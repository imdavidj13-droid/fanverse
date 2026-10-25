export async function api<T = Record<string, unknown>>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      "The account service is unavailable. Please try again later.",
    );
  const value = await response
    .json()
    .catch(() => ({ error: "The server returned an unexpected response." }));
  if (!response.ok)
    throw new Error(value.error || value.message || "The request failed.");
  return value;
}
export interface LiveProfile {
  user_id: string;
  username: string;
  display_name: string;
  bio: string;
  role: "member" | "moderator" | "admin";
  status: string;
}
export interface Page<T> {
  items: T[];
  next: number | string | null;
}
