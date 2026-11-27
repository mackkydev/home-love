"use client";

import { useStartupLoading } from "./AppStartupGate";

export default function Loading() {
  useStartupLoading(true);
  return null;
}
