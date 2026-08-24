import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiClient, type ApiSuccess } from "@/lib/api/client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

interface LoginResponse {
  token: string;
  user: { id: string; email: string; role: string };
}

export function LoginPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: async (input: LoginForm) => {
      const res = await apiClient.post<ApiSuccess<LoginResponse>>("/auth/login", input);
      return res.data.data;
    },
    onSuccess: (data) => {
      localStorage.setItem("auth_token", data.token);
      window.location.href = "/dashboard";
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <form
        onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="mb-6 text-xl font-semibold text-slate-900">
          HR &amp; Payroll Platform
        </h1>

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("email")}
        />
        {errors.email && <p className="mb-2 text-xs text-red-600">{errors.email.message}</p>}

        <label className="mb-1 mt-3 block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          {...register("password")}
        />
        {errors.password && (
          <p className="mb-2 text-xs text-red-600">{errors.password.message}</p>
        )}

        {loginMutation.isError && (
          <p className="mt-2 text-xs text-red-600">Login failed. Check your credentials.</p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
