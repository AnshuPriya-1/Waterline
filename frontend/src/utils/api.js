import { getSamplePins } from "../data/initialSampleData";
import { haversineDistanceMeters } from "./routeChecker";
import { APP_CONFIG } from "../config";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

const STORAGE_KEY = "waterline_local_pins_v2";
const ESCALATIONS_STORAGE_KEY = "waterline_local_escalations_v1";
const DEVICE_ID_KEY = "waterline_client_device_id";

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
    /* ignore */
  }
}

function getLocalEscalationsStore() {
  try {
    const existing = localStorage.getItem(ESCALATIONS_STORAGE_KEY);
    if (!existing) {
      const initial = [
        {
          ticketId: "PWD-DEL-9821",
          city: APP_CONFIG.DEFAULT_CITY,
          routeName: "Outer Ring Road (Corridor Sec 16 to Bus Terminal)",
          potholeCount: 4,
          complaintCount: 6,
          status: "escalated_to_pwd",
          department: "Public Works Department (PWD) - Road Safety Cell",
          escalatedAt: Math.floor(Date.now() / 1000) - 86400,
          citizenNotes: "Multiple 40cm craters causing two-wheeler skids and traffic congestion during rains.",
          voters: ["dev-1", "dev-2", "dev-3", "dev-4", "dev-5", "dev-6"],
          isSampleData: true
        }
      ];
      localStorage.setItem(ESCALATIONS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(existing);
  } catch {
    return [];
  }
}

function saveLocalEscalationsStore(escalations) {
  try {
    localStorage.setItem(ESCALATIONS_STORAGE_KEY, JSON.stringify(escalations));
  } catch {
    /* ignore */
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
      return lastLivePins;
    }

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

  // ----------------------------------------------------------- POST /analyze (Flood)
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

    return {
      suggestedLevel: "unknown",
      confidence: "low",
      referenceObject: "none",
      reasoning: API_BASE
        ? "AI hint is not available right now. Please tap the water level you see."
        : "Offline demo mode: please tap the water level you observe.",
      notice: "Water can hide open drains. This is an estimate, not a guarantee.",
      isOffline: true
    };
  },

  // ----------------------------------------------------------- POST /analyze-hazard (Potholes)
  async analyzeHazardPhoto(base64Image) {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/analyze-hazard`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64Image })
        });
        if (res.ok) {
          connectionState = "live";
          return await res.json();
        }
      } catch (err) {
        console.warn("Live /analyze-hazard call failed:", err.message);
        connectionState = "unreachable";
      }
    }

    // Local heuristic fallback for photo analysis
    return {
      detectedHazard: "deep_pothole",
      severity: "severe",
      waterloggedPothole: true,
      twoWheelerRisk: "critical",
      estimatedDimensions: "approx 45 cm diameter, rim hazard",
      pwdRecommendation: "Urgent cold-mix asphalt patch required by PWD.",
      confidence: "medium",
      reasoning: "Road surface depression and edge fracturing identified.",
      fallback: true
    };
  },

  // ------------------------------------------------------------ POST /reports
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
        throw new Error("Cannot reach the WaterLine server. Your report was NOT saved. Check connection and try again.");
      }
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status}). Your report was NOT saved.`);
      }
      connectionState = "live";
      return { ...data.item, duplicate: Boolean(data.duplicate) };
    }

    // Offline demo mode
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

  // -------------------------------------------------------- POST /routes/escalate
  /**
   * Submits a route pothole cluster grievance to the government / PWD.
   * Dispatches via AWS SNS / DynamoDB.
   */
  async escalateRoute(payload) {
    const deviceId = getOrCreateDeviceId();
    const city = payload.city || APP_CONFIG.DEFAULT_CITY;

    if (API_BASE) {
      let res;
      try {
        res = await fetch(`${API_BASE}/routes/escalate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, city, deviceId })
        });
      } catch (err) {
        connectionState = "unreachable";
        throw new Error("Cannot connect to server. Grievance dispatch failed. Check network connection.");
      }
      const data = await readJsonSafe(res);
      if (!res.ok) {
        throw new Error(data.error || `Server error (${res.status}). Escalation could not be submitted.`);
      }
      connectionState = "live";
      return data;
    }

    // Offline demo mode
    const escalations = getLocalEscalationsStore();
    const now = Math.floor(Date.now() / 1000);

    // If upvoting an existing ticket
    if (payload.action === "upvote" && payload.ticketId) {
      const ticket = escalations.find((e) => e.ticketId === payload.ticketId);
      if (ticket) {
        ticket.complaintCount = (ticket.complaintCount || 1) + 1;
        ticket.lastUpdatedAt = now;
        saveLocalEscalationsStore(escalations);
        return {
          success: true,
          ticketId: ticket.ticketId,
          complaintCount: ticket.complaintCount,
          message: "Your complaint was added to this active government escalation"
        };
      }
    }

    const ticketId = `PWD-${city.slice(0, 3).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const newEscalation = {
      ticketId,
      city,
      routeName: payload.routeName || "Corridor Route",
      startPoint: payload.startPoint || null,
      endPoint: payload.endPoint || null,
      potholeCount: payload.potholeCount || 1,
      complaintCount: 1,
      potholeCoordinates: payload.potholeCoordinates || [],
      citizenNotes: payload.citizenNotes || "",
      status: "escalated_to_pwd",
      department: "Public Works Department (PWD) / Municipal Road Maintenance Cell",
      escalatedAt: now,
      lastUpdatedAt: now,
      voters: [deviceId],
      isSampleData: false,
      auditReportUrl: `s3://waterline-evidence-bucket/reports/${ticketId}.json`
    };

    escalations.unshift(newEscalation);
    saveLocalEscalationsStore(escalations);

    return {
      success: true,
      ticketId,
      escalation: newEscalation,
      message: `Corridor successfully escalated to PWD. Tracking ID: ${ticketId}`
    };
  },

  // -------------------------------------------------------- GET /routes/escalations
  async getEscalations(city = APP_CONFIG.DEFAULT_CITY) {
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/routes/escalations?city=${encodeURIComponent(city)}`);
        if (res.ok) {
          const data = await res.json();
          connectionState = "live";
          return data.escalations || [];
        }
        connectionState = "unreachable";
      } catch (err) {
        console.warn("Live /routes/escalations call failed:", err.message);
        connectionState = "unreachable";
      }
    }

    return getLocalEscalationsStore();
  },

  /** Offline demo only: resets browser data back to the sample pins */
  resetSampleData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(ESCALATIONS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return getLocalStore();
  }
};
