import Link from "next/link";
import { redirect } from "next/navigation";
import { PageFrame } from "@/components/page-frame";
import { BrandForm } from "../brand-form";
import { hasSupabaseEnv } from "@/lib/env";

export default function NewBrandPage() {
  if (!hasSupabaseEnv()) redirect("/brands");
  return <PageFrame title="Add a brand" description="Start with identity and audience. Safe defaults keep publishing off and autonomy manual."><div className="back-row"><Link href="/brands">← Back to brands</Link></div><section className="card form-card"><BrandForm /></section></PageFrame>;
}
