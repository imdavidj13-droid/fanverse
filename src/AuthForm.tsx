import {useState} from "react";
import {api} from "./api";
export function AuthForm({ onSignedIn, initialMode = "login", enabled = true }: { onSignedIn: () => void; initialMode?: "login" | "signup"; enabled?: boolean }) {
  const token = new URLSearchParams(location.search).get("token"),
    [mode, setMode] = useState(token ? "reset" : initialMode),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled) return;
    const data = new FormData(event.currentTarget);
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const email = String(data.get("email") || ""),
        password = String(data.get("password") || "");
      if (mode === "signup") {
        await api("/api/auth/sign-up/email", "POST", {
          email,
          password,
          name: String(data.get("name")),
          callbackURL: location.origin + "/account",
        });
        setNotice("Check your email to verify your account, then sign in.");
        setMode("login");
      } else if (mode === "verify") {
        await api("/api/auth/send-verification-email", "POST", {
          email,
          callbackURL: location.origin + "/account",
        });
        setNotice("If verification is needed, an email will be sent.");
      } else if (mode === "forgot") {
        await api("/api/auth/request-password-reset", "POST", {
          email,
          redirectTo: location.origin + "/account",
        });
        setNotice(
          "If an account exists for that email, a reset link will be sent.",
        );
      } else if (mode === "reset") {
        await api("/api/auth/reset-password", "POST", {
          token,
          newPassword: password,
        });
        setNotice("Password updated. You can now sign in.");
        setMode("login");
        history.replaceState(null, "", "/account");
      } else {
        await api("/api/auth/sign-in/email", "POST", { email, password });
        onSignedIn();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="account-card">
      <h2>
        {mode === "signup"
          ? "Join the community"
          : mode === "verify"
            ? "Verify your account"
            : mode === "forgot"
              ? "Reset your password"
              : mode === "reset"
                ? "Choose a new password"
                : "Welcome back"}
      </h2>
      <p>
        Sign in to your account to join your fandoms and conversations.
      </p>
      <form className="live-form" onSubmit={submit}>
        {mode === "signup" && (
          <label>
            Display name
            <input
              name="name"
              maxLength={40}
              required
              autoComplete="nickname"
            />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Email
            <input name="email" type="email" required autoComplete="email" />
          </label>
        )}
        {!["forgot", "verify"].includes(mode) && (
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              required
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
            <small>{mode !== "login" && "At least 12 characters."}</small>
          </label>
        )}
        {error && (
          <p className="composer-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <button className="primary" disabled={busy || !enabled}>
          {busy
            ? "Please wait…"
            : mode === "signup"
              ? "Create account"
              : mode === "verify"
                ? "Send verification email"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Set password"
                    : "Sign in"}
        </button>
      </form>
      <div className="account-links">
        <button
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
          }}
        >
          {mode === "signup" ? "Already have an account?" : "Create an account"}
        </button>
        <button
          onClick={() => {
            setMode("forgot");
            setError("");
          }}
        >
          Forgot password?
        </button>
        <button
          onClick={() => {
            setMode("verify");
            setError("");
          }}
        >
          Resend verification
        </button>
      </div>
    </div>
  );
}
