import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import * as satellite from 'satellite.js';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Helper component to handle click events
function LocationMarker({ onStationAdd }) {
  useMapEvents({
    click(e) {
      onStationAdd({
        id: Date.now(),
        lat: e.latlng.lat,
        lng: e.latlng.lng,
        name: `Station ${Math.floor(e.latlng.lat)}°`
      });
    },
  });
  return null;
}

export default function GroundStationMap({ stations, setStations }) {
  const handleAddStation = (newStation) => {
    if (stations.length < 5) {
      setStations([...stations, newStation]);
    } else {
      alert("Max 5 stations allowed.");
    }
  };

  return (
    <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationMarker onStationAdd={handleAddStation} />
      
      {stations.map((station) => (
        <React.Fragment key={station.id}>
          {/* Visual Marker for the Station */}
          <Marker position={[station.lat, station.lng]}>
            <Popup>{station.name}</Popup>
          </Marker>
          
          {/* Visual Coverage Circle (~1000km radius approx for LEO visibility) */}
          <Circle 
            center={[station.lat, station.lng]}
            pathOptions={{ color: 'red', fillOpacity: 0.1 }}
            radius={1000000} 
          />
        </React.Fragment>
      ))}
    </MapContainer>
  );
}

/**
 * Estimates how many times per day a station sees a satellite based on latitude.
 * @param {number} stationLat - The latitude of the ground station (-90 to 90).
 * @param {number} debrisInclination - The orbital inclination of the debris in degrees.
 * @returns {number} - Estimated number of passes per day.
 */
export function calculatePassesPerDay(stationLat, debrisInclination) {
  // Convert inputs to absolute values for calculation
  const lat = Math.abs(stationLat);
  const inc = Math.abs(debrisInclination);

  // If station is outside the orbital band, it sees nothing (simple approximation)
  if (lat > inc + 10) return 0; 

  // Formula: Higher latitude overlap = more passes (due to convergence at poles)
  // This acts as a probability weight.
  const passes = 2 * (1 + Math.abs(lat - inc) / 90);
  
  return Math.floor(passes); // Return integer
}

/**
 * Calculates precise visibility windows for a specific station and debris object.
 * @param {object} station - { lat: number, lng: number, altitude: number (km) }
 * @param {string} tleLine1 - First line of TLE data
 * @param {string} tleLine2 - Second line of TLE data
 * @param {number} daysToPredict - How many days into the future to calculate (e.g., 30)
 * @param {number} minElevation - Minimum angle (degrees) required for laser usage (default 20)
 * @returns {Array} - List of pass objects { startTime, endTime, maxElevation, duration }
 */
export function calculateVisibilityWindows(station, tleLine1, tleLine2, daysToPredict = 30, minElevation = 20) {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  const passes = [];
  
  // Simulation Step settings
  const timeStepInMinutes = 1; // Check every minute (coarse search)
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + daysToPredict);

  let currentTime = new Date(startDate);
  let isPassActive = false;
  let currentPass = null;

  while (currentTime < endDate) {
    // 1. Get Position and Velocity
    const positionAndVelocity = satellite.propagate(satrec, currentTime);
    
    // 2. Get Greenwich Sidereal Time (needed for Earth rotation)
    const gmst = satellite.gstime(currentTime);
    
    // 3. Coordinate Transforms
    // Convert station lat/lng to radians for satellite.js
    const positionGd = {
      latitude: satellite.degreesToRadians(station.lat),
      longitude: satellite.degreesToRadians(station.lng),
      height: 0 // Assuming sea level for simplicity, or station.altitude
    };

    // Get Look Angles (Azimuth, Elevation, Range)
    // positionAndVelocity.position is in ECI (Earth-Centered Inertial)
    // We need to convert ECI -> ECF (Earth-Centered Fixed) -> Topocentric (Look Angles)
    const positionEcf = satellite.eciToEcf(positionAndVelocity.position, gmst);
    const lookAngles = satellite.ecfToLookAngles(positionGd, positionEcf);

    // Convert elevation from radians to degrees
    const elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);

    // 4. Determine Pass Status
    if (elevationDeg > minElevation) {
      if (!isPassActive) {
        // START OF PASS
        isPassActive = true;
        currentPass = {
          startTime: new Date(currentTime),
          maxElevation: elevationDeg,
          azimuthStart: satellite.radiansToDegrees(lookAngles.azimuth)
        };
      } else {
        // DURING PASS - Update max elevation if this moment is higher
        if (elevationDeg > currentPass.maxElevation) {
          currentPass.maxElevation = elevationDeg;
        }
      }
    } else {
      if (isPassActive) {
        // END OF PASS
        isPassActive = false;
        currentPass.endTime = new Date(currentTime);
        currentPass.duration = (currentPass.endTime - currentPass.startTime) / 1000; // seconds
        
        // Only add if the pass was meaningful (e.g. > 30 seconds)
        if (currentPass.duration > 30) {
          passes.push(currentPass);
        }
        currentPass = null;
      }
    }

    // Increment time
    currentTime.setMinutes(currentTime.getMinutes() + timeStepInMinutes);
  }

  return passes;
}

/**
 * Helper function to calculate all passes for multiple stations
 * @param {Array} stations - Array of station objects with { lat, lng, altitude }
 * @param {string} tle1 - First line of TLE data
 * @param {string} tle2 - Second line of TLE data
 * @returns {Array} - Sorted array of all passes
 */
export function getAllPasses(stations, tle1, tle2) {
  const allPasses = stations.flatMap(station => 
    calculateVisibilityWindows(station, tle1, tle2)
  );
  // Sort passes chronologically
  allPasses.sort((a, b) => a.startTime - b.startTime);
  return allPasses;
}