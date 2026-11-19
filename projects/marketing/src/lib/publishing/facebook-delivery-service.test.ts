import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocked=vi.hoisted(()=>({claim:vi.fn(),complete:vi.fn(),send:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/data/facebook-deliveries',()=>({claimFacebookDelivery:mocked.claim,completeFacebookDelivery:mocked.complete}));
vi.mock('./config',()=>({getMetaEnvironment:()=>({META_APP_SECRET:'test-meta-secret-at-least-32-characters'})}));
vi.mock('./facebook-live',async original=>({...await original<typeof import('./facebook-live')>(),sendFacebookText:mocked.send}));
import {executeFacebookDelivery} from './facebook-delivery-service';
import {encryptProviderCredential} from './credential-crypto';
import {FacebookDeliveryError} from './facebook-live';
const input={contentId:'content',updatedAt:'today',pageId:'123',reviewed:true,scheduledFor:null};
const delivery={id:'delivery',brand_id:'brand',page_id:'123',body_snapshot:'Approved words',scheduled_for:null,mode:'NOW',status:'PROCESSING'};
beforeEach(()=>{vi.clearAllMocks();mocked.claim.mockResolvedValue({shouldExecute:true,delivery,encryptedCredential:encryptProviderCredential({facebookPageId:'123',pageAccessToken:'private-token'},'test-meta-secret-at-least-32-characters','brand:brand:provider:META')});mocked.complete.mockResolvedValue(undefined);mocked.send.mockResolvedValue('123_456');});
describe('publication claim and receipt pipeline',()=>{
 it('does not resend an existing delivery',async()=>{mocked.claim.mockResolvedValue({shouldExecute:false,delivery:{...delivery,status:'SENT'}});await executeFacebookDelivery(input);expect(mocked.send).not.toHaveBeenCalled();});
 it('uses the locked copy snapshot and stores the provider receipt',async()=>{await executeFacebookDelivery(input);expect(mocked.send).toHaveBeenCalledWith(expect.objectContaining({body:'Approved words',pageId:'123',token:'private-token'}),expect.anything());expect(mocked.complete).toHaveBeenCalledWith('delivery','SENT','123_456',null);});
 it('records ambiguity without treating it as a definitive rejection',async()=>{mocked.send.mockRejectedValue(new FacebookDeliveryError('UNKNOWN'));await expect(executeFacebookDelivery(input)).rejects.toThrow('may have accepted');expect(mocked.complete).toHaveBeenCalledWith('delivery','UNKNOWN',null,'OUTCOME_UNKNOWN');expect(mocked.send).toHaveBeenCalledOnce();});
 it('does not retry or overwrite a success if storing the receipt fails',async()=>{mocked.complete.mockRejectedValue(Error('DB unavailable'));await expect(executeFacebookDelivery(input)).rejects.toThrow('receipt could not be saved');expect(mocked.send).toHaveBeenCalledOnce();expect(mocked.complete).toHaveBeenCalledOnce();});
});
