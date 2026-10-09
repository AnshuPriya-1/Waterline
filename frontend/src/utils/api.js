import { getSamplePins } from "../data/initialSampleData";
import { haversineDistanceMeters } from "./routeChecker";
import { APP_CONFIG } from "../config";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const STORAGE_KEY = "waterline_local_pins_v2";
const DEVICE_ID_KEY = "waterline_client_device_id";

export function getOrCreateDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = "dev-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

function getLocalStore() {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (!existing) {
    const initial = getSamplePins();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(existing);
  } catch {
    return getSamplePins();
  }
}

function saveLocalStore(pins) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
}

let isLiveConnected = Boolean(API_BASE);

export const api = {
  isConfiguredWithLiveApi() {
    return Boolean(API_BASE);
  },

  isLiveConnected() {
    return isLiveConnected;
  },

  async getPins(city = APP_CONFIG.DEFAULT_CITY) {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/pins?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const data = await res.json();
          isLiveConnected = true;
          return data.pins;
        } else {
          isLiveConnected = false;
        }
      } catch (err) {
        console.warn("Live API /pins unavailable. Falling back to local store:", err.message);
        isLiveConnected = false;
      }
    } else {
      isLiveConnected = false;
    }

    const all = getLocalStore();
    const now = Math.floor(Date.now() / 1000);
    const floodCutoff = now - APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES * 60;
    const oldCutoff = now - 60 * 86400;

    return all.filter((p) => {
      if (p.type === "hazard") {
        if (p.status === "fixed") return false;
        p.isOldUnverified = p.lastConfirmedAt ? p.lastConfirmedAt < oldCutoff : false;
        return true;
      }
      if (p.type === "flood") {
        p.ageMinutes = Math.max(0, Math.floor((now - p.reportedAt) / 60));
        return p.reportedAt >= floodCutoff;
      }
      return false;
    });
  },

  async analyzeFloodPhoto(base64Image) {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image })
        });
        if (res.ok) {
          isLiveConnected = true;
          return await res.json();
        } else {
          isLiveConnected = false;
        }
      } catch (err) {
        console.warn("Live Bedrock API call failed:", err.message);
        isLiveConnected = false;
      }
    } else {
      isLiveConnected = false;
    }

    // Honest offline fallback: NEVER fakes "knee" or a fake explanation!
    return {
      suggestedLevel: "unknown",
      confidence: "low",
      referenceObject: "none",
      reasoning: "Offline Demo Mode: Automated Bedrock vision is unavailable without live AWS backend. Please tap your observed depth below.",
      notice: "Water can hide open drains. This is an estimate, not a guarantee.",
      isOffline: true
    };
  },

  async submitReport(payload) {
    const { city = APP_CONFIG.DEFAULT_CITY, type, lat, lng, level, hazardType, description = "" } = payload;

    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            deviceId: getOrCreateDeviceId()
          })
        });
        if (res.ok) {
          isLiveConnected = true;
          const data = await res.json();
          return data.item;
        }
      } catch (err) {
        console.warn("Live API /reports call failed, recording locally:", err.message);
        isLiveConnected = false;
      }
    }

    const current = getLocalStore();
    const now = Math.floor(Date.now() / 1000);
    const newId = `report-${Date.now()}`;

    let newItem;
    if (type === "flood") {
      const floodCutoff = now - APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES * 60;
      const nearbyFloods = current.filter(
        (p) =>
          p.type === "flood" &&
          p.reportedAt >= floodCutoff &&
          haversineDistanceMeters(lat, lng, p.lat, p.lng) <= 100
      );

      const isConfirmed = nearbyFloods.length > 0;
      const confirmedCount = isConfirmed ? nearbyFloods.length + 1 : 1;

      if (isConfirmed) {
        for (const older of nearbyFloods) {
          older.status = "confirmed";
          older.confirmedBy = Math.max(older.confirmedBy || 1, confirmedCount);
        }
      }

      const nearbyHazard = current.find(
        (p) =>
          p.type === "hazard" &&
          p.status !== "fixed" &&
          haversineDistanceMeters(lat, lng, p.lat, p.lng) <= APP_CONFIG.COMPOUND_DANGER_RADIUS_METERS
      );

      newItem = {
        id: newId,
        SK: `FLOOD#${now}`,
        type: "flood",
        city,
        lat,
        lng,
        level: level || "ankle",
        reportedAt: now,
        ageMinutes: 0,
        status: isConfirmed ? "confirmed" : "unconfirmed",
        confirmedBy: confirmedCount,
        compoundHazardNearby: !!nearbyHazard,
        isSampleData: false
      };
    } else {
      newItem = {
        id: newId,
        SK: `HAZARD#${now}`,
        type: "hazard",
        city,
        lat,
        lng,
        hazardType: hazardType || "open_drain",
        description,
        reportedAt: now,
        lastConfirmedAt: now,
        fixedVotes: 0,
        status: "active",
        isSampleData: false
      };
    }

    current.unshift(newItem);
    saveLocalStore(current);
    return newItem;
  },

  async voteHazard(sk, voteType, city = APP_CONFIG.DEFAULT_CITY) {
    const deviceId = getOrCreateDeviceId();
    const votedKey = `voted_${sk}`;
    if (localStorage.getItem(votedKey)) {
      return {
        success: false,
        error: "This device has already voted on this hazard."
      };
    }

    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/pins/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sk, voteType, city, deviceId })
        });
        if (res.ok) {
          localStorage.setItem(votedKey, voteType);
          return await res.json();
        }
      } catch (err) {
        console.warn("Live vote failed, applying locally:", err.message);
      }
    }

    const current = getLocalStore();
    const now = Math.floor(Date.now() / 1000);
    const target = current.find((p) => p.SK === sk || p.id === sk);

    if (target && target.type === "hazard") {
      if (voteType === "fixed") {
        target.fixedVotes = (target.fixedVotes || 0) + 1;
        if (target.fixedVotes >= 2) {
          target.status = "fixed";
        }
      } else if (voteType === "still_there") {
        target.lastConfirmedAt = now;
      }
      localStorage.setItem(votedKey, voteType);
      saveLocalStore(current);
      return { success: true, target };
    }
    return { success: false, error: "Hazard not found" };
  },

  resetSampleData() {
    localStorage.removeItem(STORAGE_KEY);
    return getLocalStore();
  }
};