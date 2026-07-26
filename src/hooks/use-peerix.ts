import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { CONFIG } from "@/lib/config";
import { roomId } from "@/lib/room-info";
import { useRouter } from "@/hooks/use-router";
import { useStorage } from "@/hooks/use-storage";
import { useRoom } from "@/hooks/use-room";
import {
  Room,
  BroadcastChannelDriver,
  NatsDriver,
  MqttDriver,
  SseDriver,
  type Driver,
} from "peerix";
import type { Message } from "@/lib/types";

/**
 * Creates a Peerix Driver instance based on the loaded config.
 *
 * - "broadcastchannel" (default) — no external dependency needed.
 * - "nats" — dynamically imports `@nats-io/nats-core` and creates a WebSocket NATS connection.
 * - "mqtt" — dynamically imports `mqtt` and creates an MQTT client.
 * - "sse" — uses the built-in SseDriver with Mercure-compatible options.
 */
async function createDriver(): Promise<Driver> {
  if (!CONFIG.driver) {
    return new BroadcastChannelDriver();
  }

  switch (CONFIG.driver.type) {
    case "nats": {
      const { wsconnect } = (await import("@nats-io/nats-core")) as any;
      const nc = await wsconnect({
        servers: CONFIG.driver.servers,
        noEcho: true,
      });
      return new NatsDriver({ nc, prefix: CONFIG.driver.prefix });
    }

    case "mqtt": {
      const mqtt = (await import("mqtt")) as any;
      const connect = mqtt.connect || mqtt.default?.connect;
      if (!connect) throw new Error("mqtt module does not export connect");

      const client = connect(CONFIG.driver.server);
      return new MqttDriver({ client, prefix: CONFIG.driver.prefix });
    }

    case "sse": {
      return new SseDriver({
        url: CONFIG.driver.url,
        subscriber: {},
        publisher: {
          headers: {
            Authorization: `Bearer ${CONFIG.driver.publisherJwtKey}`,
          },
        },
      });
    }
  }
}

/**
 * Creates a P2P room with the configured driver and ICE settings.
 */
async function createRoom(id: string): Promise<Room> {
  const driver = await createDriver();
  return new Room({
    id,
    driver,
    iceServers: CONFIG.iceServers,
    iceTransportPolicy: CONFIG.iceTransportPolicy,
  });
}

export function usePeerix() {
  const { t } = useTranslation();
  const { navigate } = useRouter();
  const { value: username } = useStorage("username");
  const {
    cam,
    mic,
    setParticipants,
    setMessages,
    toggleCam,
    toggleMic,
    toggleScr,
  } = useRoom();
  const roomRef = useRef<Room | null>(null);
  const camRef = useRef(cam);
  const micRef = useRef(mic);
  const nameRef = useRef(username);

  camRef.current = cam;
  micRef.current = mic;
  nameRef.current = username;

  const join = useCallback(
    async (initialStream?: MediaStream | null) => {
      const room = await createRoom(roomId);
      roomRef.current = room;

      const name = nameRef.current || t("common.defaultUserName");

      room.on("error", (e) => {
        console.error("Peer error:", e.error);
      });

      room.on("connection:new", (e) => {
        const { peer } = e;
        setParticipants((prev) => [
          ...prev,
          {
            peer: peer.id,
            label: "camera",
            name: `${peer.metadata?.name ?? t("common.defaultUserName")}`,
          },
        ]);
      });

      room.on("connection:closed", (e) => {
        const { peer } = e;
        setParticipants((prev) => prev.filter((p) => p.peer !== peer.id));
      });

      room.on("track", (e) => {
        const { peer, stream, label } = e;

        // Local or remote identifiers
        const isLocal = !peer;
        const peerId = isLocal ? roomRef.current?.id || name : peer.id;
        const participantName = isLocal
          ? name
          : `${peer.metadata?.name ?? t("common.defaultUserName")}`;

        // Stream removed — stop sharing
        if (!stream.active) {
          setParticipants((prev) =>
            label === "camera"
              ? prev.map((p) =>
                  p.label === label && p.peer === peerId
                    ? { peer: peerId, label, name: participantName }
                    : p,
                )
              : prev.filter((p) => !(p.label === label && p.peer === peerId)),
          );
          if (isLocal) {
            if (label === "camera") {
              toggleCam(false);
              toggleMic(false);
            }
            if (label === "screen") {
              toggleScr(false);
            }
          }
          return;
        }

        // Build entry — local uses refs, remote reads from stream tracks
        const entry = isLocal
          ? {
              peer: peerId,
              label,
              name,
              ...(label === "camera"
                ? { audio: micRef.current, video: camRef.current, mirror: true }
                : { video: true, audio: true }),
              stream,
              muted: true,
            }
          : {
              peer: peerId,
              label,
              name: participantName,
              stream,
              audio: stream.getAudioTracks().length > 0,
              video: stream.getVideoTracks().length > 0,
            };

        setParticipants((prev) => {
          const idx = prev.findIndex(
            (p) => p.label === label && p.peer === peerId,
          );
          return idx >= 0
            ? prev.map((p, i) => (i === idx ? entry : p))
            : [...prev, entry];
        });
      });

      room.on("channel:message", async (e) => {
        const { peer, data } = e;
        const message = (await data) as Message;
        setMessages((prev) => [...prev, { ...message, peer: peer.id }]);
      });

      await room.open({ label: "chat" });
      await room.join({ name });

      if (initialStream) {
        await room.share({ stream: initialStream, label: "camera" });
      } else {
        setParticipants((prev) => [
          ...prev,
          { peer: roomRef.current?.id || name, label: "camera", name },
        ]);
      }

      navigate("room");
    },
    [
      navigate,
      t,
      username,
      setParticipants,
      setMessages,
      toggleCam,
      toggleMic,
      toggleScr,
    ],
  );

  const leave = useCallback(async () => {
    await roomRef.current?.unshare({ label: "camera" });
    await roomRef.current?.unshare({ label: "screen" });
    await roomRef.current?.leave();
    roomRef.current = null;
    setParticipants([]);
    setMessages([]);
    toggleCam(false);
    toggleMic(false);
    toggleScr(false);
    navigate("lobby");
  }, [navigate, setParticipants, setMessages, toggleCam, toggleMic, toggleScr]);

  return { roomRef, join, leave };
}

export type { Room };
