import axios from "axios";

// Sprint 3 HLD §3 — candidate identity is fully separate from internal
// auth: its own token, its own storage key, its own axios instance. Reusing
// apiClient (and AUTH_TOKEN_KEY) would mean an HR Admin and a candidate
// signed in on the same browser fight over one token slot.
export const CANDIDATE_TOKEN_KEY = "candidate_auth_token";

export const candidateApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api/v1",
});

candidateApiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(CANDIDATE_TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

candidateApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(CANDIDATE_TOKEN_KEY);
    }
    return Promise.reject(error);
  },
);
