"use client";

import { useActionState } from "react";
import type { BrandSummary } from "@/data/brands";
import type { PublicationAttempt } from "@/data/publishing";
import type { BriefingSocialChannel } from "@/lib/content/briefing-social-drafts";
import { createContentAction, createFacebookUnpublishedTestAction, createSocialDraftAction, recordDecisionAction, reviseContentAction, type ContentActionState } from "./actions";

const initialState: ContentActionState = {};

export function ContentForReviewForm({ brands }: { brands: BrandSummary[] }) {
  const [state, action, pending] = useActionState(createContentAction, initialState);
  return <form action={action} className="brand-form">
    <div className="form-grid">
      <Field label="Brand" name="brandId" error={state.fieldErrors?.brandId?.[0]}>
        <select id="brandId" name="brandId" defaultValue="" required><option disabled value="">Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select>
      </Field>
      <Field label="Content type" name="contentType" error={state.fieldErrors?.contentType?.[0]}>
        <select id="contentType" name="contentType" defaultValue="SOCIAL_POST"><option value="ARTICLE">Article</option><option value="SOCIAL_POST">Social post</option><option value="CAPTION">Caption</option><option value="THREAD">Thread</option><option value="GRAPHIC">Graphic</option><option value="CAROUSEL">Carousel</option><option value="VIDEO_CONCEPT">Video concept</option><option value="VIDEO_SCRIPT">Video script</option><option value="CAMPAIGN_CONTENT">Campaign content</option></select>
      </Field>
    </div>
    <Field label="Title" name="title" error={state.fieldErrors?.title?.[0]}><input id="title" name="title" maxLength={200} required /></Field>
    <Field label="Content preview" name="body" hint="Write or paste your content here. It will be saved for review, not published." error={state.fieldErrors?.body?.[0]}><textarea id="body" name="body" rows={14} maxLength={50_000} /></Field>
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    <div className="form-actions"><button className="button" disabled={pending} type="submit">{pending ? "Submitting…" : "Submit for review"}</button></div>
  </form>;
}

export function ReviewDecisionForm({ contentId }: { contentId: string }) {
  const [state, action, pending] = useActionState(recordDecisionAction.bind(null, contentId), initialState);
  return <form action={action} className="decision-form">
    <Field label="Review notes" name="notes" hint="Record the reasoning a future operator will need to reconstruct this decision." error={state.fieldErrors?.notes?.[0]}><textarea id="notes" name="notes" rows={5} maxLength={4_000} /></Field>
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    {state.success ? <p className="success" role="status">{state.success}</p> : null}
    <div className="decision-actions"><button className="danger-button" disabled={pending} name="decision" type="submit" value="REJECTED">Reject</button><button className="button" disabled={pending} name="decision" type="submit" value="APPROVED">Approve</button></div>
  </form>;
}

export function ReviseContentForm({ contentId, title, body }: { contentId: string; title: string; body: string }) {
  const [state, action, pending] = useActionState(reviseContentAction.bind(null, contentId), initialState);
  return <form action={action} className="decision-form">
    <Field label="Post title" name="title" error={state.fieldErrors?.title?.[0]}><input id="title" name="title" defaultValue={title} maxLength={200} required /></Field>
    <Field label="Post copy" name="body" hint="Saving returns the draft to review and resets verification and media checks. Approved posts cannot be changed here." error={state.fieldErrors?.body?.[0]}><textarea id="body" name="body" defaultValue={body} rows={10} maxLength={50_000} required /></Field>
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    {state.success ? <p className="success" role="status">{state.success}</p> : null}
    <button className="button" disabled={pending} type="submit">{pending ? "Saving…" : "Save and resubmit"}</button>
  </form>;
}

export function BriefingSocialDraftForm({ contentId, rank, channel }: { contentId: string; rank: number; channel: BriefingSocialChannel }) {
  const [state, action, pending] = useActionState(createSocialDraftAction.bind(null, contentId), initialState);
  return <form action={action} className="briefing-handoff-form">
    <input name="rank" type="hidden" value={rank} />
    <input name="channel" type="hidden" value={channel} />
    {state.error ? <p className="error" role="alert">{state.error}</p> : null}
    <button className="button" disabled={pending} type="submit">{pending ? "Creating…" : `Create ${channel === "X" ? "X handoff" : channel.toLowerCase() + " draft"}`}</button>
  </form>;
}

export function FacebookUnpublishedTestForm({ contentId, attempts }: { contentId: string; attempts: PublicationAttempt[] }) {
  const [state, action, pending] = useActionState(createFacebookUnpublishedTestAction.bind(null, contentId), initialState);
  return <div className="publication-test">
    <form action={action}>
      <p>This creates an unpublished Page post for provider verification. It will not appear on the public Facebook Page feed and it does not enable automatic publishing.</p>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="success" role="status">{state.success}</p> : null}
      <button className="button" disabled={pending} type="submit">{pending ? "Creating test…" : "Create unpublished Facebook test"}</button>
    </form>
    {attempts.length ? <div className="publication-attempts"><strong>Attempt history</strong>{attempts.map((attempt) => <div className="publication-attempt" key={attempt.id}><span className={`status status-${attempt.status.toLowerCase()}`}>{attempt.status}</span><span>Attempt {attempt.attemptCount}</span>{attempt.errorCode ? <span>{attempt.errorCode.replaceAll("_", " ")}</span> : null}</div>)}</div> : null}
  </div>;
}

function Field({ label, name, hint, error, children }: { label: string; name: string; hint?: string; error?: string; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}</label>{children}{hint ? <span className="field-hint">{hint}</span> : null}{error ? <span className="error" role="alert">{error}</span> : null}</div>;
}
