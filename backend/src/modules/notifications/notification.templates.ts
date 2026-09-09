// Handbook Sec 7 event catalog. A small in-code template map rather than
// the HLD's HR-editable NotificationTemplate database table — editable
// templates are a nice-to-have in the HLD, not a rule (NOTIF-01..07), and
// keeping them in code keeps Sprint 2 shippable. Swapping to DB-backed
// templates later only touches this file's lookup, not the emitter/queue.
export type NotificationEventType =
  | "leave.request.submitted"
  | "leave.request.decided"
  | "overtime.request.decided"
  | "payroll.run.released"
  | "expense.claim.decided"
  | "expense.claim.reimbursed"
  | "recruitment.interview.scheduled"
  | "recruitment.offer.responded";

export interface RenderedNotification {
  title: string;
  // Shown in the in-app inbox — may include operational detail.
  inAppMessage: string;
  // NOTIF-04 — never includes salary, expense amounts, or GPS coordinates;
  // always a generic link-back prompt.
  emailBody: string;
  // NOTIF-08..13 — same NOTIF-04 content rule as emailBody, additionally
  // capped at 160 chars (a single SMS segment).
  smsBody: string;
}

type TemplateFn = (payload: Record<string, unknown>) => RenderedNotification;

function str(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

const TEMPLATES: Record<NotificationEventType, TemplateFn> = {
  "leave.request.submitted": (p) => ({
    title: "New leave request",
    inAppMessage: `${str(p, "employeeName")} requested ${str(p, "leaveTypeName")} from ${str(p, "startDate")} to ${str(p, "endDate")}.`,
    emailBody: "A new leave request is waiting for your review. Open the app to respond.",
    smsBody: "A new leave request is waiting for your review. Open the app to respond.",
  }),
  "leave.request.decided": (p) => ({
    title: "Leave request decided",
    inAppMessage: `Your ${str(p, "leaveTypeName")} request (${str(p, "startDate")} to ${str(p, "endDate")}) was ${str(p, "status").toLowerCase()}.`,
    emailBody: "One of your leave requests has been decided. Open the app to see the result.",
    smsBody: "One of your leave requests has been decided. Open the app to see the result.",
  }),
  "overtime.request.decided": (p) => ({
    title: "Overtime request decided",
    inAppMessage: `Your overtime request for ${str(p, "workDate")} was ${str(p, "status").toLowerCase()}.`,
    emailBody: "One of your overtime requests has been decided. Open the app to see the result.",
    smsBody: "One of your overtime requests has been decided. Open the app to see the result.",
  }),
  "payroll.run.released": (p) => ({
    title: "Payslip available",
    inAppMessage: `Your payslip for ${str(p, "period")} is now available.`,
    emailBody: "A new payslip is available. Open the app to view it.",
    smsBody: "A new payslip is available. Open the app to view it.",
  }),
  "expense.claim.decided": (p) => ({
    title: "Expense claim decided",
    inAppMessage: `Your ${str(p, "categoryName")} expense claim was ${str(p, "status").toLowerCase()}.`,
    emailBody: "One of your expense claims has been decided. Open the app to see the result.",
    smsBody: "One of your expense claims has been decided. Open the app to see the result.",
  }),
  "expense.claim.reimbursed": (p) => ({
    title: "Expense claim reimbursed",
    inAppMessage: `Your ${str(p, "categoryName")} expense claim has been reimbursed.`,
    emailBody: "One of your expense claims has been reimbursed. Open the app to see the result.",
    smsBody: "One of your expense claims has been reimbursed. Open the app to see the result.",
  }),
  "recruitment.interview.scheduled": (p) => ({
    title: "Interview scheduled",
    inAppMessage: `An interview with ${str(p, "candidateName")} is scheduled for ${str(p, "scheduledAt")}.`,
    emailBody: "You have a new interview on your recruitment pipeline. Open the app for details.",
    smsBody: "You have a new interview on your recruitment pipeline. Open the app for details.",
  }),
  "recruitment.offer.responded": (p) => ({
    title: "Offer response received",
    inAppMessage: `${str(p, "candidateName")} ${str(p, "status").toLowerCase()} the offer.`,
    emailBody: "A candidate has responded to an offer. Open the app for details.",
    smsBody: "A candidate has responded to an offer. Open the app for details.",
  }),
};

export function renderNotification(
  eventType: string,
  payload: Record<string, unknown>,
): RenderedNotification {
  const template = TEMPLATES[eventType as NotificationEventType];
  if (!template) {
    return {
      title: "Notification",
      inAppMessage: "You have a new notification. Open the app for details.",
      emailBody: "You have a new notification. Open the app for details.",
      smsBody: "You have a new notification. Open the app for details.",
    };
  }
  return template(payload);
}
