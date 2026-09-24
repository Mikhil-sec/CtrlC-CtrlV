import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tradeoffs" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
