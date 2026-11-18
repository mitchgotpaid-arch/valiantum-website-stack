import Link from 'next/link';
import {PageFrame} from '@/components/page-frame';
import {listProjectBriefs,ProjectBriefError} from '@/data/project-briefs';
import {hasSupabaseEnv} from '@/lib/env';
import {AuthenticationRequiredError} from '@/data/auth';
import {redirect} from 'next/navigation';
export default async function ProjectBriefsPage(){
  let briefs:Awaited<ReturnType<typeof listProjectBriefs>>=[];
  let setup=!hasSupabaseEnv();
  if(!setup){
    try{briefs=await listProjectBriefs();}
    catch(error){
      if(error instanceof AuthenticationRequiredError)redirect('/login');
      if(error instanceof ProjectBriefError&&error.code==='SETUP_REQUIRED')setup=true;
      else throw error;
    }
  }
  return <PageFrame title="Project briefs" description="Ideas from your Projects workspace, connected to marketing review.">
    <section className="card section-card">
      {setup?<div className="empty"><strong>Connect your existing Marketing OS database</strong><p>Add the existing Supabase URL and publishable key to hosting settings, then apply the Projects bridge migration. Use your existing database to preserve brands, drafts and review history.</p><p>Marketing sign-in is required after your private Projects sign-in.</p></div>:briefs.length?<div className="brief-list">{briefs.map(brief=><article className="project-brief" key={brief.id}><div><div className="eyebrow">{brief.brandName} · {brief.sourceProjectName}</div><h2>{brief.title}</h2><p className="subtitle">{brief.status.toLowerCase().replaceAll('_',' ')} · Updated {new Date(brief.updatedAt).toLocaleDateString()}</p></div><div className="brief-actions"><Link className="button" href={`/content/${brief.contentId}`}>Review brief</Link><a className="button secondary" href={`/?project=${brief.sourceProjectId}`}>Source project ↗</a></div></article>)}</div>:<div className="empty"><strong>No project briefs yet</strong>Open a saved card in Projects and choose “Send saved card to Marketing OS”. Choose a brand and review the brief before sending.</div>}
      <p className="subtitle">Review status appears on the source card when you return to Projects. Your project stage stays under your control. Sending a brief does not generate AI content or publish it.</p>
      <a className="button secondary" href="/">← Return to Projects</a>
    </section>
  </PageFrame>;
}
