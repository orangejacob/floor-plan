import * as THREE from 'three';

export class BuildingLoader {
    constructor(scene) {
        this.scene = scene;
        this.floors = new Map();
        this.floorVisibility = {
            'floor-1': true,
            'floor-2': true,
            'roof': true
        };
    }

    async loadFromJSON(path) {
        const response = await fetch(path);
        const buildingData = await response.json();

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

        // Materials
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            roughness: 0.7,
            metalness: 0.1
        });

        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x88ccee,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.4
        });

        const doorMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8
        });

        const floorMaterial = new THREE.MeshStandardMaterial({
            color: 0xAAAAAA,
            roughness: 0.9
        });

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
