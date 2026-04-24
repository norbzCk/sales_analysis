import { useState, useEffect, useRef } from "react";
import { ChatMessage } from "./useDeliverySocket";

interface DeliveryChatProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  currentUserId: number | undefined;
  otherPartyName: string;
}

export function DeliveryChat({ messages, onSend, currentUserId, otherPartyName }: DeliveryChatProps) {
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onSend(inputText.trim());
      setInputText("");
    }
  };

  return (
    <div className="flex flex-col h-[400px] md:h-[500px] glass-card overflow-hidden">
      <div className="p-4 bg-brand text-white flex justify-between items-center shadow-lg shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs uppercase">
            {otherPartyName[0] || 'D'}
          </div>
          <div>
            <h3 className="font-display font-bold text-sm leading-none">{otherPartyName}</h3>
            <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Live Conversation</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Live</span>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/50"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
            <div className="p-4 bg-white rounded-2xl shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.003 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Start the conversation</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm font-medium shadow-sm
                  ${isMe ? 'bg-slate-900 text-white rounded-tr-none' : 'bg-white text-slate-900 rounded-tl-none border border-slate-100'}
                `}>
                  {msg.text}
                </div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mt-1 px-1">
                   {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 shrink-0 flex gap-2">
        <input 
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 px-4 py-2 bg-slate-50 border-2 border-transparent focus:border-brand/20 focus:bg-white rounded-xl outline-none transition-all font-semibold text-sm"
          placeholder="Type your message..."
        />
        <button 
          type="submit"
          className="p-2 bg-brand text-white rounded-xl shadow-md hover:shadow-lg active:scale-90 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
}
