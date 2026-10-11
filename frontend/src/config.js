/**
 * Central application configuration.
 * EDIT THESE to match the city/area where you can test with real data.
 */
export const APP_CONFIG = {
  // City identifier used as the DynamoDB partition key (e.g. 'delhi', 'patna', 'mumbai', 'muzaffarpur')
  DEFAULT_CITY: "delhi",

  // Default map centre [lat, lng] and zoom (Delhi by default, or your preferred city)
  DEFAULT_MAP_CENTER: [28.7495, 77.1175],
  DEFAULT_ZOOM: 15,

  // "Load Preset Route" button: two points on a real road in YOUR city.
  // Connects across the sample hazard cluster corridor
  PRESET_ROUTE: {
    start: { lat: 28.7505, lng: 77.1188 },
    end: { lat: 28.7540, lng: 77.1120 }
  },

  // How close a hazard must be to the road to be flagged (meters)
  CORRIDOR_THRESHOLD_METERS: 50,

  // Pothole cluster threshold for automated/manual government escalation
  POTHOLE_ESCALATION_THRESHOLD: 2,

  // Flood pin lifetime in minutes (enforced in code, not only by DynamoDB TTL)
  FLOOD_PIN_LIFETIME_MINUTES: 45,

  // Flood near a known drain/hazard counts as a compound danger (meters)
  COMPOUND_DANGER_RADIUS_METERS: 50,

  // Official municipal authority to dispatch grievances to
  MUNICIPAL_AUTHORITY: "Public Works Department (PWD) & Municipal Road Cell",

  // OSRM public demo server. It gives CAR routes, so we call it a "route check", not bike routing.
  OSRM_API_URL: "https://router.project-osrm.org/route/v1/driving"
};
