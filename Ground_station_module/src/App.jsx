import React, { useState } from 'react';
import GroundStationMap from './map.jsx';
import MissionPlanner from './MissionPlanner.jsx';

export default function App() {
  const [stations, setStations] = useState([]);
  const [selectedDebris, setSelectedDebris] = useState(null);
  const [missionResults, setMissionResults] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', background: '#0a0e27' }}>
      {/* Header */}
      <div style={{ 
        padding: '20px', 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>
          🛰️ Laser Debris Removal Mission Planner
        </h1>
        <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>
          Ground-based laser system for sustainable space debris mitigation
        </p>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Ground Station Map */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid #1e2139' }}>
          <div style={{ padding: '15px', background: '#1a1e35', color: 'white', borderBottom: '1px solid #2a2e45' }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Ground Station Network</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', opacity: 0.7 }}>
              Click map to place stations (max 5) • {stations.length}/5 active
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <GroundStationMap stations={stations} setStations={setStations} />
          </div>
        </div>

        {/* Right Panel - Mission Planner */}
        <div style={{ width: '450px', display: 'flex', flexDirection: 'column', background: '#1a1e35' }}>
          <MissionPlanner 
            stations={stations}
            selectedDebris={selectedDebris}
            setSelectedDebris={setSelectedDebris}
            missionResults={missionResults}
            setMissionResults={setMissionResults}
          />
        </div>
      </div>
    </div>
  );
}