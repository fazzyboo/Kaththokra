import Link from "next/link";
import { cn } from "@/lib/cn";

/** Woodpecker head mark: ink head, red crest, long beak pointing at the trunk. */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className={className} aria-hidden="true">
      <circle cx="17" cy="22" r="10.5" fill="var(--color-ink)" />
      <path d="M8.5 16.5C8.6 9.6 14.6 5.2 22.5 6.6 19.4 8 17.6 10.2 16.8 12.6 13.6 12.7 10.6 14.2 8.5 16.5Z" fill="var(--color-crest)" />
      <path d="M25.6 18.6 39 21.8 25.8 25.2Z" fill="var(--color-bark)" />
      <path d="M9 25.5c3.4 2.1 8.6 2.4 13.4.4" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <circle cx="20.6" cy="19.6" r="2" fill="#fff" />
      <circle cx="21" cy="19.6" r="1" fill="var(--color-ink)" />
    </svg>
  );
}

export function Wordmark({ className, href = "/", sub }: { className?: string; href?: string; sub?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="কাঠঠোকরা — Kaththokra">
      <Mark size={34} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.35rem] leading-none text-ink">কাঠঠোকরা</span>
        {sub ? <span className="mt-1 text-[0.7rem] text-ink-3">{sub}</span> : null}
      </span>
    </Link>
  );
}
