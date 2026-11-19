"use client";

import { useActionState } from "react";
import type { BrandSummary } from "@/data/brands";
import { generateDailyBriefingAction, type AgentDraftActionState } from "./actions";

const initialState: AgentDraftActionState = {};

export function DailyBriefingForm({ brands, configured }: { brands: BrandSummary[]; configured: boolean }) {
  const [state, action, pending] = useActionState(generateDailyBriefingAction, initialState);
  return <form action={action} className="brand-form">
    <div className="form-grid">
      <div className="field"><label htmlFor="briefingBrandId">Brand</label><select id="briefingBrandId" name="brandId" defaultValue="" required><option disabled value="">Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>{state.fieldErrors?.brandId?.[0] ? <span className="error" role="alert">{state.fieldErrors.brandId[0]}</span> : null}</div>
      <div className="field"><label>Research mode</label><div className="input-readonly">Live web research · ranked daily package</div><span className="field-hint">Uses the dedicated briefing model. If a returned response fails quality checks, its material is saved as a non-publishable research capture.</span></div>
    </div>
    <div className="field"><label htmlFor="operatorFocus">Optional focus for today</label><textarea id="operatorFocus" name="operatorFocus" rows={4} maxLength={1_000} placeholder="Example: Prioritize Reds offseason stories and one non-redundant Facebook graphic." /><span className="field-hint">Leave blank for the Agent to rank the strongest opportunities across the Brand&apos;s configured coverage.</span>{state.fieldErrors?.operatorFocus?.[0] ? <span className="error" role="alert">{state.fieldErrors.operatorFocus[0]}</span> : null}</div>
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    {!configured ? <div className="setup-callout"><strong>OpenAI key required</strong><p>Add a server-only OpenAI API key to enable live research. The key is never sent to the browser.</p></div> : null}
    <div className="form-actions"><button className="button" disabled={pending || !configured} type="submit">{pending ? "Researching and building briefing…" : "Build today’s briefing"}</button></div>
  </form>;
}
