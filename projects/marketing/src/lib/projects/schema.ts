import {z} from 'zod';
export const projectCardBriefSchema=z.object({
  sourceProjectId:z.uuid(),sourceCardId:z.uuid(),sourceProjectName:z.string().trim().min(1).max(160),
  brandId:z.uuid(),title:z.string().trim().min(1).max(200),body:z.string().max(50000),
}).strict();
export type ProjectCardBriefInput=z.infer<typeof projectCardBriefSchema>;
export const projectBriefProgressSchema=z.object({
  id:z.uuid(),sourceProjectId:z.uuid(),sourceCardId:z.uuid(),sourceProjectName:z.string(),
  brandId:z.uuid(),brandName:z.string(),contentId:z.uuid(),title:z.string(),
  status:z.enum(['IDEA','RESEARCHING','DRAFTING','VERIFYING','NEEDS_REVIEW','APPROVED','SCHEDULED','PUBLISHING','PUBLISHED','FAILED','REJECTED']),
  updatedAt:z.string(),createdAt:z.string(),
});
export type ProjectBriefProgress=z.infer<typeof projectBriefProgressSchema>;
export function projectBriefText(project:{name:string;description:string;links:string},card:{title:string;description:string;checklist:Array<{text:string;done:boolean}>}){
  return [`Project: ${project.name}`,project.description?`Project context:\n${project.description}`:'',`Card: ${card.title}`,card.description,card.checklist.length?'Checklist:\n'+card.checklist.map(item=>`${item.done?'[x]':'[ ]'} ${item.text}`).join('\n'):'',project.links?'Project resources:\n'+project.links:''].filter(Boolean).join('\n\n');
}
