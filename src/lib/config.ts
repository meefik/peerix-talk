export interface MqttDriverConfig {
  type: "mqtt";
  module: string;
  server: string;
  prefix: string;
}

export interface NatsDriverConfig {
  type: "nats";
  module: string;
  servers: string[];
  prefix: string;
}

export interface SseDriverConfig {
  type: "sse";
  url: string;
  publisherJwtKey?: string;
}

export type DriverConfig =
  MqttDriverConfig | NatsDriverConfig | SseDriverConfig;

export interface AppConfig {
  driver?: DriverConfig;
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
}

export const CONFIG = parseConfig();

function parseConfig(): AppConfig {
  const raw = import.meta.env.VITE_APP_CONFIG;
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    console.warn("VITE_APP_CONFIG is not valid JSON, using defaults");
    return {};
  }
}
