import {requirePageUser} from '@/data/page-auth';
import {AppShell} from '@/components/app-shell';
import {MarketingOverview} from '@/components/marketing/overview';
import {listBrands} from '@/data/brands';
import {listContentQueue} from '@/data/content';
import {hasSupabaseEnv} from '@/lib/env';
export default async function DashboardPage(){await requirePageUser();const [brands,items]=hasSupabaseEnv()?await Promise.all([listBrands(),listContentQueue()]):[[],[]];return <AppShell><MarketingOverview brands={brands} items={items}/></AppShell>}
