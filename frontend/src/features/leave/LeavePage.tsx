import { useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { MyLeaveRequests } from "@/features/leave/MyLeaveRequests";
import { HrLeaveRequests } from "@/features/leave/HrLeaveRequests";
import { LeaveBalancesAdmin } from "@/features/leave/LeaveBalancesAdmin";
import { LeaveTypesAdmin } from "@/features/leave/LeaveTypesAdmin";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);
const TABS = ["Requests", "Balances", "Types"] as const;
type Tab = (typeof TABS)[number];

export function LeavePage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));
  const [tab, setTab] = useState<Tab>("Requests");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Leave</h1>
        <p className="page-subtitle">
          Types, balances, requests, and approvals.
        </p>
      </div>

      {user?.employee && <MyLeaveRequests employeeId={user.employee.id} />}

      {isHrRole && (
        <div>
          <div className="border-b border-slate-200 dark:border-slate-800">
            <nav className="-mb-px flex gap-6">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                    tab === t
                      ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </nav>
          </div>
          <div className="mt-4">
            {tab === "Requests" && <HrLeaveRequests />}
            {tab === "Balances" && <LeaveBalancesAdmin />}
            {tab === "Types" && <LeaveTypesAdmin />}
          </div>
        </div>
      )}
    </div>
  );
}
