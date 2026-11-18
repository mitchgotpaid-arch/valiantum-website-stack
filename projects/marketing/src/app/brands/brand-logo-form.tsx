"use client";

import { useActionState } from "react";
import type { BrandSummary } from "@/data/brands";
import { removeBrandLogoAction, uploadBrandLogoAction, type BrandActionState } from "./actions";

const initialState: BrandActionState = {};

export function BrandLogoForm({ brand }: { brand: BrandSummary }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadBrandLogoAction.bind(null, brand.id), initialState);
  const [removeState, removeAction, removePending] = useActionState(removeBrandLogoAction.bind(null, brand.id), initialState);
  const initials = brand.name.split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

  return <div className="logo-settings">
    {brand.logoUrl
      ? <div aria-label={`${brand.name} logo`} className="brand-logo-preview" role="img" style={{ backgroundImage: `url(${brand.logoUrl})` }} />
      : <div aria-label={`${brand.name} has no logo`} className="brand-logo-preview brand-logo-fallback" role="img">{initials}</div>}
    <div className="logo-settings-copy">
      <strong>Brand logo</strong>
      <p>Upload the primary logo the Agent should use when creating Brand graphics. PNG, JPEG, or WebP; maximum 5 MB.</p>
      <form action={uploadAction} className="logo-upload-form">
        <input accept="image/png,image/jpeg,image/webp" aria-label="Brand logo file" name="logo" required type="file" />
        {uploadState.fieldErrors?.logo?.[0] ? <span className="error" role="alert">{uploadState.fieldErrors.logo[0]}</span> : null}
        {uploadState.error ? <span className="error" role="alert">{uploadState.error}</span> : null}
        {uploadState.success ? <span className="success" role="status">{uploadState.success}</span> : null}
        <button className="button" disabled={uploadPending} type="submit">{uploadPending ? "Uploading…" : brand.logoPath ? "Replace logo" : "Upload logo"}</button>
      </form>
      {brand.logoPath ? <form action={removeAction}>
        {removeState.error ? <span className="error" role="alert">{removeState.error}</span> : null}
        {removeState.success ? <span className="success" role="status">{removeState.success}</span> : null}
        <button className="text-danger" disabled={removePending} type="submit">{removePending ? "Removing…" : "Remove logo"}</button>
      </form> : null}
    </div>
  </div>;
}
