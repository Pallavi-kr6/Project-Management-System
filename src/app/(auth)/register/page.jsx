"use client";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";
import { api, ApiClientError, fieldErrors } from "@/lib/api/client";
import { zodFieldErrors } from "@/lib/forms";
import { registerSchema } from "@/validations/auth";
export default function RegisterPage() {
    const [values, setValues] = useState({ fullName: "", email: "", password: "", confirm: "" });
    const [errors, setErrors] = useState({});
    const [formError, setFormError] = useState(null);
    const [loading, setLoading] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState(null);
    async function onSubmit(e) {
        e.preventDefault();
        setFormError(null);
        const parsed = registerSchema.safeParse({ fullName: values.fullName, email: values.email, password: values.password });
        const next = parsed.success ? {} : zodFieldErrors(parsed.error);
        if (values.password !== values.confirm)
            next.confirm = "Passwords do not match";
        if (Object.keys(next).length > 0)
            return setErrors(next);
        if (!parsed.success)
            return;
        setErrors({});
        setLoading(true);
        try {
            const { data } = await api.auth.register(parsed.data);
            if (data.requiresEmailConfirmation) {
                setConfirmEmail(parsed.data.email);
                setLoading(false);
            }
            else {
                window.location.assign("/dashboard");
            }
        }
        catch (err) {
            setErrors(fieldErrors(err));
            setFormError(err instanceof ApiClientError ? err.message : "Could not create the account. Please try again.");
            setLoading(false);
        }
    }
    if (confirmEmail) {
        return (<div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-6 w-6"/>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Check your email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We sent a confirmation link to <span className="font-medium text-foreground">{confirmEmail}</span>. Open it, then sign in.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Go to sign in
        </Link>
      </div>);
    }
    return (<div>
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1 text-sm text-muted-foreground">Start organising your projects in minutes.</p>

      {formError && (<p role="alert" className="mt-5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>)}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Full name" error={errors.fullName}>
          {(p) => <Input {...p} autoComplete="name" value={values.fullName} onChange={(e) => setValues({ ...values, fullName: e.target.value })}/>}
        </Field>
        <Field label="Email" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} placeholder="you@example.com"/>}
        </Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number.">
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })}/>}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={values.confirm} onChange={(e) => setValues({ ...values, confirm: e.target.value })}/>}
        </Field>
        <Button type="submit" className="w-full" loading={loading}>
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>);
}
