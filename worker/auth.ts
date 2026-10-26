import { betterAuth } from "better-auth";
import { type Env, isLocal, emailConfigured } from "./types";
export function createAuth(env: Env) {
  const development =
    env.AUTH_DEV_MODE === "true" && isLocal(env.BETTER_AUTH_URL!);
  const emailEnabled = emailConfigured(env);
  async function sendEmail(to: string, subject: string, url: string) {
    if (development) return;
    if (!emailEnabled) throw new Error("Email account services are not configured.");
    const safe = url
      .replaceAll("&", "&amp;")
      .replaceAll('"', "&quot;")
      .replaceAll("<", "&lt;");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [to],
        subject,
        html: `<p><a href="${safe}">${subject}</a></p><p>If you did not request this, ignore this email.</p>`,
      }),
    });
    if (!response.ok) throw new Error("Account email could not be delivered.");
  }
  return betterAuth({
    database: env.DB!,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/api/auth",
    trustedOrigins: [new URL(env.BETTER_AUTH_URL!).origin, ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET ? ["https://appleid.apple.com"] : [])],
    onAPIError: { errorURL: new URL("/login", env.BETTER_AUTH_URL!).href },
    socialProviders: {
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, requireEmailVerification: true } } : {}),
      ...(env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET ? { apple: { clientId: env.APPLE_CLIENT_ID, clientSecret: env.APPLE_CLIENT_SECRET, requireEmailVerification: true } } : {}),
    },
    emailAndPassword: {
      enabled: emailEnabled,
      minPasswordLength: 12,
      requireEmailVerification: !development,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) =>
        sendEmail(user.email, "Reset your community password", url),
    },
    emailVerification: emailEnabled ? {
      sendOnSignUp: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) =>
        sendEmail(user.email, "Verify your community email", url),
    } : undefined,
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", window: 60, max: 30 },
    advanced: {
      useSecureCookies: !development,
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
  });
}
