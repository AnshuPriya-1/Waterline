/**
 * Central application configuration.
 * EDIT THESE to match the city/area where you can test with real data.
 */
export const APP_CONFIG = {
  // City identifier used as the DynamoDB partition key (e.g. 'delhi', 'patna', 'mumbai')
  DEFAULT_CITY: "delhi",

  // Default map centre [lat, lng] and zoom
  DEFAULT_MAP_CENTER: [28.7505, 77.1188],
  DEFAULT_ZOOM: 15,

  // "Load Preset Route" button: two points on a real road in YOUR city.
  // Pick a road that passes near one of your real hazards.
  PRESET_ROUTE: {
    start: { lat: 28.747, lng: 77.1235 },
    end: { lat: 28.7545, lng: 77.113 }
  },

  // How close a hazard must be to the road to be flagged (meters)
  CORRIDOR_THRESHOLD_METERS: 40,

  // Flood pin lifetime in minutes (enforced in code, not only by DynamoDB TTL)
  FLOOD_PIN_LIFETIME_MINUTES: 45,

  // Flood near a known drain/hazard counts as a compound danger (meters)
  COMPOUND_DANGER_RADIUS_METERS: 50,

  // OSRM public demo server. It gives CAR routes, so we call it a "route check", not bike routing.
  OSRM_API_URL: "https://router.project-osrm.org/route/v1/driving"
};
