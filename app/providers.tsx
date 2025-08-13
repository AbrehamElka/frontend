// app/providers.tsx
"use client";

import { SessionProvider } from "next-auth/react";

// This component wraps children with the SessionProvider
export function Providers({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SessionProvider>{children}</SessionProvider>;
}
