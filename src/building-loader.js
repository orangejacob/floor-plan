import * as THREE from 'three';
import { RealisticTextureGenerator } from './realistic-textures.js';

export class BuildingLoader {
    constructor(scene) {
        this.scene = scene;
        this.floors = new Map();
        this.floorVisibility = {
            'floor-1': true,
            'floor-2': true,
            'roof': true
        };

        // Create realistic PBR textures
        this.textureGen = new RealisticTextureGenerator();
        this.textures = {
            concrete: this.textureGen.generateConcreteTexture(1024),
            brick: this.textureGen.generateBrickTexture(1024),
            wood: this.textureGen.generateWoodTexture(1024)
        };

        console.log('✓ Realistic textures generated');
    }

    createNoiseTexture(size, intensity) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.createImageData(size, size);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = Math.random() * intensity * 255;
            imageData.data[i] = 128 + noise;
            imageData.data[i + 1] = 128 + noise;
            imageData.data[i + 2] = 128 + noise;
            imageData.data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    createBumpTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Create subtle bump pattern
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 20 + Math.random() * 30;
                const value = 128 + noise;
                ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    createWoodTexture(size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Create wood grain pattern
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const grain = Math.sin(y * 0.3 + Math.random() * 0.5) * 25;
                const noise = Math.random() * 15;
                const value = 100 + grain + noise;
                ctx.fillStyle = `rgb(${value * 0.8}, ${value * 0.6}, ${value * 0.4})`;
                ctx.fillRect(x, y, 1, 1);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 3);
        return texture;
    }

    async loadFromJSON(path) {
        let buildingData;

        // Check if data was uploaded via the upload interface
        const uploadedData = localStorage.getItem('building_data');
        if (uploadedData) {
            console.log('Loading building from uploaded data');
            buildingData = JSON.parse(uploadedData);
            localStorage.removeItem('building_data'); // Clear after loading
        } else {
            // Load from file
            const response = await fetch(path);
            buildingData = await response.json();
        }

        console.log('Loading building data:', buildingData);

        // Process each floor
        for (const floorData of buildingData.floors) {
            const floorGroup = this.createFloor(floorData);
            this.floors.set(floorData.id, floorGroup);
            this.scene.add(floorGroup);
        }

        return this.floors;
    }

    createFloor(floorData) {
        const group = new THREE.Group();
        group.name = floorData.id;
        group.userData.floorNumber = floorData.floor_number;

        const baseHeight = floorData.base_height || 0;
        const floorHeight = floorData.height || 3;

        // Realistic PBR materials with full texture maps
        const concrete = this.textures.concrete;
        const wallMaterial = new THREE.MeshStandardMaterial({
            map: concrete.map.clone(),
            normalMap: concrete.normalMap.clone(),
            roughnessMap: concrete.roughnessMap.clone(),
            aoMap: concrete.aoMap.clone(),
            normalScale: new THREE.Vector2(0.5, 0.5),
            aoMapIntensity: 0.5
        });
        wallMaterial.map.needsUpdate = true;

        // Photorealistic glass
        const windowMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            roughness: 0.05,
            metalness: 0.0,
            transparent: true,
            opacity: 0.1,
            transmission: 0.95,
            thickness: 0.5,
            ior: 1.52, // Real glass IOR
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            side: THREE.DoubleSide,
            envMapIntensity: 1.0
        });

        // Realistic wood door
        const wood = this.textures.wood;
        const doorMaterial = new THREE.MeshStandardMaterial({
            map: wood.map.clone(),
            normalMap: wood.normalMap.clone(),
            roughnessMap: wood.roughnessMap.clone(),
            aoMap: wood.aoMap.clone(),
            normalScale: new THREE.Vector2(0.8, 0.8),
            aoMapIntensity: 0.3
        });
        doorMaterial.map.needsUpdate = true;

        // Concrete floor
        const floorMaterial = new THREE.MeshStandardMaterial({
            map: concrete.map.clone(),
            normalMap: concrete.normalMap.clone(),
            roughnessMap: concrete.roughnessMap.clone(),
            aoMap: concrete.aoMap.clone(),
            normalScale: new THREE.Vector2(0.3, 0.3),
            aoMapIntensity: 0.6
        });
        floorMaterial.map.needsUpdate = true;

        // Create walls
        if (floorData.walls) {
            for (const wall of floorData.walls) {
                const wallMesh = this.createWall(wall, baseHeight, floorHeight, wallMaterial);
                wallMesh.castShadow = true;
                wallMesh.receiveShadow = true;
                group.add(wallMesh);
            }
        }

        // Create windows
        if (floorData.windows) {
            for (const window of floorData.windows) {
                const windowMesh = this.createWindow(window, baseHeight, floorHeight, windowMaterial);
                windowMesh.castShadow = true;
                group.add(windowMesh);
            }
        }

        // Create doors
        if (floorData.doors) {
            for (const door of floorData.doors) {
                const doorMesh = this.createDoor(door, baseHeight, floorHeight, doorMaterial);
                doorMesh.castShadow = true;
                doorMesh.receiveShadow = true;
                group.add(doorMesh);
            }
        }

        // Create floor slab
        if (floorData.slab) {
            const slab = this.createSlab(floorData.slab, baseHeight, floorMaterial);
            slab.receiveShadow = true;
            group.add(slab);
        }

        return group;
    }

    createWall(wallData, baseHeight, floorHeight, material) {
        const thickness = wallData.thickness || 0.2;
        const start = new THREE.Vector2(wallData.start[0], wallData.start[1]);
        const end = new THREE.Vector2(wallData.end[0], wallData.end[1]);

        const length = start.distanceTo(end);
        const angle = Math.atan2(end.y - start.y, end.x - start.x);

        const geometry = new THREE.BoxGeometry(length, floorHeight, thickness);
        const mesh = new THREE.Mesh(geometry, material);

        // Position at center of wall
        const center = new THREE.Vector3(
            (start.x + end.x) / 2,
            baseHeight + floorHeight / 2,
            (start.y + end.y) / 2
        );

        mesh.position.copy(center);
        mesh.rotation.y = -angle;

        return mesh;
    }

    createWindow(windowData, baseHeight, floorHeight, material) {
        const width = windowData.width || 1.5;
        const height = windowData.height || 1.2;
        const wallThickness = 0.15;

        const geometry = new THREE.BoxGeometry(width, height, wallThickness);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(
            windowData.position[0],
            baseHeight + (windowData.sill_height || 1.0) + height / 2,
            windowData.position[1]
        );

        if (windowData.rotation) {
            mesh.rotation.y = windowData.rotation;
        }

        return mesh;
    }

    createDoor(doorData, baseHeight, floorHeight, material) {
        const width = doorData.width || 0.9;
        const height = doorData.height || 2.1;
        const thickness = 0.1;

        const geometry = new THREE.BoxGeometry(width, height, thickness);
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(
            doorData.position[0],
            baseHeight + height / 2,
            doorData.position[1]
        );

        if (doorData.rotation) {
            mesh.rotation.y = doorData.rotation;
        }

        return mesh;
    }

    createSlab(slabData, baseHeight, material) {
        // Create floor slab from polygon
        const points = slabData.outline.map(p => new THREE.Vector2(p[0], p[1]));
        const shape = new THREE.Shape(points);

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: slabData.thickness || 0.2,
            bevelEnabled: false
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = baseHeight;

        return mesh;
    }

    toggleFloorVisibility(floorId) {
        this.floorVisibility[floorId] = !this.floorVisibility[floorId];

        const floor = this.floors.get(floorId);
        if (floor) {
            floor.visible = this.floorVisibility[floorId];
        }
    }
}
