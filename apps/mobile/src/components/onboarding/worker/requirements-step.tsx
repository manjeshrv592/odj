import * as React from "react";
import { View, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { RequirementAnswers } from "@odj/shared";
import { appApi } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { RequirementFieldInput } from "@/components/onboarding/requirement-field";

/**
 * Worker requirement-fields step: fetches the cascaded effective field set for
 * the chosen professions (catalog + category + profession, de-duped by `key`),
 * and renders each by input type. Answers are lifted to the wizard, keyed by the
 * field's stable `key`.
 */
export function RequirementsStep({
  professionIds,
  answers,
  onChange,
}: {
  professionIds: string[];
  answers: RequirementAnswers;
  onChange: (key: string, value: string | null) => void;
}) {
  const fieldsQ = useQuery({
    queryKey: ["app-effreq", [...professionIds].sort().join(",")],
    queryFn: () => appApi.effectiveRequirements(professionIds),
    enabled: professionIds.length > 0,
  });

  if (fieldsQ.isLoading) {
    return <ActivityIndicator />;
  }
  if (!fieldsQ.data?.length) {
    return (
      <Text className="text-muted-foreground">
        No additional details are required for your selected professions.
      </Text>
    );
  }

  return (
    <View className="gap-5">
      {fieldsQ.data.map((field) => (
        <RequirementFieldInput
          key={field.id}
          field={field}
          value={answers[field.key]}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </View>
  );
}
