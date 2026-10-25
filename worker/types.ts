export interface Env {
  DB?: D1Database;
  CATALOGUE_SOURCE?: Fetcher;
  ASSETS: Fetcher;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  AUTH_DEV_MODE?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_CLIENT_SECRET?: string;
}
export const fandomIds = ["taylor", "sabrina", "olivia", "screen"];
export function isLocal(url: string) {
  return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
}
export function configured(env: Env) {
  if (
    !env.DB ||
    !env.BETTER_AUTH_SECRET ||
    env.BETTER_AUTH_SECRET.length < 32 ||
    !env.BETTER_AUTH_URL
  )
    return false;
  try {
    return (
      (new URL(env.BETTER_AUTH_URL).protocol === "https:" &&
        Boolean(env.RESEND_API_KEY && env.EMAIL_FROM)) ||
      (env.AUTH_DEV_MODE === "true" && isLocal(env.BETTER_AUTH_URL))
    );
  } catch {
    return false;
  }
}
