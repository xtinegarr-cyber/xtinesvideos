"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/login/actions";
import { Field, FormError, inputClass, primaryButton } from "./forms";

export default function LoginForm({ next = "" }) {
  const [state, formAction, pending] = useActionState(loginAction, { error: null, username: "" });
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Username">
        <input
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username}
          className={inputClass}
        />
      </Field>
      <Field label="Password">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <button type="submit" disabled={pending} className={`${primaryButton} w-full`}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="pt-2 text-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/vip" className="font-semibold text-gold underline-offset-4 hover:underline">
          Get VIP
        </Link>
      </p>
    </form>
  );
}
