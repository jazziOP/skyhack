import React, { useState } from 'react';
import GroundStationMap from './map.jsx';

export default function App() {
  const [stations, setStations] = useState([]);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <GroundStationMap stations={stations} setStations={setStations} />
    </div>
  );
}