import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";
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
    <div className="app-shell flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={handleSubmit((values) => loginMutation.mutate(values))}
        className="card w-full max-w-sm p-8"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm dark:from-indigo-400 dark:to-indigo-600">
          <Building2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          HR &amp; Payroll Platform
        </h1>
        <p className="page-subtitle">Sign in to continue.</p>

        <label className="label-field mt-6" htmlFor="email">
          Email
        </label>
        <input id="email" type="email" className="input-field-inset w-full" {...register("email")} />
        {errors.email && <p className="field-error-text">{errors.email.message}</p>}

        <label className="label-field mt-3" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className="input-field-inset w-full"
          {...register("password")}
        />
        {errors.password && <p className="field-error-text">{errors.password.message}</p>}

        {loginMutation.isError && (
          <p className="field-error-text">
            {getApiErrorMessage(loginMutation.error, "Login failed. Check your credentials.")}
          </p>
        )}

        <button type="submit" disabled={loginMutation.isPending} className="btn-primary mt-6 w-full">
          {loginMutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
