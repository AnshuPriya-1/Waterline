/**
 * Central application configuration.
 * Edit these defaults to match your local testing city/area.
 */
export const APP_CONFIG = {
  // City identifier for DynamoDB partition key (e.g. 'delhi', 'bangalore', 'mumbai')
  DEFAULT_CITY: "delhi",

  // Default map viewport center [lat, lng] (currently set to DTU, Delhi)
  DEFAULT_MAP_CENTER: [28.7505, 77.1188],
  DEFAULT_ZOOM: 15,

  // Route corridor safety buffer radius in meters
  CORRIDOR_THRESHOLD_METERS: 40,

  // Strict flood pin lifetime in minutes
  FLOOD_PIN_LIFETIME_MINUTES: 45,

  // Compound danger detection radius (flood near open drain) in meters
  COMPOUND_DANGER_RADIUS_METERS: 50,

  // OSRM Public Routing Server URL
  OSRM_API_URL: "https://router.project-osrm.org/route/v1/driving"
};