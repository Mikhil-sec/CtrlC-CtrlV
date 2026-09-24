import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted rather than next/font/google: fetching from Google at build
// time is unreliable behind some networks' TLS inspection, and vendoring the
// (latin-only, matching the subset we used) woff2 avoids that entirely.
const geistSans = localFont({
  src: "./fonts/geist-sans.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/geist-mono.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const fraunces = localFont({
  src: "./fonts/fraunces.woff2",
  variable: "--font-fraunces",
  weight: "400 700",
});

export const metadata: Metadata = {
  title: {
    default: "GoalPath — can you afford what you're saving for?",
    template: "%s · GoalPath",
  },
  description:
    "Work out whether your financial goals are reachable, and what it would take to get there.",
  applicationName: "GoalPath",
  openGraph: {
    title: "GoalPath",
    description:
      "Every goal competing for one surplus, a likelihood instead of a false promise, and an assistant that shows you what it would take.",
    type: "website",
  },
};

// Matches the page background, so the browser chrome on phones blends in.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffdf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0810" },
  ],
};

// Runs before paint so the theme is correct on first render, avoiding a
// light-then-dark flash. Falls back to the OS preference for a first visit.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("goalpath-theme");
    var dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} bg-background text-foreground font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
