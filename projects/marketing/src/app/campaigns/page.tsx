import {requirePageUser} from '@/data/page-auth';
import { PageFrame } from "@/components/page-frame";
export default async function CampaignsPage() { await requirePageUser(); return <PageFrame title="Campaigns" description="Coordinate objectives, audiences, strategy, channels, content plans, and measured outcomes." />; }
