/**
 * Client-Side Floor Plan Image Processor
 * Extracts walls and rooms from floor plan images using canvas-based image processing
 */

export class FloorPlanImageProcessor {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * Process floor plan image and extract building data
     */
    async processImage(imageFile, options = {}) {
        const {
            realWidth = 12, // meters
            realDepth = 10,  // meters
            floorHeight = 3.0,
            floorNumber = 1,
            threshold = 128
        } = options;

        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    try {
                        // Set canvas size
                        this.canvas.width = img.width;
                        this.canvas.height = img.height;

                        // Draw image
                        this.ctx.drawImage(img, 0, 0);

                        // Get image data
                        const imageData = this.ctx.getImageData(0, 0, img.width, img.height);

                        // Process image
                        const processed = this.detectWalls(imageData, threshold);

                        // Extract building structure
                        const buildingData = this.extractBuildingData(
                            processed,
                            img.width,
                            img.height,
                            realWidth,
                            realDepth,
                            floorHeight,
                            floorNumber
                        );

                        resolve(buildingData);
                    } catch (error) {
                        reject(error);
                    }
                };

                img.onerror = reject;
                img.src = e.target.result;
            };

            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });
    }

    /**
     * Detect walls using edge detection
     */
    detectWalls(imageData, threshold) {
        const width = imageData.width;
        const height = imageData.height;
        const data = imageData.data;

        // Convert to grayscale
        const gray = new Uint8ClampedArray(width * height);
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const grayscale = 0.299 * r + 0.587 * g + 0.114 * b;
            gray[i / 4] = grayscale;
        }

        // Apply threshold (walls are typically darker)
        const binary = new Uint8ClampedArray(width * height);
        for (let i = 0; i < gray.length; i++) {
            binary[i] = gray[i] < threshold ? 0 : 255;
        }

        // Simple edge detection (Sobel-like)
        const edges = new Uint8ClampedArray(width * height);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const i = y * width + x;

                // Horizontal gradient
                const gx =
                    -binary[(y - 1) * width + (x - 1)] +
                    binary[(y - 1) * width + (x + 1)] +
                    -2 * binary[y * width + (x - 1)] +
                    2 * binary[y * width + (x + 1)] +
                    -binary[(y + 1) * width + (x - 1)] +
                    binary[(y + 1) * width + (x + 1)];

                // Vertical gradient
                const gy =
                    -binary[(y - 1) * width + (x - 1)] +
                    -2 * binary[(y - 1) * width + x] +
                    -binary[(y - 1) * width + (x + 1)] +
                    binary[(y + 1) * width + (x - 1)] +
                    2 * binary[(y + 1) * width + x] +
                    binary[(y + 1) * width + (x + 1)];

                // Gradient magnitude
                edges[i] = Math.sqrt(gx * gx + gy * gy) > 50 ? 255 : 0;
            }
        }

        return { width, height, edges, binary };
    }

    /**
     * Extract building data from processed image
     */
    extractBuildingData(processed, imgWidth, imgHeight, realWidth, realDepth, floorHeight, floorNumber) {
        const { width, height, edges, binary } = processed;

        // Scale factor to convert pixels to meters
        const scaleX = realWidth / width;
        const scaleY = realDepth / height;

        // Find bounding box of the floor plan
        const bounds = this.findBounds(binary, width, height);

        // Extract outer walls
        const walls = this.extractWalls(bounds, scaleX, scaleY, realWidth, realDepth);

        // Detect windows (bright regions in dark walls)
        const windows = this.detectWindows(binary, edges, width, height, scaleX, scaleY, realWidth, realDepth);

        // Detect doors (gaps in walls)
        const doors = this.detectDoors(edges, width, height, scaleX, scaleY, realWidth, realDepth);

        // Create building structure
        const buildingData = {
            version: '1.0',
            floors: [{
                id: `floor-${floorNumber}`,
                floor_number: floorNumber,
                base_height: (floorNumber - 1) * floorHeight,
                height: floorHeight,
                walls: walls,
                windows: windows,
                doors: doors,
                slab: {
                    outline: walls.map(w => w.start),
                    thickness: 0.2
                }
            }],
            metadata: {
                num_floors: 1,
                total_height: floorHeight,
                source: 'image_processing',
                image_size: `${imgWidth}x${imgHeight}`,
                real_size: `${realWidth}m x ${realDepth}m`
            }
        };

        return buildingData;
    }

    /**
     * Find bounding box of floor plan
     */
    findBounds(binary, width, height) {
        let minX = width, maxX = 0, minY = height, maxY = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (binary[y * width + x] === 0) { // Dark pixels (walls)
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        return { minX, maxX, minY, maxY };
    }

    /**
     * Extract walls from bounds
     */
    extractWalls(bounds, scaleX, scaleY, realWidth, realDepth) {
        const { minX, maxX, minY, maxY } = bounds;

        // Convert to centered coordinates
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const toRealX = (x) => ((x - centerX) * scaleX);
        const toRealY = (y) => ((y - centerY) * scaleY);

        // Create rectangular walls
        const walls = [
            // Front wall
            {
                start: [toRealX(minX), toRealY(minY)],
                end: [toRealX(maxX), toRealY(minY)],
                thickness: 0.2
            },
            // Right wall
            {
                start: [toRealX(maxX), toRealY(minY)],
                end: [toRealX(maxX), toRealY(maxY)],
                thickness: 0.2
            },
            // Back wall
            {
                start: [toRealX(maxX), toRealY(maxY)],
                end: [toRealX(minX), toRealY(maxY)],
                thickness: 0.2
            },
            // Left wall
            {
                start: [toRealX(minX), toRealY(maxY)],
                end: [toRealX(minX), toRealY(minY)],
                thickness: 0.2
            }
        ];

        return walls;
    }

    /**
     * Detect windows (simplified)
     */
    detectWindows(binary, edges, width, height, scaleX, scaleY, realWidth, realDepth) {
        const windows = [];

        // Sample points along walls for potential windows
        const sampleCount = 8;
        const centerX = width / 2;
        const centerY = height / 2;

        const toRealX = (x) => ((x - centerX) * scaleX);
        const toRealY = (y) => ((y - centerY) * scaleY);

        // Front wall
        for (let i = 1; i < sampleCount; i++) {
            const x = Math.floor((i / sampleCount) * width);
            const y = Math.floor(height * 0.2);

            if (this.isLikelyWindow(binary, x, y, width, height)) {
                windows.push({
                    position: [toRealX(x), toRealY(y)],
                    width: 1.5,
                    height: 1.2,
                    sill_height: 1.0,
                    rotation: 0
                });
            }
        }

        // Side walls (simplified)
        windows.push({
            position: [toRealX(width * 0.8), toRealY(centerY)],
            width: 1.5,
            height: 1.2,
            sill_height: 1.0,
            rotation: 1.57
        });

        return windows;
    }

    /**
     * Check if location is likely a window
     */
    isLikelyWindow(binary, x, y, width, height) {
        // Windows are typically brighter regions in walls
        const windowSize = 20;
        let brightCount = 0;
        let totalCount = 0;

        for (let dy = -windowSize / 2; dy < windowSize / 2; dy++) {
            for (let dx = -windowSize / 2; dx < windowSize / 2; dx++) {
                const px = x + dx;
                const py = y + dy;

                if (px >= 0 && px < width && py >= 0 && py < height) {
                    totalCount++;
                    if (binary[py * width + px] === 255) {
                        brightCount++;
                    }
                }
            }
        }

        return brightCount / totalCount > 0.6; // 60% bright = likely window
    }

    /**
     * Detect doors (simplified)
     */
    detectDoors(edges, width, height, scaleX, scaleY, realWidth, realDepth) {
        const centerX = width / 2;
        const centerY = height / 2;

        const toRealX = (x) => ((x - centerX) * scaleX);
        const toRealY = (y) => ((y - centerY) * scaleY);

        // Place door in center of front wall
        return [{
            position: [toRealX(centerX), toRealY(height * 0.2)],
            width: 0.9,
            height: 2.1,
            rotation: 0
        }];
    }

    /**
     * Export processed image for visualization
     */
    getProcessedImageDataURL() {
        return this.canvas.toDataURL();
    }
}
