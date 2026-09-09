import { useAuth } from "@/features/auth/AuthContext";
import { MyAssets } from "@/features/assets/MyAssets";
import { HrAssetsAdmin } from "@/features/assets/HrAssetsAdmin";

const HR_ROLES = new Set(["HR_ADMIN", "SUPER_ADMIN"]);

export function AssetsPage() {
  const { user } = useAuth();
  const isHrRole = Boolean(user && HR_ROLES.has(user.role));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Assets</h1>
        <p className="page-subtitle">Company equipment register and assignment.</p>
      </div>

      {user?.employee && !isHrRole && <MyAssets />}
      {isHrRole && <HrAssetsAdmin />}
    </div>
  );
}
