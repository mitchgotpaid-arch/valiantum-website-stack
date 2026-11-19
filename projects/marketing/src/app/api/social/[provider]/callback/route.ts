import {NextResponse,type NextRequest} from 'next/server';
import {requireUser} from '@/data/auth';
import {canAdminPublishingBrand} from '@/data/publishing';
import {isOAuthProvider} from '@/lib/social/catalog';
import {verifySocialState,exchangeSocialCode,discoverSocialAccounts,socialOrigin,SocialError} from '@/lib/social/oauth';
import {createPendingConnection} from '@/lib/social/pending';
export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const provider=(await params).provider.toUpperCase();if(!isOAuthProvider(provider))return new Response('Invalid platform.',{status:400});
 const {user}=await requireUser(),name='valiantum_social_'+provider.toLowerCase();let brandId:string|undefined;
 const finish=(path:string)=>{const response=NextResponse.redirect(new URL(path,socialOrigin(process.env)));response.cookies.set(name,'',{httpOnly:true,secure:true,sameSite:'lax',path:`/marketing/api/social/${provider.toLowerCase()}`,maxAge:0});response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');return response;};
 try{const state=verifySocialState(request.cookies.get(name)?.value,request.nextUrl.searchParams.get('state'),provider,user.id,process.env);brandId=state.brandId;if(!await canAdminPublishingBrand(brandId))throw Error('Permission denied.');if(request.nextUrl.searchParams.has('error'))return finish(`/marketing/connections?brand=${brandId}&outcome=cancelled&platform=${provider}`);const code=request.nextUrl.searchParams.get('code');if(!code||code.length>8000)throw new SocialError('INVALID_STATE');const token=await exchangeSocialCode(provider,code,state,process.env);const accounts=await discoverSocialAccounts(provider,token,process.env);const ticket=createPendingConnection({userId:user.id,brandId,provider,token,accounts});return finish('/marketing/connections/select?ticket='+encodeURIComponent(ticket));}
 catch(error){const outcome=error instanceof SocialError?error.code.toLowerCase():'failed';return finish(`/marketing/connections?outcome=${outcome}&platform=${provider}${brandId?'&brand='+brandId:''}`);}
}
