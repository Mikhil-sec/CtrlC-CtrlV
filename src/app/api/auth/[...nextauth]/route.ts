/**
 * Wires Auth.js's own endpoints — sign-in, callback, session, sign-out, csrf —
 * into the App Router. `src/auth.ts` builds the handlers; this file is just
 * the route Next.js needs in order to reach them at `/api/auth/*`, including
 * `/api/auth/callback/github`, the callback URL the GitHub OAuth app is
 * configured with.
 */

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
