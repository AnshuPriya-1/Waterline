/**
 * Geospatial distance utility functions
 */

/**
 * Calculates Great-Circle distance between two coordinates in meters using the Haversine formula.
 */
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's mean radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates the shortest distance in meters from point P to line segment AB.
 * Uses flat-earth equirectangular projection valid for urban distances (<20km).
 */
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

  // Projection scalar clamped to [0, 1]
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / segmentLenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;

  return Math.hypot(px - projX, py - projY);
}
