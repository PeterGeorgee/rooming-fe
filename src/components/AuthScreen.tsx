import { useState } from "react";
import { Eye, EyeOff, LogIn, UserPlus } from "lucide-react";
import { request, setAuthToken, type AuthResponse, type AuthUser } from "../api";
import { BrandLoader } from "./BrandLoader";

export function AuthScreen({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="authpage">
      <section className="authcard">
        <img src="/vault-hq-logo.png" alt="Vault HQ" />
        <div className="authintro">
          <small>Camp assignment workspace</small>
          <h1>{register ? "Create your account" : "Welcome back"}</h1>
          <p>{register ? "Create camps, invite your team with a code, and keep every workspace private." : "Sign in to access the camps you created or joined."}</p>
        </div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await request<AuthResponse>(register ? "/auth/register" : "/auth/login", {
              method: "POST",
              body: JSON.stringify(register ? { name, email, password } : { email, password }),
            });
            setAuthToken(result.token);
            onAuth(result.user);
          } catch (caught) {
            setError((caught as Error).message);
          } finally {
            setBusy(false);
          }
        }}>
          {register && <label>Your name<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Peter George" /></label>}
          <label>Email address<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label>
            Password
            <span className="passwordfield">
              <input required minLength={8} type={showPassword ? "text" : "password"} autoComplete={register ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </span>
          </label>
          {error && <p className="autherror" role="alert">{error}</p>}
          <button className="primary authsubmit" disabled={busy}>{register ? <UserPlus size={18} /> : <LogIn size={18} />} {busy ? "Please wait..." : register ? "Create account" : "Sign in"}</button>
        </form>
        <button className="authswitch" onClick={() => { setRegister(!register); setError(""); setShowPassword(false); }}>{register ? "Already have an account? Sign in" : "New to Vault HQ? Create an account"}</button>
      </section>
      {busy && <BrandLoader overlay label={register ? "Creating your account..." : "Signing you in..."} />}
    </main>
  );
}
