import { useAuth } from "@/features/auth/AuthContext";
import { CourseCatalog } from "@/features/courses/CourseCatalog";
import { HrCoursesAdmin } from "@/features/courses/HrCoursesAdmin";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function CoursesPage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Learning</h1>
        <p className="page-subtitle">Course catalog and completion tracking.</p>
      </div>

      {user?.employee && <CourseCatalog />}
      {isHrRole && <HrCoursesAdmin />}
    </div>
  );
}
