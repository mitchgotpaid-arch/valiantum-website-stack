import {NextResponse,type NextRequest} from 'next/server';
import {z} from 'zod';
import {requireUser} from '@/data/auth';
import {canAdminPublishingBrand} from '@/data/publishing';
import {isOAuthProvider} from '@/lib/social/catalog';
import {createSocialAuthorization,socialOrigin} from '@/lib/social/oauth';
export async function GET(request:NextRequest,{params}:{params:Promise<{provider:string}>}){
 const provider=(await params).provider.toUpperCase(),brand=z.uuid().safeParse(request.nextUrl.searchParams.get('brandId'));
 if(!isOAuthProvider(provider)||!brand.success)return new Response('Invalid platform or brand.',{status:400});
 const {user}=await requireUser();if(!await canAdminPublishingBrand(brand.data))return new Response('Not permitted.',{status:403});
 try{const flow=createSocialAuthorization(provider,brand.data,user.id,process.env);const response=NextResponse.redirect(flow.url);response.headers.set('Cache-Control','no-store');response.headers.set('Referrer-Policy','no-referrer');response.cookies.set('valiantum_social_'+provider.toLowerCase(),flow.cookie,{httpOnly:true,secure:true,sameSite:'lax',path:`/marketing/api/social/${provider.toLowerCase()}`,maxAge:600});return response;}
 catch{const url=new URL('/marketing/connections',socialOrigin(process.env));url.searchParams.set('brand',brand.data);url.searchParams.set('platform',provider);url.searchParams.set('outcome','setup_required');return NextResponse.redirect(url);}
}
