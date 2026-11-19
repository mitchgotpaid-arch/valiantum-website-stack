import {readBriefJson,RequestBodyTooLarge} from '@/lib/projects/request-body';
import {z} from 'zod';
import {importProjectCard,listProjectBriefs} from '@/data/project-briefs';
import {projectCardBriefSchema} from '@/lib/projects/schema';
import {projectApiError,sameOrigin,setupResponse} from '@/lib/projects/api';
export async function GET(request:Request){
  const setup=setupResponse();if(setup)return setup;
  const project=new URL(request.url).searchParams.get('projectId');
  if(project&&!z.uuid().safeParse(project).success)return Response.json({error:'Invalid project.'},{status:400});
  try{return Response.json({briefs:await listProjectBriefs(project??undefined)},{headers:{'Cache-Control':'no-store'}});}catch(error){return projectApiError(error);}
}
export async function POST(request:Request){
  if(!sameOrigin(request))return Response.json({error:'Request origin rejected.'},{status:403});
  const setup=setupResponse();if(setup)return setup;
  let body:unknown;
  try {body=await readBriefJson(request);}
  catch(error){return Response.json({error:error instanceof RequestBodyTooLarge?'Brief is too large.':'Invalid request.'},{status:error instanceof RequestBodyTooLarge?413:400});}
  const parsed=projectCardBriefSchema.safeParse(body);if(!parsed.success)return Response.json({error:'Check the brand, project and brief fields.'},{status:400});
  try{const result=await importProjectCard(parsed.data);return Response.json({...result,reviewPath:`/marketing/content/${result.contentId}`},{status:result.alreadyExists?200:201});}catch(error){return projectApiError(error);}
}
