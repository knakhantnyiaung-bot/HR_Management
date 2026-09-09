import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "@/lib/api/client";
import { loginCandidate, registerCandidate } from "@/features/careers/api";
import { useCandidateAuth } from "@/features/careers/CandidateAuthContext";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Must be at least 8 characters"),
  fullName: z.string().min(1, "Required"),
  phone: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

// CAREER-03/04 — one component, two modes, matching how small this form
// pair is; avoids two near-duplicate route components.
export function CareersAuthPage({ mode }: { mode: "login" | "register" }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/candidate-portal";
  const navigate = useNavigate();
  const { setSession } = useCandidateAuth();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const registerForm = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const loginMutation = useMutation({
    mutationFn: (values: LoginForm) => loginCandidate(orgSlug!, values),
    onSuccess: (result) => {
      setSession(orgSlug!, result);
      navigate(redirect, { replace: true });
    },
  });

  const registerMutation = useMutation({
    mutationFn: (values: RegisterForm) => registerCandidate(orgSlug!, values),
    onSuccess: (result) => {
      setSession(orgSlug!, result);
      navigate(redirect, { replace: true });
    },
  });

  const otherModeHref =
    mode === "login"
      ? `/careers/${orgSlug}/register?redirect=${encodeURIComponent(redirect)}`
      : `/careers/${orgSlug}/login?redirect=${encodeURIComponent(redirect)}`;

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          {mode === "login" ? "Candidate sign in" : "Create your candidate account"}
        </h1>
        <p className="page-subtitle">
          {mode === "login" ? (
            <>
              New here?{" "}
              <Link to={otherModeHref} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Create an account
              </Link>
            </>
          ) : (
            <>
              Already applied?{" "}
              <Link to={otherModeHref} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                Sign in
              </Link>
            </>
          )}
        </p>

        {mode === "login" ? (
          <form
            onSubmit={loginForm.handleSubmit((values) => loginMutation.mutate(values))}
            className="mt-6 space-y-3"
          >
            <div>
              <label className="label-field">Email</label>
              <input type="email" className="input-field-inset w-full" {...loginForm.register("email")} />
              {loginForm.formState.errors.email && (
                <p className="field-error-text">{loginForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="label-field">Password</label>
              <input
                type="password"
                className="input-field-inset w-full"
                {...loginForm.register("password")}
              />
              {loginForm.formState.errors.password && (
                <p className="field-error-text">{loginForm.formState.errors.password.message}</p>
              )}
            </div>
            {loginMutation.isError && (
              <p className="field-error-text">
                {getApiErrorMessage(loginMutation.error, "Sign in failed. Check your credentials.")}
              </p>
            )}
            <button type="submit" disabled={loginMutation.isPending} className="btn-primary w-full">
              {loginMutation.isPending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : (
          <form
            onSubmit={registerForm.handleSubmit((values) => registerMutation.mutate(values))}
            className="mt-6 space-y-3"
          >
            <div>
              <label className="label-field">Full name</label>
              <input className="input-field-inset w-full" {...registerForm.register("fullName")} />
              {registerForm.formState.errors.fullName && (
                <p className="field-error-text">{registerForm.formState.errors.fullName.message}</p>
              )}
            </div>
            <div>
              <label className="label-field">Email</label>
              <input
                type="email"
                className="input-field-inset w-full"
                {...registerForm.register("email")}
              />
              {registerForm.formState.errors.email && (
                <p className="field-error-text">{registerForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="label-field">Phone (optional)</label>
              <input className="input-field-inset w-full" {...registerForm.register("phone")} />
            </div>
            <div>
              <label className="label-field">Password</label>
              <input
                type="password"
                className="input-field-inset w-full"
                {...registerForm.register("password")}
              />
              {registerForm.formState.errors.password && (
                <p className="field-error-text">{registerForm.formState.errors.password.message}</p>
              )}
            </div>
            {registerMutation.isError && (
              <p className="field-error-text">
                {getApiErrorMessage(registerMutation.error, "Could not create your account.")}
              </p>
            )}
            <button type="submit" disabled={registerMutation.isPending} className="btn-primary w-full">
              {registerMutation.isPending ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
