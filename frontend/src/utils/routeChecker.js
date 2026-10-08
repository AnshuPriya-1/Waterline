/**
 * Route Corridor Hazard Analysis & Proximity Evaluator
 */

export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function pointToSegmentDistanceMeters(p, a, b) {
  const latMid = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const mPerDegLat = 111132.954;
  const mPerDegLon = 111412.84 * Math.cos(latMid);

  const px = p.lng * mPerDegLon;
  const py = p.lat * mPerDegLat;
  const ax = a.lng * mPerDegLon;
  const ay = a.lat * mPerDegLat;
  const bx = b.lng * mPerDegLon;
  const by = b.lat * mPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const segmentLenSq = dx * dx + dy * dy;

  if (segmentLenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segmentLenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY);
}

/**
 * Checks a route path against active flood pins and hazards.
 * Prioritizes the compound threat (waterlogging over/near an open drain).
 */
export function evaluateRoute(routeWaypoints, activePins, corridorThresholdMeters = 40) {
  if (!routeWaypoints || routeWaypoints.length < 2) {
    return { warnings: [], overallStatus: "clear" };
  }

  const rawWarnings = [];
  const floodPins = activePins.filter((p) => p.type === "flood");
  const hazardPins = activePins.filter((p) => p.type === "hazard");

  // Step 1: Detect Compound Risks (Flood pin within 50m of known dry-day drain/hazard)
  const compoundRisks = [];
  for (const flood of floodPins) {
    for (const hazard of hazardPins) {
      const dist = haversineDistanceMeters(flood.lat, flood.lng, hazard.lat, hazard.lng);
      if (dist <= 50) {
        compoundRisks.push({ flood, hazard, dist });
      }
    }
  }

  // Step 2: Test Route Segments
  for (let i = 0; i < routeWaypoints.length - 1; i++) {
    const segA = routeWaypoints[i];
    const segB = routeWaypoints[i + 1];

    // Check Compound Risks along this segment
    for (const item of compoundRisks) {
      const distToSegment = pointToSegmentDistanceMeters(
        { lat: item.hazard.lat, lng: item.hazard.lng },
        segA,
        segB
      );
      if (distToSegment <= corridorThresholdMeters) {
        rawWarnings.push({
          level: "CRITICAL",
          priority: 3,
          title: "Submerged Known Hazard Detected",
          message: `Higher risk: water may be hiding a known ${item.hazard.hazardType.replace("_", " ")} within ${Math.round(item.dist)}m. Water level reported: ${item.flood.level}.`,
          lat: item.hazard.lat,
          lng: item.hazard.lng,
          distanceToRoute: Math.round(distToSegment),
          hazardType: item.hazard.hazardType,
          floodLevel: item.flood.level
        });
      }
    }

    // Check Individual Hazards along this segment
    for (const hazard of hazardPins) {
      const distToSegment = pointToSegmentDistanceMeters(
        { lat: hazard.lat, lng: hazard.lng },
        segA,
        segB
      );
      if (distToSegment <= corridorThresholdMeters) {
        rawWarnings.push({
          level: "CAUTION",
          priority: 2,
          title: `Known ${hazard.hazardType.replace("_", " ").toUpperCase()}`,
          message: `Caution: Known ${hazard.hazardType.replace("_", " ")} within ${Math.round(distToSegment)}m of route corridor.`,
          lat: hazard.lat,
          lng: hazard.lng,
          distanceToRoute: Math.round(distToSegment),
          hazardType: hazard.hazardType
        });
      }
    }

    // Check Individual Flood Pins along this segment
    for (const flood of floodPins) {
      const distToSegment = pointToSegmentDistanceMeters(
        { lat: flood.lat, lng: flood.lng },
        segA,
        segB
      );
      if (distToSegment <= corridorThresholdMeters) {
        rawWarnings.push({
          level: "ADVISORY",
          priority: 1,
          title: `Waterlogging (${flood.level})`,
          message: `Waterlogging reported (${flood.level} depth) approx ${Math.round(distToSegment)}m from route.`,
          lat: flood.lat,
          lng: flood.lng,
          distanceToRoute: Math.round(distToSegment),
          floodLevel: flood.level
        });
      }
    }
  }

  // Step 3: Deduplicate by coordinate keeping strictly the highest priority warning
  const bestWarningsMap = new Map();
  for (const w of rawWarnings) {
    const key = `${w.lat.toFixed(5)}-${w.lng.toFixed(5)}`;
    const existing = bestWarningsMap.get(key);
    if (!existing || w.priority > existing.priority) {
      bestWarningsMap.set(key, w);
    }
  }

  const finalWarnings = Array.from(bestWarningsMap.values()).sort(
    (a, b) => b.priority - a.priority
  );

  let overallStatus = "lower_risk";
  if (finalWarnings.some((w) => w.level === "CRITICAL")) {
    overallStatus = "critical_risk";
  } else if (finalWarnings.some((w) => w.level === "CAUTION")) {
    overallStatus = "moderate_risk";
  } else if (finalWarnings.length > 0) {
    overallStatus = "advisory";
  }

  return {
    warnings: finalWarnings,
    overallStatus,
    summary: {
      criticalCount: finalWarnings.filter((w) => w.level === "CRITICAL").length,
      cautionCount: finalWarnings.filter((w) => w.level === "CAUTION").length,
      advisoryCount: finalWarnings.filter((w) => w.level === "ADVISORY").length
    }
  };
}
