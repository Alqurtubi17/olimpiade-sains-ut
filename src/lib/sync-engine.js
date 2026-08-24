import mqtt from "mqtt";

const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8000/mqtt",
  "wss://test.mosquitto.org:8081",
];

let client = null;
let currentRoomId = null;
let statusCallback = null;
let messageCallback = null;

export function generateRoomId() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  let prefix = "";
  for (let i = 0; i < 3; i++) {
    prefix += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  let num = "";
  for (let i = 0; i < 4; i++) {
    num += digits.charAt(Math.floor(Math.random() * digits.length));
  }
  return `${prefix}-${num}`;
}

let currentClientId = null;

let pendingGlobalMatchesIndex = null;

export function initSyncEngine(roomId, onMessage, onStatusChange) {
  if (client) {
    try {
      client.end(true);
    } catch (e) {}
    client = null;
  }

  currentRoomId = roomId ? roomId.toUpperCase().trim() : null;
  messageCallback = onMessage;
  statusCallback = onStatusChange;

  if (!currentRoomId) {
    if (statusCallback) statusCallback("disconnected");
    return;
  }

  if (statusCallback) statusCallback("connecting");

  let brokerIndex = 0;
  const connectToNextBroker = () => {
    const brokerUrl = BROKERS[brokerIndex];
    currentClientId = `olimpiade_${Math.random().toString(16).substring(2, 10)}`;

    try {
      client = mqtt.connect(brokerUrl, {
        clientId: currentClientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 3000,
        keepalive: 30,
      });

      client.on("connect", () => {
        if (statusCallback) statusCallback("connected");
        const topics = [`olimpiade2026/global/matches_index`];
        if (currentRoomId && currentRoomId !== "GLOBAL") {
          topics.push(`olimpiade2026/room/${currentRoomId}`);
        }
        client.subscribe(topics, { qos: 1 }, (err) => {
          if (err) {
            console.error("Gagal subscribe topics:", err);
          }
        });

        if (pendingGlobalMatchesIndex !== null) {
          broadcastGlobalMatchesIndex(pendingGlobalMatchesIndex);
        }
      });

      client.on("message", (topic, payload) => {
        try {
          const msg = JSON.parse(payload.toString());
          if (msg && msg.senderId === currentClientId) return;
          if (messageCallback) messageCallback(msg);
        } catch (e) {
          console.error("Gagal parse sinyal MQTT:", e);
        }
      });

      client.on("error", (err) => {
        console.warn(`MQTT error pada ${brokerUrl}:`, err);
        if (statusCallback) statusCallback("connecting");
      });

      client.on("offline", () => {
        if (statusCallback) statusCallback("offline");
      });

      client.on("reconnect", () => {
        if (statusCallback) statusCallback("connecting");
      });
    } catch (err) {
      console.error("Error menginisialisasi MQTT:", err);
      brokerIndex = (brokerIndex + 1) % BROKERS.length;
      setTimeout(connectToNextBroker, 2000);
    }
  };

  connectToNextBroker();
}

export function broadcastState(roomId, stateData) {
  const targetRoom = (roomId || currentRoomId || "").toUpperCase().trim();
  if (!client || !targetRoom || !client.connected) return;

  const topic = `olimpiade2026/room/${targetRoom}`;
  const payload = JSON.stringify({
    type: "SYNC_STATE",
    senderId: currentClientId,
    timestamp: Date.now(),
    payload: stateData,
  });

  client.publish(topic, payload, { qos: 1, retain: true }, (err) => {
    if (err) console.error("Gagal broadcast state:", err);
  });
}

export function broadcastGlobalMatchesIndex(matchesList, deletedIds = []) {
  pendingGlobalMatchesIndex = matchesList;
  if (!client || !client.connected) return;

  const topic = `olimpiade2026/global/matches_index`;
  const payload = JSON.stringify({
    type: "GLOBAL_MATCHES_INDEX",
    senderId: currentClientId,
    timestamp: Date.now(),
    payload: matchesList,
    deletedIds: Array.isArray(deletedIds) ? deletedIds : [],
  });

  client.publish(topic, payload, { qos: 1, retain: true });
}

export function broadcastBuzzer(roomId, teamId) {
  const targetRoom = (roomId || currentRoomId || "").toUpperCase().trim();
  if (!client || !targetRoom || !client.connected) return;

  const topic = `olimpiade2026/room/${targetRoom}`;
  const payload = JSON.stringify({
    type: "BUZZER_PRESS",
    senderId: currentClientId,
    timestamp: Date.now(),
    teamId,
  });

  client.publish(topic, payload, { qos: 1, retain: false });
}

export function disconnectSyncEngine() {
  if (client) {
    try {
      client.end(true);
    } catch (e) {}
    client = null;
  }
  currentRoomId = null;
  if (statusCallback) statusCallback("disconnected");
}
