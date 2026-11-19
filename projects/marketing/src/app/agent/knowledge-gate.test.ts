import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocked=vi.hoisted(()=>({reserve:vi.fn(),draft:vi.fn(),briefing:vi.fn(),canGenerate:vi.fn(),getBrand:vi.fn(),governance:vi.fn(),save:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));vi.mock('next/navigation',()=>({redirect:vi.fn()}));
vi.mock('@/data/ai',()=>({AiDataError:class extends Error{},canGenerateForBrand:mocked.canGenerate,reserveAiBudget:mocked.reserve,failAiBudgetReservation:vi.fn(),saveGeneratedDraft:mocked.save,saveGeneratedDailyBriefing:mocked.save,saveCapturedDailyBriefing:mocked.save}));
vi.mock('@/data/auth',()=>({AuthenticationRequiredError:class extends Error{}}));
vi.mock('@/data/brands',()=>({BrandDataError:class extends Error{},getBrand:mocked.getBrand}));
vi.mock('@/data/brand-governance',()=>({getBrandGovernance:mocked.governance}));
vi.mock('@/lib/ai/draft-generator',()=>({BRAND_DRAFT_RESERVATION_MICROS:10000,generateBrandDraft:mocked.draft}));
vi.mock('@/lib/ai/daily-briefing',()=>({DAILY_BRIEFING_RESERVATION_MICROS:450000,generateDailyBriefing:mocked.briefing}));
vi.mock('@/lib/ai/config',()=>({getAiEnvironment:()=>({OPENAI_DRAFT_MODEL:'synthetic',OPENAI_BRIEFING_MODEL:'synthetic'})}));
import {generateDraftAction,generateDailyBriefingAction} from './actions';
import {brand,governance} from '@/lib/brands/knowledge-fixture';
beforeEach(()=>{vi.clearAllMocks();mocked.canGenerate.mockResolvedValue(true);mocked.getBrand.mockResolvedValue({...brand,brandVoice:null});mocked.governance.mockResolvedValue(governance());mocked.reserve.mockResolvedValue('reservation');mocked.draft.mockResolvedValue({title:'Draft',body:'An evergreen question for fans.',researchNotes:[],requiresResearch:false});mocked.save.mockResolvedValue('draft-id');});
function form(){const f=new FormData();f.set('brandId',brand.id);f.set('brief','Write a useful brand introduction for our audience.');f.set('contentType','SOCIAL_POST');f.set('operatorFocus','A useful introduction.');return f;}
describe('knowledge checks precede spending',()=>{
 it('allows an explicit manual assignment with incomplete knowledge and keeps the warning on the draft',async()=>{await generateDraftAction({},form());expect(mocked.reserve).toHaveBeenCalled();expect(mocked.draft).toHaveBeenCalled();expect(mocked.save).toHaveBeenCalledWith(expect.objectContaining({channel:'FACEBOOK'}),expect.objectContaining({requiresResearch:true,researchNotes:[expect.stringContaining('Brand setup is incomplete')]}),'reservation');});
 it('applies the same free readiness gate to research briefings',async()=>{const result=await generateDailyBriefingAction({},form());expect(result.error).toContain('Knowledge setup');expect(mocked.reserve).not.toHaveBeenCalled();expect(mocked.briefing).not.toHaveBeenCalled();});
 it('denies an unauthorized brand before loading its knowledge',async()=>{mocked.canGenerate.mockResolvedValue(false);const result=await generateDraftAction({},form());expect(result.error).toContain('permission');expect(mocked.getBrand).not.toHaveBeenCalled();expect(mocked.governance).not.toHaveBeenCalled();expect(mocked.reserve).not.toHaveBeenCalled();});
});
