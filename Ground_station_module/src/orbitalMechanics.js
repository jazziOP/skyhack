import * as satellite from 'satellite.js';

/**
 * Orbital Mechanics Engine for Laser Debris Removal
 * Handles orbit propagation, velocity changes, and perigee tracking
 */

// Constants
const EARTH_RADIUS_KM = 6371.0;
const MU_EARTH = 398600.4418; // Earth's gravitational parameter (km³/s²)
const RE_ENTRY_THRESHOLD_KM = 200; // Perigee altitude threshold for re-entry
const J2 = 0.00108263; // Earth's J2 perturbation coefficient

/**
 * Convert orbital elements to state vectors (position, velocity)
 * @param {object} elements - { a, e, i, omega, Omega, M, epoch }
 * @returns {object} - { position: [x,y,z], velocity: [vx,vy,vz] }
 */
export function orbitalElementsToStateVectors(elements) {
  const { a, e, i, omega, Omega, M } = elements;
  
  // Solve Kepler's equation for Eccentric Anomaly (E)
  let E = M;
  for (let iter = 0; iter < 10; iter++) {
    E = M + e * Math.sin(E);
  }
  
  // True anomaly (nu)
  const nu = 2 * Math.atan2(
    Math.sqrt(1 + e) * Math.sin(E / 2),
    Math.sqrt(1 - e) * Math.cos(E / 2)
  );
  
  // Distance from focus
  const r = a * (1 - e * Math.cos(E));
  
  // Position in orbital plane
  const x_orb = r * Math.cos(nu);
  const y_orb = r * Math.sin(nu);
  
  // Velocity in orbital plane
  const p = a * (1 - e * e);
  const h = Math.sqrt(MU_EARTH * p);
  const vx_orb = -(MU_EARTH / h) * Math.sin(nu);
  const vy_orb = (MU_EARTH / h) * (e + Math.cos(nu));
  
  // Rotation matrices to convert to ECI frame
  const cos_O = Math.cos(Omega);
  const sin_O = Math.sin(Omega);
  const cos_i = Math.cos(i);
  const sin_i = Math.sin(i);
  const cos_w = Math.cos(omega);
  const sin_w = Math.sin(omega);
  
  // Position in ECI
  const x = (cos_O * cos_w - sin_O * sin_w * cos_i) * x_orb + 
            (-cos_O * sin_w - sin_O * cos_w * cos_i) * y_orb;
  const y = (sin_O * cos_w + cos_O * sin_w * cos_i) * x_orb + 
            (-sin_O * sin_w + cos_O * cos_w * cos_i) * y_orb;
  const z = (sin_w * sin_i) * x_orb + (cos_w * sin_i) * y_orb;
  
  // Velocity in ECI
  const vx = (cos_O * cos_w - sin_O * sin_w * cos_i) * vx_orb + 
             (-cos_O * sin_w - sin_O * cos_w * cos_i) * vy_orb;
  const vy = (sin_O * cos_w + cos_O * sin_w * cos_i) * vx_orb + 
             (-sin_O * sin_w + cos_O * cos_w * cos_i) * vy_orb;
  const vz = (sin_w * sin_i) * vx_orb + (cos_w * sin_i) * vy_orb;
  
  return {
    position: [x, y, z],
    velocity: [vx, vy, vz]
  };
}

/**
 * Convert state vectors to orbital elements
 * @param {array} position - [x, y, z] in km
 * @param {array} velocity - [vx, vy, vz] in km/s
 * @returns {object} - Orbital elements { a, e, i, omega, Omega, nu, perigeeLat, perigeeAlt }
 */
export function stateVectorsToOrbitalElements(position, velocity) {
  const [x, y, z] = position;
  const [vx, vy, vz] = velocity;
  
  const r = Math.sqrt(x*x + y*y + z*z);
  const v = Math.sqrt(vx*vx + vy*vy + vz*vz);
  
  // Angular momentum vector
  const hx = y * vz - z * vy;
  const hy = z * vx - x * vz;
  const hz = x * vy - y * vx;
  const h = Math.sqrt(hx*hx + hy*hy + hz*hz);
  
  // Node vector
  const nx = -hy;
  const ny = hx;
  const n = Math.sqrt(nx*nx + ny*ny);
  
  // Eccentricity vector
  const v_sq = v * v;
  const r_dot_v = x*vx + y*vy + z*vz;
  const ex = ((v_sq - MU_EARTH/r) * x - r_dot_v * vx) / MU_EARTH;
  const ey = ((v_sq - MU_EARTH/r) * y - r_dot_v * vy) / MU_EARTH;
  const ez = ((v_sq - MU_EARTH/r) * z - r_dot_v * vz) / MU_EARTH;
  const e = Math.sqrt(ex*ex + ey*ey + ez*ez);
  
  // Specific orbital energy
  const energy = v_sq / 2 - MU_EARTH / r;
  
  // Semi-major axis
  const a = -MU_EARTH / (2 * energy);
  
  // Inclination
  const i = Math.acos(hz / h);
  
  // Right ascension of ascending node
  let Omega = 0;
  if (n !== 0) {
    Omega = Math.acos(nx / n);
    if (ny < 0) Omega = 2 * Math.PI - Omega;
  }
  
  // Argument of perigee
  let omega = 0;
  if (e > 0.0001 && n !== 0) {
    const cos_omega = (nx * ex + ny * ey) / (n * e);
    omega = Math.acos(Math.max(-1, Math.min(1, cos_omega)));
    if (ez < 0) omega = 2 * Math.PI - omega;
  }
  
  // True anomaly
  let nu = 0;
  if (e > 0.0001) {
    const cos_nu = (ex * x + ey * y + ez * z) / (e * r);
    nu = Math.acos(Math.max(-1, Math.min(1, cos_nu)));
    if (r_dot_v < 0) nu = 2 * Math.PI - nu;
  }
  
  // Perigee altitude and latitude
  const perigeeAlt = a * (1 - e) - EARTH_RADIUS_KM;
  
  // Calculate perigee position
  const E_perigee = 0; // At perigee, E = 0
  const r_perigee = a * (1 - e);
  const x_perigee = r_perigee;
  const y_perigee = 0;
  
  // Transform to ECI
  const cos_O = Math.cos(Omega);
  const sin_O = Math.sin(Omega);
  const cos_i = Math.cos(i);
  const sin_i = Math.sin(i);
  const cos_w = Math.cos(omega);
  const sin_w = Math.sin(omega);
  
  const z_perigee = (sin_w * sin_i) * x_perigee;
  const perigeeLat = Math.asin(z_perigee / r_perigee) * (180 / Math.PI);
  
  return {
    a,
    e,
    i,
    omega,
    Omega,
    nu,
    perigeeAlt,
    perigeeLat,
    apogeeAlt: a * (1 + e) - EARTH_RADIUS_KM
  };
}

/**
 * Apply delta-V to current state vectors
 * @param {array} position - Current position [x, y, z] km
 * @param {array} velocity - Current velocity [vx, vy, vz] km/s
 * @param {number} deltaV - Magnitude of velocity change in m/s
 * @param {string} direction - 'prograde', 'retrograde', 'radial-in', 'radial-out'
 * @returns {object} - New { position, velocity }
 */
export function applyDeltaV(position, velocity, deltaV, direction = 'retrograde') {
  const deltaV_km_s = deltaV / 1000; // Convert m/s to km/s
  
  const [x, y, z] = position;
  const [vx, vy, vz] = velocity;
  
  const v_mag = Math.sqrt(vx*vx + vy*vy + vz*vz);
  const r_mag = Math.sqrt(x*x + y*y + z*z);
  
  let dvx = 0, dvy = 0, dvz = 0;
  
  switch(direction) {
    case 'prograde':
      // Add velocity in direction of motion
      dvx = (vx / v_mag) * deltaV_km_s;
      dvy = (vy / v_mag) * deltaV_km_s;
      dvz = (vz / v_mag) * deltaV_km_s;
      break;
      
    case 'retrograde':
      // Subtract velocity (opposite to motion)
      dvx = -(vx / v_mag) * deltaV_km_s;
      dvy = -(vy / v_mag) * deltaV_km_s;
      dvz = -(vz / v_mag) * deltaV_km_s;
      break;
      
    case 'radial-out':
      // Add velocity away from Earth
      dvx = (x / r_mag) * deltaV_km_s;
      dvy = (y / r_mag) * deltaV_km_s;
      dvz = (z / r_mag) * deltaV_km_s;
      break;
      
    case 'radial-in':
      // Add velocity toward Earth
      dvx = -(x / r_mag) * deltaV_km_s;
      dvy = -(y / r_mag) * deltaV_km_s;
      dvz = -(z / r_mag) * deltaV_km_s;
      break;
  }
  
  return {
    position: position,
    velocity: [vx + dvx, vy + dvy, vz + dvz]
  };
}

/**
 * Propagate TLE forward in time and apply laser delta-V
 * @param {string} tleLine1 - TLE line 1
 * @param {string} tleLine2 - TLE line 2
 * @param {array} laserPasses - Array of { time, deltaV } objects
 * @returns {object} - Orbital evolution data
 */
export function propagateWithLaserPasses(tleLine1, tleLine2, laserPasses) {
  const satrec = satellite.twoline2satrec(tleLine1, tleLine2);
  
  const orbitalHistory = [];
  let currentSatrec = satrec;
  
  // Sort passes by time
  const sortedPasses = [...laserPasses].sort((a, b) => a.time - b.time);
  
  let lastTime = new Date();
  
  sortedPasses.forEach((pass, index) => {
    // Propagate to just before the pass
    const posVel = satellite.propagate(currentSatrec, pass.time);
    
    if (posVel.position && posVel.velocity) {
      // Convert ECI position/velocity to km and km/s
      const pos = [posVel.position.x, posVel.position.y, posVel.position.z];
      const vel = [posVel.velocity.x, posVel.velocity.y, posVel.velocity.z];
      
      // Get orbital elements before deltaV
      const elemsBefore = stateVectorsToOrbitalElements(pos, vel);
      
      // Apply laser delta-V (retrograde to lower orbit)
      const newState = applyDeltaV(pos, vel, pass.deltaV, 'retrograde');
      
      // Get new orbital elements
      const elemsAfter = stateVectorsToOrbitalElements(newState.position, newState.velocity);
      
      orbitalHistory.push({
        time: pass.time,
        passNumber: index + 1,
        before: elemsBefore,
        after: elemsAfter,
        deltaV: pass.deltaV,
        cumulativeDeltaV: laserPasses.slice(0, index + 1).reduce((sum, p) => sum + p.deltaV, 0),
        perigeeAlt: elemsAfter.perigeeAlt,
        apogeeAlt: elemsAfter.apogeeAlt,
        reEntryApproaching: elemsAfter.perigeeAlt < RE_ENTRY_THRESHOLD_KM
      });
      
      // Update TLE with new orbital elements (simplified - in reality would need proper TLE generation)
      // For now, we'll track the evolution but keep using original satrec for next propagation
      // This is a simplification; proper implementation would regenerate TLE from new elements
    }
  });
  
  return {
    initialOrbit: stateVectorsToOrbitalElements(
      [satrec.position.x, satrec.position.y, satrec.position.z],
      [satrec.velocity.x, satrec.velocity.y, satrec.velocity.z]
    ),
    history: orbitalHistory,
    finalOrbit: orbitalHistory[orbitalHistory.length - 1]?.after,
    reEntryAchieved: orbitalHistory[orbitalHistory.length - 1]?.perigeeAlt < RE_ENTRY_THRESHOLD_KM,
    totalDeltaV: laserPasses.reduce((sum, p) => sum + p.deltaV, 0),
    totalPasses: laserPasses.length
  };
}

/**
 * Estimate atmospheric drag effects on orbit decay
 * @param {number} perigeeAlt - Perigee altitude in km
 * @param {number} areaToMass - Area-to-mass ratio in m²/kg
 * @param {number} days - Number of days to propagate
 * @returns {object} - { decayRate, estimatedLifetime }
 */
export function estimateAtmosphericDecay(perigeeAlt, areaToMass, days = 30) {
  // Simplified atmospheric density model (kg/km³)
  let rho;
  if (perigeeAlt > 600) {
    rho = 1e-15;
  } else if (perigeeAlt > 400) {
    rho = 1e-13;
  } else if (perigeeAlt > 300) {
    rho = 1e-12;
  } else if (perigeeAlt > 200) {
    rho = 1e-11;
  } else {
    rho = 1e-10;
  }
  
  // Drag coefficient
  const Cd = 2.2;
  
  // Orbital velocity at perigee (km/s)
  const v_perigee = Math.sqrt(MU_EARTH / (EARTH_RADIUS_KM + perigeeAlt));
  
  // Decay rate (km/day) - simplified
  const decayRate = (0.5 * Cd * rho * areaToMass * v_perigee * v_perigee * 86400) / 1000;
  
  // Estimated lifetime (days until re-entry at 100 km)
  let estimatedLifetime;
  if (decayRate > 0) {
    estimatedLifetime = (perigeeAlt - 100) / decayRate;
  } else {
    estimatedLifetime = Infinity;
  }
  
  return {
    decayRate, // km/day
    estimatedLifetime, // days
    naturalDecay: perigeeAlt < 600 // Whether natural decay is significant
  };
}

/**
 * Calculate perigee evolution over multiple passes
 * @param {number} initialPerigee - Initial perigee altitude in km
 * @param {number} initialApogee - Initial apogee altitude in km
 * @param {array} deltaVs - Array of delta-V values in m/s
 * @returns {array} - Array of { passNumber, perigeeAlt, apogeeAlt }
 */
export function trackPerigeeEvolution(initialPerigee, initialApogee, deltaVs) {
  const evolution = [];
  
  // Initial semi-major axis
  let a = (initialPerigee + initialApogee) / 2 + EARTH_RADIUS_KM;
  
  // Initial eccentricity
  let rp = initialPerigee + EARTH_RADIUS_KM;
  let ra = initialApogee + EARTH_RADIUS_KM;
  let e = (ra - rp) / (ra + rp);
  
  evolution.push({
    passNumber: 0,
    perigeeAlt: initialPerigee,
    apogeeAlt: initialApogee,
    semiMajorAxis: a,
    eccentricity: e
  });
  
  deltaVs.forEach((dv, index) => {
    // Orbital velocity at apogee (where we apply retrograde burn)
    const v_apogee = Math.sqrt(MU_EARTH * (2/ra - 1/a));
    
    // New velocity after retrograde burn
    const v_new = v_apogee - (dv / 1000); // Convert m/s to km/s
    
    // New semi-major axis
    const a_new = 1 / (2/ra - v_new*v_new/MU_EARTH);
    
    // New perigee
    const rp_new = 2 * a_new - ra;
    
    // Update for next iteration
    a = a_new;
    rp = rp_new;
    e = (ra - rp) / (ra + rp);
    
    evolution.push({
      passNumber: index + 1,
      perigeeAlt: rp - EARTH_RADIUS_KM,
      apogeeAlt: ra - EARTH_RADIUS_KM,
      semiMajorAxis: a,
      eccentricity: e,
      deltaV: dv,
      reEntry: (rp - EARTH_RADIUS_KM) < RE_ENTRY_THRESHOLD_KM
    });
  });
  
  return evolution;
}

/**
 * Calculate orbital period
 * @param {number} semiMajorAxis - Semi-major axis in km
 * @returns {number} - Orbital period in minutes
 */
export function calculateOrbitalPeriod(semiMajorAxis) {
  return 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / MU_EARTH) / 60;
}

/**
 * Determine if perigee has reached re-entry threshold
 * @param {number} perigeeAlt - Perigee altitude in km
 * @returns {boolean}
 */
export function isReEntryAchieved(perigeeAlt) {
  return perigeeAlt < RE_ENTRY_THRESHOLD_KM;
}

export default {
  orbitalElementsToStateVectors,
  stateVectorsToOrbitalElements,
  applyDeltaV,
  propagateWithLaserPasses,
  estimateAtmosphericDecay,
  trackPerigeeEvolution,
  calculateOrbitalPeriod,
  isReEntryAchieved,
  RE_ENTRY_THRESHOLD_KM,
  EARTH_RADIUS_KM
};
