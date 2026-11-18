import { LoginForm } from "./login-form";

export default function LoginPage() {
  return <main className="auth-shell"><section className="card auth-card"><div className="wordmark" style={{ color: "var(--ink)" }}>Valiantum <small style={{ color: "var(--muted)" }}>Marketing OS</small></div><h1 style={{ fontSize: 30, marginTop: 28 }}>Welcome back</h1><p className="subtitle">Sign in to your existing Marketing OS account to continue.</p><LoginForm /><a className="projects-return" style={{color:"var(--muted)"}} href="/">← Back to Projects</a></section></main>;
}
