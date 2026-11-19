import Link from 'next/link';
import {requirePageUser} from '@/data/page-auth';
import {requireUser} from '@/data/auth';
import {getBrand} from '@/data/brands';
import {canAdminPublishingBrand} from '@/data/publishing';
import {getPendingConnection} from '@/lib/social/pending';
import {PageFrame} from '@/components/page-frame';
import {SelectAccountForm} from '../connection-forms';
export default async function SelectConnectionPage({searchParams}:{searchParams:Promise<{ticket?:string}>}){await requirePageUser();const {user}=await requireUser(),{ticket}=await searchParams;const pending=ticket?getPendingConnection(ticket,user.id):null;if(!pending||!await canAdminPublishingBrand(pending.brandId))return <PageFrame title="Start a fresh connection" description="This account selection expired or is no longer available."><Link href="/connections" className="button">Back to Connections</Link></PageFrame>;const brand=await getBrand(pending.brandId);if(!brand)return <PageFrame title="Brand unavailable" description="Choose a brand before connecting an account."/>;const accounts=pending.accounts.map(account=>({id:account.id,name:pending.provider==='META'&&'instagram_business_account' in account&&account.instagram_business_account?.username?account.name+' + Instagram @'+account.instagram_business_account.username:account.name,...('username' in account?{username:account.username}:{})}));return <PageFrame title="The right account. The right brand." description={`Confirm which ${pending.provider==='META'?'Facebook Page and linked Instagram account':pending.provider} account belongs to ${brand.name}. This connection does not publish content.`}><section className="card form-card"><SelectAccountForm ticket={ticket!} accounts={accounts} brandName={brand.name}/></section></PageFrame>}
