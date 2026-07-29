import { useLocalSearchParams, type Href } from "expo-router";
import { RateJobScreen } from "@/components/rate-job-screen";

/** Worker rates the hirer for a completed job. */
export default function WorkerRateJob() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return (
    <RateJobScreen
      jobId={jobId ?? ""}
      backHref={"/home" as Href}
      jobsKeyBase="worker"
    />
  );
}
