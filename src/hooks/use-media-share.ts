import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRoom } from "@/hooks/use-room";
import { useStorage } from "@/hooks/use-storage";
import { getUserMedia, getDisplayMedia } from "@/lib/media";
import type { Room } from "@/hooks/use-peerix";

export function useMediaShare(roomRef: React.MutableRefObject<Room | null>) {
  const { mic, cam, scr, toggleCam, toggleMic, toggleScr } = useRoom();
  const { value: audioDeviceId } = useStorage("audioDeviceId");
  const { value: videoDeviceId } = useStorage("videoDeviceId");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (mic || cam) {
      async function acquire() {
        try {
          const stream = await getUserMedia({ audio: mic, video: cam, audioDeviceId, videoDeviceId });
          streamRef.current = stream;
          roomRef.current?.share({ stream, label: "camera" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err), { position: "top-center" });
          toggleCam(false);
          toggleMic(false);
        }
      }
      acquire();
    } else {
      roomRef.current?.unshare({ label: "camera" });
      streamRef.current = null;
    }
  }, [mic, cam]);

  useEffect(() => {
    if (scr) {
      async function acquire() {
        try {
          const stream = await getDisplayMedia();
          roomRef.current?.share({ stream, label: "screen" });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : String(err), { position: "top-center" });
          toggleScr(false);
        }
      }
      acquire();
    } else {
      roomRef.current?.unshare({ label: "screen" });
    }
  }, [scr]);

  return streamRef;
}
