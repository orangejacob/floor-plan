import * as THREE from 'three';

export class RealisticTextureGenerator {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Generate a realistic concrete texture with proper PBR maps
     */
    generateConcreteTexture(resolution = 1024) {
        const cacheKey = `concrete_${resolution}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');

        // Base concrete color with variation
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4;

                // Multi-octave noise for realistic variation
                const noise1 = this.perlinNoise(x * 0.05, y * 0.05) * 0.5;
                const noise2 = this.perlinNoise(x * 0.2, y * 0.2) * 0.3;
                const noise3 = this.perlinNoise(x * 0.8, y * 0.8) * 0.2;
                const combined = noise1 + noise2 + noise3;

                // Concrete base color (gray with slight warmth)
                const base = 180 + combined * 40;
                data[i] = base * 0.95;     // R - slightly less red
                data[i + 1] = base * 0.96; // G
                data[i + 2] = base;        // B - slightly more blue
                data[i + 3] = 255;         // A
            }
        }

        ctx.putImageData(imageData, 0, 0);

        // Add subtle cracks and imperfections
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            ctx.beginPath();
            const startX = Math.random() * resolution;
            const startY = Math.random() * resolution;
            ctx.moveTo(startX, startY);
            let x = startX;
            let y = startY;
            for (let j = 0; j < 10; j++) {
                x += (Math.random() - 0.5) * 50;
                y += (Math.random() - 0.5) * 50;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        const result = {
            map: texture,
            normalMap: this.generateConcreteNormal(resolution),
            roughnessMap: this.generateConcreteRoughness(resolution),
            aoMap: this.generateAO(resolution)
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Generate a realistic brick texture
     */
    generateBrickTexture(resolution = 1024) {
        const cacheKey = `brick_${resolution}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');

        // Fill background with mortar color
        ctx.fillStyle = '#c8c8c8';
        ctx.fillRect(0, 0, resolution, resolution);

        // Brick dimensions
        const brickWidth = resolution / 4;
        const brickHeight = resolution / 12;
        const mortarGap = resolution * 0.01;

        // Draw bricks with variation
        for (let row = 0; row < 15; row++) {
            const offsetX = (row % 2) * (brickWidth / 2);
            for (let col = 0; col < 6; col++) {
                const x = col * brickWidth + offsetX;
                const y = row * brickHeight;

                // Brick color variation
                const hue = 10 + Math.random() * 15;
                const sat = 45 + Math.random() * 20;
                const light = 35 + Math.random() * 15;

                // Draw brick
                ctx.fillStyle = `hsl(${hue}, ${sat}%, ${light}%)`;
                ctx.fillRect(
                    x + mortarGap,
                    y + mortarGap,
                    brickWidth - mortarGap * 2,
                    brickHeight - mortarGap * 2
                );

                // Add brick texture
                const brickData = ctx.getImageData(
                    x + mortarGap,
                    y + mortarGap,
                    brickWidth - mortarGap * 2,
                    brickHeight - mortarGap * 2
                );

                for (let i = 0; i < brickData.data.length; i += 4) {
                    const noise = (Math.random() - 0.5) * 30;
                    brickData.data[i] += noise;
                    brickData.data[i + 1] += noise;
                    brickData.data[i + 2] += noise;
                }

                ctx.putImageData(brickData, x + mortarGap, y + mortarGap);
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);

        const result = {
            map: texture,
            normalMap: this.generateBrickNormal(resolution),
            roughnessMap: this.generateBrickRoughness(resolution),
            aoMap: this.generateAO(resolution, 0.3)
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Generate a realistic wood texture
     */
    generateWoodTexture(resolution = 1024) {
        const cacheKey = `wood_${resolution}`;
        if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');

        // Wood grain pattern
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4;

                // Wood grain rings
                const distance = Math.sqrt(
                    Math.pow((x - resolution / 2) * 0.5, 2) +
                    Math.pow((y - resolution / 2) * 2, 2)
                );
                const ring = Math.sin(distance * 0.05 + this.perlinNoise(x * 0.1, y * 0.1) * 5) * 0.5 + 0.5;

                // Wood color (brown with variation)
                const baseValue = 80 + ring * 50;
                const noise = this.perlinNoise(x * 0.3, y * 0.3) * 20;

                data[i] = (baseValue + noise) * 0.8;     // R
                data[i + 1] = (baseValue + noise) * 0.5; // G
                data[i + 2] = (baseValue + noise) * 0.3; // B
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 2);

        const result = {
            map: texture,
            normalMap: this.generateWoodNormal(resolution),
            roughnessMap: this.generateWoodRoughness(resolution),
            aoMap: this.generateAO(resolution, 0.2)
        };

        this.cache.set(cacheKey, result);
        return result;
    }

    /**
     * Generate normal map for concrete
     */
    generateConcreteNormal(resolution) {
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4;

                // Sample height at adjacent pixels
                const h = this.perlinNoise(x * 0.1, y * 0.1);
                const hx = this.perlinNoise((x + 1) * 0.1, y * 0.1);
                const hy = this.perlinNoise(x * 0.1, (y + 1) * 0.1);

                // Calculate normal
                const dx = (h - hx) * 5;
                const dy = (h - hy) * 5;
                const dz = 1;

                // Normalize and convert to 0-255
                const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
                data[i] = ((dx / length) * 0.5 + 0.5) * 255;
                data[i + 1] = ((dy / length) * 0.5 + 0.5) * 255;
                data[i + 2] = ((dz / length) * 0.5 + 0.5) * 255;
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    generateBrickNormal(resolution) {
        // Similar to concrete but with deeper grooves for mortar
        return this.generateConcreteNormal(resolution);
    }

    generateWoodNormal(resolution) {
        // Wood grain normals
        return this.generateConcreteNormal(resolution);
    }

    /**
     * Generate roughness map
     */
    generateConcreteRoughness(resolution) {
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4;
                const roughness = 0.85 + this.perlinNoise(x * 0.1, y * 0.1) * 0.1;
                const value = roughness * 255;
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    generateBrickRoughness(resolution) {
        return this.generateConcreteRoughness(resolution);
    }

    generateWoodRoughness(resolution) {
        return this.generateConcreteRoughness(resolution);
    }

    /**
     * Generate ambient occlusion map
     */
    generateAO(resolution, strength = 0.2) {
        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(resolution, resolution);
        const data = imageData.data;

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const i = (y * resolution + x) * 4;
                const ao = 1.0 - (this.perlinNoise(x * 0.05, y * 0.05) * strength);
                const value = ao * 255;
                data[i] = value;
                data[i + 1] = value;
                data[i + 2] = value;
                data[i + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);
        return texture;
    }

    /**
     * Simple Perlin-like noise function
     */
    perlinNoise(x, y) {
        // Simplified noise - in production, use a proper Perlin noise library
        const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
        return n - Math.floor(n);
    }

    /**
     * Load external texture from URL (for user-provided textures)
     */
    async loadExternalTexture(url) {
        const loader = new THREE.TextureLoader();
        return new Promise((resolve, reject) => {
            loader.load(
                url,
                (texture) => {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                    resolve(texture);
                },
                undefined,
                reject
            );
        });
    }
}
