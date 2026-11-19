"use client";

import { useActionState, useState } from "react";
import type { BrandSummary } from "@/data/brands";
import { createBrandAction, updateBrandAction, type BrandActionState } from "./actions";
import { slugifyBrandName } from "@/lib/brands/slug";

const initialState: BrandActionState = {};

export function BrandForm({ brand }: { brand?: BrandSummary }) {
  const action = brand ? updateBrandAction.bind(null, brand.id) : createBrandAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [name, setName] = useState(brand?.name ?? "");
  const [slug, setSlug] = useState(brand?.slug ?? "");
  const [slugEdited, setSlugEdited] = useState(Boolean(brand));

  function updateName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugifyBrandName(value));
  }

  return (
    <form action={formAction} className="brand-form">
      <div className="form-intro"><strong>Only the Brand name and slug are required.</strong><span>Complete whichever optional settings are useful. Empty settings are not included in the Marketing Agent&apos;s Brand context.</span></div>
      <div className="form-section-heading"><div><span className="eyebrow">Identity</span><h2>Brand basics</h2></div><span>Tell the Agent what this Brand is.</span></div>
      <div className="form-grid">
        <Field label="Brand name" name="name" error={state.fieldErrors?.name?.[0]}>
          <input id="name" name="name" value={name} onChange={(event) => updateName(event.target.value)} maxLength={120} required />
        </Field>
        <Field label="Slug" name="slug" hint="Used in stable internal URLs." error={state.fieldErrors?.slug?.[0]}>
          <input id="slug" name="slug" value={slug} onChange={(event) => { setSlug(event.target.value); setSlugEdited(true); }} maxLength={120} required />
        </Field>
        <Field label="Website" name="websiteUrl" hint="Your main official website. Include https://" error={state.fieldErrors?.websiteUrl?.[0]} optional>
          <input id="websiteUrl" name="websiteUrl" type="url" defaultValue={brand?.websiteUrl ?? ""} maxLength={500} />
        </Field>
        <Field label="Organization type or category" name="industry" hint="For example: independent sports media company, restaurant, nonprofit, or software company." error={state.fieldErrors?.industry?.[0]} optional>
          <input id="industry" name="industry" defaultValue={brand?.industry ?? ""} maxLength={120} />
        </Field>
      </div>
      <Field label="About the Brand" name="description" hint="A plain-language summary of what the Brand does. This does not need to sound like marketing copy." error={state.fieldErrors?.description?.[0]} optional>
        <textarea id="description" name="description" defaultValue={brand?.description ?? ""} rows={4} maxLength={2000} />
      </Field>
      <Field label="Audience" name="targetAudience" hint="Who should the content serve? Do not include sensitive personal data." error={state.fieldErrors?.targetAudience?.[0]} optional>
        <textarea id="targetAudience" name="targetAudience" defaultValue={brand?.targetAudience ?? ""} rows={4} maxLength={2000} />
      </Field>
      <div className="form-section-heading"><div><span className="eyebrow">Content</span><h2>Agent guidance</h2></div><span>Use any combination of these fields.</span></div>
      <Field label="Coverage or content pillars" name="contentPillars" hint="What should the Brand usually cover? Enter one team, topic, product area, or recurring theme per line." error={state.fieldErrors?.contentPillars?.[0]} optional>
        <textarea id="contentPillars" name="contentPillars" defaultValue={brand?.contentPillars.join("\n") ?? ""} rows={5} maxLength={6000} placeholder={"Cincinnati Reds\nCincinnati Bengals\nFC Cincinnati"} />
      </Field>
      <Field label="Marketing goals" name="marketingObjectives" hint="What outcomes should the Agent work toward? Enter one goal per line." error={state.fieldErrors?.marketingObjectives?.[0]} optional>
        <textarea id="marketingObjectives" name="marketingObjectives" defaultValue={brand?.marketingObjectives.join("\n") ?? ""} rows={4} maxLength={6000} placeholder={"Grow newsletter subscriptions\nIncrease meaningful fan discussion"} />
      </Field>
      <Field label="Brand voice" name="brandVoice" hint="Describe how content should sound—for example passionate, conversational, opinionated, or analytical." error={state.fieldErrors?.brandVoice?.[0]} optional>
        <textarea id="brandVoice" name="brandVoice" defaultValue={brand?.brandVoice ?? ""} rows={5} maxLength={4000} />
      </Field>
      <div className="playbook-intro"><div><span className="eyebrow">Optional depth</span><h2>Brand Playbook</h2><p>Open only the sections that matter for this Brand. These details help the Agent make stronger decisions with less supervision; every blank field is ignored.</p></div><span>{brand ? configuredPlaybookCount(brand) : 0} configured</span></div>
      <details className="playbook-card">
        <summary><span><strong>Strategy, offers, and proof</strong><small>What the Brand stands for, sells, and can credibly claim.</small></span><span>+</span></summary>
        <div className="playbook-fields">
          <Field label="Mission or purpose" name="mission" hint="Why does this Brand exist beyond making money?" error={state.fieldErrors?.mission?.[0]} optional>
            <textarea id="mission" name="mission" defaultValue={brand?.playbook.mission ?? ""} rows={3} maxLength={2000} />
          </Field>
          <Field label="Positioning" name="positioning" hint="The distinct place this Brand should own in its market or community." error={state.fieldErrors?.positioning?.[0]} optional>
            <textarea id="positioning" name="positioning" defaultValue={brand?.playbook.positioning ?? ""} rows={4} maxLength={3000} placeholder="For Cincinnati fans who want... Nati Sports is the... unlike..." />
          </Field>
          <div className="form-grid">
            <Field label="Offers, products, or services" name="offers" hint="One current offer per line." error={state.fieldErrors?.offers?.[0]} optional>
              <textarea id="offers" name="offers" defaultValue={brand?.playbook.offers.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
            <Field label="Key differentiators" name="differentiators" hint="Why should someone choose or follow this Brand? One per line." error={state.fieldErrors?.differentiators?.[0]} optional>
              <textarea id="differentiators" name="differentiators" defaultValue={brand?.playbook.differentiators.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
          </div>
          <Field label="Proof points" name="proofPoints" hint="Awards, credentials, results, statistics, partnerships, or other supportable evidence. One per line; do not enter anything the Brand cannot substantiate." error={state.fieldErrors?.proofPoints?.[0]} optional>
            <textarea id="proofPoints" name="proofPoints" defaultValue={brand?.playbook.proofPoints.join("\n") ?? ""} rows={4} maxLength={6000} />
          </Field>
        </div>
      </details>
      <details className="playbook-card">
        <summary><span><strong>Audience intelligence</strong><small>What the audience needs, wants, doubts, and resists.</small></span><span>+</span></summary>
        <div className="playbook-fields form-grid">
          <Field label="Audience needs and desired outcomes" name="audienceNeeds" hint="One need, pain point, or desired outcome per line." error={state.fieldErrors?.audienceNeeds?.[0]} optional>
            <textarea id="audienceNeeds" name="audienceNeeds" defaultValue={brand?.playbook.audienceNeeds.join("\n") ?? ""} rows={6} maxLength={6000} />
          </Field>
          <Field label="Audience objections and frustrations" name="audienceObjections" hint="What makes them skeptical, disengaged, or unlikely to act? One per line." error={state.fieldErrors?.audienceObjections?.[0]} optional>
            <textarea id="audienceObjections" name="audienceObjections" defaultValue={brand?.playbook.audienceObjections.join("\n") ?? ""} rows={6} maxLength={6000} />
          </Field>
        </div>
      </details>
      <details className="playbook-card">
        <summary><span><strong>Channels, formats, and conversion</strong><small>Where content goes, what shape it takes, and what it should ask people to do.</small></span><span>+</span></summary>
        <div className="playbook-fields">
          <div className="form-grid">
            <Field label="Priority channels" name="priorityChannels" hint="One channel per line—for example website, newsletter, X, Instagram, or YouTube." error={state.fieldErrors?.priorityChannels?.[0]} optional>
              <textarea id="priorityChannels" name="priorityChannels" defaultValue={brand?.playbook.priorityChannels.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
            <Field label="Preferred content formats" name="preferredFormats" hint="One format per line—for example game recap, short video, carousel, analysis, or newsletter." error={state.fieldErrors?.preferredFormats?.[0]} optional>
              <textarea id="preferredFormats" name="preferredFormats" defaultValue={brand?.playbook.preferredFormats.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
          </div>
          <Field label="Preferred calls to action" name="callsToAction" hint="What should content usually invite people to do? One action per line." error={state.fieldErrors?.callsToAction?.[0]} optional>
            <textarea id="callsToAction" name="callsToAction" defaultValue={brand?.playbook.callsToAction.join("\n") ?? ""} rows={4} maxLength={6000} placeholder={"Subscribe to the newsletter\nJoin the discussion\nRead the full analysis"} />
          </Field>
        </div>
      </details>
      <details className="playbook-card">
        <summary><span><strong>Language and examples</strong><small>Teach the Agent the Brand&apos;s vocabulary and show what good and bad look like.</small></span><span>+</span></summary>
        <div className="playbook-fields">
          <div className="form-grid">
            <Field label="Words and phrases to use" name="approvedVocabulary" hint="Preferred terminology, slogans, naming conventions, or local language. One per line." error={state.fieldErrors?.approvedVocabulary?.[0]} optional>
              <textarea id="approvedVocabulary" name="approvedVocabulary" defaultValue={brand?.playbook.approvedVocabulary.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
            <Field label="Words and phrases to avoid" name="avoidedVocabulary" hint="Clichés, competitor language, banned phrases, or wording that feels off-brand. One per line." error={state.fieldErrors?.avoidedVocabulary?.[0]} optional>
              <textarea id="avoidedVocabulary" name="avoidedVocabulary" defaultValue={brand?.playbook.avoidedVocabulary.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
          </div>
          <Field label="Approved content examples" name="approvedExamples" hint="Paste a few short examples that sound exactly right and explain why if useful." error={state.fieldErrors?.approvedExamples?.[0]} optional>
            <textarea id="approvedExamples" name="approvedExamples" defaultValue={brand?.playbook.approvedExamples ?? ""} rows={7} maxLength={6000} />
          </Field>
          <Field label="Examples to avoid" name="avoidExamples" hint="Paste examples that feel wrong, along with what the Agent should change." error={state.fieldErrors?.avoidExamples?.[0]} optional>
            <textarea id="avoidExamples" name="avoidExamples" defaultValue={brand?.playbook.avoidExamples ?? ""} rows={7} maxLength={6000} />
          </Field>
        </div>
      </details>
      <details className="playbook-card">
        <summary><span><strong>Visual direction</strong><small>Guide image and graphic creation beyond the uploaded logo.</small></span><span>+</span></summary>
        <div className="playbook-fields">
          <Field label="Visual style" name="visualDirection" hint="Describe colors, typography, composition, photography, illustration, mood, logo placement, and anything visuals should avoid." error={state.fieldErrors?.visualDirection?.[0]} optional>
            <textarea id="visualDirection" name="visualDirection" defaultValue={brand?.playbook.visualDirection ?? ""} rows={7} maxLength={4000} />
          </Field>
        </div>
      </details>
      <details className="playbook-card">
        <summary><span><strong>Sources and hard guardrails</strong><small>Improve factual accuracy and define non-negotiable boundaries.</small></span><span>+</span></summary>
        <div className="playbook-fields">
          <Field label="Official and preferred source URLs" name="officialSources" hint="One complete URL per line. The Agent should favor these during research; a URL is not automatically proof for every claim." error={state.fieldErrors?.officialSources?.[0]} optional>
            <textarea id="officialSources" name="officialSources" defaultValue={brand?.playbook.officialSources.join("\n") ?? ""} rows={6} maxLength={6000} placeholder={"https://www.example.com/about\nhttps://www.example.com/products"} />
          </Field>
          <div className="form-grid">
            <Field label="Required disclosures" name="requiredDisclosures" hint="Disclosures or context that must appear when relevant. One per line." error={state.fieldErrors?.requiredDisclosures?.[0]} optional>
              <textarea id="requiredDisclosures" name="requiredDisclosures" defaultValue={brand?.playbook.requiredDisclosures.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
            <Field label="Prohibited topics or claims" name="prohibitedTopics" hint="Topics, promises, comparisons, or claims the Agent must never make. One per line." error={state.fieldErrors?.prohibitedTopics?.[0]} optional>
              <textarea id="prohibitedTopics" name="prohibitedTopics" defaultValue={brand?.playbook.prohibitedTopics.join("\n") ?? ""} rows={5} maxLength={6000} />
            </Field>
          </div>
        </div>
      </details>
      <Field label="Special instructions and boundaries" name="freeformInstructions" hint="Add affiliations, disclosures, topics to avoid, rumor-labeling preferences, or anything else the Agent should follow." error={state.fieldErrors?.freeformInstructions?.[0]} optional>
        <textarea id="freeformInstructions" name="freeformInstructions" defaultValue={brand?.freeformInstructions ?? ""} rows={6} maxLength={6000} placeholder="We are independent and not officially affiliated with the teams we cover. Clearly label rumors and opinion." />
      </Field>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      {state.success ? <p className="success" role="status">{state.success}</p> : null}
      <div className="form-actions"><button className="button" disabled={pending} type="submit">{pending ? "Saving…" : brand ? "Save brand" : "Create brand"}</button></div>
    </form>
  );
}

function configuredPlaybookCount(brand: BrandSummary) {
  return Object.values(brand.playbook).filter((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)).length;
}

function Field({ label, name, hint, error, optional = false, children }: { label: string; name: string; hint?: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return <div className="field"><label htmlFor={name}>{label}{optional ? <span className="optional-label">Optional</span> : null}</label>{children}{hint ? <span className="field-hint">{hint}</span> : null}{error ? <span className="error" role="alert">{error}</span> : null}</div>;
}
