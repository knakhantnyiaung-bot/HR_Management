import { createContext, useContext, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AUTH_TOKEN_KEY } from "@/lib/api/client";
import { fetchCurrentUser, login as loginRequest, type LoginInput } from "@/features/auth/api";
import type { CurrentUser } from "@/features/auth/types";

interface AuthContextValue {
  user: CurrentUser | undefined;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<CurrentUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(localStorage.getItem(AUTH_TOKEN_KEY)));

  const { data: user, isLoading } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchCurrentUser,
    enabled: hasToken,
    retry: false,
  });

  async function login(input: LoginInput): Promise<CurrentUser> {
    const result = await loginRequest(input);
    localStorage.setItem(AUTH_TOKEN_KEY, result.token);
    setHasToken(true);
    const currentUser = await queryClient.fetchQuery({
      queryKey: ["auth", "me"],
      queryFn: fetchCurrentUser,
    });
    return currentUser;
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setHasToken(false);
    queryClient.removeQueries({ queryKey: ["auth", "me"] });
  }

  return (
    <AuthContext.Provider value={{ user, isLoading: hasToken && isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
