# Teaching the Valiantum agents

Brand Knowledge is the reference library used at generation time. It does not retrain model weights. Current, inspectable context and a repeatable evaluation loop are the first approach here, consistent with [OpenAI's accuracy guidance](https://developers.openai.com/api/docs/guides/optimizing-llm-accuracy) and [evaluation practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices).

## Set up each brand

1. Open **Marketing → Brand Knowledge → Teach this brand**. State what the brand does, who it serves, and how it should sound. Existing profile guidance remains available in Brand Settings.
2. Supply 2–5 short examples you would publish, with notes explaining what works. Add counterexamples and explain what should change. These are style references, never automatic evidence for factual claims.
3. Add official HTTPS sources. Approval covers the exact origin and, when supplied, the selected path and its descendants. Look-alike domains, insecure URLs, credentials in URLs and discovery-only tier-4 sources cannot substantiate facts. A URL is not automatically fetched or imported.
4. Add concise, separately sourced product facts. Mark a fact verified only after checking it, using the explicit review checkbox. Examples: current product capabilities, approved positioning, supported pricing and the limits of the offering. Do not invent facts to complete setup.
5. Add always, never, or require-review rules, disclosures and avoided vocabulary. Media policies continue to apply. Source approval can be withdrawn and rules deactivated without deleting their records.
6. Run the three prefilled calibration briefs. They open in the AI assistant without a paid request; generation only starts when you submit. Assess the voice, evidence, disclosures and refusal to invent an unsupported offer. Iterate on the knowledge and examples, then repeat.

## How generation works

The server verifies access to the selected brand and checks setup before reserving AI spend. Eligible facts must be VERIFIED, tied to an approved HTTPS source, effective now, not expired and recently reviewed. Time-sensitive prices, subscriptions, costs, discounts, trials, offers, launches and availability require review within 30 days; other facts within 90 days. These are application freshness defaults, not a guarantee that a claim remains accurate for that long.

Relevant facts are ranked against the brief and bounded to 24 facts / 18,000 characters. Active safety rules are never silently dropped: an excessive context blocks generation for cleanup. The full eligible knowledge library, profile and media policy have a fingerprint, so changing a fact or rule can be detected on previously generated drafts.

Routine social drafts use a writer followed by a separate skeptical review pass on the configured draft model. Both passes use the same retrieved brand context. The reviewer checks factual support, voice, rules and disclosures. This is a separate pass, not an independently trained verifier. Deterministic checks also flag unknown fact references, missing disclosures, avoided phrases, verification markers and numbers needing evidence checks. Claims mapped to fact IDs still require checking that those facts actually support the wording.

Both passes' returned token usage counts toward the existing application budget. If review fails, the draft is retained for human review, flagged and conservatively charged the full drafting reservation against the app cap. No extra API calls or paid generation run just from visiting Knowledge pages. Research briefings use the same knowledge gate and context alongside their existing web-source checks; they do not receive the routine draft's separate critic pass.

## Evidence and feedback

New routine AI drafts append a server-created knowledge record to the existing immutable generation audit metadata. The record includes the knowledge fingerprint, supplied fact snapshots and URLs, the model-reported claim references, review result, detected issues and an original-copy hash. The review page flags changed knowledge and edits to generated copy. Routine model notes cannot supersede that final server-created record. Existing drafts without a record are explicitly labelled for manual checking.

Research briefings retain a knowledge-version fingerprint in their existing prompt-version metadata, rather than a per-claim brand evidence snapshot. Live-research sources remain separate. Human-authored drafts and social copies made from briefings are not silently represented as having passed the new AI review pipeline.

An approved social post, caption or thread can be explicitly saved as a voice example from its review page. Only someone with edit access can do this; the underlying content must still be approved when the action executes. It updates this brand only, avoids duplicate examples, preserves other profile keys, respects the example-size limit and rejects concurrent overwrites. Factual claims in examples do not become verified facts.

## Limits and verification

Setup completeness is not an accuracy score. Owner-entered data can be wrong, a source can change before its review interval, lexical retrieval can omit a useful fact, and both model passes can miss an error. Human review remains mandatory; publishing eligibility and authority are unchanged. No automatic source crawling, document ingestion, vector store, provider fine-tuning, or publication was enabled.

This release reuses existing brand facts, rules, sources, profiles and audit tables with their RLS and audit triggers. No service-role key or new database grants are needed. Source/rule changes and teaching edits use the existing signed-in identity. Profile and fact revisions reject stale writes.

Verification includes synthetic eligibility, source-boundary, freshness, conflict, context-budget, claim-check and writer/reviewer tests; readiness-before-spend action tests; the complete database migration chain with tenant/role boundaries and stale fact writes; existing authentication regressions; production build/types; and desktop/mobile UI checks with synthetic content. No live paid model generation or public post was made as part of verification. Real brand output quality must be calibrated using your approved examples and actual test drafts.
