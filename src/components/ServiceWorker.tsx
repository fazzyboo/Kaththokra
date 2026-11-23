"use client";

import { useEffect } from "react";

/** Registers the offline shell (SRS WEB-2). Only in production builds. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline shell is best-effort */
    });
  }, []);
  return null;
}
