import { APP_CONFIG } from '../config';

/**
 * Fetches real driving road geometry from the OSRM Public Routing API.
 * Never generates straight-line mocks: if network fails, reports an explicit failure.
 */
export async function fetchRoadRoute(startPoint, endPoint) {
  if (!startPoint || !endPoint) {
    throw new Error("Start and End coordinates required");
  }

  const url = `${APP_CONFIG.OSRM_API_URL}/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM routing server returned status ${response.status}`);
    }

    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error("No navigable road route found between selected points");
    }

    const primaryRoute = data.routes[0];
    const rawCoords = primaryRoute.geometry.coordinates; // Array of [lng, lat]

    const waypoints = rawCoords.map(([lng, lat]) => ({ lat, lng }));

    return {
      success: true,
      waypoints,
      distanceMeters: Math.round(primaryRoute.distance),
      durationSeconds: Math.round(primaryRoute.duration)
    };
  } catch (err) {
    console.error("OSRM Route Fetch Error:", err);
    return {
      success: false,
      waypoints: [],
      error: `Road network route unavailable: ${err.message}. (Straight-line routing is disallowed to prevent false safety readings).`
    };
  }
}