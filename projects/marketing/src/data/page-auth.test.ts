import {beforeEach,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('next/navigation',()=>({redirect:vi.fn(()=>{throw new Error('LOGIN_REDIRECT');})}));
vi.mock('@/lib/env',()=>({hasSupabaseEnv:vi.fn()}));
vi.mock('./auth',()=>({AuthenticationRequiredError:class AuthenticationRequiredError extends Error{},requireUser:vi.fn()}));
import {hasSupabaseEnv} from '@/lib/env';
import {AuthenticationRequiredError,requireUser} from './auth';
import {redirect} from 'next/navigation';
import {requirePageUser} from './page-auth';
beforeEach(()=>{vi.resetAllMocks();vi.mocked(redirect).mockImplementation(()=>{throw new Error('LOGIN_REDIRECT');});});
describe('page authentication fallback',()=>{
 it('redirects missing sessions instead of showing a server error',async()=>{
  vi.mocked(hasSupabaseEnv).mockReturnValue(true);vi.mocked(requireUser).mockRejectedValue(new AuthenticationRequiredError());
  await expect(requirePageUser()).rejects.toThrow('LOGIN_REDIRECT');expect(redirect).toHaveBeenCalledWith('/login');
 });
 it('continues with a verified session and does not hide unrelated errors',async()=>{
  vi.mocked(hasSupabaseEnv).mockReturnValue(true);vi.mocked(requireUser).mockResolvedValue({user:{id:'owner'}} as Awaited<ReturnType<typeof requireUser>>);
  await expect(requirePageUser()).resolves.toBeUndefined();expect(redirect).not.toHaveBeenCalled();
  vi.mocked(requireUser).mockRejectedValue(new Error('Database unavailable'));await expect(requirePageUser()).rejects.toThrow('Database unavailable');
 });
 it('keeps the private setup page available before database configuration',async()=>{
  vi.mocked(hasSupabaseEnv).mockReturnValue(false);await requirePageUser();expect(requireUser).not.toHaveBeenCalled();
 });
});
