# Quick Start Guide

Get up and running in 5 minutes.

## ⚡ Installation

```bash
# 1. Install Node.js dependencies
npm install

# 2. Generate example building data
python3 processor/generate_building.py

# 3. Start the development server
npm run dev
```

Your browser will open at `http://localhost:3000` with a navigable 3D building!

## 🎮 Try It Out

1. **Click the canvas** to enable first-person controls
2. **Use WASD** to walk around inside the building
3. **Move your mouse** to look around
4. **Adjust the time slider** to see how sunlight changes throughout the day
5. **Toggle floor visibility** to see different levels

## 🏗️ Create Your Own Building

### Option 1: Use the Python API

```python
from processor.floor_plan_parser import FloorPlanParser, Point2D, Wall

parser = FloorPlanParser()

# Create a simple room
floor = parser.parse_simple_rectangular_room(
    width=10.0,      # 10 meters wide
    depth=8.0,       # 8 meters deep
    floor_number=1,
    base_height=0.0,
    wall_height=3.0
)

# Add a window
parser.add_window_to_wall(floor, wall_index=0, position_ratio=0.5)

# Add a door
parser.add_door_to_wall(floor, wall_index=0, position_ratio=0.8)

# Create building
building = parser.create_building([floor])

# Save
import json
with open('public/data/building.json', 'w') as f:
    json.dump(building, f, indent=2)
```

### Option 2: Write JSON Directly

Create `my-floor-plan.json`:

```json
{
  "floor_number": 1,
  "base_height": 0.0,
  "height": 3.0,
  "walls": [
    {"start": [-5, -5], "end": [5, -5]},
    {"start": [5, -5], "end": [5, 5]},
    {"start": [5, 5], "end": [-5, 5]},
    {"start": [-5, 5], "end": [-5, -5]}
  ],
  "windows": [
    {
      "position": [0, -5],
      "width": 1.5,
      "height": 1.2
    }
  ],
  "slab_outline": [
    [-5, -5], [5, -5], [5, 5], [-5, 5]
  ]
}
```

Generate:

```bash
python3 processor/generate_building.py my-floor-plan.json
```

### Option 3: Use Example Templates

```bash
# Simple two-story house
python3 processor/generate_building.py examples/simple-house.json

# L-shaped commercial building
python3 processor/generate_building.py examples/l-shaped-building.json
```

## 🌍 Change Location for Sunlight

Edit `src/sunlight-simulator.js`:

```javascript
// Line 4-5
constructor(scene, sunLight, latitude = 40.7128, longitude = -74.0060) {
  // Change to your coordinates
}
```

Common cities:
- New York: `40.7128, -74.0060`
- London: `51.5074, -0.1278`
- Tokyo: `35.6762, 139.6503`
- Sydney: `-33.8688, 151.2093`
- San Francisco: `37.7749, -122.4194`

## 📐 Understanding Coordinates

The coordinate system:
- **X-axis**: Left (-) to Right (+)
- **Y-axis**: Down (-) to Up (+) in 3D, but used as Z in 2D floor plans
- **Z-axis**: Back (-) to Front (+)
- **Units**: Meters

Example wall:
```json
{"start": [0, 0], "end": [10, 0]}
```
Creates a 10-meter horizontal wall along the X-axis.

## 🎨 Customize Materials

Edit `src/building-loader.js` (around line 27-45):

```javascript
// Wall color
const wallMaterial = new THREE.MeshStandardMaterial({
  color: 0xdddddd,  // Light gray (hex color)
  roughness: 0.7,
  metalness: 0.1
});

// Window color
const windowMaterial = new THREE.MeshStandardMaterial({
  color: 0x88ccee,  // Blue tint
  roughness: 0.1,
  metalness: 0.9,
  transparent: true,
  opacity: 0.4      // 40% transparent
});
```

## 🚀 Next Steps

1. **Add Multiple Floors**: Stack floors by setting `base_height` appropriately
2. **Add Environment**: Edit `addEnvironment()` in `src/main.js` to add neighboring buildings
3. **Export for Blender**: Add GLTF export functionality
4. **Add Textures**: Load image textures for realistic materials

## 🐛 Common Issues

**"Building not found"**
→ Run `python3 processor/generate_building.py` to generate data

**"npm: command not found"**
→ Install Node.js from https://nodejs.org/

**Controls don't work**
→ Click the canvas first to enable pointer lock

**Poor performance**
→ Reduce shadow quality in `src/main.js` line 58:
```javascript
this.sunLight.shadow.mapSize.width = 1024;  // Lower = faster
```

## 📚 Learn More

- [Full README](README.md) - Complete documentation
- [Three.js Docs](https://threejs.org/docs/) - 3D engine reference
- [Floor Plan Parser](processor/floor_plan_parser.py) - Python API reference

Happy building! 🏢
