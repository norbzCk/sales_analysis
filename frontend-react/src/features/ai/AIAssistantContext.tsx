import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiRequest } from "../../lib/http";

export type AssistantMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type AssistantContextValue = {
  isOpen: boolean;
  messages: AssistantMessage[];
  isReplying: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
  sendMessage: (message: string) => Promise<void>;
};

const AIAssistantContext = createContext<AssistantContextValue | null>(null);
const ASSISTANT_STORAGE_KEY = "sokolink_ai_conversation_id";

function getAreaLabel(pathname: string) {
  if (pathname === "/") return "marketplace home";
  if (pathname.includes("/seller")) return "seller workspace";
  if (pathname.includes("/customer")) return "customer dashboard";
  if (pathname.includes("/logistics")) return "logistics workspace";
  if (pathname.includes("/superadmin")) return "super admin area";
  if (pathname.includes("/settings")) return "settings page";
  if (pathname.includes("/profile")) return "profile page";
  if (pathname.includes("/orders")) return "orders page";
  if (pathname.includes("/products")) return "products page";
  if (pathname.includes("/notifications")) return "notifications page";
  return "current page";
}

function buildAssistantReply(message: string, pathname: string, roleLabel: string, displayName: string) {
  const query = message.trim().toLowerCase();
  const area = getAreaLabel(pathname);
  const name = displayName || "there";

  if (!query) {
    return `I’m here with you, ${name}. Tell me what you want to do in the ${area} and I’ll guide you step by step.`;
  }

  if (/(hello|hi|hey|mambo|habari)/.test(query)) {
    return `I’m here with you, ${name}. You can ask for help with products, orders, settings, profile updates, or what to do next in the ${area}.`;
  }

  if (/(product|catalog|item|search|find|buy|recommend)/.test(query)) {
    return pathname === "/"
      ? "Describe the product, category, budget, or preferred seller and I’ll help you narrow down what to look for in the marketplace."
      : `You’re in the ${area}, so I can help you find the right product flow from here. If you tell me the item, budget, or supplier type, I’ll suggest the next best step.`;
  }

  if (/(order|delivery|shipment|track|dispatch|fulfill)/.test(query)) {
    return roleLabel === "logistics"
      ? "I can help you stay on top of deliveries. Check route status, assigned orders, and any stalled handoffs, then I can help you decide what to tackle first."
      : "I can help with the order flow. If you’re checking fulfillment, tracking, or delayed delivery, tell me what stage you’re in and I’ll point you to the right action.";
  }

  if (/(profile|account|photo|name|email|phone)/.test(query)) {
    return "For account updates, start in your profile page and save the essentials first. If something is not updating the way you expect, tell me which field is giving trouble and I’ll help troubleshoot it.";
  }

  if (/(setting|password|theme|dark|light|notification|preference)/.test(query)) {
    return "Settings are best handled one small step at a time. I can help you change theme, preferences, or account controls and explain what each option affects before you save it.";
  }

  if (/(seller|business|customer|buyer|logistics|admin|super)/.test(query)) {
    return `You’re signed in as ${roleLabel}. I’ll keep my guidance aligned with that role so the suggestions stay practical for what you can actually do in this area.`;
  }

  if (/(help|support|stuck|how|what next|next step)/.test(query)) {
    return `Let’s keep it simple. In the ${area}, the next best move is to focus on one task at a time. Tell me the goal you’re trying to finish and I’ll break it into clear steps.`;
  }

  return `I’m with you in the ${area}. Share the outcome you want, and I’ll help you work toward it in a practical way that fits your ${roleLabel} access.`;
}

export function AIAssistantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const roleLabel = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    if (role === "seller") return "seller";
    if (role === "user") return "customer";
    if (role === "logistics") return "logistics";
    if (role === "super_admin" || role === "owner") return "super admin";
    if (role === "admin") return "admin";
    return "guest";
  }, [user?.role]);

  const displayName = user?.name || user?.business_name || user?.owner_name || user?.email || "";

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      text: "I’m your SokoLink assistant. I’m available throughout the app to help with products, orders, account tasks, and the next step whenever you need support.",
    },
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedId = window.localStorage.getItem(ASSISTANT_STORAGE_KEY);
    if (!storedId) return;
    setConversationId(storedId);
  }, []);

  useEffect(() => {
    if (!conversationId) return;
    let isCancelled = false;

    async function loadConversation() {
      try {
        const response = await apiRequest<{ conversation_id: string; messages: AssistantMessage[] }>(
          `/ai/assistant/history/${conversationId}`,
          { auth: Boolean(user) },
        );

        if (isCancelled || !response.messages.length) return;
        setMessages(response.messages);
      } catch {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(ASSISTANT_STORAGE_KEY);
        }
        if (!isCancelled) {
          setConversationId(null);
        }
      }
    }

    void loadConversation();

    return () => {
      isCancelled = true;
    };
  }, [conversationId, user]);

  useEffect(() => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      const routeHint = `You’re now in the ${getAreaLabel(location.pathname)}. I’ll keep my help focused on what matters here.`;
      if (last?.role === "assistant" && last.text === routeHint) {
        return prev;
      }
      return [...prev, { id: `route-${Date.now()}`, role: "assistant", text: routeHint }];
    });
  }, [location.pathname]);

  function openAssistant() {
    setIsOpen(true);
  }

  function closeAssistant() {
    setIsOpen(false);
  }

  function toggleAssistant() {
    setIsOpen((prev) => !prev);
  }

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed) return;

    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, text: trimmed };
    const history = messages.slice(-8).map((item) => ({ role: item.role, text: item.text }));

    setMessages((prev) => [
      ...prev,
      userMessage,
    ]);
    setIsOpen(true);
    setIsReplying(true);

    try {
      const response = await apiRequest<{ conversation_id: string; reply: string }>("/ai/assistant", {
        method: "POST",
        auth: Boolean(user),
        body: {
          message: trimmed,
          current_path: location.pathname,
          conversation_id: conversationId,
          history,
        },
      });

      setConversationId(response.conversation_id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(ASSISTANT_STORAGE_KEY, response.conversation_id);
      }

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now() + 1}`, role: "assistant", text: response.reply },
      ]);
    } catch {
      const reply = buildAssistantReply(trimmed, location.pathname, roleLabel, displayName);
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now() + 1}`, role: "assistant", text: reply },
      ]);
    } finally {
      setIsReplying(false);
    }
  }

  return (
    <AIAssistantContext.Provider
      value={{ isOpen, messages, isReplying, openAssistant, closeAssistant, toggleAssistant, sendMessage }}
    >
      {children}
    </AIAssistantContext.Provider>
  );
}

export function useAIAssistant() {
  const context = useContext(AIAssistantContext);
  if (!context) {
    throw new Error("useAIAssistant must be used within AIAssistantProvider");
  }
  return context;
}
