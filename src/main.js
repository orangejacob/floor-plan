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
        // Renderer setup
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

        // Sunlight simulator
        this.sunlightSim = new SunlightSimulator(this.scene, this.sunLight);
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
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a7c3b,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.1;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    addEnvironment() {
        // Add a simple neighboring building to demonstrate view obstruction
        const neighborMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B8B8B,
            roughness: 0.7
        });

        const neighbor = new THREE.Mesh(
            new THREE.BoxGeometry(15, 12, 10),
            neighborMaterial
        );
        neighbor.position.set(25, 6, -10);
        neighbor.castShadow = true;
        neighbor.receiveShadow = true;
        this.scene.add(neighbor);

        // Add some trees (simple cylinders + spheres)
        for (let i = 0; i < 5; i++) {
            const tree = this.createSimpleTree();
            const angle = (i / 5) * Math.PI * 2;
            const radius = 20 + Math.random() * 10;
            tree.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );
            this.scene.add(tree);
        }
    }

    createSimpleTree() {
        const group = new THREE.Group();

        // Trunk
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.4, 3, 8),
            new THREE.MeshStandardMaterial({ color: 0x4d3319 })
        );
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        group.add(trunk);

        // Foliage
        const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(2, 8, 8),
            new THREE.MeshStandardMaterial({ color: 0x2d5016 })
        );
        foliage.position.y = 4;
        foliage.castShadow = true;
        group.add(foliage);

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

        // Direction
        const direction = new THREE.Vector3();

        if (this.moveState.forward) direction.z -= 1;
        if (this.moveState.backward) direction.z += 1;
        if (this.moveState.left) direction.x -= 1;
        if (this.moveState.right) direction.x += 1;

        if (direction.length() > 0) direction.normalize();

        // Apply movement
        if (this.moveState.forward || this.moveState.backward) {
            this.velocity.z -= direction.z * this.moveSpeed * delta;
        }
        if (this.moveState.left || this.moveState.right) {
            this.velocity.x -= direction.x * this.moveSpeed * delta;
        }

        // Vertical movement
        if (this.moveState.up) {
            this.velocity.y += this.moveSpeed * delta;
        }
        if (this.moveState.down) {
            this.velocity.y -= this.moveSpeed * delta;
        }

        // Move camera
        this.controls.moveRight(-this.velocity.x * delta);
        this.controls.moveForward(-this.velocity.z * delta);
        this.camera.position.y += this.velocity.y * delta;

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

        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize viewer
new FloorPlanViewer();
