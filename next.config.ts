import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * The Content Security Policy.
 *
 * Everything is served from this origin except GitHub avatars, and the only
 * place a form navigates off-site is the GitHub sign-in redirect. Inline
 * scripts are allowed because Next.js and the pre-paint theme script need
 * them; a nonce-based policy would remove that, at the cost of rendering every
 * page dynamically, which is not worth it for an app with no third-party
 * scripts and no user-authored HTML anywhere.
 *
 * `connect-src 'self'` is the line that matters most for a finance app: even
 * if something did get injected, it could not send data anywhere.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://avatars.githubusercontent.com",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://github.com",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Belt and braces for browsers that predate frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version to anyone scanning for old ones.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
