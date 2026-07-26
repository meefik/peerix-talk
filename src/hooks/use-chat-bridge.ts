import { useEffect } from "react";
import { useRoom } from "@/hooks/use-room";
import type { Room } from "@/hooks/use-peerix";

export function useChatBridge(roomRef: React.MutableRefObject<Room | null>) {
  const { messages } = useRoom();

  useEffect(() => {
    const room = roomRef.current;
    const msg = messages[messages.length - 1];
    if (room && msg && !msg.peer) {
      room.send(msg, { label: "chat" });
    }
  }, [messages]);
}
