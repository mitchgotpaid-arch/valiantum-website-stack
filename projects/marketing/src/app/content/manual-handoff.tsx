"use client";

import { useState } from "react";

export function ManualHandoff({ body, channel }: { body: string; channel: string }) {
  const [message, setMessage] = useState("");
  async function copyPost() {
    try {
      await navigator.clipboard.writeText(body);
      setMessage("Post copy copied. Check every claim and media right before posting it manually.");
    } catch {
      setMessage("Could not copy automatically. Select the post copy above and copy it manually.");
    }
  }

  return <section className="card review-card"><div className="section-heading"><div><h2>Manual {channel} handoff</h2><p>Nothing is sent to {channel} by this button. Human approval is not a substitute for checking claims, sources, and image rights.</p></div></div><button className="button" onClick={copyPost} type="button">Copy approved copy</button>{message ? <p role="status">{message}</p> : null}</section>;
}
