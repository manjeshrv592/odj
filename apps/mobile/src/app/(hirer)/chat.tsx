import { useLocalSearchParams } from "expo-router";
import { ChatScreen } from "@/components/chat-screen";

/** Hirer's chat with the matched worker for a job (?jobId). */
export default function HirerChat() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  return <ChatScreen jobId={jobId ?? ""} myRole="hirer" />;
}
