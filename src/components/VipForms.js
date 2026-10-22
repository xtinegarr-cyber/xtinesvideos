"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAndCheckoutAction, startCheckoutAction } from "@/app/vip/actions";
import { Field, FormError, goldButton, inputClass } from "./forms";

export function CheckoutButton({ priceLabel }) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, { error: null });
  return (
    <form action={formAction} className="space-y-3">
      <FormError message={state.error} />
      <button type="submit" disabled={pending} className={`${goldButton} w-full`}>
        {pending ? "Opening checkout…" : `Continue to payment, ${priceLabel}/month`}
      </button>
    </form>
  );
}

export function SignupForm({ priceLabel }) {
  const [state, formAction, pending] = useActionState(signupAndCheckoutAction, { error: null, username: "" });
  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted">Pick a username and password. You’ll use them to log in and watch.</p>
      <Field label="Username" hint="Lowercase letters, numbers, dots and underscores.">
        <input
          name="username"
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9_.]+"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={state.username}
          className={inputClass}
        />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <button type="submit" disabled={pending} className={`${goldButton} w-full`}>
        {pending ? "Opening checkout…" : `Create account and pay ${priceLabel}/month`}
      </button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login?next=/vip" className="font-semibold text-fg underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
