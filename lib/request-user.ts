export function requestUserId(request: Request): string | null {
  return request.headers.get("oai-authenticated-user-id");
}

export function unauthorized() {
  return Response.json({ error: "请先通过 ChatGPT 登录后使用云端档案。" }, { status: 401 });
}

export function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
