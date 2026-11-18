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
  if(Number(request.headers.get('content-length')||'0')>100000)return Response.json({error:'Brief is too large.'},{status:413});
  let body:unknown;try{const text=await request.text();if(text.length>100000)return Response.json({error:'Brief is too large.'},{status:413});body=JSON.parse(text);}catch{return Response.json({error:'Invalid request.'},{status:400});}
  const parsed=projectCardBriefSchema.safeParse(body);if(!parsed.success)return Response.json({error:'Check the brand, project and brief fields.'},{status:400});
  try{const result=await importProjectCard(parsed.data);return Response.json({...result,reviewPath:`/marketing/content/${result.contentId}`},{status:result.alreadyExists?200:201});}catch(error){return projectApiError(error);}
}
