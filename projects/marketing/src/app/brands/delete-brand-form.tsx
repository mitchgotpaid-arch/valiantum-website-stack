"use client";

import { useActionState } from "react";
import { deleteBrandAction, type BrandActionState } from "./actions";

const initialState: BrandActionState = {};

export function DeleteBrandForm({ brandId, brandName }: { brandId: string; brandName: string }) {
  const action = deleteBrandAction.bind(null, brandId);
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="danger-form">
      <p>Deletion is permanent and is blocked when related content exists. Type <strong>{brandName}</strong> to confirm.</p>
      <div className="field"><label htmlFor="confirmation">Brand name</label><input id="confirmation" name="confirmation" autoComplete="off" />{state.fieldErrors?.confirmation?.[0] ? <span className="error">{state.fieldErrors.confirmation[0]}</span> : null}</div>
      {state.error ? <p className="error" role="alert">{state.error}</p> : null}
      <button className="danger-button" disabled={pending} type="submit">{pending ? "Deleting…" : "Delete brand"}</button>
    </form>
  );
}
