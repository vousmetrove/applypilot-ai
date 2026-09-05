import { env } from "cloudflare:workers";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments } from "@/db/schema";
import { requestUserId, unauthorized } from "@/lib/request-user";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
]);

export async function GET(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const rows = await getDb().select().from(attachments).where(eq(attachments.userId, userId)).orderBy(desc(attachments.createdAt));
  return Response.json({ attachments: rows.map((row) => ({ id: row.id, type: row.type, fileName: row.fileName, contentType: row.contentType, size: row.size, createdAt: row.createdAt })) });
}

export async function POST(request: Request) {
  const userId = requestUserId(request);
  if (!userId) return unauthorized();
  const form = await request.formData();
  const file = form.get("file");
  const type = String(form.get("type") || "其他材料").slice(0, 80);
  if (!(file instanceof File)) return Response.json({ error: "请选择要上传的文件。" }, { status: 400 });
  if (!file.size || file.size > MAX_FILE_SIZE) return Response.json({ error: "单个文件需小于 20 MB。" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: "仅支持 PDF、DOC、DOCX、JPG、PNG。" }, { status: 400 });

  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\p{L}\p{N}._-]+/gu, "-").slice(-120) || "attachment";
  const r2Key = `${userId}/${id}/${safeName}`;
  await env.BUCKET.put(r2Key, file.stream(), { httpMetadata: { contentType: file.type } });
  const row = {
    id,
    userId,
    type,
    fileName: file.name.slice(0, 255),
    contentType: file.type,
    size: file.size,
    r2Key,
    createdAt: new Date().toISOString(),
  };
  await getDb().insert(attachments).values(row);
  const publicRow = { id: row.id, type: row.type, fileName: row.fileName, contentType: row.contentType, size: row.size, createdAt: row.createdAt };
  return Response.json({ attachment: publicRow }, { status: 201 });
}
