import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { getApiErrorMessage } from "@/lib/api/client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      const isHrRole = user.role === "HR_ADMIN" || user.role === "SUPER_ADMIN";
      navigate(isHrRole ? "/dashboard" : "/me", { replace: true });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <form
        onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">
          HR &amp; Payroll Platform
        </h1>

        <label
          className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
          htmlFor="email"
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          {...register("email")}
        />
        {errors.email && (
          <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{errors.email.message}</p>
        )}

        <label
          className="mb-1 mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300"
          htmlFor="password"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          className="mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          {...register("password")}
        />
        {errors.password && (
          <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">{errors.password.message}</p>
        )}

        {loginMutation.isError && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {getApiErrorMessage(loginMutation.error, "Login failed. Check your credentials.")}
          </p>
        )}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="mt-4 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
