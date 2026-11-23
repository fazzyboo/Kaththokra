import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger" | "dark";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-leaf-600 text-white hover:bg-leaf-700 active:bg-leaf-800 disabled:bg-line-2 disabled:text-ink-3",
  secondary: "bg-paper text-ink border border-line-2 hover:border-ink-3 active:bg-mist disabled:text-ink-3",
  soft: "bg-leaf-50 text-leaf-800 hover:bg-leaf-100 disabled:text-ink-3",
  ghost: "text-ink-2 hover:bg-mist hover:text-ink",
  danger: "bg-paper text-alarm border border-alarm/30 hover:bg-alarm-50",
  dark: "bg-ink text-white hover:bg-leaf-900",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-12 px-5 text-base gap-2 rounded-xl",
  lg: "h-14 px-6 text-lg gap-2.5 rounded-xl",
};

type Common = {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
};

function classes({ variant = "primary", size = "md", block, className }: Common) {
  return cn(
    "inline-flex select-none items-center justify-center font-medium transition-colors disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

function Inner({ icon, iconRight, loading, size = "md", children }: Common) {
  const s = size === "sm" ? 16 : size === "lg" ? 22 : 20;
  return (
    <>
      {loading ? <Spinner size={s} /> : icon ? <Icon name={icon} size={s} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={s} /> : null}
    </>
  );
}

export function Button(props: Common & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  const { variant, size, icon, iconRight, block, loading, className, children, disabled, type, ...rest } = props;
  return (
    <button
      type={type ?? "button"}
      className={classes({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Inner icon={icon} iconRight={iconRight} loading={loading} size={size}>
        {children}
      </Inner>
    </button>
  );
}

export function LinkButton(props: Common & { href: string; onClick?: () => void }) {
  const { href, variant, size, icon, iconRight, block, className, children, onClick } = props;
  const isExternal = href.startsWith("tel:") || href.startsWith("sms:") || href.startsWith("http");
  if (isExternal) {
    return (
      <a href={href} className={classes({ variant, size, block, className })} onClick={onClick}>
        <Inner icon={icon} iconRight={iconRight} size={size}>
          {children}
        </Inner>
      </a>
    );
  }
  return (
    <Link href={href} className={classes({ variant, size, block, className })} onClick={onClick}>
      <Inner icon={icon} iconRight={iconRight} size={size}>
        {children}
      </Inner>
    </Link>
  );
}

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={cn("animate-spin", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
