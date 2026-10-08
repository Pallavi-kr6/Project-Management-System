import { Suspense } from "react";
import { LoginForm } from "./login-form";
export const metadata = { title: "Sign in" };
export default function LoginPage() {
    return (<Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
      <LoginForm />
    </Suspense>);
}
