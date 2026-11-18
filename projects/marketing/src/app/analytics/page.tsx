import {requirePageUser} from '@/data/page-auth';
import { PageFrame } from "@/components/page-frame";
export default async function AnalyticsPage() { await requirePageUser(); return <PageFrame title="Analytics" description="Compare normalized channel, content, campaign, and cost performance without compromising truth or safety." />; }
