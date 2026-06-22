import { ProfessionDetail } from "@/components/profession-detail";

/** Profession detail route: inherited (read-only) + this profession's fields. */
export default async function ProfessionPage({
  params,
}: {
  params: Promise<{ categoryId: string; professionId: string }>;
}) {
  const { categoryId, professionId } = await params;
  return (
    <ProfessionDetail categoryId={categoryId} professionId={professionId} />
  );
}
