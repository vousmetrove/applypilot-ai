import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { jsonObject, requestUserId, unauthorized } from "@/lib/request-user";

export async function GET(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();

  const [row] = await getDb().select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
  return Response.json({ profile: row ? JSON.parse(row.profileJson) : null, updatedAt: row?.updatedAt ?? null });
}

export async function PUT(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();

  const payload = jsonObject(await request.json());
  const profile = jsonObject(payload.profile);
  const updatedAt = new Date().toISOString();
  await getDb()
    .insert(profiles)
    .values({ userId, profileJson: JSON.stringify(profile), updatedAt })
    .onConflictDoUpdate({ target: profiles.userId, set: { profileJson: JSON.stringify(profile), updatedAt } });

  return Response.json({ ok: true, updatedAt });
}
