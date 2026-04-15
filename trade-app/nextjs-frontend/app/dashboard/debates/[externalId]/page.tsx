import { redirect } from "next/navigation";

export default async function LegacyDebateDetailPage({
  params,
}: {
  params: Promise<{ externalId: string }>;
}) {
  const { externalId } = await params;
  redirect(`/debates/${externalId}`);
}
