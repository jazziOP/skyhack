import React, { useState, useMemo } from 'react';
import { calculateVisibilityWindows } from './map.jsx';
import { trackPerigeeEvolution, estimateAtmosphericDecay, isReEntryAchieved } from './orbitalMechanics.js';

// Sample debris catalog with TLE data
const DEBRIS_CATALOG = [
  {
    id: 1,
    name: "Cosmos 1408 Fragment #1",
    size: 0.5, // meters
    mass: 15, // kg
    material: 'ALUMINUM',
    areaToMass: 0.02, // m²/kg
    tle1: "1 49863U 21113A   23320.50000000  .00001234  00000-0  12345-3 0  9999",
    tle2: "2 49863  82.5678 123.4567 0012345  45.6789 314.5678 14.89012345123456",
    perigee: 480,
    apogee: 520,
    inclination: 82.5
  },
  {
    id: 2,
    name: "Fengyun-1C Fragment",
    size: 0.3,
    mass: 5,
    material: 'ALUMINUM',
    areaToMass: 0.03,
    tle1: "1 32345U 07006A   23320.50000000  .00000987  00000-0  98765-4 0  9997",
    tle2: "2 32345  98.7654 234.5678 0023456  67.8901 292.3456 14.12345678234567",
    perigee: 750,
    apogee: 820,
    inclination: 98.7
  },
  {
    id: 3,
    name: "Rocket Body (R/B)",
    size: 2.5,
    mass: 450,
    material: 'STEEL',
    areaToMass: 0.008,
    tle1: "1 12345U 99025B   23320.50000000  .00000456  00000-0  45678-4 0  9998",
    tle2: "2 12345  51.6543 345.6789 0034567  89.0123 271.2345 15.54321098345678",
    perigee: 380,
    apogee: 410,
    inclination: 51.6
  },
  {
    id: 4,
    name: "Small Fragment (Paint Flake)",
    size: 0.1,
    mass: 0.5,
    material: 'MLI',
    areaToMass: 0.05,
    tle1: "1 98765U 19001A   23320.50000000  .00002345  00000-0  23456-3 0  9996",
    tle2: "2 98765  45.6789 456.7890 0045678  12.3456 347.8901 15.12345678456789",
    perigee: 550,
    apogee: 600,
    inclination: 45.6
  }
];

// Physics constants from Physics.js
const LASER_PARAMS = {
  PULSE_ENERGY: 100e3, // 100 kJ
  WAVELENGTH: 1030e-9,
  PULSE_DURATION: 5e-9,
  TRANSMITTER_DIAMETER: 4.0,
  BEAM_QUALITY: 1.2,
};

const MATERIAL_PROPERTIES = {
  ALUMINUM: { MAX_TEMP_RISE: 100, SPECIFIC_HEAT: 900, DENSITY: 2700 },
  STEEL: { MAX_TEMP_RISE: 200, SPECIFIC_HEAT: 470, DENSITY: 7850 },
  MLI: { MAX_TEMP_RISE: 80, SPECIFIC_HEAT: 1000, DENSITY: 100 }
};

/**
 * Calculate laser-induced delta-V (simplified from Physics.js)
 */
function calculateLaserDeltaV(pulseEnergy, mass, distance) {
  // Beam radius at distance (simplified)
  const divergenceAngle = (LASER_PARAMS.BEAM_QUALITY * LASER_PARAMS.WAVELENGTH) / 
                         (Math.PI * (LASER_PARAMS.TRANSMITTER_DIAMETER / 2));
  const beamRadius = (LASER_PARAMS.TRANSMITTER_DIAMETER / 2) + distance * divergenceAngle;
  
  // Fluence (J/cm²)
  const beamArea = Math.PI * beamRadius * beamRadius;
  const fluenceJm2 = (pulseEnergy * 0.7) / beamArea; // 0.7 = atmospheric transmission
  const fluence = fluenceJm2 / 10000; // Convert to J/cm²
  
  // Momentum coupling coefficient (simplified)
  let cm;
  if (fluence < 10) {
    cm = 5e-6;
  } else if (fluence < 50) {
    cm = (5 + (fluence - 10) * 0.5) * 1e-6;
  } else {
    cm = 25e-6;
  }
  
  // Delta-V per pulse (m/s)
  return (cm * pulseEnergy) / mass;
}

/**
 * Calculate max pulses per pass based on thermal constraints
 */
function calculateMaxPulses(debris, fluence) {
  const material = MATERIAL_PROPERTIES[debris.material];
  const maxTempRise = material.MAX_TEMP_RISE;
  const specificHeat = material.SPECIFIC_HEAT;
  
  // Energy absorbed per pulse
  const absorptionEff = fluence < 20 ? 0.3 : Math.min(0.8, 0.3 + (fluence - 20) * 0.01);
  const energyPerPulse = fluence * 10000 * absorptionEff; // J/m²
  
  // Temperature rise per pulse
  const tempRisePerPulse = (debris.areaToMass * energyPerPulse) / specificHeat;
  
  // Max pulses before overheating
  return Math.floor(maxTempRise / tempRisePerPulse);
}

export default function MissionPlanner({ stations, selectedDebris, setSelectedDebris, missionResults, setMissionResults }) {
  const [calculating, setCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Calculate mission when debris is selected and stations are available
  const runMissionSimulation = () => {
    if (!selectedDebris || stations.length === 0) {
      alert('Please select debris and place at least one ground station');
      return;
    }

    setCalculating(true);
    setShowResults(false);

    // Simulate calculation delay
    setTimeout(() => {
      // 1. Calculate visibility passes for all stations
      const allPasses = [];
      stations.forEach(station => {
        const passes = calculateVisibilityWindows(
          station,
          selectedDebris.tle1,
          selectedDebris.tle2,
          90, // 90 days
          20 // min elevation
        );
        passes.forEach(pass => {
          allPasses.push({
            ...pass,
            stationId: station.id,
            stationName: station.name
          });
        });
      });

      // Sort passes chronologically
      allPasses.sort((a, b) => a.startTime - b.startTime);

      // 2. Calculate laser physics for each pass
      const distance = (selectedDebris.perigee + 6371) * 1000; // meters
      const deltaVPerPulse = calculateLaserDeltaV(
        LASER_PARAMS.PULSE_ENERGY,
        selectedDebris.mass,
        distance
      );

      // Beam radius calculation
      const divergenceAngle = (LASER_PARAMS.BEAM_QUALITY * LASER_PARAMS.WAVELENGTH) / 
                             (Math.PI * (LASER_PARAMS.TRANSMITTER_DIAMETER / 2));
      const beamRadius = (LASER_PARAMS.TRANSMITTER_DIAMETER / 2) + distance * divergenceAngle;
      const beamArea = Math.PI * beamRadius * beamRadius;
      const fluence = (LASER_PARAMS.PULSE_ENERGY * 0.7) / (beamArea * 10000);
      
      const maxPulsesPerPass = calculateMaxPulses(selectedDebris, fluence);

      // 3. Calculate orbital mechanics
      const deltaVsPerPass = [];
      const passDetails = [];

      allPasses.forEach((pass, idx) => {
        const pulsesThisPass = Math.min(maxPulsesPerPass, Math.floor(pass.duration / 0.1)); // 10 Hz max
        const totalDeltaV = deltaVPerPulse * pulsesThisPass;
        
        deltaVsPerPass.push(totalDeltaV);
        passDetails.push({
          passNumber: idx + 1,
          time: pass.startTime,
          duration: pass.duration,
          pulses: pulsesThisPass,
          deltaV: totalDeltaV,
          station: pass.stationName,
          elevation: pass.maxElevation
        });
      });

      // Track perigee evolution
      const orbitalEvolution = trackPerigeeEvolution(
        selectedDebris.perigee,
        selectedDebris.apogee,
        deltaVsPerPass
      );

      // Find when re-entry is achieved
      const reEntryPass = orbitalEvolution.find(e => isReEntryAchieved(e.perigeeAlt));
      const passesNeeded = reEntryPass ? reEntryPass.passNumber : orbitalEvolution.length;
      const totalDeltaV = deltaVsPerPass.slice(0, passesNeeded).reduce((sum, dv) => sum + dv, 0);

      // Estimate atmospheric decay
      const finalPerigee = reEntryPass ? reEntryPass.perigeeAlt : orbitalEvolution[orbitalEvolution.length - 1].perigeeAlt;
      const decay = estimateAtmosphericDecay(finalPerigee, selectedDebris.areaToMass);

      // Mission duration
      const firstPass = allPasses[0].startTime;
      const lastPass = allPasses[Math.min(passesNeeded - 1, allPasses.length - 1)].startTime;
      const durationDays = (lastPass - firstPass) / (1000 * 60 * 60 * 24);

      // Total energy
      const totalPulses = passDetails.slice(0, passesNeeded).reduce((sum, p) => sum + p.pulses, 0);
      const totalEnergyGJ = (totalPulses * LASER_PARAMS.PULSE_ENERGY) / 1e9;

      setMissionResults({
        debris: selectedDebris,
        passesNeeded,
        totalPasses: allPasses.length,
        totalDeltaV,
        durationDays,
        totalEnergyGJ,
        totalPulses,
        reEntryAchieved: !!reEntryPass,
        finalPerigee,
        atmosphericDecay: decay,
        passDetails: passDetails.slice(0, Math.min(20, passesNeeded)), // First 20 passes
        orbitalEvolution: orbitalEvolution.slice(0, Math.min(50, passesNeeded)), // First 50 for chart
        deltaVPerPulse,
        fluence
      });

      setCalculating(false);
      setShowResults(true);
    }, 1500);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', color: 'white', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '15px', background: '#1a1e35', borderBottom: '1px solid #2a2e45' }}>
        <h2 style={{ margin: 0, fontSize: '18px' }}>Mission Planner</h2>
        <p style={{ margin: '5px 0 0 0', fontSize: '13px', opacity: 0.7 }}>
          Select debris and calculate removal campaign
        </p>
      </div>

      {/* Debris Selection */}
      <div style={{ padding: '20px', borderBottom: '1px solid #2a2e45' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
          Select Debris Target:
        </label>
        <select
          value={selectedDebris?.id || ''}
          onChange={(e) => {
            const debris = DEBRIS_CATALOG.find(d => d.id === parseInt(e.target.value));
            setSelectedDebris(debris);
            setShowResults(false);
          }}
          style={{
            width: '100%',
            padding: '10px',
            background: '#2a2e45',
            color: 'white',
            border: '1px solid #3a3e55',
            borderRadius: '6px',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <option value="">-- Choose Target --</option>
          {DEBRIS_CATALOG.map(debris => (
            <option key={debris.id} value={debris.id}>
              {debris.name} ({debris.size}m, {debris.mass}kg, {debris.perigee}km)
            </option>
          ))}
        </select>

        {selectedDebris && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#2a2e45', 
            borderRadius: '6px',
            fontSize: '13px'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div><strong>Size:</strong> {selectedDebris.size} m</div>
              <div><strong>Mass:</strong> {selectedDebris.mass} kg</div>
              <div><strong>Material:</strong> {selectedDebris.material}</div>
              <div><strong>A/M:</strong> {selectedDebris.areaToMass} m²/kg</div>
              <div><strong>Perigee:</strong> {selectedDebris.perigee} km</div>
              <div><strong>Apogee:</strong> {selectedDebris.apogee} km</div>
            </div>
          </div>
        )}
      </div>

      {/* Calculate Button */}
      <div style={{ padding: '20px', borderBottom: '1px solid #2a2e45' }}>
        <button
          onClick={runMissionSimulation}
          disabled={!selectedDebris || stations.length === 0 || calculating}
          style={{
            width: '100%',
            padding: '14px',
            background: !selectedDebris || stations.length === 0 ? '#3a3e55' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: !selectedDebris || stations.length === 0 ? 'not-allowed' : 'pointer',
            opacity: calculating ? 0.6 : 1
          }}
        >
          {calculating ? '⚙️ Calculating...' : '🚀 Calculate Mission'}
        </button>
      </div>

      {/* Results */}
      {showResults && missionResults && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px', color: '#667eea' }}>
            📊 Mission Results
          </h3>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            <ResultCard 
              label="Passes Needed" 
              value={missionResults.passesNeeded}
              unit="passes"
              color="#10b981"
            />
            <ResultCard 
              label="Mission Duration" 
              value={Math.round(missionResults.durationDays)}
              unit="days"
              color="#3b82f6"
            />
            <ResultCard 
              label="Total ΔV" 
              value={missionResults.totalDeltaV.toFixed(2)}
              unit="m/s"
              color="#f59e0b"
            />
            <ResultCard 
              label="Total Energy" 
              value={missionResults.totalEnergyGJ.toFixed(3)}
              unit="GJ"
              color="#ef4444"
            />
          </div>

          {/* Re-entry Status */}
          <div style={{
            padding: '15px',
            background: missionResults.reEntryAchieved ? '#065f46' : '#7c2d12',
            borderRadius: '8px',
            marginBottom: '20px',
            border: `2px solid ${missionResults.reEntryAchieved ? '#10b981' : '#f59e0b'}`
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
              {missionResults.reEntryAchieved ? '✅ Re-entry Achieved' : '⚠️ Re-entry Pending'}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              Final Perigee: {Math.round(missionResults.finalPerigee)} km
              {!missionResults.reEntryAchieved && ` (Target: <200 km)`}
            </div>
            {missionResults.atmosphericDecay.naturalDecay && (
              <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '5px' }}>
                Natural decay: ~{Math.round(missionResults.atmosphericDecay.estimatedLifetime)} days
              </div>
            )}
          </div>

          {/* Perigee Evolution Chart */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Perigee Evolution</h4>
            <div style={{ 
              background: '#2a2e45', 
              padding: '15px', 
              borderRadius: '6px',
              height: '200px',
              position: 'relative'
            }}>
              <svg width="100%" height="100%" viewBox="0 0 400 180">
                {/* Grid lines */}
                <line x1="40" y1="20" x2="40" y2="160" stroke="#3a3e55" strokeWidth="2"/>
                <line x1="40" y1="160" x2="380" y2="160" stroke="#3a3e55" strokeWidth="2"/>
                
                {/* Re-entry threshold line */}
                <line x1="40" y1="140" x2="380" y2="140" stroke="#ef4444" strokeWidth="1" strokeDasharray="4"/>
                <text x="45" y="135" fill="#ef4444" fontSize="10">200 km</text>
                
                {/* Plot perigee evolution */}
                {missionResults.orbitalEvolution.map((point, idx, arr) => {
                  if (idx === 0) return null;
                  const prevPoint = arr[idx - 1];
                  
                  const x1 = 40 + (prevPoint.passNumber / arr.length) * 340;
                  const y1 = 160 - ((prevPoint.perigeeAlt / selectedDebris.apogee) * 140);
                  const x2 = 40 + (point.passNumber / arr.length) * 340;
                  const y2 = 160 - ((point.perigeeAlt / selectedDebris.apogee) * 140);
                  
                  return (
                    <line
                      key={idx}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="#667eea"
                      strokeWidth="2"
                    />
                  );
                })}
                
                {/* Labels */}
                <text x="10" y="25" fill="white" fontSize="10">Alt</text>
                <text x="200" y="175" fill="white" fontSize="10" textAnchor="middle">Pass Number</text>
              </svg>
            </div>
          </div>

          {/* Pass Details */}
          <div>
            <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>First 10 Passes</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {missionResults.passDetails.slice(0, 10).map(pass => (
                <div
                  key={pass.passNumber}
                  style={{
                    padding: '10px',
                    background: '#2a2e45',
                    borderRadius: '6px',
                    marginBottom: '8px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    Pass #{pass.passNumber} - {pass.station}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    {pass.time.toLocaleString()} • {Math.round(pass.duration)}s • {pass.pulses} pulses • ΔV: {pass.deltaV.toFixed(4)} m/s
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!showResults && (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          opacity: 0.5,
          fontSize: '14px',
          textAlign: 'center',
          padding: '20px'
        }}>
          {stations.length === 0 
            ? '📍 Place ground stations on the map to begin'
            : !selectedDebris 
            ? '🎯 Select a debris target above'
            : '🚀 Click Calculate Mission to start'}
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value, unit, color }) {
  return (
    <div style={{
      padding: '12px',
      background: '#2a2e45',
      borderRadius: '8px',
      borderLeft: `4px solid ${color}`
    }}>
      <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 'bold', color }}>
        {value} <span style={{ fontSize: '12px', opacity: 0.8 }}>{unit}</span>
      </div>
    </div>
  );
}
