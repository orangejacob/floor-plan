# Architecture Deep Dive

Technical documentation for extending and customizing the system.

## 🏛️ System Overview

This is a **two-stage pipeline**:

1. **Processing Stage** (Python) - Converts 2D floor plans → 3D geometry data
2. **Rendering Stage** (JavaScript/Three.js) - Visualizes geometry in browser

### Why Two Stages?

- **Separation of concerns**: Parsing/processing vs rendering
- **Performance**: Heavy processing done once, lightweight rendering in browser
- **Flexibility**: Can swap processing pipeline (Python → Rust) or renderer (Three.js → Babylon.js)
- **Scalability**: Can process batch of buildings server-side, serve to many clients

## 📦 Data Flow

```
Input Floor Plan
     │
     ├─── [Image] ────────► Image Processing (Future: OpenCV, segmentation)
     ├─── [SVG] ──────────► SVG Path Parser (Future: xml.etree)
     ├─── [DXF] ──────────► DXF Parser (Future: ezdxf library)
     └─── [JSON] ─────────► Direct parsing ✓ (Current)
            │
            ▼
    FloorPlanParser
    ├─── Extract walls (line segments)
    ├─── Extract openings (windows, doors)
    ├─── Extract room polygons
    └─── Generate floor slabs
            │
            ▼
    Building Structure (Python objects)
    ├─── Floor 1
    │    ├─── Walls[]
    │    ├─── Windows[]
    │    ├─── Doors[]
    │    └─── Slab
    ├─── Floor 2
    └─── Floor N
            │
            ▼
    JSON Serialization
    (public/data/building.json)
            │
            ▼
    [Browser Loads JSON]
            │
            ▼
    BuildingLoader (Three.js)
    ├─── Parse JSON
    ├─── Create Three.js geometries
    │    ├─── Wall: BoxGeometry
    │    ├─── Window: BoxGeometry + Glass material
    │    ├─── Door: BoxGeometry
    │    └─── Slab: ExtrudeGeometry from polygon
    └─── Add to Scene
            │
            ▼
    3D Scene Rendering
    ├─── Camera (First-person)
    ├─── Lighting (Sun + Ambient + Hemisphere)
    ├─── Environment (Ground, neighbors, trees)
    └─── Controls (WASD, mouse look)
            │
            ▼
    User Interaction
    ├─── Navigate building
    ├─── Adjust time/date
    └─── Toggle floors
```

## 🧩 Component Architecture

### 1. Python Processor (`processor/`)

#### `floor_plan_parser.py`

**Classes:**

- `Point2D` - 2D coordinate
- `Wall` - Line segment with thickness
- `Window` - Opening with dimensions
- `Door` - Opening with dimensions
- `Slab` - Polygon outline for floors/ceilings
- `Floor` - Complete floor definition
- `FloorPlanParser` - Main parser class

**Key Methods:**

```python
parse_simple_rectangular_room(width, depth, floor_number, base_height, wall_height)
    → Creates basic rectangular floor

parse_from_json_definition(definition: Dict) → Floor
    → Parses JSON floor plan

add_window_to_wall(floor, wall_index, position_ratio)
    → Programmatically adds windows

add_door_to_wall(floor, wall_index, position_ratio)
    → Programmatically adds doors

create_building(floors: List[Floor]) → Dict
    → Combines floors into building JSON
```

**Extension Points:**

```python
# Add new input format parser
def parse_from_svg(svg_path: str) -> Floor:
    # Parse SVG paths
    # Extract polylines
    # Convert to walls
    pass

# Add new geometry type
@dataclass
class Staircase:
    start: Point2D
    end: Point2D
    steps: int
```

#### `generate_building.py`

CLI tool that orchestrates the parser.

**Usage:**
```bash
# Generate example
python3 processor/generate_building.py

# Process custom file
python3 processor/generate_building.py input.json
```

**Extension:**
```python
# Add batch processing
def generate_from_directory(input_dir: str):
    for file in Path(input_dir).glob('*.json'):
        generate_from_input(str(file))
```

### 2. Three.js Viewer (`src/`)

#### `main.js` - Main Application

**Class: `FloorPlanViewer`**

**Responsibilities:**
- Scene setup
- Camera and controls
- Lighting
- Environment
- Movement/input handling
- Animation loop

**Key Methods:**

```javascript
init()
    → Initialize Three.js scene, renderer, camera, controls

setupLighting()
    → Create sun, ambient, hemisphere lights

loadBuilding()
    → Fetch and load building.json

updateMovement(delta)
    → Handle WASD movement with physics

animate()
    → Main render loop (called every frame)
```

**Extension Example:**

```javascript
// Add collision detection
updateMovement(delta) {
    // ... existing movement code ...

    // Check collision with walls
    const raycaster = new THREE.Raycaster();
    raycaster.set(this.camera.position, this.velocity.normalize());
    const intersects = raycaster.intersectObjects(this.walls);

    if (intersects.length > 0 && intersects[0].distance < 0.5) {
        // Stop movement
        this.velocity.set(0, 0, 0);
    }
}
```

#### `building-loader.js` - Geometry Generator

**Class: `BuildingLoader`**

**Responsibilities:**
- Load building JSON
- Convert data → Three.js meshes
- Manage floor visibility

**Key Methods:**

```javascript
loadFromJSON(path)
    → Fetch JSON and create all floors

createFloor(floorData)
    → Generate meshes for one floor

createWall(wallData, baseHeight, floorHeight, material)
    → Wall = BoxGeometry positioned between two points

createWindow(windowData, ...)
    → Window = BoxGeometry with glass material

createDoor(doorData, ...)
    → Door = BoxGeometry with wood material

createSlab(slabData, baseHeight, material)
    → Slab = ExtrudeGeometry from polygon shape
```

**Algorithm: Wall Positioning**

```javascript
// Given: start point (x1, y1), end point (x2, y2)
// 1. Calculate length
const length = distance(start, end);

// 2. Calculate angle
const angle = atan2(y2 - y1, x2 - x1);

// 3. Position at center
const center = ((x1 + x2) / 2, (y1 + y2) / 2);

// 4. Create geometry
const geometry = new BoxGeometry(length, height, thickness);
mesh.position = center;
mesh.rotation.y = -angle;  // Negative because Three.js coordinates
```

**Extension Example:**

```javascript
// Add textured walls
createWall(wallData, baseHeight, floorHeight) {
    const textureLoader = new THREE.TextureLoader();
    const brickTexture = textureLoader.load('/textures/brick.jpg');

    const material = new THREE.MeshStandardMaterial({
        map: brickTexture,
        roughness: 0.8
    });

    // ... rest of wall creation
}
```

#### `sunlight-simulator.js` - Sun Positioning

**Class: `SunlightSimulator`**

Uses [SunCalc](https://github.com/mourner/suncalc) library for astronomical calculations.

**Algorithm:**

```javascript
updateSunPosition(date, hour) {
    // 1. Get sun position for date/time/location
    const sunPos = SunCalc.getPosition(dateTime, lat, lon);
    //    → { azimuth, altitude }

    // 2. Convert spherical to Cartesian
    const x = distance * cos(altitude) * sin(azimuth);
    const y = distance * sin(altitude);
    const z = distance * cos(altitude) * cos(azimuth);

    // 3. Position directional light
    sunLight.position.set(x, y, z);

    // 4. Adjust intensity based on altitude
    if (altitude > 0) {
        intensity = max(0.3, sin(altitude) * 1.5);
    }

    // 5. Change color temperature
    //    Low altitude → warm orange
    //    High altitude → cool white
}
```

**Extension Example:**

```javascript
// Add moon lighting for night
updateMoonPosition(date, hour) {
    const moonPos = SunCalc.getMoonPosition(dateTime, lat, lon);

    this.moonLight = new THREE.DirectionalLight(0x6666aa, 0.2);
    this.moonLight.position.set(/* calculate from moonPos */);
    this.scene.add(this.moonLight);
}
```

## 🔧 Configuration Points

### Material Properties

**Located in:** `src/building-loader.js`

```javascript
// Realistic concrete
const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    roughness: 0.9,   // 0 = mirror, 1 = rough
    metalness: 0.0,   // 0 = non-metal, 1 = metal
});

// Glass
const windowMaterial = new THREE.MeshStandardMaterial({
    color: 0x88ccee,
    roughness: 0.1,
    metalness: 0.9,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide  // Render both sides
});
```

### Camera Settings

**Located in:** `src/main.js`

```javascript
// Field of view
this.camera = new THREE.PerspectiveCamera(
    75,              // FOV in degrees (wider = more distortion)
    aspect,
    0.1,             // Near clip plane
    1000             // Far clip plane
);

// Movement speed
this.moveSpeed = 5.0;  // meters per second

// Starting position
this.camera.position.set(0, 1.6, 5);  // x, y (eye height), z
```

### Shadow Quality

**Located in:** `src/main.js`

```javascript
// Shadow map resolution (higher = better quality, slower)
this.sunLight.shadow.mapSize.width = 2048;
this.sunLight.shadow.mapSize.height = 2048;

// Shadow camera frustum (area that receives shadows)
this.sunLight.shadow.camera.left = -50;
this.sunLight.shadow.camera.right = 50;
this.sunLight.shadow.camera.top = 50;
this.sunLight.shadow.camera.bottom = -50;
```

## 🚀 Performance Optimization

### Current Performance

- **Target:** 60 FPS
- **Scene complexity:** ~1000-5000 polygons for typical building
- **Shadow map:** 2048x2048 (high quality)

### Optimization Strategies

#### 1. Reduce Shadow Quality

```javascript
// Before (high quality)
this.sunLight.shadow.mapSize.width = 2048;

// After (medium quality, 2x faster)
this.sunLight.shadow.mapSize.width = 1024;
```

#### 2. Instanced Rendering (for repeated elements)

```javascript
// For windows (many identical objects)
const windowGeometry = new THREE.BoxGeometry(1.5, 1.2, 0.15);
const windowMaterial = new THREE.MeshStandardMaterial({...});

const instancedMesh = new THREE.InstancedMesh(
    windowGeometry,
    windowMaterial,
    windows.length  // Number of instances
);

windows.forEach((window, i) => {
    const matrix = new THREE.Matrix4();
    matrix.setPosition(window.position.x, window.position.y, window.position.z);
    instancedMesh.setMatrixAt(i, matrix);
});

scene.add(instancedMesh);
```

#### 3. Level of Detail (LOD)

```javascript
const lod = new THREE.LOD();

// High detail (close)
const highDetail = createDetailedBuilding();
lod.addLevel(highDetail, 0);

// Medium detail
const mediumDetail = createSimplifiedBuilding();
lod.addLevel(mediumDetail, 50);

// Low detail (far away)
const lowDetail = createBoundingBox();
lod.addLevel(lowDetail, 200);

scene.add(lod);
```

#### 4. Frustum Culling (automatic)

Three.js automatically culls objects outside camera view. Ensure objects are properly positioned.

#### 5. Texture Atlasing

```javascript
// Combine multiple textures into one atlas
// Reduces texture switches = faster rendering
const atlas = combineTextures([
    'brick.jpg',
    'wood.jpg',
    'glass.jpg'
]);
```

## 🔌 Extension Guide

### Adding New Floor Plan Format

**Example: SVG Parser**

```python
# processor/svg_parser.py
import xml.etree.ElementTree as ET
from floor_plan_parser import FloorPlanParser, Wall, Point2D

def parse_svg_floor_plan(svg_path: str) -> Floor:
    tree = ET.parse(svg_path)
    root = tree.getroot()

    walls = []

    # Find all <line> elements
    for line in root.findall('.//{http://www.w3.org/2000/svg}line'):
        x1 = float(line.get('x1'))
        y1 = float(line.get('y1'))
        x2 = float(line.get('x2'))
        y2 = float(line.get('y2'))

        walls.append(Wall(
            Point2D(x1, y1),
            Point2D(x2, y2)
        ))

    return Floor(...)
```

### Adding New Interaction

**Example: Click to Place Furniture**

```javascript
// In main.js
setupFurniturePlacement() {
    this.renderer.domElement.addEventListener('click', (event) => {
        // Convert screen coordinates to 3D world
        const mouse = new THREE.Vector2(
            (event.clientX / window.innerWidth) * 2 - 1,
            -(event.clientY / window.innerHeight) * 2 + 1
        );

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        const intersects = raycaster.intersectObjects(this.scene.children);

        if (intersects.length > 0) {
            const point = intersects[0].point;

            // Place furniture at click point
            const furniture = this.createChair();
            furniture.position.copy(point);
            this.scene.add(furniture);
        }
    });
}
```

### Adding Analytics

**Example: Shadow Analysis**

```javascript
// Calculate hours of sunlight at a point
async analyzeSunlightAtPoint(point, date) {
    const results = [];

    for (let hour = 0; hour < 24; hour++) {
        this.sunlightSim.updateSunPosition(date, hour);

        // Cast ray from point toward sun
        const raycaster = new THREE.Raycaster();
        const sunDir = this.sunLight.position.clone()
                                      .sub(point)
                                      .normalize();

        raycaster.set(point, sunDir);
        const intersects = raycaster.intersectObjects(this.scene.children);

        // If no intersection, point receives direct sunlight
        const inSunlight = intersects.length === 0;

        results.push({ hour, inSunlight });
    }

    return results;
}
```

## 📊 Data Format Specification

### Building JSON Schema

```json
{
  "version": "1.0",
  "floors": [
    {
      "id": "floor-1",
      "floor_number": 1,
      "base_height": 0.0,
      "height": 3.0,
      "walls": [
        {
          "start": [x, y],
          "end": [x, y],
          "thickness": 0.2
        }
      ],
      "windows": [
        {
          "position": [x, y],
          "width": 1.5,
          "height": 1.2,
          "sill_height": 1.0,
          "rotation": 0.0
        }
      ],
      "doors": [
        {
          "position": [x, y],
          "width": 0.9,
          "height": 2.1,
          "rotation": 0.0
        }
      ],
      "slab": {
        "outline": [[x, y], [x, y], ...],
        "thickness": 0.2
      }
    }
  ],
  "metadata": {
    "num_floors": 2,
    "total_height": 6.0
  }
}
```

### Units

- All distances: **meters**
- Angles: **radians** (0 to 2π)
- Heights: **meters above ground**

### Coordinate System

```
      +Y (North)
       │
       │
       └───── +X (East)
      ╱
     ╱
   +Z (Up)
```

## 🧪 Testing Strategy

### Unit Tests (Future)

```python
# tests/test_parser.py
def test_rectangular_room():
    parser = FloorPlanParser()
    floor = parser.parse_simple_rectangular_room(10, 8, 1, 0, 3)

    assert len(floor.walls) == 4
    assert floor.height == 3.0
```

### Integration Tests (Future)

```javascript
// tests/building-loader.test.js
describe('BuildingLoader', () => {
    it('should load building from JSON', async () => {
        const loader = new BuildingLoader(scene);
        await loader.loadFromJSON('/data/test-building.json');

        expect(loader.floors.size).toBe(2);
    });
});
```

### Visual Regression Tests (Future)

Use tools like [Playwright](https://playwright.dev/) to capture screenshots and compare.

## 🏗️ Deployment

### Static Hosting (Recommended)

```bash
# Build for production
npm run build

# Deploy dist/ folder to:
# - Vercel
# - Netlify
# - GitHub Pages
# - AWS S3 + CloudFront
```

### Server-Side Processing

```javascript
// server.js (Node.js + Express)
const express = require('express');
const { exec } = require('child_process');

app.post('/generate-building', (req, res) => {
    const floorPlan = req.body;

    // Save to temp file
    fs.writeFileSync('/tmp/input.json', JSON.stringify(floorPlan));

    // Process with Python
    exec('python3 processor/generate_building.py /tmp/input.json', (err) => {
        if (err) return res.status(500).send(err);

        const building = JSON.parse(fs.readFileSync('public/data/building.json'));
        res.json(building);
    });
});
```

## 📚 Further Reading

- [Three.js Fundamentals](https://threejsfundamentals.org/)
- [WebGL Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)
- [Computational Geometry Algorithms](https://en.wikipedia.org/wiki/Computational_geometry)
- [Sun Position Calculation](https://www.esrl.noaa.gov/gmd/grad/solcalc/calcdetails.html)

---

**Questions?** See the main [README.md](README.md) for high-level overview.
