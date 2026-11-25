/*
  Load .env / .env.local the same way `next dev` does. Import this FIRST in every script.
  Scripts run with `tsx --conditions=react-server` so `import "server-only"` resolves to
  its no-op build outside Next.js.
*/
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
