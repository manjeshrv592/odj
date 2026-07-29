import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "@/components/chat-screen";

/** Worker's chat with the hirer for a job (?jobId). */
export default function WorkerChat() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return <ChatScreen jobId={jobId ?? ""} myRole="worker" />;
}
