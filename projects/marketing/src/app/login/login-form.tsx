"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);
  return (
    <form action={action} className="form">
      <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required /></div>
      <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="button" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
