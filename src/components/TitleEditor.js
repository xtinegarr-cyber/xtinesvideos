"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { FiCheck } from "react-icons/fi";
import { setMediaTitleAction } from "@/app/admin/actions";
import { FormError, inputClass } from "./forms";
import { TITLE_MAX } from "@/lib/format";

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex h-11 shrink-0 items-center rounded-full bg-fg px-5 text-sm font-bold text-ink disabled:opacity-60">
      {pending ? "Saving…" : "Save title"}
    </button>
  );
}

/** Admins only: rename a video right on its page (photos don't have titles). */
export default function TitleEditor({ mediaId, title, placeholder }) {
  const [state, action] = useActionState(setMediaTitleAction, null);
  return (
    <form action={action} className="mt-4 rounded-2xl border border-line bg-panel/80 p-4">
      <input type="hidden" name="mediaId" value={mediaId} />
      <label className="block text-sm font-semibold" htmlFor={`title-${mediaId}`}>
        Title <span className="font-normal text-muted">(admins only; shown to visitors and search engines)</span>
      </label>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          id={`title-${mediaId}`}
          name="title"
          defaultValue={title ?? ""}
          maxLength={TITLE_MAX}
          placeholder={`No title yet (shows as “${placeholder}”)`}
          className={inputClass}
        />
        <Save />
      </div>
      {state?.saved && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-sm text-[#9be4b8]">
          <FiCheck aria-hidden /> {state.title ? "Saved." : "Title removed."}
        </p>
      )}
      <FormError message={state?.error} />
    </form>
  );
}
