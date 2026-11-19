import {listEditableMarketingBrands} from '@/data/project-briefs';
import {projectApiError,setupResponse} from '@/lib/projects/api';
export async function GET(){const setup=setupResponse();if(setup)return setup;try{return Response.json({brands:await listEditableMarketingBrands()},{headers:{'Cache-Control':'no-store'}});}catch(error){return projectApiError(error);}}
