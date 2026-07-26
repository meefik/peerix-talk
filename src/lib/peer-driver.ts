import { Peer, BroadcastChannelDriver, NatsDriver, MqttDriver, SseDriver, type Driver } from "peerix";
import { CONFIG } from "@/lib/config";

/**
 * Creates a Peerix Driver instance based on the loaded config.
 *
 * - "broadcastchannel" (default) — no external dependency needed.
 * - "nats" — dynamically imports `@nats-io/nats-core` and creates a WebSocket NATS connection.
 * - "mqtt" — dynamically imports `mqtt` and creates an MQTT client.
 * - "sse" — uses the built-in SseDriver with Mercure-compatible options.
 */
export async function createDriver(): Promise<Driver> {
  if (!CONFIG.driver) {
    return new BroadcastChannelDriver();
  }

  switch (CONFIG.driver.type) {
    case "nats": {
      const { wsconnect } = await import("@nats-io/nats-core") as any;
      const nc = await wsconnect({ servers: CONFIG.driver.servers, noEcho: true });
      return new NatsDriver({ nc, prefix: CONFIG.driver.prefix });
    }

    case "mqtt": {
      const mqtt = await import("mqtt") as any;
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
 * Creates a Peer with the configured driver and ICE settings.
 */
export async function createPeer(): Promise<Peer> {
  const driver = await createDriver();
  return new Peer({
    driver,
    iceServers: CONFIG.iceServers,
    iceTransportPolicy: CONFIG.iceTransportPolicy,
  });
}
