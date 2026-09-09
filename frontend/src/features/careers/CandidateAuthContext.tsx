import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CANDIDATE_TOKEN_KEY } from "@/lib/api/candidateClient";
import { fetchCandidateMe } from "@/features/careers/candidateApi";
import type { CandidateAuthResult } from "@/features/careers/api";
import type { CandidateMe } from "@/features/careers/types";

// The org's careers slug the candidate authenticated through — persisted
// alongside the token so an expired-session redirect (CandidateProtectedRoute)
// can send them back to the right org's login page. Not part of the JWT
// itself (candidate-portal routes are org-scoped via the token's
// organizationId claim, not this).
const CANDIDATE_ORG_SLUG_KEY = "candidate_org_slug";

interface CandidateAuthContextValue {
  candidate: CandidateMe | undefined;
  isLoading: boolean;
  orgSlug: string | null;
  setSession: (orgSlug: string, result: CandidateAuthResult) => void;
  logout: () => void;
}

const CandidateAuthContext = createContext<CandidateAuthContextValue | null>(null);

export function CandidateAuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem(CANDIDATE_TOKEN_KEY)));
  const [orgSlug, setOrgSlug] = useState<string | null>(() =>
    localStorage.getItem(CANDIDATE_ORG_SLUG_KEY),
  );

  const { data: candidate, isLoading } = useQuery({
    queryKey: ["candidate-portal", "me"],
    queryFn: fetchCandidateMe,
    enabled: hasToken,
    retry: false,
  });

  function setSession(slug: string, result: CandidateAuthResult) {
    localStorage.setItem(CANDIDATE_TOKEN_KEY, result.token);
    localStorage.setItem(CANDIDATE_ORG_SLUG_KEY, slug);
    setOrgSlug(slug);
    setHasToken(true);
    queryClient.invalidateQueries({ queryKey: ["candidate-portal", "me"] });
  }

  function logout() {
    localStorage.removeItem(CANDIDATE_TOKEN_KEY);
    setHasToken(false);
    queryClient.removeQueries({ queryKey: ["candidate-portal"] });
  }

  return (
    <CandidateAuthContext.Provider
      value={{ candidate, isLoading: hasToken && isLoading, orgSlug, setSession, logout }}
    >
      {children}
    </CandidateAuthContext.Provider>
  );
}

export function useCandidateAuth(): CandidateAuthContextValue {
  const ctx = useContext(CandidateAuthContext);
  if (!ctx) {
    throw new Error("useCandidateAuth must be used within a CandidateAuthProvider");
  }
  return ctx;
}
