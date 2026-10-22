"use client";

import { useFormStatus } from "react-dom";

/** A submit button that asks "are you sure?" first. Put it inside a <form>. */
export default function ConfirmButton({ message, children, className = "", pendingLabel = "Working…", ...props }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
      className={className}
      {...props}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
