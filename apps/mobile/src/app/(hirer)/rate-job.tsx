import { useLocalSearchParams, type Href } from "expo-router";
import { RateJobScreen } from "@/components/rate-job-screen";

/** Hirer rates the worker for a completed job. */
export default function HirerRateJob() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return (
    <RateJobScreen
      jobId={jobId ?? ""}
      backHref={"/(hirer)" as Href}
      jobsKeyBase="hirer"
    />
  );
}
