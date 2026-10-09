/**
 * Gets the device GPS position as a promise.
 * Needs HTTPS (or localhost) to work in browsers.
 * Returns { lat, lng, accuracy } where accuracy is in meters.
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("This browser does not support GPS location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0)
        }),
      (err) => reject(new Error(err.message || "Could not get GPS location.")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
