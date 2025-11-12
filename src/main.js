import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import SunCalc from 'suncalc';
import { BuildingLoader } from './building-loader.js';
import { SunlightSimulator } from './sunlight-simulator.js';

class FloorPlanViewer {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();

        // Movement state
        this.moveState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false
        };
        this.velocity = new THREE.Vector3();
        this.moveSpeed = 5.0;

        this.init();
    }

    init() {
        // Renderer setup with realistic tone mapping
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.physicallyCorrectLights = true;
        document.getElementById('canvas-container').appendChild(this.renderer.domElement);

        // Camera position (inside the building)
        this.camera.position.set(0, 1.6, 5); // Eye level height

        // Scene setup
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

        // Controls (First-person)
        this.controls = new PointerLockControls(this.camera, this.renderer.domElement);

        // Click to enable controls
        this.renderer.domElement.addEventListener('click', () => {
            this.controls.lock();
        });

        // Keyboard controls
        this.setupKeyboardControls();

        // Lighting
        this.setupLighting();

        // Load building
        this.buildingLoader = new BuildingLoader(this.scene);
        this.loadBuilding();

        // Sunlight simulator with volumetric rays
        this.sunlightSim = new SunlightSimulator(this.scene, this.sunLight, this.camera, this.renderer);
        this.setupUIControls();

        // Add ground plane
        this.addGround();

        // Add surrounding environment (simple)
        this.addEnvironment();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Start animation loop
        this.animate();
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);

        // Sunlight (directional)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        this.sunLight.position.set(10, 20, 10);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -50;
        this.sunLight.shadow.camera.right = 50;
        this.sunLight.shadow.camera.top = 50;
        this.sunLight.shadow.camera.bottom = -50;
        this.scene.add(this.sunLight);

        // Hemisphere light (sky/ground)
        const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x545454, 0.3);
        this.scene.add(hemiLight);
    }

    async loadBuilding() {
        try {
            await this.buildingLoader.loadFromJSON('/data/building.json');
            console.log('Building loaded successfully');
        } catch (error) {
            console.error('Failed to load building:', error);
            // Create a simple test building if load fails
            this.createTestBuilding();
        }
    }

    createTestBuilding() {
        // Simple test room if no data exists
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.8
        });

        // Create a simple room
        const wallThickness = 0.2;
        const roomWidth = 10;
        const roomDepth = 10;
        const wallHeight = 3;

        // Front wall
        const frontWall = new THREE.Mesh(
            new THREE.BoxGeometry(roomWidth, wallHeight, wallThickness),
            wallMaterial
        );
        frontWall.position.set(0, wallHeight / 2, -roomDepth / 2);
        frontWall.castShadow = true;
        frontWall.receiveShadow = true;
        this.scene.add(frontWall);

        // Back wall
        const backWall = frontWall.clone();
        backWall.position.z = roomDepth / 2;
        this.scene.add(backWall);

        // Left wall
        const leftWall = new THREE.Mesh(
            new THREE.BoxGeometry(wallThickness, wallHeight, roomDepth),
            wallMaterial
        );
        leftWall.position.set(-roomWidth / 2, wallHeight / 2, 0);
        leftWall.castShadow = true;
        leftWall.receiveShadow = true;
        this.scene.add(leftWall);

        // Right wall
        const rightWall = leftWall.clone();
        rightWall.position.x = roomWidth / 2;
        this.scene.add(rightWall);

        // Floor
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(roomWidth, roomDepth),
            new THREE.MeshStandardMaterial({ color: 0x8B7355, roughness: 0.9 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        console.log('Test building created');
    }

    addGround() {
        const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);

        // Add subtle terrain variation
        const positions = groundGeometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const z = positions.getZ(i);
            positions.setZ(i, z + Math.random() * 0.1);
        }
        groundGeometry.computeVertexNormals();

        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x567d46,
            roughness: 0.95,
            metalness: 0.0
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    addEnvironment() {
        // Add realistic neighboring buildings to demonstrate view obstruction
        const neighborMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4d4d4,
            roughness: 0.85,
            metalness: 0.0
        });

        // Building 1
        const neighbor1 = new THREE.Mesh(
            new THREE.BoxGeometry(15, 18, 12),
            neighborMaterial
        );
        neighbor1.position.set(25, 9, -10);
        neighbor1.castShadow = true;
        neighbor1.receiveShadow = true;
        this.scene.add(neighbor1);

        // Building 2
        const neighbor2 = new THREE.Mesh(
            new THREE.BoxGeometry(12, 15, 15),
            neighborMaterial.clone()
        );
        neighbor2.material.color.setHex(0xb8b8b8);
        neighbor2.position.set(-30, 7.5, 5);
        neighbor2.castShadow = true;
        neighbor2.receiveShadow = true;
        this.scene.add(neighbor2);

        // Add more realistic trees
        for (let i = 0; i < 8; i++) {
            const tree = this.createRealisticTree();
            const angle = (i / 8) * Math.PI * 2;
            const radius = 20 + Math.random() * 15;
            tree.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            this.scene.add(tree);
        }
    }

    createRealisticTree() {
        const group = new THREE.Group();

        // Realistic trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.25, 0.35, 4, 12);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x3d2817,
            roughness: 0.9,
            metalness: 0.0
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // Layered foliage for realism
        const foliageMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a5018,
            roughness: 0.9,
            metalness: 0.0
        });

        for (let i = 0; i < 3; i++) {
            const foliage = new THREE.Mesh(
                new THREE.SphereGeometry(1.5 - i * 0.3, 12, 12),
                foliageMaterial.clone()
            );
            foliage.material.color.multiplyScalar(1 + i * 0.1);
            foliage.position.y = 4 + i * 0.8;
            foliage.castShadow = true;
            foliage.receiveShadow = true;
            group.add(foliage);
        }

        return group;
    }

    setupKeyboardControls() {
        document.addEventListener('keydown', (e) => {
            switch(e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.moveState.forward = true;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.moveState.backward = true;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.moveState.left = true;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.moveState.right = true;
                    break;
                case 'Space':
                    this.moveState.up = true;
                    e.preventDefault();
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.moveState.down = true;
                    break;
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'KeyW':
                case 'ArrowUp':
                    this.moveState.forward = false;
                    break;
                case 'KeyS':
                case 'ArrowDown':
                    this.moveState.backward = false;
                    break;
                case 'KeyA':
                case 'ArrowLeft':
                    this.moveState.left = false;
                    break;
                case 'KeyD':
                case 'ArrowRight':
                    this.moveState.right = false;
                    break;
                case 'Space':
                    this.moveState.up = false;
                    break;
                case 'ShiftLeft':
                case 'ShiftRight':
                    this.moveState.down = false;
                    break;
            }
        });
    }

    setupUIControls() {
        // Time slider
        const timeSlider = document.getElementById('time-slider');
        const timeDisplay = document.getElementById('time-display');

        timeSlider.addEventListener('input', (e) => {
            const hour = parseFloat(e.target.value);
            const hourInt = Math.floor(hour);
            const minutes = (hour % 1) * 60;
            timeDisplay.textContent = `${hourInt.toString().padStart(2, '0')}:${Math.floor(minutes).toString().padStart(2, '0')}`;

            const date = new Date(document.getElementById('date-picker').value);
            this.sunlightSim.updateSunPosition(date, hour);
        });

        // Date picker
        const datePicker = document.getElementById('date-picker');
        const today = new Date();
        datePicker.value = today.toISOString().split('T')[0];
        document.getElementById('date-display').textContent = today.toLocaleDateString();

        datePicker.addEventListener('change', (e) => {
            const date = new Date(e.target.value);
            document.getElementById('date-display').textContent = date.toLocaleDateString();
            const hour = parseFloat(timeSlider.value);
            this.sunlightSim.updateSunPosition(date, hour);
        });

        // Floor visibility toggles
        const floors = ['floor-1', 'floor-2', 'roof'];
        floors.forEach(floorId => {
            const btn = document.getElementById(`toggle-${floorId}`);
            btn.addEventListener('click', () => {
                this.buildingLoader.toggleFloorVisibility(floorId);
                const isVisible = this.buildingLoader.floorVisibility[floorId];
                btn.textContent = `${floorId.replace('-', ' ').toUpperCase()}: ${isVisible ? 'ON' : 'OFF'}`;
                btn.style.background = isVisible ? '#4CAF50' : '#f44336';
            });
        });

        // Reset camera
        document.getElementById('reset-camera').addEventListener('click', () => {
            this.camera.position.set(0, 1.6, 5);
            this.camera.rotation.set(0, 0, 0);
        });

        // Initial sun position
        this.sunlightSim.updateSunPosition(today, 12);
    }

    updateMovement(delta) {
        if (!this.controls.isLocked) return;

        // Damping
        this.velocity.x -= this.velocity.x * 10.0 * delta;
        this.velocity.z -= this.velocity.z * 10.0 * delta;
        this.velocity.y -= this.velocity.y * 10.0 * delta;

        // Calculate movement direction
        const direction = new THREE.Vector3();
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();

        this.camera.getWorldDirection(forward);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();

        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        if (this.moveState.forward) {
            direction.add(forward);
        }
        if (this.moveState.backward) {
            direction.sub(forward);
        }
        if (this.moveState.right) {
            direction.add(right);
        }
        if (this.moveState.left) {
            direction.sub(right);
        }

        if (direction.length() > 0) {
            direction.normalize();
            this.velocity.x += direction.x * this.moveSpeed * delta;
            this.velocity.z += direction.z * this.moveSpeed * delta;
        }

        // Vertical movement
        if (this.moveState.up) {
            this.velocity.y += this.moveSpeed * delta;
        }
        if (this.moveState.down) {
            this.velocity.y -= this.moveSpeed * delta;
        }

        // Apply velocity to camera position
        this.camera.position.x += this.velocity.x;
        this.camera.position.y += this.velocity.y;
        this.camera.position.z += this.velocity.z;

        // Keep camera above ground
        if (this.camera.position.y < 0.5) {
            this.camera.position.y = 0.5;
            this.velocity.y = 0;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const delta = this.clock.getDelta();
        this.updateMovement(delta);

        // Update volumetric sun effect
        if (this.sunlightSim) {
            this.sunlightSim.update();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize viewer
new FloorPlanViewer();
