import { redirect } from "next/navigation";

export default async function GovernancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/brands/${encodeURIComponent(id)}/knowledge`);
}
