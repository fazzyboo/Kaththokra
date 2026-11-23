import type { SVGProps } from "react";

/* Hand-picked 24px stroke icons, inlined to keep the JS bundle small (SRS WEB-2). */
const PATHS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  leaf: "M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c3-4 6-7 10-9",
  camera: "M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01",
  file: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
  bell: "M6 17V11a6 6 0 1 1 12 0v6l2 2H4zM10 21h4",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01",
  chevronRight: "M9 6l6 6-6 6",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronDown: "M6 9l6 6 6-6",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6 6 18",
  alert: "M12 4 2.5 20h19zM12 10v4M12 17h.01",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5h.01",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  users: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a7 7 0 0 1 4 7",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8.1 7 7 0 0 1-1.6.9 1.7 1.7 0 0 0-1.1 1.5V23h-4v-.3a1.7 1.7 0 0 0-1.1-1.5 7 7 0 0 1-1.6-.9 1.7 1.7 0 0 0-1.8-.1l-.2.1-2-3.4.1-.1a1.7 1.7 0 0 0 .3-1.8 7 7 0 0 1 0-1.8 1.7 1.7 0 0 0-.3-1.8L2.4 12l2-3.4.2.1a1.7 1.7 0 0 0 1.8-.1 7 7 0 0 1 1.6-.9A1.7 1.7 0 0 0 9 6.2V6h4v.2a1.7 1.7 0 0 0 1.1 1.5 7 7 0 0 1 1.6.9 1.7 1.7 0 0 0 1.8.1l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.8 7 7 0 0 1 0 1.8z",
  store: "M4 9l1.5-5h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6",
  chart: "M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  book: "M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7",
  map: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  refresh: "M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4",
  download: "M12 4v11M7 10l5 5 5-5M4 20h16",
  upload: "M12 20V9M7 14l5-5 5 5M4 4h16",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2zM16 16h2v2h-2z",
  printer: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  logout: "M10 4H5v16h5M14 8l4 4-4 4M18 12H9",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  send: "M4 12l16-8-6 16-2.5-6.5z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  sms: "M4 5h16v11H9l-5 4zM8 10h8",
  volume: "M4 9h4l5-4v14l-5-4H4zM17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11",
  plus: "M12 5v14M5 12h14",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  unlock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  focus: "M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M12 14a2 2 0 1 0 0-4 2 4 0 0 0 0 4z",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  db: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  cpu: "M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  wallet: "M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l12-4v4M16.5 13.5h.01",
  keypad: "M6 4h2v2H6zM11 4h2v2h-2zM16 4h2v2h-2zM6 9h2v2H6zM11 9h2v2h-2zM16 9h2v2h-2zM6 14h2v2H6zM11 14h2v2h-2zM16 14h2v2h-2zM11 19h2v2h-2z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  wifiOff: "M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.4-1.7M2 8.8a15 15 0 0 1 4.3-2.6M12 20h.01M22 8.8A15 15 0 0 0 11 5",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4",
  bug: "M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0zM12 9v10M4 13h4M16 13h4M5 7l3 2M19 7l-3 2M5 19l3-2M19 19l-3-2",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 1.8, ...rest }: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
