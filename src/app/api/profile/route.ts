import { updateProfileSchema } from "@/lib/contract/schemas";
import { ok, parseBody, route } from "@/lib/api";
import { readableUserId, writableUserId } from "@/lib/auth/guard";
import { ensureProfile, getProfile, updateProfile } from "@/lib/db/profile";

export const GET = route(async () => {
  const profile = await getProfile(await readableUserId());
  return ok(profile);
});

export const PATCH = route(async (request) => {
  const userId = await writableUserId();
  const values = await parseBody(request, updateProfileSchema);
  await ensureProfile(userId);
  await updateProfile(userId, values);
  const profile = await getProfile(userId);
  return ok(profile);
});
