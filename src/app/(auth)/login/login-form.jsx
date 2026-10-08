"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { api, ApiClientError, fieldErrors } from "@/lib/api/client";
import { safeNextPath, zodFieldErrors } from "@/lib/forms";
import { loginSchema } from "@/validations/auth";
const REASONS = {
    expired: "Your session has expired. Please sign in again.",
    signin: "Please sign in to continue.",
};
export function LoginForm() {
    const params = useSearchParams();
    const reason = REASONS[params.get("reason") ?? ""] ?? (params.get("next") ? REASONS.signin : null);
    const [values, setValues] = useState({ email: "", password: "" });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [loading, setLoading] = useState(false);
    async function onSubmit(e) {
        e.preventDefault();
        setFormError(null);
        const parsed = loginSchema.safeParse(values);
        if (!parsed.success)
            return setErrors(zodFieldErrors(parsed.error));
        setErrors({});
        setLoading(true);
        try {
            await api.auth.login(parsed.data);
            window.location.assign(safeNextPath(params.get("next"))); // full navigation: fresh cookies + clean client cache
        }
        catch (err) {
            setErrors(fieldErrors(err));
            setFormError(err instanceof ApiClientError ? err.message : "Could not sign in. Please try again.");
            setLoading(false);
        }
    }
    return (<div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your account to continue.</p>

      {reason && !formError && (<p role="status" className="mt-5 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          {reason}
        </p>)}
      {formError && (<p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>)}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="you@example.com"/>}
        </Field>
        <Field label="Password" error={errors.password}>
          {(p) => <Input {...p} type="password" autoComplete="current-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })}/>}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>);
}
