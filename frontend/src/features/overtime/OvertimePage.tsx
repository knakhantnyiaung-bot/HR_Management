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
        <h1 className="page-title">Overtime</h1>
        <p className="page-subtitle">
          Requests, approval, and payable hours.
        </p>
      </div>

      {user?.employee && <MyOvertimeRequests employeeId={user.employee.id} />}
      {isHrRole && <HrOvertimeRequests />}
    </div>
  );
}
