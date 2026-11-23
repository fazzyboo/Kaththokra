"use client";

import { useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/cn";

/*
  Small hand-built SVG charts (no chart library, keeps the bundle small).
  Rules followed: one y-axis, thin marks, recessive grid, legend for ≥ 2 series plus
  direct end labels, hover tooltip on every chart, text in ink colours not series colours.
*/

export type Series = { name: string; values: number[]; color: string };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

function Tooltip({ pct, children }: { pct: number; children: ReactNode }) {
  const left = `clamp(72px, ${pct.toFixed(2)}%, calc(100% - 72px))`;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg border border-line bg-paper px-3 py-2 text-xs shadow-[0_8px_24px_-12px_rgba(16,38,28,0.35)]"
      style={{ left }}
    >
      {children}
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((i) => (
        <li key={i.name} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded" style={{ background: i.color }} />
          {i.name}
        </li>
      ))}
    </ul>
  );
}

export function LineChart({
  series,
  labels,
  height = 220,
  format = (v: number) => String(v),
}: {
  series: Series[];
  labels: string[];
  height?: number;
  format?: (v: number) => string;
}) {
  const W = 640;
  const pad = { l: 36, r: 76, t: 12, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const max = niceMax(Math.max(...series.flatMap((s) => s.values)));
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / (n - 1);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const ticks = [0, max / 2, max];

  const onMove = (e: MouseEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * (W - pad.l - pad.r);
    setHover(Math.max(0, Math.min(n - 1, Math.round((rel / (W - pad.l - pad.r)) * (n - 1)))));
  };

  return (
    <div className="relative overflow-x-auto">
      {hover !== null ? (
        <Tooltip pct={(x(hover) / W) * 100}>
          <p className="mb-1 font-medium text-ink">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.name} className="flex items-center gap-1.5 text-ink-2">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              {s.name}: <span className="font-medium text-ink">{format(s.values[hover])}</span>
            </p>
          ))}
        </Tooltip>
      ) : null}
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full min-w-[540px]" role="img" aria-label={series.map((s) => s.name).join(", ")}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          (i % 3 === 0 && i < n - 2) || i === n - 1 ? (
            <text key={l} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
              {l}
            </text>
          ) : null,
        )}
        {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--color-ink-3)" strokeDasharray="3 3" /> : null}
        {series.map((s) => (
          <g key={s.name}>
            <path
              d={s.values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={x(n - 1)} cy={y(s.values[n - 1])} r={4} fill={s.color} stroke="var(--color-paper)" strokeWidth={2} />
            <text x={x(n - 1) + 9} y={y(s.values[n - 1]) + 4} fontSize="11.5" fill="var(--color-ink-2)">
              {s.name}
            </text>
            {hover !== null ? <circle cx={x(hover)} cy={y(s.values[hover])} r={4} fill={s.color} stroke="var(--color-paper)" strokeWidth={2} /> : null}
          </g>
        ))}
        <rect x={pad.l} y={pad.t} width={W - pad.l - pad.r} height={height - pad.t - pad.b} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>
    </div>
  );
}

export function BarChart({
  values,
  labels,
  height = 200,
  color = "var(--color-leaf-500)",
  highlightLast = true,
  format = (v: number) => String(v),
  name,
}: {
  values: number[];
  labels: string[];
  height?: number;
  color?: string;
  highlightLast?: boolean;
  format?: (v: number) => string;
  name: string;
}) {
  const W = 640;
  const pad = { l: 44, r: 8, t: 10, b: 26 };
  const [hover, setHover] = useState<number | null>(null);
  const n = values.length;
  const max = niceMax(Math.max(...values));
  const slot = (W - pad.l - pad.r) / n;
  const bw = Math.min(28, slot - 6);
  const y = (v: number) => pad.t + (1 - v / max) * (height - pad.t - pad.b);
  const base = height - pad.b;

  return (
    <div className="relative overflow-x-auto">
      {hover !== null ? (
        <Tooltip pct={((pad.l + slot * hover + slot / 2) / W) * 100}>
          <p className="font-medium text-ink">{labels[hover]}</p>
          <p className="text-ink-2">
            {name}: <span className="font-medium text-ink">{format(values[hover])}</span>
          </p>
        </Tooltip>
      ) : null}
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full min-w-[540px]" role="img" aria-label={name} onMouseLeave={() => setHover(null)}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-3)">
              {format(t)}
            </text>
          </g>
        ))}
        {values.map((v, i) => {
          const cx = pad.l + slot * i + slot / 2;
          const top = y(v);
          const h = Math.max(1, base - top);
          const r = Math.min(4, h);
          const dim = highlightLast && i !== n - 1 && hover !== i;
          return (
            <g key={i}>
              <path
                d={`M${cx - bw / 2} ${base}V${top + r}q0 -${r} ${r} -${r}h${bw - 2 * r}q${r} 0 ${r} ${r}V${base}z`}
                fill={color}
                opacity={dim ? 0.45 : 1}
              />
              {(i % 3 === 0 && i < n - 2) || i === n - 1 ? (
                <text x={cx} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">
                  {labels[i]}
                </text>
              ) : null}
              <rect x={pad.l + slot * i} y={pad.t} width={slot} height={base - pad.t} fill="transparent" onMouseEnter={() => setHover(i)} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Ranked horizontal bars with value labels — for funnels and splits. */
export function HBars({
  rows,
  color = "var(--color-leaf-500)",
  format = (v: number) => String(v),
}: {
  rows: { label: string; value: number; note?: string }[];
  color?: string;
  format?: (v: number) => string;
}) {
  const max = Math.max(...rows.map((r) => r.value)) || 1;
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-ink-2">{r.label}</span>
            <span className="font-medium text-ink">
              {format(r.value)}
              {r.note ? <span className={cn("ml-1.5 font-normal text-ink-3", hover === i ? "inline" : "hidden sm:inline")}>{r.note}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-mist">
            <div className="h-full rounded-full transition-opacity" style={{ width: `${(r.value / max) * 100}%`, background: color, opacity: hover === null || hover === i ? 1 : 0.5 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
