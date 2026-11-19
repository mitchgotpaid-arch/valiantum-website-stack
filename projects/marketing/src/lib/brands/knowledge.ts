import {createHash} from 'node:crypto';
import type {BrandSummary} from '@/data/brands';
import type {BrandFact,BrandRule,BrandSource,MediaPolicy} from '@/data/brand-governance';
import {buildBrandAgentContext,type BrandAgentContext} from './agent-context';
export const KNOWLEDGE_VERSION='valiantum-brand-v1';
export interface BrandGovernanceKnowledge {brandId:string;facts:BrandFact[];rules:BrandRule[];sources:BrandSource[];mediaPolicy:MediaPolicy}
export interface KnowledgeFact {id:string;key:string;value:string;sourceUrl:string;reviewedAt:string;validUntil:string|null}
export interface BrandKnowledge {version:string;fingerprint:string;facts:KnowledgeFact[];rules:{type:BrandRule['ruleType'];text:string}[];sources:{name:string;url:string;tier:number}[];mediaPolicy:MediaPolicy}
export interface KnowledgeCheck {key:string;label:string;passed:boolean;help:string}
export interface BrandKnowledgeResult {context:BrandAgentContext;knowledge:BrandKnowledge;checks:KnowledgeCheck[];ready:boolean;excluded:{fact:BrandFact;reason:string}[];eligibleCount:number;selectedCount:number}
export function matchesApprovedSource(candidate:string,base:string){
 try{const a=new URL(candidate),b=new URL(base);if(a.protocol!=='https:'||b.protocol!=='https:'||a.username||a.password||b.username||b.password)return false;return a.origin===b.origin&&(b.pathname==='/'||a.pathname===b.pathname||a.pathname.startsWith(b.pathname.replace(/\/$/,'')+'/'));}catch{return false;}
}
export function factExclusion(fact:BrandFact,sources:BrandSource[],now:number){
 if(fact.verificationStatus!=='VERIFIED')return 'Not owner-verified';
 if(!fact.sourceUrl||!sources.some(s=>s.isApproved&&s.sourceTier<=3&&s.baseUrl&&matchesApprovedSource(fact.sourceUrl!,s.baseUrl)))return 'Needs an approved HTTPS source';
 const reviewed=Date.parse(fact.updatedAt||'');
 if(!Number.isFinite(reviewed)||reviewed>now+60_000)return 'Needs a valid review date';
 if(fact.validFrom&&(!Number.isFinite(Date.parse(fact.validFrom))||Date.parse(fact.validFrom)>now))return 'Not effective yet';
 if(fact.validUntil&&(!Number.isFinite(Date.parse(fact.validUntil))||Date.parse(fact.validUntil)<=now))return 'Expired';
 const days=(/(?:price|pricing|cost|subscription|discount|trial|launch|availability|offer|promotion)/i.test(fact.factKey+' '+fact.value)||/[$£€%]/.test(fact.value))?30:90;
 if(now-reviewed>days*86_400_000)return `Review is older than ${days} days`;
 return null;
}
export function buildBrandKnowledge(brand:BrandSummary,governance:BrandGovernanceKnowledge,brief='',now=new Date()):BrandKnowledgeResult{
 if(governance.brandId!==brand.id)throw new Error('Brand knowledge identity mismatch.');
 const profile=buildBrandAgentContext(brand);const {logoAssetUrl:_logo,...textProfile}=profile;void _logo;
 const excluded:BrandKnowledgeResult['excluded']=[],eligible:KnowledgeFact[]=[];
 for(const fact of governance.facts){const reason=factExclusion(fact,governance.sources,now.getTime());if(reason)excluded.push({fact,reason});else eligible.push({id:fact.id,key:fact.factKey,value:fact.value,sourceUrl:fact.sourceUrl!,reviewedAt:fact.updatedAt!,validUntil:fact.validUntil||null});}
 eligible.sort((a,b)=>a.id.localeCompare(b.id));
 const rules=governance.rules.filter(rule=>rule.isActive).map(rule=>({type:rule.ruleType,text:rule.ruleText}));
 const sources=governance.sources.filter(s=>s.isApproved&&s.sourceTier<=3&&s.baseUrl&&matchesApprovedSource(s.baseUrl,s.baseUrl)).map(s=>({name:s.name,url:s.baseUrl!,tier:s.sourceTier})).sort((a,b)=>a.url.localeCompare(b.url));
 const fingerprint=createHash('sha256').update(JSON.stringify({version:KNOWLEDGE_VERSION,brandId:brand.id,profile:textProfile,facts:eligible,rules,sources,mediaPolicy:governance.mediaPolicy})).digest('hex');
 const words=[...new Set(brief.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu)||[])];
 const ranked=eligible.map(fact=>({fact,score:words.reduce((score,word)=>score+((fact.key+' '+fact.value).toLowerCase().includes(word)?1:0),0)})).sort((a,b)=>b.score-a.score||a.fact.id.localeCompare(b.fact.id));
 let size=0;const facts:KnowledgeFact[]=[];for(const {fact} of ranked){const length=JSON.stringify(fact).length;if(facts.length<24&&size+length<=18000){facts.push(fact);size+=length;}}
 const knowledge:BrandKnowledge={version:KNOWLEDGE_VERSION,fingerprint,facts,rules,sources,mediaPolicy:governance.mediaPolicy};
 const checks:KnowledgeCheck[]=[
 {key:'identity',label:'Brand purpose',passed:!!brand.description.trim(),help:'Describe what this brand does and what it does not do.'},
 {key:'audience',label:'Defined audience',passed:!!brand.targetAudience?.trim(),help:'Describe the people you serve, their needs, and their objections.'},
 {key:'voice',label:'Voice direction',passed:!!brand.brandVoice?.trim(),help:'Explain the tone, vocabulary, and approach that sound like you.'},
 {key:'examples',label:'Approved voice example',passed:!!brand.playbook.approvedExamples.trim(),help:'Add at least one example you would be comfortable putting your name on.'},
 {key:'sources',label:'Approved factual source',passed:sources.length>0,help:'Approve the official HTTPS pages used to substantiate your brand claims.'},
 {key:'facts',label:'Fresh verified facts',passed:facts.length>0,help:'Review at least one sourced fact. Time-sensitive facts expire after 30 days; other facts after 90 days.'},
 {key:'rules',label:'Editorial boundaries',passed:rules.length>0,help:'Add an active always, never, or require-review rule.'},
 {key:'conflicts',label:'No unresolved conflicting facts',passed:!governance.facts.some(f=>f.verificationStatus==='CONFLICTING'),help:'Resolve conflicting facts before generating new content.'},
 {key:'budget',label:'Context fits the drafting budget',passed:JSON.stringify({...textProfile,knowledge}).length<=48000,help:'Shorten long guidance or consolidate rules; safety rules are never silently dropped.'},
 ];
 return {context:{...profile,knowledge},knowledge,checks,ready:checks.every(check=>check.passed),excluded,eligibleCount:eligible.length,selectedCount:facts.length};
}
export function inspectDraftAgainstKnowledge(draft:{body:string;claimReferences:{claim:string;factIds:string[]}[]},brand:BrandAgentContext){
 const issues:string[]=[];const known=new Set(brand.knowledge?.facts.map(f=>f.id)||[]),copy=draft.body.toLowerCase();
 for(const ref of draft.claimReferences){if(!ref.factIds.length||ref.factIds.some(id=>!known.has(id)))issues.push('A claim refers to missing or unapproved evidence.');if(!copy.includes(ref.claim.toLowerCase()))issues.push('A model-reported claim does not appear verbatim in the draft.');}
 if(/\[verify\b/i.test(copy))issues.push('The draft contains an unresolved verification marker.');
 for(const phrase of brand.guardrails?.requiredDisclosures||[])if(!copy.includes(phrase.toLowerCase()))issues.push(`Missing required disclosure: ${phrase}`);
 for(const phrase of brand.editorialRules?.avoidedVocabulary||[])if(copy.includes(phrase.toLowerCase()))issues.push(`Avoided wording appears: ${phrase}`);
 const numberTokens=copy.match(/\b\d+(?:[.,]\d+)*%?\b/g)||[];
 const evidence=brand.knowledge?.facts.map(f=>f.value).join(' ').toLowerCase()||'';
 if(numberTokens.some(token=>!evidence.includes(token)))issues.push('A number in the copy needs manual evidence checking.');
 return [...new Set(issues)].slice(0,12);
}

// Private, review-only ideation needs a coherent brand foundation, but does not
// need a complete factual library. Missing evidence stays visible on every draft.
export function canDraftAutomatically(training:Pick<BrandKnowledgeResult,'checks'>){const essential=['identity','audience','voice','conflicts','budget'];return essential.every(key=>training.checks.some(check=>check.key===key&&check.passed));}
