import { FormEvent, useState } from "react";
import { useTheme } from "../features/auth/ThemeContext";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

interface AIAssistantProps {
  isOpen: boolean;
  onToggle: () => void;
  messages: AssistantMessage[];
  onSendMessage: (message: string) => void;
}

export function AIAssistant({ isOpen, onToggle, messages, onSendMessage }: AIAssistantProps) {
  const { theme } = useTheme();
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <>
      {/* Overlay when open */}
      {isOpen && (
        <div
          className="ai-overlay"
          onClick={onToggle}
        />
      )}

      {/* AI Assistant Panel */}
      <div className={`ai-assistant ${isOpen ? 'open' : ''}`}>
        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-content">
            <div className="ai-icon">🤖</div>
            <div>
              <h3>AI Shopping Assistant</h3>
              <p>Ask me about products, sellers, or recommendations</p>
            </div>
          </div>
          <button className="ai-close" onClick={onToggle}>
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`ai-message ${message.role === 'user' ? 'user' : 'assistant'}`}
            >
              <div className="ai-message-content">
                {message.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input Form */}
        <form className="ai-input-form" onSubmit={handleSubmit}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what you're looking for..."
            className="ai-input"
          />
          <button type="submit" className="ai-send-btn">
            Send
          </button>
        </form>
      </div>

      {/* Toggle Button */}
      <button
        className="ai-toggle-btn"
        onClick={onToggle}
        aria-label="Toggle AI Assistant"
      >
        {isOpen ? '×' : '🤖'}
      </button>
    </>
  );
}