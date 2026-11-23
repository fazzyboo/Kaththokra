"use client";

import { useRef } from "react";
import type { ClipboardEvent, InputHTMLAttributes, KeyboardEvent, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[0.95rem] font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-sm text-alarm" role="alert">
          <Icon name="alert" size={16} />
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full rounded-xl border border-line-2 bg-paper px-4 text-ink placeholder:text-ink-3 focus:border-leaf-500 focus:outline-none focus:ring-4 focus:ring-leaf-100 disabled:bg-mist";

export function TextInput({ className, size = "md", ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "sm" | "md" }) {
  return <input className={cn(inputBase, size === "sm" ? "h-10 text-sm rounded-lg" : "h-12 text-base", className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputBase, "min-h-24 py-3 leading-relaxed", className)} {...rest} />;
}

export function Select({ className, children, size = "md", ...rest }: Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "sm" | "md" }) {
  return (
    <div className="relative">
      <select
        className={cn(inputBase, "appearance-none pr-10", size === "sm" ? "h-10 text-sm rounded-lg" : "h-12 text-base", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon name="chevronDown" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" />
    </div>
  );
}

/** Banglalink number input with fixed +88 prefix (SRS PAY-2). */
export function PhoneInput({
  id,
  value,
  onChange,
  invalid,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-14 items-center overflow-hidden rounded-xl border bg-paper focus-within:ring-4",
        invalid ? "border-alarm focus-within:ring-alarm-50" : "border-line-2 focus-within:border-leaf-500 focus-within:ring-leaf-100",
      )}
    >
      <span className="flex h-full items-center border-r border-line bg-mist px-3 text-base text-ink-2">+88</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="019XXXXXXXX"
        maxLength={11}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9০-৯]/g, ""))}
        className="h-full w-full bg-transparent px-3 text-xl tracking-wider text-ink placeholder:text-ink-3/60 focus:outline-none"
        aria-invalid={invalid || undefined}
      />
    </div>
  );
}

/** Six single-digit boxes; supports paste and backspace navigation. */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  invalid,
  autoFocus,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.split("");

  const setAt = (i: number, ch: string) => {
    const next = value.padEnd(length, " ").split("");
    next[i] = ch;
    onChange(next.join("").replace(/\s+$/, "").replace(/\s/g, ""));
  };

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (digits) {
      e.preventDefault();
      onChange(digits);
      refs.current[Math.min(digits.length, length - 1)]?.focus();
    }
  };

  return (
    <div role="group" aria-label={label} className="flex justify-between gap-2">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`${label} ${i + 1}`}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={chars[i] ?? ""}
          onPaste={onPaste}
          onKeyDown={(e) => onKey(i, e)}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, ch);
            if (ch && i < length - 1) refs.current[i + 1]?.focus();
          }}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border bg-paper text-center text-2xl font-semibold text-ink focus:outline-none focus:ring-4 disabled:bg-mist",
            invalid ? "border-alarm focus:ring-alarm-50" : "border-line-2 focus:border-leaf-500 focus:ring-leaf-100",
          )}
        />
      ))}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[0.95rem] text-ink-2">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-leaf-600"
      />
      <span>{children}</span>
    </label>
  );
}

/** Pill toggle used for multi-select (crops, upazilas). */
export function Chip({
  selected,
  onClick,
  children,
  size = "md",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
        size === "sm" ? "h-8 px-3 text-sm" : "h-11 px-4 text-base",
        selected ? "border-leaf-600 bg-leaf-600 text-white" : "border-line-2 bg-paper text-ink-2 hover:border-ink-3",
      )}
    >
      {selected ? <Icon name="check" size={size === "sm" ? 14 : 18} /> : null}
      {children}
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  size?: "sm" | "md";
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-xl bg-mist p-1", size === "sm" && "rounded-lg")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-lg font-medium transition-colors",
            size === "sm" ? "h-7 px-2.5 text-xs rounded-md" : "h-10 px-4 text-sm",
            value === o.value ? "bg-paper text-ink shadow-[0_1px_2px_rgba(16,38,28,0.12)]" : "text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
