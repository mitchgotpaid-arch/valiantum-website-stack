"use client";

import { useActionState } from "react";
import type { MediaPolicy } from "@/data/brand-governance";
import { createFactAction, createRuleAction, createSourceAction, saveMediaPolicyAction, type GovernanceActionState } from "./actions";

const initialState: GovernanceActionState = {};

export function FactForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState(createFactAction.bind(null, brandId), initialState);
  return <form action={action} className="compact-form">
    <div className="form-grid"><div className="field"><label htmlFor="factKey">Fact key</label><input id="factKey" name="factKey" placeholder="pricing.monthly" required />{state.fieldErrors?.factKey?.[0] ? <span className="error">{state.fieldErrors.factKey[0]}</span> : null}</div><div className="field"><label htmlFor="verificationStatus">Verification</label><select id="verificationStatus" name="verificationStatus" defaultValue="UNVERIFIED"><option value="UNVERIFIED">Unverified</option><option value="SUPPORTED">Supported</option><option value="VERIFIED">Verified</option><option value="CONFLICTING">Conflicting</option><option value="INCORRECT">Incorrect</option></select></div></div>
    <div className="field"><label htmlFor="value">Authoritative value</label><textarea id="value" name="value" rows={3} required />{state.fieldErrors?.value?.[0] ? <span className="error">{state.fieldErrors.value[0]}</span> : null}</div>
    <div className="field"><label htmlFor="sourceUrl">Source URL</label><input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://…" />{state.fieldErrors?.sourceUrl?.[0] ? <span className="error">{state.fieldErrors.sourceUrl[0]}</span> : null}</div>
    <ActionStatus state={state} /><button className="button" disabled={pending} type="submit">{pending ? "Adding…" : "Add fact"}</button>
  </form>;
}

export function RuleForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState(createRuleAction.bind(null, brandId), initialState);
  return <form action={action} className="compact-form">
    <div className="field"><label htmlFor="ruleType">Rule type</label><select id="ruleType" name="ruleType" defaultValue="NEVER"><option value="NEVER">Never</option><option value="ALWAYS">Always</option><option value="REQUIRE_REVIEW">Require human review</option></select></div>
    <div className="field"><label htmlFor="ruleText">Enforceable rule</label><textarea id="ruleText" name="ruleText" rows={4} placeholder="Never invent product pricing." required />{state.fieldErrors?.ruleText?.[0] ? <span className="error">{state.fieldErrors.ruleText[0]}</span> : null}</div>
    <ActionStatus state={state} /><button className="button" disabled={pending} type="submit">{pending ? "Adding…" : "Add rule"}</button>
  </form>;
}

function ActionStatus({ state }: { state: GovernanceActionState }) {
  if (state.error) return <p className="error" role="alert">{state.error}</p>;
  if (state.success) return <p className="success" role="status">{state.success}</p>;
  return null;
}

export function SourceForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState(createSourceAction.bind(null, brandId), initialState);
  return <form action={action} className="compact-form"><div className="form-grid"><div className="field"><label htmlFor="source-name">Source name</label><input id="source-name" name="name" required />{state.fieldErrors?.name?.[0] ? <span className="error">{state.fieldErrors.name[0]}</span> : null}</div><div className="field"><label htmlFor="source-tier">Tier</label><select id="source-tier" name="sourceTier" defaultValue="1"><option value="1">Tier 1 · Official</option><option value="2">Tier 2 · Trusted news</option><option value="3">Tier 3 · Established publication</option><option value="4">Tier 4 · Discovery only</option></select></div></div><div className="field"><label htmlFor="baseUrl">Base URL</label><input id="baseUrl" name="baseUrl" type="url" placeholder="https://…" />{state.fieldErrors?.baseUrl?.[0] ? <span className="error">{state.fieldErrors.baseUrl[0]}</span> : null}</div><label className="check-row"><input name="isApproved" type="checkbox" /> Approved as a factual source</label>{state.fieldErrors?.isApproved?.[0] ? <span className="error">{state.fieldErrors.isApproved[0]}</span> : null}<ActionStatus state={state} /><button className="button" disabled={pending} type="submit">{pending ? "Adding…" : "Add source"}</button></form>;
}

export function MediaPolicyForm({ brandId, policy }: { brandId: string; policy: MediaPolicy }) {
  const [state, action, pending] = useActionState(saveMediaPolicyAction.bind(null, brandId), initialState);
  return <form action={action} className="compact-form"><div className="field"><label htmlFor="likeness">AI-generated real-person likenesses</label><select id="likeness" name="aiRealPersonLikenesses" defaultValue={policy.aiRealPersonLikenesses}><option value="UNSET">Not configured — blocks eligibility</option><option value="PROHIBITED">Prohibited</option><option value="ALLOWED">Allowed</option></select></div><div className="check-stack"><Check name="aiIllustrationsAllowed" label="AI illustrations allowed" checked={policy.aiIllustrationsAllowed} /><Check name="aiBackgroundsAllowed" label="AI backgrounds allowed" checked={policy.aiBackgroundsAllowed} /><Check name="realPersonPhotosRequireApproval" label="Real-person photos require approval" checked={policy.realPersonPhotosRequireApproval} /><Check name="textGraphicsAllowed" label="Text graphics allowed" checked={policy.textGraphicsAllowed} /><Check name="statisticalGraphicsAllowed" label="Statistical graphics allowed" checked={policy.statisticalGraphicsAllowed} /></div><div className="field"><label htmlFor="policyNotes">Policy notes</label><textarea id="policyNotes" name="policyNotes" rows={4} defaultValue={policy.policyNotes} /></div><ActionStatus state={state} /><button className="button" disabled={pending} type="submit">{pending ? "Saving…" : "Save media policy"}</button></form>;
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) { return <label className="check-row"><input name={name} type="checkbox" defaultChecked={checked} /> {label}</label>; }
