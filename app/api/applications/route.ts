import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { applications } from "@/db/schema";
import { jsonObject, requestUserId, unauthorized } from "@/lib/request-user";

const allowedStatuses = new Set(["待投递", "已投递", "笔试", "面试", "Offer", "已拒绝", "已撤回"]);

export async function GET(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const rows = await getDb()
    .select()
    .from(applications)
    .where(eq(applications.userId, userId))
    .orderBy(desc(applications.updatedAt))
    .limit(100);

  return Response.json({ applications: rows.map((row) => ({ ...row, result: JSON.parse(row.resultJson || "{}"), resultJson: undefined })) });
}

export async function POST(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const payload = jsonObject(await request.json());
  const id = String(payload.id || crypto.randomUUID());
  const now = new Date().toISOString();
  const status = allowedStatuses.has(String(payload.status)) ? String(payload.status) : "待投递";
  const values = {
    id,
    userId,
    company: String(payload.company || ""),
    role: String(payload.role || ""),
    platform: String(payload.platform || "待确认"),
    applicationUrl: String(payload.applicationUrl || ""),
    status,
    jd: String(payload.jd || ""),
    resultJson: JSON.stringify(jsonObject(payload.result)),
    createdAt: now,
    updatedAt: now,
  };

  await getDb()
    .insert(applications)
    .values(values)
    .onConflictDoUpdate({
      target: applications.id,
      set: {
        company: values.company,
        role: values.role,
        platform: values.platform,
        applicationUrl: values.applicationUrl,
        status: values.status,
        jd: values.jd,
        resultJson: values.resultJson,
        updatedAt: now,
      },
    });

  const [saved] = await getDb()
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), eq(applications.userId, userId)))
    .limit(1);
  return Response.json({ application: { ...saved, result: JSON.parse(saved.resultJson || "{}"), resultJson: undefined } }, { status: 201 });
}
