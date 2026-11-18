import {requirePageUser} from '@/data/page-auth';
import { PageFrame } from "@/components/page-frame";
export default async function CalendarPage() { await requirePageUser(); return <PageFrame title="Calendar" description="Review planned, approved, and scheduled content across every brand and platform." />; }
