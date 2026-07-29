import * as React from "react";
import { Alert, ActivityIndicator, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appApi, JOB_RATING_KEY } from "@/lib/app-api";
import { Text } from "@/components/ui/text";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StarRating } from "@/components/ui/star-rating";

/**
 * Rate the other party on a job — shared by `(worker)/rate-job` and
 * `(hirer)/rate-job`. Read-only once submitted (one rating per party per job).
 * `jobsKeyBase` invalidates that role's Jobs-tab list cache so a completed row
 * flips from "Rate →" to "Rated ✓" after submit.
 */
export function RateJobScreen({
  jobId,
  backHref,
  jobsKeyBase,
}: {
  jobId: string;
  backHref: Href;
  jobsKeyBase: "worker" | "hirer";
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const [stars, setStars] = React.useState(0);
  const [comment, setComment] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: JOB_RATING_KEY(jobId),
    queryFn: () => appApi.jobRating(jobId),
    enabled: !!jobId,
  });

  const submit = useMutation({
    mutationFn: () =>
      appApi.submitRating(jobId, {
        stars,
        comment: comment.trim() ? comment.trim() : undefined,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: JOB_RATING_KEY(jobId) });
      await qc.invalidateQueries({ queryKey: [jobsKeyBase, "jobs"] });
      router.replace(backHref);
    },
    onError: (e: Error) => Alert.alert("Couldn't submit", e.message),
  });

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!data || !data.canRate) {
    const existing = data?.myRating;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerClassName="flex-1 items-center justify-center gap-4 p-6">
          <Text className="text-2xl font-poppins-semibold text-foreground">
            {existing ? "You already rated this job" : "Nothing to rate here"}
          </Text>
          {existing ? (
            <>
              <StarRating value={existing.stars} />
              {existing.comment ? (
                <Text className="text-center text-muted-foreground">
                  &ldquo;{existing.comment}&rdquo;
                </Text>
              ) : null}
            </>
          ) : null}
          <Button onPress={() => router.replace(backHref)}>
            <Text>Done</Text>
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <Text className="pt-2 text-2xl font-poppins-semibold text-foreground">
          Rate {data.job.counterpartName}
        </Text>
        <Text className="text-muted-foreground">{data.job.professionName}</Text>

        <Card className="items-center gap-4">
          <StarRating value={stars} onChange={setStars} />
          <Field label="Comment (optional)" className="w-full">
            <Input
              value={comment}
              onChangeText={setComment}
              placeholder="How did it go?"
              multiline
              maxLength={500}
              className="h-24 py-3"
            />
          </Field>
        </Card>

        <Button
          onPress={() => submit.mutate()}
          disabled={stars === 0 || submit.isPending}
        >
          {submit.isPending ? (
            <ActivityIndicator />
          ) : (
            <Text>Submit rating</Text>
          )}
        </Button>
      </ScrollView>
    </SafeAreaView>
  );
}
