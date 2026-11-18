"use client";

import { useActionState } from "react";
import type { BrandSummary } from "@/data/brands";
import { generateDraftAction, type AgentDraftActionState } from "./actions";

const initialState: AgentDraftActionState = {};

export function AgentDraftForm({ brands, configured, initialBrandId="", initialBrief="" }: { brands: BrandSummary[]; configured: boolean;initialBrandId?:string;initialBrief?:string }) {
  const [state, action, pending] = useActionState(generateDraftAction, initialState);
  return <form action={action} className="brand-form">
    <div className="form-grid">
      <Field label="Brand" name="brandId" error={state.fieldErrors?.brandId?.[0]}><select id="brandId" name="brandId" defaultValue={initialBrandId} required><option disabled value="">Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></Field>
      <Field label="Draft type" name="contentType" error={state.fieldErrors?.contentType?.[0]}><select id="contentType" name="contentType" defaultValue="SOCIAL_POST"><option value="SOCIAL_POST">Social post</option><option value="CAPTION">Caption</option><option value="THREAD">Thread</option></select></Field>
    </div>
    <Field label="Content brief" name="brief" hint="Describe the topic, goal, platform, and any must-include details. Unsupported or current claims will be marked for verification." error={state.fieldErrors?.brief?.[0]}><textarea id="brief" name="brief" defaultValue={initialBrief} rows={7} maxLength={4_000} required /></Field>
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    {!configured ? <div className="setup-callout"><strong>OpenAI key required</strong><p>Add a server-only OpenAI API key to enable draft generation. The key is never sent to the browser.</p></div> : null}
    <div className="form-actions"><button className="button" disabled={pending || !configured} type="submit">{pending ? "Generating draft…" : "Generate & check draft"}</button></div>
  </form>;
}

function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label>{children}{hint ? <span className="field-hint">{hint}</span> : null}{error ? <span className="error" role="alert">{error}</span> : null}</div>;
}
