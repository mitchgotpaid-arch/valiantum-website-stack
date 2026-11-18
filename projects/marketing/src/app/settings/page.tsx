import {requirePageUser} from '@/data/page-auth';
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandForm } from "@/app/brands/brand-form";
import { BrandLogoForm } from "@/app/brands/brand-logo-form";
import { DeleteBrandForm } from "@/app/brands/delete-brand-form";
import { PageFrame } from "@/components/page-frame";
import { listBrands } from "@/data/brands";
import { listPublishingDestinations } from "@/data/publishing";
import { buildBrandAgentContext } from "@/lib/brands/agent-context";
import { hasSupabaseEnv } from "@/lib/env";
import { hasMetaEnvironment } from "@/lib/publishing/config";
import { PublishingSettings } from "./publishing-settings";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ brand?: string; meta?: string }> }) {
  await requirePageUser();
  const brands = hasSupabaseEnv() ? await listBrands() : [];
  const resolvedSearchParams = await searchParams;
  const requestedBrandId = resolvedSearchParams.brand;
  const requestedBrand = requestedBrandId ? brands.find((brand) => brand.id === requestedBrandId) : undefined;
  if (requestedBrandId && !requestedBrand) notFound();
  const activeBrand = requestedBrand ?? brands[0];
  const publishingDestinations = activeBrand ? await listPublishingDestinations(activeBrand.id) : [];

  return <PageFrame title="Settings" description="Manage Brand identity, assets, Agent guidance, and workspace controls in one place.">
    {brands.length > 1 ? <nav aria-label="Choose a Brand" className="settings-brand-picker">
      {brands.map((brand) => {
        const optionalCount = Object.keys(buildBrandAgentContext(brand)).length - 1;
        return <Link aria-current={brand.id === activeBrand?.id ? "page" : undefined} className={brand.id === activeBrand?.id ? "settings-brand-option active" : "settings-brand-option"} href={`/settings?brand=${brand.id}`} key={brand.id}>
          <strong>{brand.name}</strong><span>{optionalCount} optional {optionalCount === 1 ? "setting" : "settings"}</span>
        </Link>;
      })}
    </nav> : null}

    {activeBrand ? <>
      <div className="settings-heading-row"><div><span className="eyebrow">Brand workspace</span><h2>{activeBrand.name}</h2><p>Fill in only what is useful. Blank optional fields are ignored by the Marketing Agent.</p></div><Link className="button button-secondary" href="/brands/new">Add another brand</Link></div>
      <section className="card form-card settings-section">
        <div className="section-heading"><div><h2>Logo and visual identity</h2><p>Store the approved logo the Agent can use when creating graphics.</p></div></div>
        <BrandLogoForm brand={activeBrand} />
      </section>
      <section className="card form-card settings-section">
        <div className="section-heading"><div><h2>Brand information and Agent guidance</h2><p>These settings provide context; they do not grant publication authority.</p></div></div>
        <BrandForm brand={activeBrand} />
      </section>
      <section className="card form-card settings-section">
        <div className="section-heading"><div><h2>Publishing channels</h2><p>Connect official provider accounts and choose how approved content leaves Valiantum.</p></div></div>
        <PublishingSettings destinations={publishingDestinations} metaConfigured={hasMetaEnvironment()} metaOutcome={resolvedSearchParams.meta} />
      </section>
      <section className="card danger-card settings-section">
        <div className="section-heading"><div><h2>Danger zone</h2><p>Permanently remove this Brand after confirming its name.</p></div></div>
        <DeleteBrandForm brandId={activeBrand.id} brandName={activeBrand.name} />
      </section>
    </> : <section className="card section-card settings-card">
      <div className="empty"><strong>No Brand settings yet</strong>Create a Brand, then its logo and optional Agent fields will appear here.<div style={{ marginTop: 18 }}><Link className="button" href="/brands/new">Create first brand</Link></div></div>
    </section>}
  </PageFrame>;
}
