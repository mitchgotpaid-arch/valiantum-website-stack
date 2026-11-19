import 'server-only';
import {AuthenticationRequiredError} from '@/data/auth';
import {ProjectBriefError} from '@/data/project-briefs';
import {hasSupabaseEnv} from '@/lib/env';
export function setupResponse(){return !hasSupabaseEnv()?Response.json({error:'Connect Marketing OS to your existing Supabase project in hosting settings.',code:'SETUP_REQUIRED'},{status:503}):null;}
export function sameOrigin(request:Request){
  const expected=new URL(process.env.APP_ORIGIN||process.env.NEXT_PUBLIC_APP_URL||request.url).origin;
  return request.headers.get('origin')===expected&&request.headers.get('content-type')?.split(';')[0]==='application/json';
}
export function projectApiError(error:unknown){
  if(error instanceof AuthenticationRequiredError)return Response.json({error:'Sign in to your Marketing OS account.',loginUrl:'/marketing/login'},{status:401});
  if(error instanceof ProjectBriefError){
    if(error.code==='NOT_PERMITTED')return Response.json({error:'Your Marketing OS account cannot access this brand.'},{status:403});
    if(error.code==='INVALID_STATE')return Response.json({error:'This card is already linked to another brand. Open its existing marketing brief.'},{status:409});
    if(error.code==='SETUP_REQUIRED')return Response.json({error:'Apply the Projects integration migration to your existing Marketing OS database.',code:'SETUP_REQUIRED'},{status:503});
  }
  console.error('[projects bridge] request failed',{name:error instanceof Error?error.name:'unknown'});
  return Response.json({error:'The marketing request could not be completed. Try again.'},{status:500});
}
