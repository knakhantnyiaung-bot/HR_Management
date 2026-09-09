import Anthropic from "@anthropic-ai/sdk";
import { env } from "@config/env";
import { AppError } from "@common/errors/AppError";
import type { AuthContext } from "@common/auth/requireAuth";
import { getEmployeeByUserId, getEmployeeById } from "@modules/employees/employees.service";
import { listLeaveBalances } from "@modules/leave/leave.service";
import { listAttendance } from "@modules/attendance/attendance.service";
import { listPayslips } from "@modules/payslips/payslips.service";
import { listExpenseClaims } from "@modules/expenses/expenses.service";
import { listAssets } from "@modules/assets/assets.service";
import { listReviews } from "@modules/performance/performance.service";
import { listEnrollments } from "@modules/courses/courses.service";
import type { ChatMessage } from "@modules/ai/ai.schema";

function assertConfigured(): void {
  if (!env.anthropicApiKey) {
    throw AppError.badRequest(
      "AI_ASSISTANT_NOT_CONFIGURED",
      "The AI HR assistant is not configured for this deployment",
    );
  }
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

// AI-02 — every read below forces requester.role to "EMPLOYEE" regardless
// of the caller's real role. These service functions all auto-restrict an
// EMPLOYEE requester to their own employeeId (the same "force-scope"
// pattern used across leave/attendance/expenses/assets/performance/
// courses); this is what stops an HR Admin asking the assistant a question
// from ever getting org-wide data back in the snapshot.
async function buildEmployeeSnapshot(organizationId: string, userId: string) {
  const selfEmployee = await getEmployeeByUserId(organizationId, userId);
  const requester = { userId, role: "EMPLOYEE" as const };

  const [profile, leaveBalances, attendance, payslips, expenseClaims, assets, reviews, enrollments] =
    await Promise.all([
      getEmployeeById(organizationId, selfEmployee.id),
      listLeaveBalances(organizationId, requester, {}),
      listAttendance(organizationId, requester, { page: 1, pageSize: 10 }),
      listPayslips(organizationId, requester, { page: 1, pageSize: 3 }),
      listExpenseClaims(organizationId, requester, { page: 1, pageSize: 10 }),
      listAssets(organizationId, requester, { page: 1, pageSize: 20 }),
      listReviews(organizationId, requester, { page: 1, pageSize: 5 }),
      listEnrollments(organizationId, requester, { page: 1, pageSize: 20 }),
    ]);

  return {
    profile: {
      employeeNo: profile.employeeNo,
      status: profile.status,
      joinDate: profile.joinDate,
      workModel: profile.workModel,
      department: profile.department.name,
      position: profile.position.title,
      email: profile.user.email,
      manager: profile.manager ? profile.manager.user.email : null,
    },
    leaveBalances,
    recentAttendance: attendance.items,
    recentPayslips: payslips.items,
    expenseClaims: expenseClaims.items,
    assignedAssets: assets.items,
    performanceReviews: reviews.items,
    courseEnrollments: enrollments.items,
  };
}

function buildSystemPrompt(snapshot: Awaited<ReturnType<typeof buildEmployeeSnapshot>>): string {
  return [
    "You are the HR assistant embedded in this company's HR & Payroll platform.",
    "You answer the employee's questions ONLY using the JSON data below, which is",
    "that employee's own HR data as of this moment. Rules:",
    "- Never invent or estimate numbers that aren't in the data.",
    "- If the data doesn't contain the answer, say so and suggest they contact HR.",
    "- You have no access to any other employee's data and must not speculate about it.",
    "- You cannot take actions (submit requests, approve anything) — you can only answer questions.",
    "- Keep answers concise and specific, citing the relevant figures from the data.",
    "",
    "EMPLOYEE DATA (JSON):",
    JSON.stringify(snapshot, null, 2),
  ].join("\n");
}

export async function chatWithAssistant(
  organizationId: string,
  requester: { userId: string; role: AuthContext["role"] },
  message: string,
  history: ChatMessage[],
): Promise<string> {
  assertConfigured();

  const snapshot = await buildEmployeeSnapshot(organizationId, requester.userId);
  const system = buildSystemPrompt(snapshot);

  const response = await getClient().messages.create({
    model: env.anthropicModel,
    max_tokens: 1024,
    system,
    messages: [...history.map((m) => ({ role: m.role, content: m.content })), { role: "user" as const, content: message }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw AppError.badRequest("AI_ASSISTANT_EMPTY_RESPONSE", "The AI assistant returned no text response");
  }

  return textBlock.text;
}
