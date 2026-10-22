"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createMemberAction } from "@/app/admin/actions";
import { Field, FormError, FormNotice, inputClass, primaryButton } from "../forms";

function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export default function MemberForm() {
  const [state, formAction, pending] = useActionState(createMemberAction, { error: null, ok: null });
  const formRef = useRef(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setPassword("");
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end">
      <Field label="Username">
        <input
          name="username"
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z0-9_.]+"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={inputClass}
        />
      </Field>
      <Field label="Password">
        <div className="flex gap-2">
          <input
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} font-mono`}
          />
          <button
            type="button"
            onClick={() => setPassword(randomPassword())}
            className="h-11 shrink-0 rounded-xl border border-line px-3 text-sm font-semibold hover:border-muted"
          >
            Generate
          </button>
        </div>
      </Field>
      <Field label="VIP until (optional)">
        <input name="vipUntil" type="date" className={`${inputClass} [color-scheme:dark]`} />
      </Field>
      <button type="submit" disabled={pending} className={primaryButton}>
        {pending ? "Adding…" : "Add VIP member"}
      </button>
      <div className="md:col-span-4">
        <FormError message={state.error} />
        <FormNotice message={state.ok} />
      </div>
    </form>
  );
}
