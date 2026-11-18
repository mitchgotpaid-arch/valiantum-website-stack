import {notFound,redirect} from 'next/navigation';
import {z} from 'zod';
import {hasSupabaseEnv} from '@/lib/env';
import {requirePageUser} from '@/data/page-auth';
import {getBrand} from '@/data/brands';
import {getBrandGovernance} from '@/data/brand-governance';
import {buildBrandKnowledge} from '@/lib/brands/knowledge';
import {PageFrame} from '@/components/page-frame';
import {KnowledgeWorkspace} from '@/components/marketing/knowledge-workspace';
export default async function BrandKnowledgePage({params}:{params:Promise<{id:string}>}){await requirePageUser();if(!hasSupabaseEnv())redirect('/knowledge');const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();const brand=await getBrand(id);if(!brand)notFound();const governance=await getBrandGovernance(id);return <PageFrame title={`${brand.name}, understood.`} description="Teach the voice. Verify the facts. Keep every draft grounded in what your brand actually knows."><KnowledgeWorkspace brand={brand} governance={governance} training={buildBrandKnowledge(brand,governance)}/></PageFrame>}
