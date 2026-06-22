import { CategoryDetail } from "@/components/category-detail";

/** Category detail route: professions + category-level requirement fields. */
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const { categoryId } = await params;
  return <CategoryDetail categoryId={categoryId} />;
}
