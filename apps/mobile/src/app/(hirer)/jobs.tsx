import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";
import { appApi } from "@/lib/app-api";
import { JobList } from "@/components/job-list";
import { Text } from "@/components/ui/text";

/** Hirer Jobs tab — Active / Completed / Cancelled. */
export default function HirerJobs() {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerClassName="gap-5 p-6">
        <Text className="pt-2 text-2xl font-poppins-semibold text-foreground">
          My jobs
        </Text>
        <JobList
          keyBase="hirer"
          fetcher={appApi.hirerJobs}
          onOpenActive={(item) =>
            router.push(`/(hirer)/search?jobId=${item.id}` as Href)
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}
