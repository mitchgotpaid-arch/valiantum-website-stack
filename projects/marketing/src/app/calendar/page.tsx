import {listFacebookDeliveries,FacebookDataError} from '@/data/facebook-deliveries';
import {requirePageUser} from '@/data/page-auth';
import {PageFrame} from '@/components/page-frame';
import {ContentCalendar} from '@/components/marketing/content-calendar';
import {listContentQueue} from '@/data/content';
import {hasSupabaseEnv} from '@/lib/env';
export default async function CalendarPage(){await requirePageUser();const items=hasSupabaseEnv()?await listContentQueue():[];let deliveries:Awaited<ReturnType<typeof listFacebookDeliveries>>=[];if(hasSupabaseEnv())try{deliveries=await listFacebookDeliveries();}catch(e){if(!(e instanceof FacebookDataError&&e.code==='SETUP_REQUIRED'))throw e;}const calendarItems=items.map(item=>({...item,scheduledFor:deliveries.find(d=>d.content_id===item.id&&d.status==='SENT')?.scheduled_for||null}));return <PageFrame title="Make a little room for what’s next." description="One view of your content across every Valiantum brand. Find the rhythm behind your ideas."><ContentCalendar items={calendarItems}/></PageFrame>}
