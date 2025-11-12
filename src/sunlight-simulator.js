import * as THREE from 'three';
import SunCalc from 'suncalc';

export class SunlightSimulator {
    constructor(scene, sunLight, latitude = 40.7128, longitude = -74.0060) {
        this.scene = scene;
        this.sunLight = sunLight;
        this.latitude = latitude;   // Default: New York
        this.longitude = longitude;

        // Add sun helper (visual indicator)
        this.sunHelper = new THREE.Mesh(
            new THREE.SphereGeometry(2, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xffff00 })
        );
        this.scene.add(this.sunHelper);
    }

    updateSunPosition(date, hour) {
        // Set time on the date
        const dateTime = new Date(date);
        dateTime.setHours(Math.floor(hour));
        dateTime.setMinutes((hour % 1) * 60);

        // Calculate sun position using SunCalc
        const sunPos = SunCalc.getPosition(dateTime, this.latitude, this.longitude);

        // Convert to Three.js coordinates
        const azimuth = sunPos.azimuth;
        const altitude = sunPos.altitude;

        // Convert spherical to Cartesian coordinates
        const distance = 50;
        const x = distance * Math.cos(altitude) * Math.sin(azimuth);
        const y = Math.max(5, distance * Math.sin(altitude)); // Ensure sun is above horizon
        const z = distance * Math.cos(altitude) * Math.cos(azimuth);

        // Update sun light position
        this.sunLight.position.set(x, y, z);

        // Add target to scene if not already added
        if (!this.sunLight.target.parent) {
            this.scene.add(this.sunLight.target);
        }
        this.sunLight.target.position.set(0, 0, 0);
        this.sunLight.target.updateMatrixWorld();

        // Update visual helper
        this.sunHelper.position.copy(this.sunLight.position);

        // Adjust light intensity based on sun altitude
        if (altitude > 0) {
            // Day time
            const intensity = Math.max(0.3, Math.sin(altitude) * 1.5);
            this.sunLight.intensity = intensity;

            // Color temperature (warmer at sunrise/sunset)
            const temp = this.calculateColorTemperature(altitude);
            this.sunLight.color.setHex(temp);

            // Sky color
            const skyColor = this.calculateSkyColor(altitude);
            this.scene.background.setHex(skyColor);
            this.scene.fog.color.setHex(skyColor);
        } else {
            // Night time
            this.sunLight.intensity = 0.1;
            this.sunLight.color.setHex(0x6666aa);
            this.scene.background.setHex(0x111133);
            this.scene.fog.color.setHex(0x111133);
        }

        console.log(`Sun updated: ${dateTime.toLocaleString()}, altitude: ${(altitude * 180 / Math.PI).toFixed(1)}°`);
    }

    calculateColorTemperature(altitude) {
        // Higher altitude = cooler white, lower = warmer orange
        const normalized = Math.max(0, Math.min(1, altitude / (Math.PI / 2)));

        if (normalized < 0.1) {
            // Sunrise/sunset - orange
            return 0xff6600;
        } else if (normalized < 0.3) {
            // Morning/evening - warm
            return 0xffaa44;
        } else {
            // Midday - cool white
            return 0xffffff;
        }
    }

    calculateSkyColor(altitude) {
        const normalized = Math.max(0, Math.min(1, altitude / (Math.PI / 2)));

        if (normalized < 0.1) {
            // Dawn/dusk
            return 0xff8844;
        } else if (normalized < 0.3) {
            // Morning/evening
            return 0x88aacc;
        } else {
            // Daytime
            return 0x87CEEB;
        }
    }

    setLocation(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }
}
