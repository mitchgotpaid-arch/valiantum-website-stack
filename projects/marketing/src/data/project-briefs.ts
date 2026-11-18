import 'server-only';
import {z} from 'zod';
import {requireUser} from '@/data/auth';
import {projectBriefProgressSchema,type ProjectCardBriefInput} from '@/lib/projects/schema';
export class ProjectBriefError extends Error {
  constructor(readonly code:'NOT_PERMITTED'|'INVALID_STATE'|'SETUP_REQUIRED'|'DATABASE_ERROR'){super(code);}
}
function databaseError(code?:string):never{
  if(code==='42501')throw new ProjectBriefError('NOT_PERMITTED');
  if(code==='23514')throw new ProjectBriefError('INVALID_STATE');
  if(['PGRST202','PGRST205','42P01','42883'].includes(code||''))throw new ProjectBriefError('SETUP_REQUIRED');
  throw new ProjectBriefError('DATABASE_ERROR');
}
export async function listProjectBriefs(projectId?:string){
  const {supabase}=await requireUser();
  const {data,error}=await supabase.rpc('get_project_card_briefs',{p_source_project_id:projectId??undefined});
  if(error)databaseError(error.code);
  return z.array(projectBriefProgressSchema).parse(data);
}
export async function importProjectCard(input:ProjectCardBriefInput){
  const {supabase}=await requireUser();
  const {data,error}=await supabase.rpc('import_project_card',{
    p_source_project_id:input.sourceProjectId,p_source_card_id:input.sourceCardId,p_source_project_name:input.sourceProjectName,
    p_brand_id:input.brandId,p_title:input.title,p_body:input.body,
  });
  if(error)databaseError(error.code);
  return z.object({id:z.uuid(),contentId:z.uuid(),alreadyExists:z.boolean()}).parse(data);
}
export async function listEditableMarketingBrands(){
  const {supabase}=await requireUser();
  const {data,error}=await supabase.from('brands').select('id,name').order('name');
  if(error)databaseError(error.code);
  const permissions=await Promise.all(data.map(async brand=>{
    const permission=await supabase.rpc('can_edit_brand',{target_brand_id:brand.id});
    if(permission.error)databaseError(permission.error.code);
    return permission.data?brand:null;
  }));
  return permissions.filter((brand):brand is NonNullable<typeof brand>=>brand!==null);
}
