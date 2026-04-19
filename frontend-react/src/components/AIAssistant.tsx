import { FormEvent, useState } from "react";

type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

interface AIAssistantProps {
  isOpen: boolean;
  isReplying?: boolean;
  onToggle: () => void;
  messages: AssistantMessage[];
  onSendMessage: (message: string) => void | Promise<void>;
}

export function AIAssistant({ isOpen, isReplying = false, onToggle, messages, onSendMessage }: AIAssistantProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      void onSendMessage(input.trim());
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
        <div className="ai-assistant-backdrop" aria-hidden="true" />

        {/* Header */}
        <div className="ai-header">
          <div className="ai-header-content">
            <div className="ai-icon">🤖</div>
            <div className="ai-header-copy">
              <div className="ai-header-topline">
                <h3>AI Command Desk</h3>
                <span className={`ai-status-pill ${isReplying ? "busy" : "live"}`}>
                  {isReplying ? "Thinking" : "Live"}
                </span>
              </div>
              <p>Products, sellers, orders, and the next best move</p>
            </div>
          </div>
          <button className="ai-close" onClick={onToggle} aria-label="Close assistant">
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
          {isReplying ? (
            <div className="ai-message assistant">
              <div className="ai-message-content">Thinking through the best reply for you...</div>
            </div>
          ) : null}
        </div>

        {/* Input Form */}
        <form className="ai-input-form" onSubmit={handleSubmit}>
          <div className="ai-input-shell">
            <div className="ai-input-accent" aria-hidden="true" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask for help, a reply draft, or the next step..."
            className="ai-input"
            disabled={isReplying}
          />
          </div>
          <button type="submit" className="ai-send-btn" disabled={isReplying}>
            {isReplying ? "..." : "Send"}
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
