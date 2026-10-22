"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { claimAccountAction, startCheckoutAction } from "@/app/vip/actions";
import { Field, FormError, inputClass } from "./forms";

function CheckoutSubmit({ children, className }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn-vip ${className}`}>
      {pending ? "Opening checkout…" : children}
    </button>
  );
}

/**
 * Every "Get VIP" button on the site. One click takes the visitor to
 * Stripe's checkout; they create their account after paying.
 */
export function GetVipButton({ children = "Get VIP", className = "h-12 px-7", formClassName = "" }) {
  return (
    <form action={startCheckoutAction} className={formClassName}>
      <CheckoutSubmit className={className}>{children}</CheckoutSubmit>
    </form>
  );
}

/** Shown after a successful payment: the buyer picks their login. */
export function ClaimForm({ sessionId, email = "" }) {
  const [state, formAction, pending] = useActionState(claimAccountAction, { error: null, email });
  return (
    <form action={formAction} className="space-y-4 text-left">
      <input type="hidden" name="sessionId" value={sessionId} />
      <Field label="Email" hint="You’ll log in with this.">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          className={inputClass}
        />
      </Field>
      <Field label="Password" hint="At least 8 characters.">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <FormError message={state.error} />
      <button type="submit" disabled={pending} className="btn-vip h-12 w-full px-6">
        {pending ? "Creating your account…" : "Create account and start watching"}
      </button>
    </form>
  );
}
