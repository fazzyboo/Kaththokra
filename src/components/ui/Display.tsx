import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

export type Tone = "neutral" | "leaf" | "sun" | "alarm" | "crest" | "ink";

const BADGE: Record<Tone, string> = {
  neutral: "bg-mist text-ink-2",
  leaf: "bg-leaf-50 text-leaf-800",
  sun: "bg-sun-50 text-sun",
  alarm: "bg-alarm-50 text-alarm",
  crest: "bg-crest-50 text-crest",
  ink: "bg-ink text-white",
};

export function Badge({ tone = "neutral", icon, children, className }: { tone?: Tone; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.8rem] font-medium", BADGE[tone], className)}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

const NOTICE: Record<Exclude<Tone, "ink" | "crest">, { box: string; icon: IconName }> = {
  neutral: { box: "bg-mist text-ink-2", icon: "info" },
  leaf: { box: "bg-leaf-50 text-leaf-900", icon: "check" },
  sun: { box: "bg-sun-50 text-[#7a3d06]", icon: "alert" },
  alarm: { box: "bg-alarm-50 text-alarm", icon: "alert" },
};

export function Notice({
  tone = "neutral",
  title,
  children,
  icon,
  className,
}: {
  tone?: Exclude<Tone, "ink" | "crest">;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  const s = NOTICE[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl px-4 py-3.5", s.box, className)} role={tone === "alarm" ? "alert" : undefined}>
      <Icon name={icon ?? s.icon} size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 space-y-0.5 text-[0.95rem] leading-relaxed">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}

export function Panel({ children, className, as = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  const Tag = as;
  return <Tag className={cn("rounded-sheet border border-line bg-paper", className)}>{children}</Tag>;
}

export function ListRow({
  href,
  icon,
  title,
  subtitle,
  right,
  onClick,
  tone = "leaf",
}: {
  href?: string;
  icon?: IconName;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  tone?: "leaf" | "neutral" | "crest";
}) {
  const content = (
    <>
      {icon ? (
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            tone === "leaf" && "bg-leaf-50 text-leaf-700",
            tone === "neutral" && "bg-mist text-ink-2",
            tone === "crest" && "bg-crest-50 text-crest",
          )}
        >
          <Icon name={icon} size={22} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[1.02rem] font-medium text-ink">{title}</span>
        {subtitle ? <span className="block truncate text-sm text-ink-3">{subtitle}</span> : null}
      </span>
      {right ?? (href || onClick ? <Icon name="chevronRight" size={20} className="shrink-0 text-ink-3" /> : null)}
    </>
  );
  const cls = "flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors hover:bg-mist/70";
  if (href) {
    const ext = href.startsWith("tel:") || href.startsWith("sms:");
    return ext ? (
      <a href={href} className={cls}>
        {content}
      </a>
    ) : (
      <Link href={href} className={cls}>
        {content}
      </Link>
    );
  }
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {content}
      </button>
    );
  return <div className={cls}>{content}</div>;
}

export function KeyValue({ rows, className }: { rows: { k: ReactNode; v: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("divide-y divide-line", className)}>
      {rows.map((r, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="text-[0.95rem] text-ink-3">{r.k}</dt>
          <dd className="text-right text-[0.95rem] font-medium text-ink">{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-mist text-ink-3">
        <Icon name={icon} size={26} />
      </span>
      <p className="text-lg font-semibold text-ink">{title}</p>
      {body ? <p className="mt-1 max-w-xs text-[0.95rem] text-ink-3">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("mb-3 flex items-end justify-between gap-3", className)}>
      <h2 className="text-lg font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-mist", className)} />;
}

/** Steps for a real sequence (diagnose flow, payment) — numbered because order matters. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="steps">
      {steps.map((s, i) => (
        <li key={s} className="flex min-w-0 flex-1 flex-col gap-1.5" aria-current={i === current ? "step" : undefined}>
          <span className={cn("h-1 rounded-full", i <= current ? "bg-leaf-600" : "bg-line")} />
          <span className={cn("truncate text-xs", i === current ? "font-medium text-ink" : "text-ink-3")}>{s}</span>
        </li>
      ))}
    </ol>
  );
}
