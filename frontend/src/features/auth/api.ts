import { apiClient, type ApiSuccess } from "@/lib/api/client";
import type { AuthUser, CurrentUser } from "@/features/auth/types";

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const res = await apiClient.post<ApiSuccess<LoginResult>>("/auth/login", input);
  return res.data.data;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await apiClient.get<ApiSuccess<CurrentUser>>("/auth/me");
  return res.data.data;
}

// NOTIF-08..13 — self-service SMS delivery target. Pass null to clear it.
export async function updateCurrentUser(phoneNumber: string | null): Promise<CurrentUser> {
  const res = await apiClient.patch<ApiSuccess<CurrentUser>>("/auth/me", { phoneNumber });
  return res.data.data;
}
