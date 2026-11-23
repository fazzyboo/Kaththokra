import { qrMatrix } from "@/lib/qr";

export function QrCode({ value, size = 200, label }: { value: string; size?: number; label: string }) {
  const m = qrMatrix(value);
  const n = m.length;
  const q = 4; // quiet zone
  let d = "";
  m.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) d += `M${x + q} ${y + q}h1v1h-1z`;
    }),
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n + q * 2} ${n + q * 2}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={d} fill="#10261c" />
    </svg>
  );
}
