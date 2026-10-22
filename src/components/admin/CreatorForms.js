"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FiCamera, FiUser } from "react-icons/fi";
import { Field, FormError, FormNotice, inputClass, primaryButton } from "../forms";

async function sendForm(url, formData) {
  const res = await fetch(url, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

function TierChoice({ value, onChange }) {
  const options = [
    { value: "free", label: "Free", hint: "Anyone can see" },
    { value: "vip", label: "VIP", hint: "Blurred unless VIP" },
  ];
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold">Free or VIP</legend>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className={`cursor-pointer rounded-xl border px-3.5 py-2.5 ${
              value === o.value
                ? o.value === "vip"
                  ? "border-gold bg-gold/10"
                  : "border-fg/70 bg-raised"
                : "border-line hover:border-muted"
            }`}
          >
            <input
              type="radio"
              name="tier"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            <span className={`block font-bold ${o.value === "vip" ? "text-gold" : ""}`}>{o.label}</span>
            <span className="block text-xs text-muted">{o.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CreateCreatorForm({ storageReady }) {
  const router = useRouter();
  const formRef = useRef(null);
  const [tier, setTier] = useState("free");
  const [preview, setPreview] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  async function onSubmit(e) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const { creator } = await sendForm("/api/admin/creators", new FormData(e.currentTarget));
      formRef.current?.reset();
      setTier("free");
      setPreview(null);
      setNotice(`Created ${creator.name}. Their profile is live.`);
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="grid gap-5 sm:grid-cols-[auto_1fr]">
      <label className="group relative grid aspect-[3/4] w-32 cursor-pointer place-items-center overflow-hidden rounded-2xl border border-dashed border-line bg-ink/40 hover:border-muted">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1.5 px-2 text-center text-xs text-muted">
            <FiUser aria-hidden className="size-7" />
            {storageReady ? "Add profile picture" : "Pictures need R2"}
          </span>
        )}
        <input
          type="file"
          name="avatar"
          accept="image/*"
          disabled={!storageReady}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
        />
      </label>

      <div className="space-y-4">
        <Field label="Creator name">
          <input name="name" required maxLength={60} placeholder="e.g. Ava Monroe" className={inputClass} />
        </Field>
        <TierChoice value={tier} onChange={setTier} />
        <FormError message={error} />
        <FormNotice message={notice} />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Creating…" : "Create creator"}
        </button>
      </div>
    </form>
  );
}

export function ChangePhotoButton({ creatorId, disabled }) {
  const router = useRouter();
  const [state, setState] = useState("idle");

  async function onChange(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setState("saving");
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      await sendForm(`/api/admin/creators/${creatorId}/avatar`, fd);
      setState("idle");
      router.refresh();
    } catch (err) {
      setState("idle");
      alert(err.message);
    }
  }

  return (
    <label
      className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold hover:border-muted ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
      title={disabled ? "Connect R2 storage to change pictures" : "Change profile picture"}
    >
      <FiCamera aria-hidden />
      {state === "saving" ? "Saving…" : "Photo"}
      <input type="file" accept="image/*" className="sr-only" disabled={disabled} onChange={onChange} />
    </label>
  );
}
