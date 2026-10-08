/**
 * Initial Sample Data for WaterLine Demo
 * Centered around DTU (Delhi Technological University) & Rohini / Bawana corridor.
 * Clearly marked as sample demo data to ensure judge transparency.
 */

export function getSamplePins() {
  const now = Math.floor(Date.now() / 1000);

  return [
    // 1. Dry-day hazard: Open roadside storm drain near DTU Gate 1
    {
      id: "hazard-sample-01",
      SK: "HAZARD#1728000001",
      type: "hazard",
      city: "delhi",
      lat: 28.7505,
      lng: 77.1188,
      hazardType: "open_drain",
      description: "Uncovered deep concrete stormwater drain directly beside the curb. Unmarked.",
      reportedAt: now - 86400 * 5, // 5 days ago
      lastConfirmedAt: now - 86400 * 1,
      fixedVotes: 0,
      status: "active",
      isSampleData: true
    },

    // 2. Dry-day hazard: Missing manhole cover on Bawana Road crossing
    {
      id: "hazard-sample-02",
      SK: "HAZARD#1728000002",
      type: "hazard",
      city: "delhi",
      lat: 28.7538,
      lng: 77.1132,
      hazardType: "missing_manhole",
      description: "Iron circular manhole cover broken in middle of lane. Branch stuck inside as makeshift warning.",
      reportedAt: now - 86400 * 12,
      lastConfirmedAt: now - 86400 * 2,
      fixedVotes: 1, // 1 fixed vote so far (needs 2 to remove)
      status: "active",
      isSampleData: true
    },

    // 3. Dry-day hazard: Deep submerged pothole near Shahbad Daulatpur underpass
    {
      id: "hazard-sample-03",
      SK: "HAZARD#1728000003",
      type: "hazard",
      city: "delhi",
      lat: 28.7462,
      lng: 77.1215,
      hazardType: "deep_pothole",
      description: "Craters 8+ inches deep stretching across the entire two-wheeler left lane.",
      reportedAt: now - 86400 * 20,
      lastConfirmedAt: now - 86400 * 4,
      fixedVotes: 0,
      status: "active",
      isSampleData: true
    },

    // 4. Old unverified hazard (>60 days without confirmation, should render grey)
    {
      id: "hazard-sample-04",
      SK: "HAZARD#1728000004",
      type: "hazard",
      city: "delhi",
      lat: 28.7580,
      lng: 77.1085,
      hazardType: "open_drain",
      description: "Broken drain slab observed 70 days ago.",
      reportedAt: now - 86400 * 75,
      lastConfirmedAt: now - 86400 * 65, // >60 days old
      fixedVotes: 0,
      status: "active",
      isOldUnverified: true,
      isSampleData: true
    },

    // 5. Short-lived Flood Pin: Ankle depth reported 14 minutes ago
    {
      id: "flood-sample-01",
      SK: "FLOOD#1728400001",
      type: "flood",
      city: "delhi",
      lat: 28.7480,
      lng: 77.1240,
      level: "ankle",
      reportedAt: now - 14 * 60, // 14 mins ago
      ageMinutes: 14,
      status: "unconfirmed",
      confirmedBy: 1,
      compoundHazardNearby: false,
      isSampleData: true
    },

    // 6. Short-lived Flood Pin: Knee depth reported 8 minutes ago, verified by 2 riders
    {
      id: "flood-sample-02",
      SK: "FLOOD#1728400002",
      type: "flood",
      city: "delhi",
      lat: 28.7545,
      lng: 77.1140,
      level: "knee",
      reportedAt: now - 8 * 60, // 8 mins ago
      ageMinutes: 8,
      status: "confirmed",
      confirmedBy: 2,
      compoundHazardNearby: false,
      isSampleData: true
    },

    // 7. CRITICAL COMPOUND HAZARD: Flood pin placed 28m away from Hazard 01 (Open Drain)!
    // This allows the demo video to immediately trigger the CRITICAL warning!
    {
      id: "flood-sample-compound",
      SK: "FLOOD#1728400003",
      type: "flood",
      city: "delhi",
      lat: 28.7507, // ~25 meters from 28.7505, 77.1188 (hazard-sample-01)
      lng: 77.1186,
      level: "knee",
      reportedAt: now - 18 * 60, // 18 mins ago
      ageMinutes: 18,
      status: "confirmed",
      confirmedBy: 2,
      compoundHazardNearby: true,
      isSampleData: true
    }
  ];
}
