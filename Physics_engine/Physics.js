const PHYSICS_CONSTANTS = {
  // Laser System Parameters (based on DLR specifications)
  LASER: {
    PULSE_ENERGY: 100e3,              // J (joules) - Energy per laser pulse (100 kJ)
    WAVELENGTH: 1030e-9,              // m (meters) - Laser wavelength in Yb:YAG
    PULSE_DURATION: 5e-9,             // s (seconds) - Pulse duration (5 nanoseconds)
    TRANSMITTER_DIAMETER: 4.0,        // m - Diameter of laser transmitter aperture
    BEAM_QUALITY: 1.2,                // M² - Beam quality factor (1.0 = perfect Gaussian)
    MAX_REPETITION_RATE: 10,          // Hz - Maximum pulses per second
  },

  // Atmospheric and Propagation Parameters
  ATMOSPHERE: {
    TRANSMISSION_EFFICIENCY: 0.7,     // 70% transmission through atmosphere
    TURBULENCE_PARAMETER: 1.5e-13,    // m^(-2/3) - Atmospheric turbulence (Cn²)
    TRACKING_JITTER: 1e-6,            // rad - Pointing accuracy (1 microradian RMS)
  },

  // Material Properties
  MATERIALS: {
    ALUMINUM: {
      DENSITY: 2700,                  // kg/m³
      SPECIFIC_HEAT: 900,             // J/(kg·K) - Heat capacity
      MELTING_POINT: 933,             // K (Kelvin)
      MAX_TEMP_RISE: 100,             // K - Safe temperature increase limit
      THERMAL_CONDUCTIVITY: 237,      // W/(m·K)
    },
    STEEL: {
      DENSITY: 7850,                  // kg/m³
      SPECIFIC_HEAT: 470,             // J/(kg·K)
      MELTING_POINT: 1811,            // K
      MAX_TEMP_RISE: 200,             // K
      THERMAL_CONDUCTIVITY: 50,       // W/(m·K)
    },
    MLI: {  // Multi-Layer Insulation (spacecraft blankets)
      DENSITY: 100,                   // kg/m³ (effective)
      SPECIFIC_HEAT: 1000,            // J/(kg·K)
      MELTING_POINT: 600,             // K
      MAX_TEMP_RISE: 80,              // K
      THERMAL_CONDUCTIVITY: 0.05,     // W/(m·K)
    },
  },

  // Orbital Mechanics
  ORBITAL: {
    EARTH_RADIUS: 6371e3,             // m - Earth's mean radius
    EARTH_MU: 3.986004418e14,         // m³/s² - Earth's gravitational parameter
    REENTRY_ALTITUDE: 200e3,          // m - Altitude for guaranteed re-entry (200 km)
    MIN_ELEVATION_ANGLE: 20,          // degrees - Minimum angle above horizon
    SPEED_OF_LIGHT: 299792458,        // m/s
  },

  // Safety and Operational Limits
  SAFETY: {
    MAX_SOLAR_CONSTANT_MULTIPLIER: 100,  // Max intensity relative to solar constant
    SOLAR_CONSTANT: 1361,                 // W/m² - Solar irradiance at 1 AU
    MIN_DEBRIS_SIZE: 0.1,                 // m - Minimum trackable debris size
    MAX_DEBRIS_SIZE: 10,                  // m - Maximum practical target size
    COOLDOWN_SAFETY_FACTOR: 1.5,          // Multiplier for thermal cooldown periods
  },
};

function momentumCouplingCoefficient(fluence) {
  // Convert to J/cm² if needed
  const fluenceJcm2 = fluence;
  
  // Empirical fit to DLR experimental data
  // This is a simplified model - real data shows material-dependent behavior
  if (fluenceJcm2 < 10) {
    // Very low fluence: minimal ablation
    return 5 + fluenceJcm2 * 0.5;
  } else if (fluenceJcm2 < 50) {
    // Rising efficiency
    return 10 + (fluenceJcm2 - 10) * 0.375;
  } else if (fluenceJcm2 < 150) {
    // Peak efficiency range
    return 25 - (fluenceJcm2 - 50) * 0.05;
  } else {
    // Plasma shielding reduces efficiency
    return Math.max(10, 20 - (fluenceJcm2 - 150) * 0.05);
  }
}

function heatAbsorptionEfficiency(fluence) {
  const fluenceJcm2 = fluence;
  
  if (fluenceJcm2 < 20) {
    // Low fluence: high heat absorption
    return 0.7;
  } else if (fluenceJcm2 < 100) {
    // Transition regime
    return 0.7 - (fluenceJcm2 - 20) * 0.003;
  } else {
    // High fluence: more energy in ablation
    return Math.max(0.3, 0.46 - (fluenceJcm2 - 100) * 0.001);
  }
}

function calculateBeamRadius(distance, wavelength, transmitterDiameter, beamQuality) {
  // Diffraction-limited divergence angle (half-angle)
  // θ ≈ (M² × λ) / (π × w₀) where w₀ is initial beam radius
  const initialRadius = transmitterDiameter / 2;
  const divergenceAngle = (beamQuality * wavelength) / (Math.PI * initialRadius);
  
  // Rayleigh range: distance over which beam area doubles
  const rayleighRange = (Math.PI * initialRadius * initialRadius) / (beamQuality * wavelength);
  
  // Beam radius at distance (far-field approximation for LEO distances)
  // For distance >> Rayleigh range: w(z) ≈ w₀ + z×θ
  if (distance > 10 * rayleighRange) {
    // Far-field formula (typical for LEO at 400-800 km)
    return initialRadius + distance * divergenceAngle;
  } else {
    // Full Gaussian beam propagation formula
    const w0 = initialRadius;
    const w_z = w0 * Math.sqrt(1 + Math.pow(distance / rayleighRange, 2));
    return w_z;
  }
}

function calculateFluence(pulseEnergy, beamRadius, atmosphericTransmission) {
  // Energy delivered to target after atmospheric losses
  const deliveredEnergy = pulseEnergy * atmosphericTransmission;
  
  // Beam area (circular cross-section)
  const beamArea = Math.PI * beamRadius * beamRadius;
  
  // Fluence in J/m²
  const fluenceJm2 = deliveredEnergy / beamArea;
  
  // Convert to J/cm² (standard unit in laser ablation literature)
  const fluenceJcm2 = fluenceJm2 / 10000;
  
  return fluenceJcm2;
}

function calculateIntensity(pulseEnergy, pulseDuration, beamRadius) {
  const peakPower = pulseEnergy / pulseDuration;
  const beamArea = Math.PI * beamRadius * beamRadius;
  const intensityWm2 = peakPower / beamArea;
  return intensityWm2 / 10000; // Convert to W/cm²
}


function calculateDeltaV(pulseEnergy, mass, fluence) {
  // Get momentum coupling coefficient for this fluence
  const cm = momentumCouplingCoefficient(fluence); // in µN·s/J
  
  // Convert to SI units: µN·s/J → N·s/J
  const cmSI = cm * 1e-6;
  
  // Calculate momentum transferred: p = c_m × E
  const momentum = cmSI * pulseEnergy; // N·s (Newton-seconds)
  
  // Calculate velocity change: ΔV = p / m
  const deltaV = momentum / mass; // m/s
  
  return deltaV;
}

function calculateCumulativeDeltaV(pulsesPerPass, pulseEnergy, mass, fluence) {
  const singlePulseDeltaV = calculateDeltaV(pulseEnergy, mass, fluence);
  return singlePulseDeltaV * pulsesPerPass;
}

function calculateMaxPulsesPerPass(maxTempRise, currentTemp, fluence, areaToMass, specificHeat) {
  // Energy absorbed per pulse
  const efficiency = heatAbsorptionEfficiency(fluence);
  const fluenceJm2 = fluence * 10000; // Convert J/cm² to J/m²
  const energyAbsorbedPerPulse = efficiency * fluenceJm2; // J/m²
  
  // Temperature rise per pulse: ΔT = (A/m) / c_p × E_absorbed
  const tempRisePerPulse = (areaToMass / specificHeat) * energyAbsorbedPerPulse;
  
  // Calculate maximum pulses
  const maxPulses = Math.floor(maxTempRise / tempRisePerPulse);
  
  return Math.max(1, maxPulses); // At least 1 pulse
}

class ThermalBudgetTracker {
  /**
   * @param {string} material - Material type ('ALUMINUM', 'STEEL', 'MLI')
   * @param {number} mass - Debris mass in kg
   * @param {number} area - Cross-sectional area in m²
   * @param {number} initialTemp - Starting temperature in K (typically 250-280K in LEO)
   */
  constructor(material, mass, area, initialTemp = 270) {
    this.material = material;
    this.mass = mass;
    this.area = area;
    this.areaToMass = area / mass; // Critical parameter for thermal response
    
    // Material properties
    const matProps = PHYSICS_CONSTANTS.MATERIALS[material];
    this.specificHeat = matProps.SPECIFIC_HEAT;
    this.maxTempRise = matProps.MAX_TEMP_RISE;
    this.meltingPoint = matProps.MELTING_POINT;
    this.thermalConductivity = matProps.THERMAL_CONDUCTIVITY;
    
    // Thermal state
    this.currentTemp = initialTemp;
    this.ambientTemp = initialTemp; // LEO equilibrium temperature
    this.heatHistory = []; // Track temperature over time
  }

  /**
   * Calculate temperature rise from a sequence of laser pulses
   * 
   * @param {number} numPulses - Number of pulses delivered
   * @param {number} fluence - Fluence per pulse in J/cm²
   * @returns {number} Temperature increase in K
   * 
   * Physical explanation:
   * - Heat capacity: Q = m × c_p × ΔT
   * - Absorbed energy: Q = A × Σ η_r × Φ_i
   * - Combining: ΔT = (A/m) / c_p × Σ η_r × Φ_i
   */
  calculateTempRise(numPulses, fluence) {
    const efficiency = heatAbsorptionEfficiency(fluence);
    const fluenceJm2 = fluence * 10000; // J/cm² → J/m²
    
    // Total energy absorbed
    const totalEnergyPerArea = efficiency * fluenceJm2 * numPulses;
    
    // Temperature rise
    const deltaT = (this.areaToMass / this.specificHeat) * totalEnergyPerArea;
    
    return deltaT;
  }

  /**
   * Apply laser heating to debris and update temperature
   * 
   * @param {number} numPulses - Number of pulses
   * @param {number} fluence - Fluence in J/cm²
   * @param {number} timestamp - Mission elapsed time in seconds
   * @returns {Object} Result with success flag and thermal data
   */
  applyHeating(numPulses, fluence, timestamp) {
    const tempRise = this.calculateTempRise(numPulses, fluence);
    const newTemp = this.currentTemp + tempRise;
    
    // Check safety constraints
    const totalTempRise = newTemp - this.ambientTemp;
    const isSafe = totalTempRise <= this.maxTempRise;
    const wouldMelt = newTemp >= this.meltingPoint;
    
    if (isSafe && !wouldMelt) {
      this.currentTemp = newTemp;
      this.heatHistory.push({
        timestamp,
        temperature: newTemp,
        tempRise: tempRise,
        totalRise: totalTempRise,
      });
      
      return {
        success: true,
        newTemp,
        tempRise,
        totalRise: totalTempRise,
        safetyMargin: this.maxTempRise - totalTempRise,
      };
    } else {
      return {
        success: false,
        reason: wouldMelt ? 'MELTING_RISK' : 'TEMP_LIMIT_EXCEEDED',
        currentTemp: this.currentTemp,
        attemptedTemp: newTemp,
        maxAllowed: this.ambientTemp + this.maxTempRise,
      };
    }
  }

  /**
   * Calculate cooling during orbital passes without laser engagement
   * 
   * @param {number} cooldownTime - Time since last engagement in seconds
   * @returns {number} New temperature after cooling in K
   * 
   * Physical explanation:
   * - Debris cools via thermal radiation (Stefan-Boltzmann law)
   * - P_radiated = ε × σ × A × T⁴ where ε is emissivity, σ is Stefan-Boltzmann constant
   * - Simplified model: exponential decay toward ambient temperature
   * - Time constant depends on area-to-mass ratio and thermal properties
   */
  applyCooling(cooldownTime) {
    // Stefan-Boltzmann constant
    const sigma = 5.67e-8; // W/(m²·K⁴)
    const emissivity = 0.8; // Typical for aluminum/steel surfaces
    
    // Simplified cooling model (exponential relaxation)
    // More accurate: solve dT/dt = -(ε×σ×A/m×c_p)×(T⁴ - T_amb⁴)
    // Simplified: T(t) = T_amb + (T_0 - T_amb) × exp(-t/τ)
    
    // Thermal time constant (approximate)
    const coolingRate = (emissivity * sigma * this.area) / (this.mass * this.specificHeat);
    const effectiveTimeConstant = 1 / (4 * coolingRate * Math.pow(this.currentTemp, 3));
    
    // Exponential cooling toward ambient
    const tempDiff = this.currentTemp - this.ambientTemp;
    const newTempDiff = tempDiff * Math.exp(-cooldownTime / effectiveTimeConstant);
    this.currentTemp = this.ambientTemp + newTempDiff;
    
    return this.currentTemp;
  }

  /**
   * Calculate minimum cooldown time required before next engagement
   * 
   * @param {number} plannedPulses - Number of pulses in next pass
   * @param {number} fluence - Fluence for next pass in J/cm²
   * @returns {number} Minimum cooldown time in seconds
   * 
   * Physical explanation:
   * - Must cool enough so next pass doesn't exceed thermal limit
   * - Apply safety factor to account for uncertainties
   */
  calculateRequiredCooldown(plannedPulses, fluence) {
    const nextPassTempRise = this.calculateTempRise(plannedPulses, fluence);
    const currentTempRise = this.currentTemp - this.ambientTemp;
    const availableMargin = this.maxTempRise - currentTempRise;
    
    if (nextPassTempRise <= availableMargin) {
      return 0; // Can engage immediately
    }
    
    // Need to cool to: T_required = T_amb + (T_max - ΔT_next)
    const requiredTemp = this.ambientTemp + (this.maxTempRise - nextPassTempRise) 
                        / PHYSICS_CONSTANTS.SAFETY.COOLDOWN_SAFETY_FACTOR;
    
    // Solve for time: t = -τ × ln((T_req - T_amb) / (T_current - T_amb))
    const sigma = 5.67e-8;
    const emissivity = 0.8;
    const coolingRate = (emissivity * sigma * this.area) / (this.mass * this.specificHeat);
    const effectiveTimeConstant = 1 / (4 * coolingRate * Math.pow(this.currentTemp, 3));
    
    const tempDiffCurrent = this.currentTemp - this.ambientTemp;
    const tempDiffRequired = requiredTemp - this.ambientTemp;
    
    const cooldownTime = -effectiveTimeConstant * Math.log(tempDiffRequired / tempDiffCurrent);
    
    return Math.max(0, cooldownTime);
  }

  /**
   * Get current thermal status summary
   * @returns {Object} Thermal state information
   */
  getStatus() {
    return {
      currentTemp: this.currentTemp,
      ambientTemp: this.ambientTemp,
      tempRise: this.currentTemp - this.ambientTemp,
      maxAllowedRise: this.maxTempRise,
      safetyMargin: this.maxTempRise - (this.currentTemp - this.ambientTemp),
      meltingPoint: this.meltingPoint,
      distanceToMelting: this.meltingPoint - this.currentTemp,
      isSafe: (this.currentTemp - this.ambientTemp) <= this.maxTempRise,
    };
  }
}

/**
 * Calculate change in orbital elements from tangential ΔV
 * 
 * @param {number} deltaV - Velocity change in m/s (positive = prograde)
 * @param {number} semiMajorAxis - Current semi-major axis in meters
 * @param {number} eccentricity - Current orbital eccentricity (0-1)
 * @param {number} trueAnomaly - True anomaly at ΔV application in radians
 * @returns {Object} Changes in orbital elements
 * 
 * Physical explanation:
 * - Laser provides tangential thrust (perpendicular to radius vector)
 * - Changes orbital energy and angular momentum
 * - Primarily affects perigee altitude (for retrograde ΔV)
 * - vis-viva equation: v² = μ(2/r - 1/a)
 */
function calculateOrbitalChanges(deltaV, semiMajorAxis, eccentricity, trueAnomaly) {
  const mu = PHYSICS_CONSTANTS.ORBITAL.EARTH_MU;
  
  // Current orbital velocity at true anomaly
  const r = semiMajorAxis * (1 - eccentricity * eccentricity) / 
            (1 + eccentricity * Math.cos(trueAnomaly));
  const v = Math.sqrt(mu * (2/r - 1/semiMajorAxis));
  
  // New velocity after ΔV (assuming tangential burn)
  const vNew = v + deltaV;
  
  // New semi-major axis from vis-viva equation
  const aNew = 1 / (2/r - vNew*vNew/mu);
  
  // New specific angular momentum (h = r × v for tangential burn)
  const hOld = Math.sqrt(mu * semiMajorAxis * (1 - eccentricity * eccentricity));
  const hNew = r * vNew;
  
  // New eccentricity from h and energy
  const eNew = Math.sqrt(1 - hNew*hNew / (mu * aNew));
  
  // Calculate perigee and apogee altitudes
  const earthRadius = PHYSICS_CONSTANTS.ORBITAL.EARTH_RADIUS;
  const perigeeOld = semiMajorAxis * (1 - eccentricity) - earthRadius;
  const apogeeOld = semiMajorAxis * (1 + eccentricity) - earthRadius;
  const perigeeNew = aNew * (1 - eNew) - earthRadius;
  const apogeeNew = aNew * (1 + eNew) - earthRadius;
  
  return {
    deltaSemiMajorAxis: aNew - semiMajorAxis,
    deltaEccentricity: eNew - eccentricity,
    newSemiMajorAxis: aNew,
    newEccentricity: eNew,
    perigeeAltitude: {
      old: perigeeOld,
      new: perigeeNew,
      change: perigeeNew - perigeeOld,
    },
    apogeeAltitude: {
      old: apogeeOld,
      new: apogeeNew,
      change: apogeeNew - apogeeOld,
    },
  };
}

/**
 * Estimate time to re-entry based on current orbital parameters
 * 
 * @param {number} perigeeAltitude - Current perigee altitude in meters
 * @param {number} apogeeAltitude - Current apogee altitude in meters
 * @param {number} ballisticCoefficient - m/C_d×A (kg/m²)
 * @returns {number} Estimated time to re-entry in seconds
 * 
 * Physical explanation:
 * - Atmospheric drag causes orbital decay
 * - Drag force: F = 0.5 × ρ × v² × C_d × A
 * - Decay rate depends on perigee altitude (determines drag exposure)
 * - Simplified King-Hele model for decay time
 */
function estimateReentryTime(perigeeAltitude, apogeeAltitude, ballisticCoefficient) {
  const reentryAlt = PHYSICS_CONSTANTS.ORBITAL.REENTRY_ALTITUDE;
  
  if (perigeeAltitude <= reentryAlt) {
    return 0; // Already at re-entry altitude
  }
  
  // Simplified atmospheric density model (exponential)
  const scaleHeight = 70000; // meters (average for LEO)
  const rho0 = 4e-12; // kg/m³ at 400 km reference altitude
  const refAltitude = 400000; // meters
  
  // Average atmospheric density at perigee
  const rho = rho0 * Math.exp(-(perigeeAltitude - refAltitude) / scaleHeight);
  
  // Orbital period
  const semiMajorAxis = (perigeeAltitude + apogeeAltitude) / 2 + PHYSICS_CONSTANTS.ORBITAL.EARTH_RADIUS;
  const period = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / PHYSICS_CONSTANTS.ORBITAL.EARTH_MU);
  
  // Decay rate (simplified King-Hele formula)
  // dh/dt ≈ -(3π/2) × (ρ × v × A) / (m/C_d) × scale_height
  const orbitalVelocity = Math.sqrt(PHYSICS_CONSTANTS.ORBITAL.EARTH_MU / semiMajorAxis);
  const decayRate = (3 * Math.PI / 2) * (rho * orbitalVelocity * scaleHeight) / ballisticCoefficient;
  
  // Time to decay from current perigee to re-entry altitude
  const altitudeDrop = perigeeAltitude - reentryAlt;
  const timeToReentry = altitudeDrop / decayRate;
  
  return timeToReentry; // seconds
}

/**
 * Complete mission pass simulation
 * Integrates all physics calculations for a single laser engagement
 * 
 * @param {Object} debris - Debris object with physical properties
 * @param {Object} laserParams - Laser system parameters
 * @param {number} distance - Distance to target in meters
 * @param {Object} thermalTracker - ThermalBudgetTracker instance
 * @param {number} timestamp - Mission elapsed time in seconds
 * @returns {Object} Complete pass result with all physics data
 */
function simulateLaserPass(debris, laserParams, distance, thermalTracker, timestamp) {
  // 1. Calculate beam propagation
  const beamRadius = calculateBeamRadius(
    distance,
    laserParams.wavelength,
    laserParams.transmitterDiameter,
    laserParams.beamQuality
  );
  
  // 2. Calculate fluence
  const fluence = calculateFluence(
    laserParams.pulseEnergy,
    beamRadius,
    PHYSICS_CONSTANTS.ATMOSPHERE.TRANSMISSION_EFFICIENCY
  );
  
  // 3. Check intensity constraint for large objects
  const intensity = calculateIntensity(
    laserParams.pulseEnergy,
    laserParams.pulseDuration,
    beamRadius
    );
  
  const maxIntensity = PHYSICS_CONSTANTS.SAFETY.SOLAR_CONSTANT * 
                       PHYSICS_CONSTANTS.SAFETY.MAX_SOLAR_CONSTANT_MULTIPLIER / 10000; // W/cm²
  
  if (debris.size > 5 && intensity > maxIntensity) {
    return {
      success: false,
      reason: 'INTENSITY_TOO_HIGH',
      intensity,
      maxIntensity,
      message: 'Risk of damaging large satellite - reduce power or increase distance'
    };
  }
  
  // 4. Calculate maximum pulses based on thermal constraints
  const maxPulses = calculateMaxPulsesPerPass(
    thermalTracker.maxTempRise - (thermalTracker.currentTemp - thermalTracker.ambientTemp),
    thermalTracker.currentTemp,
    fluence,
    debris.area / debris.mass,
    thermalTracker.specificHeat
  );
  
  // 5. Determine actual pulses (limited by pass duration)
  const passDuration = debris.visibilityDuration || 300; // seconds (typical 5 min)
  const maxPulsesByTime = Math.floor(passDuration * laserParams.repetitionRate);
  const actualPulses = Math.min(maxPulses, maxPulsesByTime);
  
  if (actualPulses < 1) {
    return {
      success: false,
      reason: 'THERMAL_LIMIT_REACHED',
      thermalStatus: thermalTracker.getStatus(),
      message: 'Debris too hot - cooldown required'
    };
  }
  
  // 6. Apply thermal heating
  const thermalResult = thermalTracker.applyHeating(actualPulses, fluence, timestamp);
  
  if (!thermalResult.success) {
    return {
      success: false,
      reason: thermalResult.reason,
      thermalResult,
      message: 'Thermal constraints violated'
    };
  }
  
  // 7. Calculate momentum transfer
  const deltaVSingle = calculateDeltaV(laserParams.pulseEnergy, debris.mass, fluence);
  const totalDeltaV = deltaVSingle * actualPulses;
  
  // 8. Calculate orbital changes
  const orbitalChanges = calculateOrbitalChanges(
    -totalDeltaV, // Negative for retrograde (deorbiting)
    debris.semiMajorAxis,
    debris.eccentricity,
    Math.PI // Assume worst case: ΔV at apogee (reduces perigee most)
  );
  
  // 9. Update debris orbital elements
  const updatedDebris = {
    ...debris,
    semiMajorAxis: orbitalChanges.newSemiMajorAxis,
    eccentricity: orbitalChanges.newEccentricity,
    perigeeAltitude: orbitalChanges.perigeeAltitude.new,
    apogeeAltitude: orbitalChanges.apogeeAltitude.new,
  };
  
  // 10. Check if re-entry achieved
  const reentryAchieved = orbitalChanges.perigeeAltitude.new <= 
                          PHYSICS_CONSTANTS.ORBITAL.REENTRY_ALTITUDE;
  
  // 11. Estimate remaining time to re-entry
  let timeToReentry = null;
  if (!reentryAchieved) {
    timeToReentry = estimateReentryTime(
      orbitalChanges.perigeeAltitude.new,
      orbitalChanges.apogeeAltitude.new,
      debris.ballisticCoefficient || (debris.mass / (2.2 * debris.area)) // Default C_d = 2.2
    );
  }
  
  // 12. Return comprehensive results
  return {
    success: true,
    timestamp,
    
    // Beam properties
    beamRadius,
    fluence,
    intensity,
    
    // Engagement details
    pulsesDelivered: actualPulses,
    maxPulsesByThermal: maxPulses,
    maxPulsesByTime: maxPulsesByTime,
    limitingFactor: actualPulses === maxPulses ? 'THERMAL' : 'TIME',
    
    // Momentum transfer
    deltaVPerPulse: deltaVSingle,
    totalDeltaV,
    cumulativeDeltaV: (debris.cumulativeDeltaV || 0) + totalDeltaV,
    
    // Thermal state
    thermalResult,
    thermalStatus: thermalTracker.getStatus(),
    
    // Orbital changes
    orbitalChanges,
    updatedDebris,
    
    // Mission status
    reentryAchieved,
    timeToReentry,
    perigeeReduction: -orbitalChanges.perigeeAltitude.change,
    
    // Performance metrics
    momentumCouplingCoeff: momentumCouplingCoefficient(fluence),
    heatEfficiency: heatAbsorptionEfficiency(fluence),
    energyDelivered: laserParams.pulseEnergy * actualPulses,
  };
}

/**
 * Calculate optimal laser repetition rate based on thermal constraints
 * Automatically adjusts pulse rate to maintain safe temperature
 * 
 * @param {Object} debris - Debris properties
 * @param {number} fluence - Laser fluence in J/cm²
 * @param {Object} thermalTracker - ThermalBudgetTracker instance
 * @param {number} passDuration - Pass duration in seconds
 * @returns {Object} Optimal repetition rate and pulse count
 * 
 * Physical explanation:
 * - Small fragments: Can handle high rep rates (9 Hz) - cool quickly
 * - Large objects: Need low rep rates (1.6-5.7 Hz) - heat accumulates
 * - Adaptive algorithm balances throughput vs. thermal safety
 */
function calculateAdaptiveRepRate(debris, fluence, thermalTracker, passDuration) {
  const maxRepRate = PHYSICS_CONSTANTS.LASER.MAX_REPETITION_RATE;
  
  // Calculate temperature rise per pulse
  const tempRisePerPulse = thermalTracker.calculateTempRise(1, fluence);
  
  // Calculate available thermal margin
  const currentRise = thermalTracker.currentTemp - thermalTracker.ambientTemp;
  const availableMargin = thermalTracker.maxTempRise - currentRise;
  
  // Maximum pulses before thermal limit
  const maxPulsesByTemp = Math.floor(availableMargin / tempRisePerPulse);
  
  // Calculate required rep rate to use all available margin during pass
  const idealRepRate = maxPulsesByTemp / passDuration;
  
  // Clamp to system capabilities
  const actualRepRate = Math.min(idealRepRate, maxRepRate);
  const actualPulses = Math.floor(actualRepRate * passDuration);
  
  // Calculate utilization efficiency
  const thermalUtilization = (actualPulses * tempRisePerPulse) / availableMargin;
  const timeUtilization = actualRepRate / maxRepRate;
  
  return {
    repetitionRate: actualRepRate,
    pulsesPerPass: actualPulses,
    thermalUtilization: Math.min(thermalUtilization, 1.0),
    timeUtilization,
    limitingFactor: thermalUtilization >= 0.95 ? 'THERMAL' : 'LASER_SYSTEM',
    tempRisePerPulse,
    totalTempRise: actualPulses * tempRisePerPulse,
  };
}

/**
 * Plan complete debris removal campaign across multiple passes
 * 
 * @param {Object} debris - Initial debris state
 * @param {Object} laserParams - Laser system configuration
 * @param {Array} passTimes - Array of pass timestamps (seconds from mission start)
 * @param {string} material - Material type for thermal tracking
 * @returns {Object} Complete mission plan with pass-by-pass results
 * 
 * Physical explanation:
 * - Iteratively applies laser engagements over weeks/months
 * - Tracks cumulative orbital decay and thermal state
 * - Enforces cooldown periods between passes
 * - Monitors progress toward re-entry threshold
 */
function planRemovalCampaign(debris, laserParams, passTimes, material = 'ALUMINUM') {
  // Initialize thermal tracker
  const thermalTracker = new ThermalBudgetTracker(
    material,
    debris.mass,
    debris.area,
    270 // Initial LEO temperature (K)
  );
  
  // Mission state
  let currentDebris = { ...debris, cumulativeDeltaV: 0 };
  const passResults = [];
  let totalPulses = 0;
  let totalEnergy = 0;
  let missionComplete = false;
  
  // Simulate each pass
  for (let i = 0; i < passTimes.length && !missionComplete; i++) {
    const timestamp = passTimes[i];
    
    // Apply cooling since last pass
    if (i > 0) {
      const cooldownTime = timestamp - passTimes[i - 1];
      thermalTracker.applyCooling(cooldownTime);
    }
    
    // Calculate distance to debris (simplified - assume constant altitude)
    const avgAltitude = (currentDebris.perigeeAltitude + currentDebris.apogeeAltitude) / 2;
    const distance = avgAltitude + 100e3; // Add extra 100 km for ground station elevation
    
    // Check if cooldown is sufficient
    const beamRadius = calculateBeamRadius(
      distance,
      laserParams.wavelength,
      laserParams.transmitterDiameter,
      laserParams.beamQuality
    );
    const fluence = calculateFluence(
      laserParams.pulseEnergy,
      beamRadius,
      PHYSICS_CONSTANTS.ATMOSPHERE.TRANSMISSION_EFFICIENCY
    );
    
    // Calculate adaptive rep rate for this pass
    const repRateResult = calculateAdaptiveRepRate(
      currentDebris,
      fluence,
      thermalTracker,
      currentDebris.visibilityDuration || 300
    );
    
    // Check if enough cooldown has occurred
    const requiredCooldown = thermalTracker.calculateRequiredCooldown(
      repRateResult.pulsesPerPass,
      fluence
    );
    
    if (i > 0 && requiredCooldown > (timestamp - passTimes[i - 1])) {
      // Skip this pass - insufficient cooldown
      passResults.push({
        passNumber: i + 1,
        timestamp,
        skipped: true,
        reason: 'INSUFFICIENT_COOLDOWN',
        requiredCooldown,
        actualCooldown: timestamp - passTimes[i - 1],
        thermalStatus: thermalTracker.getStatus(),
      });
      continue;
    }
    
    // Update laser params with adaptive rep rate
    const adaptiveLaserParams = {
      ...laserParams,
      repetitionRate: repRateResult.repetitionRate,
    };
    
    // Simulate the pass
    const passResult = simulateLaserPass(
      currentDebris,
      adaptiveLaserParams,
      distance,
      thermalTracker,
      timestamp
    );
    
    if (!passResult.success) {
      passResults.push({
        passNumber: i + 1,
        timestamp,
        skipped: true,
        reason: passResult.reason,
        message: passResult.message,
        thermalStatus: thermalTracker.getStatus(),
      });
      continue;
    }
    
    // Update mission state
    currentDebris = passResult.updatedDebris;
    currentDebris.cumulativeDeltaV = passResult.cumulativeDeltaV;
    totalPulses += passResult.pulsesDelivered;
    totalEnergy += passResult.energyDelivered;
    
    // Record pass results
    passResults.push({
      passNumber: i + 1,
      timestamp,
      skipped: false,
      ...passResult,
      repRateInfo: repRateResult,
    });
    
    // Check for mission completion
    if (passResult.reentryAchieved) {
      missionComplete = true;
    }
  }
  
  // Calculate mission statistics
  const successfulPasses = passResults.filter(p => !p.skipped);
  const missionDuration = passTimes[passTimes.length - 1] / 86400; // Convert to days
  
  return {
    missionComplete,
    missionDuration,
    totalPasses: passTimes.length,
    successfulPasses: successfulPasses.length,
    skippedPasses: passResults.length - successfulPasses.length,
    
    // Performance metrics
    totalPulses,
    totalEnergy: totalEnergy / 1e9, // Convert to GJ (gigajoules)
    totalDeltaV: currentDebris.cumulativeDeltaV,
    
    // Final state
    finalDebris: currentDebris,
    finalPerigee: currentDebris.perigeeAltitude,
    finalApogee: currentDebris.apogeeAltitude,
    perigeeReduction: debris.perigeeAltitude - currentDebris.perigeeAltitude,
    
    // Thermal summary
    finalThermalStatus: thermalTracker.getStatus(),
    maxTempReached: Math.max(...thermalTracker.heatHistory.map(h => h.temperature)),
    
    // Pass-by-pass results
    passResults,
    
    // Economic estimate (simplified)
    estimatedCost: calculateMissionCost(totalEnergy / 1e9, missionDuration),
  };
}

/**
 * Estimate mission cost based on energy and duration
 * 
 * @param {number} totalEnergyGJ - Total laser energy in gigajoules
 * @param {number} durationDays - Mission duration in days
 * @returns {Object} Cost breakdown
 * 
 * Physical explanation:
 * - Laser operation costs (electricity, maintenance)
 * - Staff and facility costs
 * - Compare to $100M+ per spacecraft-based removal mission
 */
function calculateMissionCost(totalEnergyGJ, durationDays) {
  // Cost assumptions (simplified)
  const electricityCostPerKWh = 0.10; // USD
  const energyKWh = totalEnergyGJ * 277.778; // Convert GJ to kWh
  const electricityCost = energyKWh * electricityCostPerKWh;
  
  const operatingCostPerDay = 5000; // Staff, facility, maintenance
  const operatingCost = operatingCostPerDay * durationDays;
  
  const totalCost = electricityCost + operatingCost;
  
  return {
    electricityCost,
    operatingCost,
    totalCost,
    costPerKm: totalCost / (durationDays * 10), // Rough estimate
    comparisonToSpacecraft: 100e6 / totalCost, // Factor cheaper than spacecraft
  };
}

/**
 * Validate debris parameters for physics calculations
 * 
 * @param {Object} debris - Debris object to validate
 * @returns {Object} Validation result with errors/warnings
 */
function validateDebrisParameters(debris) {
  const errors = [];
  const warnings = [];
  
  // Required parameters
  if (!debris.mass || debris.mass <= 0) {
    errors.push('Mass must be positive');
  }
  if (!debris.area || debris.area <= 0) {
    errors.push('Cross-sectional area must be positive');
  }
  if (!debris.semiMajorAxis || debris.semiMajorAxis <= PHYSICS_CONSTANTS.ORBITAL.EARTH_RADIUS) {
    errors.push('Semi-major axis must be above Earth surface');
  }
  if (debris.eccentricity < 0 || debris.eccentricity >= 1) {
    errors.push('Eccentricity must be between 0 and 1');
  }
  
  // Physics sanity checks
  const areaToMass = debris.area / debris.mass;
  if (areaToMass < 0.001 || areaToMass > 1.0) {
    warnings.push(`Unusual area-to-mass ratio: ${areaToMass.toFixed(3)} m²/kg`);
  }
  
  if (debris.perigeeAltitude < PHYSICS_CONSTANTS.ORBITAL.REENTRY_ALTITUDE) {
    warnings.push('Perigee already below re-entry altitude');
  }
  
  if (debris.perigeeAltitude > 2000e3) {
    warnings.push('Very high orbit - removal may take years');
  }
  
  // Size checks
  if (debris.size < PHYSICS_CONSTANTS.SAFETY.MIN_DEBRIS_SIZE) {
    warnings.push('Debris may be too small to track accurately');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Estimate debris physical properties from TLE and size
 * Used when detailed properties are unavailable
 * 
 * @param {number} size - Characteristic dimension in meters
 * @param {string} debrisType - Type: 'FRAGMENT', 'ROCKET_BODY', 'PAYLOAD'
 * @returns {Object} Estimated physical properties
 */
function estimateDebrisProperties(size, debrisType = 'FRAGMENT') {
  let density, areaFactor, material;
  
  switch (debrisType) {
    case 'FRAGMENT':
      density = 2700; // Aluminum
      areaFactor = 0.5; // Irregular shape
      material = 'ALUMINUM';
      break;
    case 'ROCKET_BODY':
      density = 1500; // Lightweight structure
      areaFactor = 0.3; // Cylindrical
      material = 'ALUMINUM';
      break;
    case 'PAYLOAD':
      density = 800; // Hollow satellite
      areaFactor = 0.4; // Box-like
      material = 'ALUMINUM';
      break;
    default:
      density = 2000;
      areaFactor = 0.4;
      material = 'ALUMINUM';
  }
  
  // Estimate volume and mass
  const volume = areaFactor * Math.pow(size, 3);
  const mass = density * volume;
  
  // Estimate cross-sectional area
  const area = areaFactor * size * size;
  
  return {
    mass,
    area,
    areaToMass: area / mass,
    material,
    ballisticCoefficient: mass / (2.2 * area), // Assume C_d = 2.2
    estimatedVolume: volume,
  };
}

/**
 * Calculate collision probability reduction from debris removal
 * 
 * @param {number} debrisRemoved - Number of debris objects removed
 * @param {number} totalDebris - Total debris population
 * @param {number} altitude - Orbital altitude in meters
 * @returns {Object} Risk reduction metrics
 * 
 * Physical explanation:
 * - Collision probability proportional to debris density squared
 * - Small reductions in population yield disproportionate risk reduction
 * - Most effective at high-density altitudes (750-850 km)
 */
function calculateRiskReduction(debrisRemoved, totalDebris, altitude) {
  const removalFraction = debrisRemoved / totalDebris;
  
  // Collision probability scales with N²
  const relativeProbabilityReduction = 1 - Math.pow(1 - removalFraction, 2);
  
  // Altitude-dependent risk multiplier (800 km is most congested)
  const altitudeKm = altitude / 1000;
  const riskMultiplier = Math.exp(-Math.pow((altitudeKm - 800) / 200, 2));
  
  const effectiveRiskReduction = relativeProbabilityReduction * riskMultiplier;
  
  return {
    debrisRemoved,
    removalFraction,
    relativeProbabilityReduction,
    effectiveRiskReduction,
    riskMultiplier,
    altitudeRiskFactor: riskMultiplier,
  };
}

/**
 * Generate performance comparison table for different debris sizes
 * Useful for mission planning and prioritization
 * 
 * @param {Array} debrisList - Array of debris objects
 * @param {Object} laserParams - Laser configuration
 * @returns {Array} Sorted performance metrics
 */
function compareDebrisRemovalEfficiency(debrisList, laserParams) {
  const results = debrisList.map(debris => {
    // Estimate passes required
    const avgAltitude = (debris.perigeeAltitude + debris.apogeeAltitude) / 2;
    const distance = avgAltitude + 100e3;
    
    const beamRadius = calculateBeamRadius(
      distance,
      laserParams.wavelength,
      laserParams.transmitterDiameter,
      laserParams.beamQuality
    );
    
    const fluence = calculateFluence(
      laserParams.pulseEnergy,
      beamRadius,
      PHYSICS_CONSTANTS.ATMOSPHERE.TRANSMISSION_EFFICIENCY
    );
    
    const deltaVPerPass = calculateCumulativeDeltaV(
      100, // Assume 100 pulses per pass
      laserParams.pulseEnergy,
      debris.mass,
      fluence
    );
    
    // Estimate total ΔV needed (rough approximation)
    const orbitalVelocity = Math.sqrt(PHYSICS_CONSTANTS.ORBITAL.EARTH_MU / 
                                      (debris.semiMajorAxis));
    const requiredDeltaV = orbitalVelocity * 0.05; // ~5% velocity change for re-entry
    
    const estimatedPasses = Math.ceil(requiredDeltaV / deltaVPerPass);
    const estimatedDays = estimatedPasses * 1.5; // Average 1.5 days between passes
    
    return {
      debrisId: debris.id || debris.name,
      size: debris.size,
      mass: debris.mass,
      deltaVPerPass,
      estimatedPasses,
      estimatedDays,
      efficiency: deltaVPerPass / debris.mass, // m/s per kg per pass
      priority: debris.collisionRisk || 0,
    };
  });
  
  // Sort by efficiency (best first)
  return results.sort((a, b) => b.efficiency - a.efficiency);
}

/**
 * Complete example: Plan a debris removal mission
 */
function exampleMission() {
  // Define debris object (example: 0.5m aluminum fragment at 800km)
  const debris = {
    id: 'DEBRIS-12345',
    name: 'Fragment from Cosmos 2251 collision',
    size: 0.5, // meters
    mass: 15, // kg
    area: 0.1, // m² cross-section
    material: 'ALUMINUM',
    
    // Orbital elements
    semiMajorAxis: 7178000, // meters (800 km altitude)
    eccentricity: 0.001, // Nearly circular
    inclination: 72.9, // degrees
    perigeeAltitude: 799000, // meters
    apogeeAltitude: 801000, // meters
    
    // Additional properties
    visibilityDuration: 300, // seconds per pass
    ballisticCoefficient: 150, // kg/m²
  };
  
  // Define laser system (DLR specification)
  const laserParams = {
    pulseEnergy: 100e3, // 100 kJ
    wavelength: 1030e-9, // 1030 nm
    pulseDuration: 5e-9, // 5 ns
    transmitterDiameter: 4.0, // 4 m
    beamQuality: 1.2, // M²
    repetitionRate: 5, // Will be adjusted adaptively
  };
  
  // Generate pass schedule (twice daily for 60 days)
  const passTimes = [];
  for (let day = 0; day < 60; day++) {
    passTimes.push(day * 86400); // Morning pass
    passTimes.push(day * 86400 + 43200); // Evening pass
  }
  
  // Plan the mission
  const missionPlan = planRemovalCampaign(
    debris,
    laserParams,
    passTimes,
    'ALUMINUM'
  );
  
  // Print results
  console.log('=== MISSION SUMMARY ===');
  console.log(`Mission Complete: ${missionPlan.missionComplete}`);
  console.log(`Duration: ${missionPlan.missionDuration.toFixed(1)} days`);
  console.log(`Successful Passes: ${missionPlan.successfulPasses} / ${missionPlan.totalPasses}`);
  console.log(`Total Pulses: ${missionPlan.totalPulses.toLocaleString()}`);
  console.log(`Total Energy: ${missionPlan.totalEnergy.toFixed(2)} GJ`);
  console.log(`Total ΔV: ${missionPlan.totalDeltaV.toFixed(3)} m/s`);
  console.log(`Perigee Reduction: ${(missionPlan.perigeeReduction/1000).toFixed(1)} km`);
  console.log(`Final Perigee: ${(missionPlan.finalPerigee/1000).toFixed(1)} km`);
  console.log(`Estimated Cost: $${missionPlan.estimatedCost.totalCost.toLocaleString()}`);
  console.log(`Cost vs Spacecraft: ${missionPlan.estimatedCost.comparisonToSpacecraft.toFixed(0)}x cheaper`);
  
  return missionPlan;
}

// Run example
const mission = exampleMission();