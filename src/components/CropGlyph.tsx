import type { CropId } from "@/lib/types";

/** Simple line drawings for the three MVP crops. */
export function CropGlyph({ crop, size = 40 }: { crop: CropId; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 48 48", fill: "none", "aria-hidden": true as const };
  if (crop === "rice")
    return (
      <svg {...common}>
        <path d="M24 44V14" stroke="var(--color-leaf-700)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M24 30c-6-2-10-7-11-14M24 36c5-3 9-8 10-15" stroke="var(--color-leaf-500)" strokeWidth="2.2" strokeLinecap="round" />
        {[8, 13, 18, 23].map((y, i) => (
          <g key={y}>
            <ellipse cx={20.5} cy={y + 1} rx="2.2" ry="3.4" transform={`rotate(-28 20.5 ${y + 1})`} fill="#c99a2e" opacity={1 - i * 0.08} />
            <ellipse cx={27.5} cy={y + 3} rx="2.2" ry="3.4" transform={`rotate(28 27.5 ${y + 3})`} fill="#c99a2e" opacity={1 - i * 0.08} />
          </g>
        ))}
        <ellipse cx="24" cy="6" rx="2" ry="3.2" fill="#c99a2e" />
      </svg>
    );
  if (crop === "potato")
    return (
      <svg {...common}>
        <path
          d="M10 27c0-9 8-15 17-14 8 1 12 7 11 14-1 8-8 13-16 12-7-1-12-5-12-12z"
          fill="#d9b382"
          stroke="#8a6238"
          strokeWidth="2"
        />
        <circle cx="19" cy="24" r="1.3" fill="#8a6238" />
        <circle cx="28" cy="21" r="1.3" fill="#8a6238" />
        <circle cx="30" cy="30" r="1.3" fill="#8a6238" />
        <circle cx="21" cy="32" r="1.3" fill="#8a6238" />
        <path d="M26 13c-1-4 1-8 5-9-1 4-2 6-5 9z" fill="var(--color-leaf-500)" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="24" cy="28" r="14" fill="#e0453c" stroke="#a82820" strokeWidth="2" />
      <path d="M17 24c1-3 3-5 6-6" stroke="#fff" strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M24 14l-2-5M24 14c-3-2-7-2-9 0 3 1 5 2 6 3M24 14c3-2 7-2 9 0-3 1-5 2-6 3M24 14c0 3-1 5-3 6M24 14c0 3 1 5 3 6"
        stroke="var(--color-leaf-600)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
