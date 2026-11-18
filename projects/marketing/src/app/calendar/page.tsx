import {requirePageUser} from '@/data/page-auth';
import {PageFrame} from '@/components/page-frame';
import {ContentCalendar} from '@/components/marketing/content-calendar';
import {listContentQueue} from '@/data/content';
import {hasSupabaseEnv} from '@/lib/env';
export default async function CalendarPage(){await requirePageUser();const items=hasSupabaseEnv()?await listContentQueue():[];return <PageFrame title="Make a little room for what’s next." description="One view of your content across every Valiantum brand. Find the rhythm behind your ideas."><ContentCalendar items={items}/></PageFrame>}
