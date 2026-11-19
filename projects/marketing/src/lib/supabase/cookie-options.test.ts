import {afterEach,describe,it,expect,vi} from 'vitest';
import {authCookieOptions} from './cookie-options';
afterEach(()=>vi.unstubAllEnvs());
describe('server-only authentication cookies',()=>{
 it('overrides insecure input in production while preserving expiry',()=>{
  vi.stubEnv('NODE_ENV','production');
  expect(authCookieOptions({httpOnly:false,secure:false,sameSite:'none',maxAge:3600})).toEqual({httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:3600});
 });
 it('allows localhost development without exposing tokens to scripts',()=>{
  vi.stubEnv('NODE_ENV','development');
  expect(authCookieOptions({})).toMatchObject({secure:false,httpOnly:true,sameSite:'lax'});
 });
});
