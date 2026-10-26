export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function body(request: Request, maxBytes = 12000): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Use JSON for this request.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel();
        throw new HttpError(413, "Request is too large.");
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw Error();
    return value;
  } catch {
    throw new HttpError(400, "Invalid JSON request.");
  }
}
export function text(
  value: unknown,
  name: string,
  max: number,
  required = true,
) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new HttpError(
      400,
      `${name} must be ${required ? "1" : "0"}–${max} characters.`,
    );
  return value.trim();
}
export function limit(url: URL) {
  const n = Number(url.searchParams.get("limit") || 20);
  if (!Number.isInteger(n) || n < 1 || n > 50)
    throw new HttpError(400, "Limit must be between 1 and 50.");
  return n;
}
export function pageCursor(url: URL) {
  const value = url.searchParams.get("before");
  if (!value) return Number.MAX_SAFE_INTEGER;
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1)
    throw new HttpError(400, "Invalid pagination cursor.");
  return n;
}
