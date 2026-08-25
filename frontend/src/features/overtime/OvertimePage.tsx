import { useAuth } from "@/features/auth/AuthContext";
import { MyOvertimeRequests } from "@/features/overtime/MyOvertimeRequests";
import { HrOvertimeRequests } from "@/features/overtime/HrOvertimeRequests";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function OvertimePage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Overtime</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Requests, approval, and payable hours.
        </p>
      </div>

      {user?.employee && <MyOvertimeRequests employeeId={user.employee.id} />}
      {isHrRole && <HrOvertimeRequests />}
    </div>
  );
}
