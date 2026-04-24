import { useEffect, useRef, useState, useCallback } from "react";
import { env } from "../../config/env";

export interface ChatMessage {
  sender_id: number;
  sender_name: string;
  sender_role: string;
  text: string;
  timestamp: string;
}

export interface LocationUpdate {
  lat: number;
  lng: number;
  rider_name: string;
}

export function useDeliverySocket(orderId: number | string | undefined, token: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [location, setLocation] = useState<LocationUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [presence, setPresence] = useState<any[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!orderId || !token) return;

    // Build WS URL (Assuming secure if https, otherwise ws)
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = env.apiBase.replace(/^https?:\/\//, "");
    const wsUrl = `${protocol}//${host}/notifications/ws/delivery/${orderId}?token=${token}`;

    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("Connected to delivery socket");
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === "chat") {
        setMessages((prev) => [...prev, data]);
      } else if (data.type === "location") {
        setLocation(data);
      } else if (data.type === "presence") {
        setPresence((prev) => {
           const others = prev.filter(p => p.user !== data.user);
           return [...others, data];
        });
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from delivery socket");
      setIsConnected(false);
    };

    socket.onerror = (err) => {
      console.error("Socket error:", err);
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [orderId, token]);

  const sendChat = useCallback((text: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "chat",
        text,
        timestamp: new Date().toISOString()
      }));
    }
  }, []);

  const sendLocation = useCallback((lat: number, lng: number) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "location",
        lat,
        lng
      }));
    }
  }, []);

  return {
    messages,
    location,
    isConnected,
    presence,
    sendChat,
    sendLocation
  };
}
