import Link from "next/link";
import { PageFrame } from "@/components/page-frame";
import { listBrands } from "@/data/brands";
import { hasSupabaseEnv } from "@/lib/env";

export default async function BrandsPage() {
  if (!hasSupabaseEnv()) return <PageFrame title="Brands" description="Configure brand identity, product truth, sources, media rules, budgets, and publication authority."><SetupRequired /></PageFrame>;
  const brands = await listBrands();
  return (
    <PageFrame title="Brands" description="Configure brand identity, product truth, sources, media rules, budgets, and publication authority.">
      <div className="toolbar"><span>{brands.length} {brands.length === 1 ? "brand" : "brands"}</span><Link className="button" href="/brands/new">Add brand</Link></div>
      {brands.length ? <div className="brand-list">{brands.map((brand) => <Link className="card brand-card" href={`/settings?brand=${brand.id}`} key={brand.id}><div className="brand-card-main">{brand.logoUrl ? <div aria-label={`${brand.name} logo`} className="brand-logo-thumb" role="img" style={{ backgroundImage: `url(${brand.logoUrl})` }} /> : <div aria-hidden="true" className="brand-logo-thumb brand-logo-fallback">{brandInitials(brand.name)}</div>}<div><span className="eyebrow">{brand.industry ?? "Uncategorized"}</span><h2>{brand.name}</h2><p>{brand.description || "No description yet."}</p></div></div><div className="brand-status"><span className="badge warning">{autonomyLabel(brand.autonomy)}</span><span>Publishing {brand.publishingEnabled ? "on" : "off"}</span></div></Link>)}</div> : <div className="card section-card"><div className="empty"><strong>No brands yet</strong>Create a brand to establish its identity, guidance, and content workspace.<div style={{ marginTop: 18 }}><Link className="button" href="/brands/new">Create first brand</Link></div></div></div>}
    </PageFrame>
  );
}

function SetupRequired() {
  return <div className="card section-card"><div className="empty"><strong>Connect Supabase first</strong>Add the project URL and publishable key to <code>.env.local</code>, then apply the initial migrations. Brand data is never mocked as live data.</div></div>;
}

function autonomyLabel(autonomy: string) {
  return autonomy === "LEVEL_1_MANUAL" ? "Manual" : autonomy.replaceAll("_", " ").toLowerCase();
}

function brandInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}
