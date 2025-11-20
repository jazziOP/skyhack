# Ground-Based Laser Debris Removal Mission Planner

A sophisticated web-based simulation tool for planning and analyzing ground-based laser missions to remove space debris from Earth orbit. This interactive application demonstrates the feasibility and cost-effectiveness of using ground-based laser systems as an alternative to traditional spacecraft-based active debris removal (ADR) methods.

![Space-themed dark UI](https://img.shields.io/badge/UI-Space%20Themed-blue)
![React](https://img.shields.io/badge/React-18.2.0-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

## Features

### Interactive Ground Station Network
- **Global Station Placement**: Click anywhere on the interactive world map to position ground stations
- **Real-time Visibility Tracking**: Calculates visibility windows for debris passes over each station
- **Multi-station Coordination**: Support for up to 5 ground stations working in concert
- **Leaflet Integration**: Powered by Leaflet.js for smooth, interactive mapping

### Advanced Mission Planning
- **Debris Catalog**: Pre-loaded with realistic debris objects including:
  - Cosmos 1408 fragments
  - Fengyun-1C collision debris
  - Rocket bodies
  - Paint flakes and small fragments
- **TLE-based Orbital Propagation**: Uses Two-Line Element (TLE) data with satellite.js for accurate orbit prediction
- **Visibility Window Calculation**: Determines optimal engagement opportunities based on elevation angles and pass duration

### Comprehensive Physics Simulation
- **Laser-Debris Interaction Modeling**:
  - Beam divergence and atmospheric transmission
  - Fluence calculations (J/cm²)
  - Momentum coupling coefficients
  - Material-specific thermal response (Aluminum, Steel, MLI)
- **Orbital Mechanics**:
  - Delta-V accumulation tracking
  - Perigee/apogee evolution over multiple passes
  - Re-entry threshold detection (<200 km altitude)
  - Atmospheric drag estimation
- **Thermal Management**:
  - Per-pulse temperature rise calculations
  - Thermal budget tracking to prevent debris vaporization
  - Cooldown period enforcement between passes

### Economic Analysis
- **Detailed Cost Breakdown**:
  - Initial setup and infrastructure costs ($800K base)
  - Electricity costs with laser efficiency modeling (30% wall-plug efficiency)
  - Daily operational costs (staffing, facility, tracking)
  - Maintenance and consumables
  - Equipment depreciation
  - Insurance and overhead
- **Comparative Analysis**:
  - Spacecraft-based capture missions ($150M)
  - Electric propulsion tugs ($200M)
  - Harpoon systems ($100M)
  - Net capture systems ($80M)
- **Cost-Effectiveness Metrics**:
  - Total mission cost
  - Cost per day
  - Savings percentage vs traditional methods
  - Cost factor comparison

### Rich Data Visualization
- **Perigee Evolution Chart**: Real-time SVG graph showing altitude reduction over mission passes
- **Mission Timeline**: Detailed pass-by-pass breakdown with timestamps, pulse counts, and delta-V
- **Cost Comparison Bars**: Visual representation of cost savings vs traditional ADR methods
- **Result Cards**: Key metrics display (passes needed, duration, total ΔV, energy)

### Space-Themed UI
- **Dark Mode Design**: Deep space color palette with cosmic gradients
- **Starfield Background**: Animated star field effect
- **Glowing Accents**: Blue neon-style borders and shadows
- **Glass Morphism**: Translucent panels with backdrop blur
- **Responsive Layout**: Two-panel design with map and mission planner

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/ground-station-module.git
   cd ground-station-module
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   Navigate to `http://localhost:5173` (or the port shown in terminal)

### Building for Production

```bash
npm run build
```

The optimized production build will be created in the `dist/` directory.

### Preview Production Build

```bash
npm run preview
```

## How to Use

### Step 1: Position Ground Stations
1. Click on the world map to place ground stations (maximum 5)
2. Strategically position stations to maximize debris visibility
3. Consider latitude for orbital inclination coverage

### Step 2: Select Debris Target
1. Choose a debris object from the dropdown menu
2. Review debris characteristics:
   - Size and mass
   - Material composition
   - Orbital parameters (perigee, apogee, inclination)
   - Area-to-mass ratio

### Step 3: Calculate Mission
1. Click the "Calculate Mission" button
2. Wait for simulation to complete (~1.5 seconds)
3. Review comprehensive mission results

### Step 4: Analyze Results
- **Mission Metrics**: Passes needed, duration, total ΔV, energy consumption
- **Cost Analysis**: Detailed breakdown and comparison with traditional methods
- **Re-entry Status**: Final perigee altitude and atmospheric decay estimates
- **Perigee Evolution**: Visual graph showing orbit lowering progress
- **Pass Timeline**: Detailed information for each laser engagement

## Technical Details

### Laser System Parameters
- **Pulse Energy**: 100 kJ (based on DLR specifications)
- **Wavelength**: 1030 nm (Yb:YAG laser)
- **Pulse Duration**: 5 ns
- **Transmitter Diameter**: 4.0 m
- **Beam Quality**: M² = 1.2
- **Repetition Rate**: Variable (thermal-limited)

### Physics Models
- **Atmospheric Transmission**: 70% efficiency through atmosphere
- **Momentum Coupling**: Fluence-dependent (5-25 μN·s/J)
- **Thermal Constraints**: Material-specific maximum temperature rise
- **Orbital Propagation**: Simplified Keplerian mechanics with delta-V application

### Material Properties
| Material  | Max Temp Rise | Specific Heat | Density |
|-----------|---------------|---------------|---------|
| Aluminum  | 100 K         | 900 J/kg·K    | 2700 kg/m³ |
| Steel     | 200 K         | 470 J/kg·K    | 7850 kg/m³ |
| MLI       | 80 K          | 1000 J/kg·K   | 100 kg/m³ |

## Project Structure

```
ground-station-module/
├── src/
│   ├── App.jsx                 # Main application component
│   ├── MissionPlanner.jsx      # Mission planning UI and logic
│   ├── map.jsx                 # Ground station map component
│   ├── orbitalMechanics.js     # Orbit evolution calculations
│   ├── Physics.js              # Laser physics and cost analysis
│   ├── main.jsx                # React entry point
│   └── index.css               # Global styles with space theme
├── index.html                  # HTML template
├── package.json                # Dependencies and scripts
├── vite.config.js              # Vite configuration (if present)
└── README.md                   # This file
```

## Technologies Used

- **React 18.2** - UI framework
- **Vite** - Build tool and dev server
- **Leaflet.js** - Interactive mapping
- **React-Leaflet** - React bindings for Leaflet
- **satellite.js** - SGP4/SDP4 orbit propagation
- **SVG** - Custom data visualization

## Use Cases

- **Research & Education**: Demonstrate laser-based debris removal concepts
- **Mission Planning**: Preliminary analysis for ground-based ADR systems
- **Cost Analysis**: Compare laser systems with traditional spacecraft missions
- **Station Network Design**: Optimize ground station placement
- **Policy & Advocacy**: Visualize sustainable space debris mitigation

## Future Enhancements

- [ ] Real-time debris tracking with TLE updates
- [ ] Multi-debris campaign planning
- [ ] Weather impact modeling
- [ ] Station-specific laser configurations
- [ ] Export mission reports (PDF/CSV)
- [ ] 3D orbital visualization
- [ ] Machine learning for optimal engagement scheduling
- [ ] Integration with space-track.org API
- [ ] Collaborative multi-user planning

## Performance Considerations

- Visibility calculations optimized for 90-day windows
- SVG rendering limited to 50 passes for chart performance
- Pass details display capped at 20 entries
- Calculation delays simulate realistic processing time

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines
1. Follow existing code style and structure
2. Add comments for complex physics calculations
3. Test with various debris parameters
4. Ensure UI remains responsive
5. Update documentation as needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Based on research by the German Aerospace Center (DLR) on laser debris removal
- Orbital mechanics algorithms inspired by satellite.js
- Debris catalog parameters from publicly available space debris databases
- UI design influenced by modern space mission control interfaces

## Contact

For questions, suggestions, or collaboration opportunities, please open an issue on GitHub.

## Disclaimer

This is a simulation tool for educational and research purposes. Actual laser-based debris removal systems would require extensive testing, regulatory approval, and international cooperation. Cost estimates are approximate and based on simplified models.

---
