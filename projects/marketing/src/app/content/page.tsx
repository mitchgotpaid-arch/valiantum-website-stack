import {requirePageUser} from '@/data/page-auth';
import {PageFrame} from '@/components/page-frame';
import {ContentLibrary} from '@/components/marketing/content-library';
import {listContentQueue} from '@/data/content';
import {hasSupabaseEnv} from '@/lib/env';
export default async function ContentPage(){await requirePageUser();const items=hasSupabaseEnv()?await listContentQueue():[];return <PageFrame title="The content studio" description="A home for every idea, first draft, final edit, and brand story. Make something worth sharing."><ContentLibrary items={items}/></PageFrame>}
