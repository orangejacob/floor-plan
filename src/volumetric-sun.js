import * as THREE from 'three';

/**
 * Volumetric Sun Rays (God Rays) Effect
 * Creates realistic sun shafts and atmospheric scattering
 */
export class VolumetricSun {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.sunPosition = new THREE.Vector3();
        this.sunMesh = null;

        this.init();
    }

    init() {
        // Create visible sun sphere
        const sunGeometry = new THREE.SphereGeometry(3, 32, 32);
        const sunMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffee,
            transparent: true,
            opacity: 0.9
        });

        this.sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
        this.scene.add(this.sunMesh);

        // Add sun glow
        const glowGeometry = new THREE.SphereGeometry(6, 32, 32);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                c: { value: 0.3 },
                p: { value: 3.5 },
                glowColor: { value: new THREE.Color(0xffffaa) },
                viewVector: { value: this.camera.position }
            },
            vertexShader: `
                uniform vec3 viewVector;
                uniform float c;
                uniform float p;
                varying float intensity;

                void main() {
                    vec3 vNormal = normalize(normalMatrix * normal);
                    vec3 vNormel = normalize(normalMatrix * viewVector);
                    intensity = pow(c - dot(vNormal, vNormel), p);

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 glowColor;
                varying float intensity;

                void main() {
                    vec3 glow = glowColor * intensity;
                    gl_FragColor = vec4(glow, intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        this.sunMesh.add(glowMesh);

        // Add lens flare effect
        this.addLensFlare();

        // Add volumetric light rays
        this.addVolumetricRays();
    }

    addLensFlare() {
        // Create lens flare sprites
        const textureLoader = new THREE.TextureLoader();

        // Create flare texture procedurally
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');

        // Radial gradient for flare
        const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 200, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 150, 0.3)');
        gradient.addColorStop(1, 'rgba(255, 255, 100, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);

        const flareTexture = new THREE.CanvasTexture(canvas);

        // Create flare sprite
        const flareMaterial = new THREE.SpriteMaterial({
            map: flareTexture,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0.7
        });

        this.flareSprite = new THREE.Sprite(flareMaterial);
        this.flareSprite.scale.set(10, 10, 1);
        this.sunMesh.add(this.flareSprite);
    }

    addVolumetricRays() {
        // Create god rays using cone geometry
        const rayCount = 12;
        this.rays = [];

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;

            const rayGeometry = new THREE.CylinderGeometry(0.1, 2, 50, 8, 1, true);
            const rayMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffaa,
                transparent: true,
                opacity: 0.08,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending
            });

            const ray = new THREE.Mesh(rayGeometry, rayMaterial);

            // Position ray
            ray.rotation.z = angle;
            ray.rotation.x = Math.PI / 2;
            ray.position.set(
                Math.cos(angle) * 2,
                0,
                Math.sin(angle) * 2
            );

            this.rays.push(ray);
            this.sunMesh.add(ray);
        }
    }

    updatePosition(position) {
        this.sunPosition.copy(position);
        this.sunMesh.position.copy(position);

        // Update sun intensity based on altitude
        const altitude = position.y;
        const intensity = Math.max(0, Math.min(1, altitude / 20));

        this.sunMesh.material.opacity = intensity * 0.9;

        if (this.flareSprite) {
            this.flareSprite.material.opacity = intensity * 0.7;
        }

        // Animate rays
        if (this.rays) {
            const time = Date.now() * 0.0001;
            this.rays.forEach((ray, i) => {
                ray.rotation.y = time + i * 0.5;
                ray.material.opacity = intensity * 0.08;
            });
        }

        // Update color based on altitude
        const color = this.calculateSunColor(altitude);
        this.sunMesh.material.color.setHex(color);
    }

    calculateSunColor(altitude) {
        const normalized = Math.max(0, Math.min(1, altitude / 30));

        if (normalized < 0.1) {
            // Sunrise/sunset - orange/red
            return 0xff8844;
        } else if (normalized < 0.3) {
            // Morning/evening - warm yellow
            return 0xffffaa;
        } else {
            // Daytime - bright white-yellow
            return 0xffffee;
        }
    }

    update() {
        // Update view vector for glow shader
        if (this.sunMesh && this.sunMesh.children[0]) {
            const glowMesh = this.sunMesh.children[0];
            if (glowMesh.material.uniforms) {
                glowMesh.material.uniforms.viewVector.value = new THREE.Vector3().subVectors(
                    this.camera.position,
                    this.sunMesh.position
                );
            }
        }
    }

    setVisible(visible) {
        this.sunMesh.visible = visible;
    }
}
