import { Navigate, Outlet } from "react-router-dom";
import { FullPageSpinner } from "@/components/FullPageSpinner";
import { useCandidateAuth } from "@/features/careers/CandidateAuthContext";

// Mirrors ProtectedRoute (internal auth) but for the candidate portal — a
// separate auth system entirely (Sprint 3 HLD §3), so it can't just reuse
// that component's useAuth() call.
export function CandidateProtectedRoute() {
  const { candidate, isLoading, orgSlug } = useCandidateAuth();

  if (isLoading) {
    return <FullPageSpinner />;
  }
  if (!candidate) {
    return <Navigate to={orgSlug ? `/careers/${orgSlug}/login` : "/"} replace />;
  }

  return <Outlet />;
}
