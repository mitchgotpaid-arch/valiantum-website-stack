"use client";

import { useActionState,useState } from "react";
import Link from 'next/link';
import {catalog} from '@/lib/social/catalog';
import type { BrandSummary } from "@/data/brands";
import { generateDraftAction, type AgentDraftActionState } from "./actions";

const initialState: AgentDraftActionState = {};

export function AgentDraftForm({ brands, configured, initialBrandId="", initialBrief="",readiness=[] }: { brands: BrandSummary[]; configured: boolean;initialBrandId?:string;initialBrief?:string;readiness?:{brandId:string;missing:string[]}[] }) {
  const [selectedBrand,setSelectedBrand]=useState(initialBrandId||brands[0]?.id||'');
  const missing=readiness.find(r=>r.brandId===selectedBrand)?.missing||[];
  const [state, action, pending] = useActionState(generateDraftAction, initialState);
  return <form action={action} className="brand-form">
    <div className="form-grid">
      <Field label="Brand" name="brandId" error={state.fieldErrors?.brandId?.[0]}><select id="brandId" name="brandId" value={selectedBrand} onChange={event=>setSelectedBrand(event.target.value)} required><option disabled value="">Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></Field>
      <Field label="Draft type" name="contentType" error={state.fieldErrors?.contentType?.[0]}><select id="contentType" name="contentType" defaultValue="SOCIAL_POST"><option value="SOCIAL_POST">Social post</option><option value="CAPTION">Caption</option><option value="THREAD">Thread</option></select></Field>
    </div>
    <Field label="Destination" name="channel"><select id="channel" name="channel" defaultValue="FACEBOOK">{catalog.map(item=><option value={item.id} key={item.id}>{item.name}{item.id==='FACEBOOK'?' · publish or schedule after review':' · draft only'}</option>)}</select></Field>
    {missing.length?<div className="setup-callout"><strong>Brand setup can be improved</strong><p>You can request a draft now. Improve its brand context with: {missing.join(' · ')}.</p><Link href={`/brands/${selectedBrand}/knowledge`}>Improve brand knowledge</Link></div>:null}
    <Field label="What should the agent create?" name="brief" hint="Example: Write a conversational Facebook post asking Reds fans about their favorite ballpark memory. Keep it short and end with a question." error={state.fieldErrors?.brief?.[0]}><textarea id="brief" name="brief" defaultValue={initialBrief} placeholder="Tell the agent what to write…" rows={5} maxLength={4_000} required /></Field>
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    {!configured ? <div className="setup-callout"><strong>OpenAI key required</strong><p>Add a server-only OpenAI API key to enable draft generation. The key is never sent to the browser.</p></div> : null}
    <div className="form-actions"><button className="button" disabled={pending || !configured} type="submit">{pending ? "Writing your post…" : "Create post draft"}</button></div>
  </form>;
}

function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label>{children}{hint ? <span className="field-hint">{hint}</span> : null}{error ? <span className="error" role="alert">{error}</span> : null}</div>;
}
