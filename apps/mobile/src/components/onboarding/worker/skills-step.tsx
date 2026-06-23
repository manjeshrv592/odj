import * as React from "react";
import { View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { Category } from "@odj/shared";
import { appApi } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { Chips } from "@/components/ui/chips";

/**
 * Worker "Skills" step: pick one or more professions from the active catalog,
 * grouped by category. The selected profession ids are lifted to the wizard.
 * Empty categories (no active professions) are hidden.
 */
export function SkillsStep({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (professionIds: string[]) => void;
}) {
  const categoriesQ = useQuery({
    queryKey: ["app-categories"],
    queryFn: appApi.categories,
  });

  if (categoriesQ.isLoading) {
    return <ActivityIndicator />;
  }
  if (!categoriesQ.data?.length) {
    return (
      <Text className="text-muted-foreground">
        No skill categories are available yet.
      </Text>
    );
  }

  return (
    <View className="gap-5">
      {categoriesQ.data.map((category) => (
        <CategorySection
          key={category.id}
          category={category}
          selected={selected}
          onChange={onChange}
        />
      ))}
    </View>
  );
}

function CategorySection({
  category,
  selected,
  onChange,
}: {
  category: Category;
  selected: string[];
  onChange: (professionIds: string[]) => void;
}) {
  const professionsQ = useQuery({
    queryKey: ["app-professions", category.id],
    queryFn: () => appApi.professions(category.id),
  });

  const options = (professionsQ.data ?? []).map((p) => ({
    value: p.id,
    label: p.name,
  }));
  if (!options.length) return null;

  return (
    <View className="gap-2">
      <Text className="font-poppins-medium text-base">{category.name}</Text>
      <Chips options={options} selected={selected} onChange={onChange} />
    </View>
  );
}
