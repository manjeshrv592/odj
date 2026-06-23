import { notFound } from "next/navigation";
import { profileKindSchema } from "@odj/shared";
import { VerificationDetail } from "@/components/verification-detail";

export default async function VerificationDetailPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;
  const kind = profileKindSchema.safeParse(type);
  if (!kind.success) notFound();
  return <VerificationDetail type={kind.data} id={id} />;
}
