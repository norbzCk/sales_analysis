import { AIAssistant } from "./AIAssistant";
import { useAIAssistant } from "../features/ai/AIAssistantContext";

export function GlobalAIAssistant() {
  const { isOpen, isReplying, toggleAssistant, messages, sendMessage } = useAIAssistant();

  return (
    <AIAssistant
      isOpen={isOpen}
      isReplying={isReplying}
      onToggle={toggleAssistant}
      messages={messages}
      onSendMessage={sendMessage}
    />
  );
}
