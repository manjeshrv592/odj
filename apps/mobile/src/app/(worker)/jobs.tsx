import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { appApi } from "@/lib/app-api";
import { JobList } from "@/components/job-list";
import { Text } from "@/components/ui/text";

/** Worker Jobs tab — Active / Completed / Cancelled. */
export default function WorkerJobs() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <Text className="pt-2 text-2xl font-poppins-semibold text-foreground">
          My jobs
        </Text>
        <JobList
          keyBase="worker"
          fetcher={appApi.workerJobs}
          onOpenActive={() => router.push("/job" as Href)}
          onRate={(item) =>
            router.push(`/(worker)/rate-job?jobId=${item.id}` as Href)
          }
          onViewProfile={(item) =>
            router.push(
              `/(worker)/hirer-profile?id=${item.counterpartProfileId}` as Href,
            )
          }
          onOpenChat={(item) =>
            router.push(`/(worker)/chat?jobId=${item.id}` as Href)
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
