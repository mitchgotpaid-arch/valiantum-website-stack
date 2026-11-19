import {describe,it,expect} from 'vitest';
import {projectCardBriefSchema,projectBriefText} from './schema';
const valid={sourceProjectId:'423a3333-6dab-4a7b-8147-ec797924b700',sourceCardId:'423a3333-6dab-4a7b-8147-ec797924b701',brandId:'423a3333-6dab-4a7b-8147-ec797924b702',sourceProjectName:'Launch',title:'Launch brief',body:'Context'};
describe('project handoff validation',()=>{
 it('accepts a bounded snapshot and rejects forged identifiers and excess fields',()=>{
  expect(projectCardBriefSchema.safeParse(valid).success).toBe(true);
  for(const input of [{...valid,brandId:'bad'},{...valid,title:' '},{...valid,body:'x'.repeat(50001)},{...valid,status:'APPROVED'}])expect(projectCardBriefSchema.safeParse(input).success).toBe(false);
 });
 it('includes source context, checklist progress and resources in a brief',()=>{
  const brief=projectBriefText({name:'Launch',description:'Audience',links:'https://example.com'},{title:'Announce',description:'Draft this',checklist:[{text:'Review',done:false},{text:'Research',done:true}]});
  expect(brief).toContain('[ ] Review');expect(brief).toContain('[x] Research');expect(brief).toContain('Audience');expect(brief).toContain('https://example.com');
 });
});
