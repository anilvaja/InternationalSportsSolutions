/**
 * LocationService — High-Accuracy Browser GPS Service
 * Provides geolocation acquisition with timeout handling and user-friendly error messages
 */

class LocationService {
  /**
   * Requests device GPS coordinates via browser Geolocation API
   * @param {PositionOptions} [options]
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
   */
  static getCurrentPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        return reject(new Error('GPS Geolocation is not supported by your browser or device.'));
      }

      const defaultOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
        ...options,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            accuracy_meters: position.coords.accuracy,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          let message = 'An unknown error occurred while acquiring GPS location.';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location permission was denied. Please allow location access in your browser or device settings to punch in/out.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'GPS location is currently unavailable. Please verify device location is turned on and try again.';
              break;
            case error.TIMEOUT:
              message = 'Acquiring GPS location timed out (10s). Please check your GPS/network signal and retry.';
              break;
          }
          const err = new Error(message);
          err.code = error.code;
          reject(err);
        },
        defaultOptions
      );
    });
  }

  /**
   * Calculates Haversine distance in meters on client side for immediate feedback
   */
  static calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const phi1 = (Number(lat1) * Math.PI) / 180;
    const phi2 = (Number(lat2) * Math.PI) / 180;
    const deltaPhi = ((Number(lat2) - Number(lat1)) * Math.PI) / 180;
    const deltaLambda = ((Number(lon2) - Number(lon1)) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }
}

// Attach to window for global browser usage
if (typeof window !== 'undefined') {
  window.LocationService = LocationService;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LocationService };
}
