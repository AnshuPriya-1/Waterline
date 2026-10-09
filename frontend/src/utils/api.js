import { getSamplePins } from "../data/initialSampleData";
import { haversineDistanceMeters } from "./routeChecker";
import { APP_CONFIG } from "../config";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const STORAGE_KEY = "waterline_local_pins_v2";
const DEVICE_ID_KEY = "waterline_client_device_id";

/**
 * Connection state, so the UI can be honest about where data comes from:
 *  - "not_configured": no VITE_API_BASE_URL. Offline demo, data lives only in this browser.
 *  - "unknown":        API is configured but we have not heard from it yet.
 *  - "live":           the last call to the real backend worked.
 *  - "unreachable":    API is configured but the last call failed.
 */
let connectionState = API_BASE ? "unknown" : "not_configured";
let lastLivePins = [];

export function getOrCreateDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = "dev-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return "dev-session-" + Math.random().toString(36).substring(2, 11);
  }
}

// ---------- Local (offline demo) store: only used when NO backend is configured ----------
function getLocalStore() {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (!existing) {
      const initial = getSamplePins();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(existing);
  } catch {
    return getSamplePins();
  }
}

function saveLocalStore(pins) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pins));
  } catch {
    /* storage can be blocked; ignore */
  }
}

async function readJsonSafe(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export const api = {
  isConfiguredWithLiveApi() {
    return Boolean(API_BASE);
  },

  getConnectionState() {
    return connectionState;
  },

  // ---------------------------------------------------------------- GET pins
  async getPins(city = APP_CONFIG.DEFAULT_CITY) {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/pins?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const data = await res.json();
          connectionState = "live";
          lastLivePins = data.pins || [];
          return lastLivePins;
        }
        connectionState = "unreachable";
      } catch (err) {
        console.warn("Live API /pins unreachable:", err.message);
        connectionState = "unreachable";
      }
      // Backend is configured but failing: never swap in fake data. Show the last real data we had.
      return lastLivePins;
    }

    // Offline demo mode (no backend configured)
    const all = getLocalStore();
    const now = Math.floor(Date.now() / 1000);
    const floodCutoff = now - APP_CONFIG.FLOOD_PIN_LIFETIME_MINUTES * 60;
    const oldCutoff = now - 60 * 86400;

    return all
      .filter((p) => {
        if (p.type === "hazard") return p.status !== "fixed";
        if (p.type === "flood") return p.reportedAt >= floodCutoff;
        return false;
      })
      .map((p) => {
        if (p.type === "hazard") {
          return { ...p, isOldUnverified: p.lastConfirmedAt ? p.lastConfirmedAt < oldCutoff : false };
        }
        return { ...p, ageMinutes: Math.max(0, Math.floor((now - p.reportedAt) / 60)) };
      });
  },

  // ----------------------------------------------------------- POST /analyze
  async analyzeFloodPhoto(base64Image) {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image })
        });
        if (res.ok) {
          connectionState = "live";
          return await res.json();
        }
      } catch (err) {
        console.warn("Live /analyze call failed:", err.message);
        connectionState = "unreachable";
      }
    }

    // Honest fallback: never fakes a depth.
    return {
      suggestedLevel: "unknown",
      confidence: "low",
      referenceObject: "none",
      reasoning: API_BASE
        ? "AI hint is not available right now. Please tap the water level you see."
        : "Offline demo mode: there is no AI without the backend. Please tap the water level you see.",
      notice: "Water can hide open drains. This is an estimate, not a guarantee.",
      isOffline: true
    };
  },

  // ------------------------------------------------------------ POST /reports
  /**
   * Throws an Error (with a readable message) if the report could not be saved.
   * With a backend configured, it NEVER falls back to local storage.
   */
  async submitReport(payload) {
    const { city = APP_CONFIG.DEFAULT_CITY, type, lat, lng, level, hazardType, description = "" } = payload;
    const deviceId = getOrCreateDeviceId();

    if (API_BASE) {
      let res;
      try {
        res = await fetch(`${API_BASE}/reports`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, city, deviceId })
        });
      } catch (err) {
        connectionState = "unreachable";
        throw new Error("Cannot reach the WaterLine server. Your report was NOT saved. Check your internet and try again.");
      }
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status}). Your report was NOT saved.`);
      }
      connectionState = "live";
      return { ...data.item, duplicate: Boolean(data.duplicate) };
    }

    // Offline demo mode: same rules as the backend, stored only in this browser
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
          p.deviceId !== deviceId &&
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
        deviceId,
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
        deviceId,
        isSampleData: false
      };
    }

    current.unshift(newItem);
    saveLocalStore(current);
    return newItem;
  },

  // -------------------------------------------------------- POST /pins/vote
  /** Returns { success, message?, error? }. Never throws. */
  async voteHazard(sk, voteType, city = APP_CONFIG.DEFAULT_CITY) {
    const deviceId = getOrCreateDeviceId();
    const votedKey = `voted_${sk}`;

    try {
      if (localStorage.getItem(votedKey)) {
        return { success: false, error: "This device has already voted on this hazard." };
      }
    } catch {
      /* ignore */
    }

    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/pins/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sk, voteType, city, deviceId })
        });
        const data = await readJsonSafe(res);
        if (!res.ok) {
          return { success: false, error: data.error || `Server error (${res.status}). Your vote was not saved.` };
        }
        connectionState = "live";
        try {
          localStorage.setItem(votedKey, voteType);
        } catch {
          /* ignore */
        }
        return data;
      } catch (err) {
        connectionState = "unreachable";
        return { success: false, error: "Cannot reach the WaterLine server. Your vote was not saved." };
      }
    }

    // Offline demo mode
    const current = getLocalStore();
    const now = Math.floor(Date.now() / 1000);
    const target = current.find((p) => p.SK === sk || p.id === sk);

    if (target && target.type === "hazard") {
      if (voteType === "fixed") {
        target.fixedVotes = (target.fixedVotes || 0) + 1;
        if (target.fixedVotes >= 2) target.status = "fixed";
      } else if (voteType === "still_there") {
        target.lastConfirmedAt = now;
      }
      saveLocalStore(current);
      try {
        localStorage.setItem(votedKey, voteType);
      } catch {
        /* ignore */
      }
      return { success: true };
    }
    return { success: false, error: "Hazard not found" };
  },

  /** Offline demo only: resets browser data back to the sample pins */
  resetSampleData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return getLocalStore();
  }
};
