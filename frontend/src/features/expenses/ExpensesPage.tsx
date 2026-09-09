import { useAuth } from "@/features/auth/AuthContext";
import { MyExpenses } from "@/features/expenses/MyExpenses";
import { HrExpenseApprovals } from "@/features/expenses/HrExpenseApprovals";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function ExpensesPage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Expenses</h1>
        <p className="page-subtitle">Claim submission, approval, and payroll reimbursement.</p>
      </div>

      {user?.employee && <MyExpenses employeeId={user.employee.id} />}
      {isHrRole && <HrExpenseApprovals />}
    </div>
  );
}
