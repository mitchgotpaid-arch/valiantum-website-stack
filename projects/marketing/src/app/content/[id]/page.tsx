import {requirePageUser} from '@/data/page-auth';
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageFrame } from "@/components/page-frame";
import { getBrandGovernance } from "@/data/brand-governance";
import { getContentReview } from "@/data/content";
import { canAdminPublishingBrand, listPublicationAttempts, listPublishingDestinations } from "@/data/publishing";
import { extractBriefingSocialDrafts } from "@/lib/content/briefing-social-drafts";
import { hasSupabaseEnv } from "@/lib/env";
import { BriefingSocialDraftForm, FacebookUnpublishedTestForm, ReviewDecisionForm, ReviseContentForm } from "../content-forms";
import { ManualHandoff } from "../manual-handoff";

export default async function ContentReviewPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  if (!hasSupabaseEnv()) redirect("/content");
  const { id } = await params;
  const content = await getContentReview(id);
  if (!content) notFound();
  const [governance, destinations, attempts, canAdminPublishing] = await Promise.all([
    getBrandGovernance(content.brandId),
    listPublishingDestinations(content.brandId),
    listPublicationAttempts(content.id),
    canAdminPublishingBrand(content.brandId),
  ]);
  const facebookConnected = destinations.some((destination) => destination.channel === "FACEBOOK" && destination.connectionStatus === "CONNECTED");
  const canRunFacebookTest = content.status === "APPROVED" && content.contentType !== "DAILY_BRIEFING" && (!content.targetChannel || content.targetChannel === "FACEBOOK");
  const briefingDrafts = content.contentType === "DAILY_BRIEFING" && ["NEEDS_REVIEW", "APPROVED"].includes(content.status) && content.canEdit
    ? extractBriefingSocialDrafts(content.body) : [];

  return <PageFrame title={content.title} description={content.status === "VERIFYING" ? "Inspect captured research and its failed quality checks. This item is not eligible for approval or publishing." : "Review the content, evidence, risk, and Brand controls before recording a human decision."}>
    <div className="back-row"><Link href="/content">← Back to approval queue</Link><span className={`status status-${content.status.toLowerCase()}`}>{content.status.replaceAll("_", " ")}</span></div>
    {content.status === "VERIFYING" && content.contentType === "RESEARCH_CAPTURE" ? <section className="card review-card"><h2>Research saved, not approved</h2><p>This AI response was captured after a quality check failed. Its source links and returned material are below. Verify all claims before using it; this record cannot be approved or published from this state.</p></section> : null}
    <div className="review-layout">
      <div className="review-main">
        <section className="card review-card"><div className="section-heading"><div><div className="eyebrow">Content preview</div><h2>{content.title}</h2></div><span className="status">{content.contentType.replaceAll("_", " ")}</span></div><div className="content-preview">{content.body || "No body content was provided."}</div></section>
        {briefingDrafts.length ? <section className="card review-card"><div className="section-heading"><div><h2>Turn this briefing into posts</h2><p>Make separate, editable drafts from this paid research. This does not call OpenAI or publish anything. Each post still needs its own verification and approval.</p></div></div><div className="record-list">{briefingDrafts.map((draft) => <article className="record" key={`${draft.rank}-${draft.channel}`}><div className="record-head"><strong>#{draft.rank} {draft.headline}</strong><span className="status">{draft.channel}</span></div><p className="briefing-copy-preview">{draft.body}</p>{draft.channel === "INSTAGRAM" ? <p className="field-hint">Instagram will also need an approved image or video before publishing.</p> : null}<div className="briefing-source-list"><strong>Research links to check</strong>{draft.sourceUrls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank">{url} ↗</a>)}</div><BriefingSocialDraftForm contentId={content.id} rank={draft.rank} channel={draft.channel} /></article>)}</div></section> : null}
        {content.sourceContentId ? <section className="card review-card"><div className="section-heading"><div><h2>Research behind this post</h2><p>These sources are leads for human verification, not proof that each claim in the copy is correct.</p></div></div><Link href={`/content/${content.sourceContentId}`}>Open source briefing →</Link>{content.sourceUrls.length ? <div className="briefing-source-list">{content.sourceUrls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank">{url} ↗</a>)}</div> : <div className="mini-empty">No research links were stored.</div>}</section> : null}
        <section className="card review-card"><div className="section-heading"><div><h2>Facts</h2><p>Brand truth available to the reviewer. This does not mean the draft has been verified against every fact.</p></div></div>{governance.facts.length ? <div className="record-list">{governance.facts.map((fact) => <article className="record" key={fact.id}><div className="record-head"><strong>{fact.factKey}</strong><span className={`status status-${fact.verificationStatus.toLowerCase()}`}>{fact.verificationStatus}</span></div><p>{fact.value}</p>{fact.sourceUrl ? <a className="source-link" href={fact.sourceUrl} rel="noreferrer" target="_blank">View source ↗</a> : <span className="source-missing">No source recorded</span>}</article>)}</div> : <div className="mini-empty">No Brand Facts are recorded. Accuracy remains unverified.</div>}</section>
        <section className="card review-card"><div className="section-heading"><div><h2>Sources</h2><p>Approved sources are context for human review, not automatic proof for this draft.</p></div></div>{governance.sources.length ? <div className="record-list">{governance.sources.map((source) => <article className="record" key={source.id}><div className="record-head"><strong>{source.name}</strong><span className="status">TIER {source.sourceTier}</span></div><p>{source.isApproved ? "Approved factual source" : "Discovery only / not approved"}</p>{source.baseUrl ? <a className="source-link" href={source.baseUrl} rel="noreferrer" target="_blank">Visit source ↗</a> : null}</article>)}</div> : <div className="mini-empty">No Source Hierarchy is configured.</div>}</section>
      </div>
      <aside className="review-side">
        <section className="card review-card"><div className="section-heading"><div><h2>Review checks</h2><p>Fail-closed status from the stored content record.</p></div></div><div className="review-checks"><ReviewCheck label="Brand" value={content.brandName} /><ReviewCheck label="Verification" value={content.verificationStatus} warning={content.verificationStatus !== "VERIFIED" && content.verificationStatus !== "SUPPORTED"} /><ReviewCheck label="Risk" value={content.risk} warning={content.risk !== "LOW"} /><ReviewCheck label="Human approval" value={content.requiresHumanApproval ? "Required" : "Not required"} warning={content.requiresHumanApproval && content.status === "NEEDS_REVIEW"} /><ReviewCheck label="Product claims" value={content.hasProhibitedClaim ? "Prohibited claim detected" : "No prohibited flag"} warning={content.hasProhibitedClaim} /><ReviewCheck label="Media policy" value={content.mediaPolicySatisfied ? "Satisfied" : "Not satisfied"} warning={!content.mediaPolicySatisfied} /></div></section>
        {content.canEdit && ["NEEDS_REVIEW", "REJECTED"].includes(content.status) && content.contentType !== "RESEARCH_CAPTURE" ? <section className="card review-card"><div className="section-heading"><div><h2>Edit and resubmit</h2><p>Improve the copy without another API request. Any earlier verification or media clearance is reset.</p></div></div><ReviseContentForm key={content.updatedAt} contentId={content.id} title={content.title} body={content.body} /></section> : null}
        <section className="card review-card"><div className="section-heading"><div><h2>Decision</h2><p>Approval changes review status only. It cannot override verification, risk, media, Brand, or global publishing controls.</p></div></div>{content.status === "NEEDS_REVIEW" ? content.canReview ? <ReviewDecisionForm contentId={content.id} /> : <div className="mini-empty">Your Brand role can view this item but cannot record a review decision.</div> : content.status === "VERIFYING" ? <div className="mini-empty"><strong>Verification required</strong>This captured response is not eligible for approval or publication.</div> : <div className="mini-empty"><strong>Decision recorded</strong>This item is {content.status.toLowerCase()}. Decisions are immutable audit events.</div>}</section>
        {canRunFacebookTest ? <section className="card review-card"><div className="section-heading"><div><h2>Meta provider test</h2><p>Validate the connection without creating a public post.</p></div><span className="status">UNPUBLISHED</span></div>{!facebookConnected ? <div className="mini-empty">Connect the Brand&apos;s Facebook Page in Settings before running a provider test.</div> : !canAdminPublishing ? <div className="mini-empty">Only a Brand owner or administrator can run a publishing test.</div> : <FacebookUnpublishedTestForm attempts={attempts} contentId={content.id} />}</section> : null}
        {content.status === "APPROVED" && content.targetChannel && content.sourceContentId ? <ManualHandoff body={content.body} channel={content.targetChannel} /> : null}
        <section className="card review-card"><div className="section-heading"><div><h2>Decision history</h2></div></div>{content.approvals.length ? <div className="record-list">{content.approvals.map((approval) => <article className="record" key={approval.id}><div className="record-head"><strong>{approval.decision}</strong></div><p>{approval.notes || "No reviewer notes."}</p></article>)}</div> : <div className="mini-empty">No human decision recorded yet.</div>}</section>
      </aside>
    </div>
  </PageFrame>;
}

function ReviewCheck({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className="review-check"><span>{label}</span><strong className={warning ? "review-warning" : ""}>{value.replaceAll("_", " ")}</strong></div>;
}
