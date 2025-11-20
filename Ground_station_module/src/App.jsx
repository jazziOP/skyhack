import React, { useState } from 'react';
import GroundStationMap from './map.jsx';
import MissionPlanner from './MissionPlanner.jsx';

export default function App() {
  const [stations, setStations] = useState([]);
  const [selectedDebris, setSelectedDebris] = useState(null);
  const [missionResults, setMissionResults] = useState(null);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100vh', background: 'transparent', position: 'relative', zIndex: 1 }}>
      {/* Header */}
      <div style={{ 
        padding: '20px', 
        background: 'linear-gradient(135deg, #1e3a8a 0%, #312e81 50%, #1e1b4b 100%)',
        color: '#e0e7ff',
        boxShadow: '0 4px 20px rgba(30, 58, 138, 0.4), 0 0 40px rgba(99, 102, 241, 0.2)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.3)'
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', textShadow: '0 0 20px rgba(99, 102, 241, 0.5)' }}>
          🛰️ Laser Debris Removal Mission Planner
        </h1>
        <p style={{ margin: '5px 0 0 0', opacity: 0.8, color: '#c7d2fe' }}>
          Ground-based laser system for sustainable space debris mitigation
        </p>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Panel - Ground Station Map */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '2px solid rgba(30, 58, 138, 0.5)', background: 'rgba(10, 14, 26, 0.6)', backdropFilter: 'blur(10px)' }}>
          <div style={{ padding: '15px', background: 'rgba(15, 23, 42, 0.8)', color: '#e0e7ff', borderBottom: '1px solid rgba(30, 58, 138, 0.5)' }}>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#a5b4fc' }}>Ground Station Network</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px', opacity: 0.7, color: '#c7d2fe' }}>
              Click map to place stations (max 5) • {stations.length}/5 active
            </p>
          </div>
          <div style={{ flex: 1 }}>
            <GroundStationMap stations={stations} setStations={setStations} />
          </div>
        </div>

        {/* Right Panel - Mission Planner */}
        <div style={{ width: '450px', display: 'flex', flexDirection: 'column', background: 'rgba(10, 14, 26, 0.8)', backdropFilter: 'blur(10px)' }}>
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