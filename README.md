# Floor Plan to 3D Building Generator

Dynamically generate navigable 3D building models from 2D floor plans in your browser.

## 🎯 Features

- **Web-based 3D viewer** - Navigate inside buildings using first-person controls
- **Multi-floor support** - Stack multiple floors with proper alignment
- **Sunlight simulation** - Visualize how sunlight moves throughout the day
- **Dynamic generation** - Convert 2D floor plans to 3D geometry programmatically
- **Fast iteration** - Hot reload during development with Vite
- **Extensible architecture** - Easy to add new features and floor plan formats

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+)
- Python 3.8+

### Installation

```bash
# Install JavaScript dependencies
npm install

# Generate example building
python3 processor/generate_building.py

# Start development server
npm run dev
```

The viewer will open at `http://localhost:3000`

## 🎮 Controls

- **WASD / Arrow Keys** - Move around
- **Mouse** - Look around (click canvas to enable)
- **Space** - Move up
- **Shift** - Move down
- **ESC** - Release mouse control

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│  2D Floor Plans (JSON/SVG/DXF/Images)              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Python Processor (processor/floor_plan_parser.py) │
│  - Parse floor plan data                           │
│  - Extract walls, rooms, openings                  │
│  - Generate 3D geometry data                       │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Building JSON (public/data/building.json)         │
│  - Floor definitions                               │
│  - Wall coordinates                                │
│  - Window/door positions                           │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Three.js Web Viewer (src/*)                       │
│  - 3D rendering                                    │
│  - Camera controls                                 │
│  - Sunlight simulation                             │
└─────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
floor-plan/
├── src/
│   ├── main.js                  # Main viewer application
│   ├── building-loader.js       # Load and render building geometry
│   └── sunlight-simulator.js    # Sun position and lighting
├── processor/
│   ├── floor_plan_parser.py     # Core parsing logic
│   └── generate_building.py     # CLI tool for generation
├── public/
│   └── data/
│       └── building.json        # Generated building data
├── examples/
│   └── floor-plans/             # Sample floor plan inputs
├── index.html                   # Entry point
├── package.json                 # Node dependencies
└── vite.config.js              # Dev server config
```

## 🔧 Usage

### Generate from Custom Floor Plan

Create a JSON definition:

```json
{
  "floor_number": 1,
  "base_height": 0.0,
  "height": 3.0,
  "walls": [
    {
      "start": [0, 0],
      "end": [10, 0],
      "thickness": 0.2
    }
  ],
  "windows": [
    {
      "position": [5, 0],
      "width": 1.5,
      "height": 1.2,
      "sill_height": 1.0,
      "rotation": 0
    }
  ],
  "doors": [
    {
      "position": [2, 0],
      "width": 0.9,
      "height": 2.1,
      "rotation": 0
    }
  ],
  "slab_outline": [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10]
  ]
}
```

Generate building:

```bash
python3 processor/generate_building.py examples/my-floor-plan.json
```

### Modify Sunlight Settings

In `src/sunlight-simulator.js`, change the location:

```javascript
constructor(scene, sunLight, latitude = 37.7749, longitude = -122.4194) {
  // San Francisco coordinates
}
```

### Add Custom Materials

In `src/building-loader.js`, modify materials:

```javascript
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  roughness: 0.7,
  metalness: 0.1
});
```

## 🌟 Advanced Features

### Multi-Floor Buildings

The parser automatically handles multiple floors. Each floor has:
- `floor_number` - Sequential floor number
- `base_height` - Elevation where floor starts
- `height` - Floor-to-ceiling height

Floors are stacked automatically:
- Floor 1: base_height = 0.0, height = 3.0
- Floor 2: base_height = 3.0, height = 3.0
- Floor 3: base_height = 6.0, height = 3.0

### Sunlight Simulation

Uses [SunCalc](https://github.com/mourner/suncalc) library for accurate sun positioning:

- Adjust date and time with UI sliders
- Sun position calculated based on lat/long
- Dynamic sky color (dawn/day/dusk/night)
- Shadow mapping enabled
- Color temperature changes (warm at sunrise/sunset)

### View Obstruction Analysis

The environment includes sample neighboring buildings. To add more:

```javascript
// In src/main.js > addEnvironment()
const neighbor = new THREE.Mesh(
  new THREE.BoxGeometry(width, height, depth),
  neighborMaterial
);
neighbor.position.set(x, y, z);
this.scene.add(neighbor);
```

## 🛠️ Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| 3D Engine | Three.js | Industry standard WebGL library |
| Dev Server | Vite | Fast HMR and modern build tooling |
| Sun Calc | SunCalc.js | Accurate solar position calculations |
| Parser | Python | Easy geometry processing |
| Controls | PointerLockControls | First-person navigation |

### Why Three.js over alternatives?

- **vs Babylon.js**: Lighter weight, larger community (3x GitHub stars)
- **vs D3.js**: D3 is for 2D data visualization, not 3D scenes
- **vs Cesium**: Overkill for building interiors, focused on geospatial
- **vs Unity/Unreal**: Too heavy for web deployment

## 📈 Roadmap / Future Enhancements

### Phase 2 (Weeks 3-4)
- [ ] Import from SVG floor plans
- [ ] Import from DXF (CAD) files
- [ ] Image-based floor plan detection (OpenCV)
- [ ] Roof geometry (pitched, gabled, etc.)
- [ ] Stairs between floors

### Phase 3 (Month 2)
- [ ] Advanced materials (brick, glass, wood textures)
- [ ] Furniture placement
- [ ] Interior rooms with proper doors/hallways
- [ ] Export to GLTF for Blender/Unity
- [ ] VR support with WebXR

### Phase 4 (Month 3+)
- [ ] Shadow analysis reports
- [ ] View corridor analysis
- [ ] Energy/thermal simulation integration
- [ ] Multi-building site planning
- [ ] Collaborative editing

## 🤝 Contributing

This project is designed for rapid iteration. To extend:

1. **Add new floor plan formats**: Edit `processor/floor_plan_parser.py`
2. **Enhance rendering**: Modify `src/building-loader.js`
3. **Add analysis tools**: Create new modules in `src/`

## 📝 Example: L-Shaped Building

```python
from floor_plan_parser import FloorPlanParser, Floor, Wall, Point2D, Slab

parser = FloorPlanParser()

# Define L-shaped floor
floor_def = {
    "floor_number": 1,
    "base_height": 0.0,
    "height": 3.0,
    "walls": [
        {"start": [0, 0], "end": [10, 0]},
        {"start": [10, 0], "end": [10, 5]},
        {"start": [10, 5], "end": [5, 5]},
        {"start": [5, 5], "end": [5, 10]},
        {"start": [5, 10], "end": [0, 10]},
        {"start": [0, 10], "end": [0, 0]}
    ],
    "slab_outline": [
        [0, 0], [10, 0], [10, 5], [5, 5], [5, 10], [0, 10]
    ]
}

floor = parser.parse_from_json_definition(floor_def)
building = parser.create_building([floor])
```

## 🐛 Troubleshooting

### Building not loading
- Check browser console for errors
- Verify `public/data/building.json` exists
- Run `python3 processor/generate_building.py` again

### Controls not working
- Click on canvas to enable pointer lock
- Check keyboard layout (WASD vs QWERTY)

### Poor performance
- Reduce shadow map size in `src/main.js`:
  ```javascript
  this.sunLight.shadow.mapSize.width = 1024;
  this.sunLight.shadow.mapSize.height = 1024;
  ```
- Disable shadows:
  ```javascript
  this.renderer.shadowMap.enabled = false;
  ```

## 📄 License

MIT License - Feel free to use for commercial or personal projects.

## 🙋 Questions?

This is a starter template designed for fast iteration. Customize freely!

Key extension points:
- `processor/floor_plan_parser.py` - Add input format parsers
- `src/building-loader.js` - Enhance 3D generation
- `src/main.js` - Add interaction features
- `src/sunlight-simulator.js` - Improve lighting models
