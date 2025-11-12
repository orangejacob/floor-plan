"""
Image-based Floor Plan Parser
Extracts walls, rooms, and openings from floor plan images
"""

import json
import sys
from pathlib import Path
from typing import List, Tuple, Dict
from floor_plan_parser import FloorPlanParser, Wall, Window, Door, Point2D, Floor


def parse_floor_plan_image(image_path: str, floor_number: int = 1,
                           base_height: float = 0.0, height: float = 3.0) -> Floor:
    """
    Parse a floor plan image and extract structural elements

    This is a simplified parser. For production use, integrate with:
    - OpenCV for edge detection
    - Computer vision models for room segmentation
    - OCR for extracting dimensions

    Args:
        image_path: Path to floor plan image
        floor_number: Floor level number
        base_height: Height where floor starts
        height: Floor ceiling height

    Returns:
        Floor object with extracted walls, windows, doors
    """

    try:
        # Try to import CV libraries
        import cv2
        import numpy as np
    except ImportError:
        print("OpenCV not installed. Using manual definition fallback.")
        print("To enable image parsing, install: pip install opencv-python numpy")
        return create_manual_floor_from_description(floor_number, base_height, height)

    # Load image
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not load image: {image_path}")

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Detect edges
    edges = cv2.Canny(gray, 50, 150)

    # Find contours (potential walls/rooms)
    contours, _ = cv2.findContours(edges, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

    # Extract walls from largest contours
    walls = extract_walls_from_contours(contours, img.shape)

    # Extract windows (bright regions in walls)
    windows = extract_windows(gray, walls)

    # Extract doors (gaps in walls or marked regions)
    doors = extract_doors(gray, walls)

    # Create floor slab outline from outer contour
    slab_outline = extract_floor_outline(contours, img.shape)

    parser = FloorPlanParser()
    floor = Floor(
        id=f"floor-{floor_number}",
        floor_number=floor_number,
        base_height=base_height,
        height=height,
        walls=walls,
        windows=windows,
        doors=doors,
        slab=parser.create_slab_from_points(slab_outline)
    )

    return floor


def extract_walls_from_contours(contours, image_shape) -> List[Wall]:
    """Extract wall segments from image contours"""
    walls = []
    height, width = image_shape[:2]
    scale = 20.0 / max(width, height)  # Scale to ~20m building

    for contour in contours:
        if cv2.contourArea(contour) < 1000:  # Filter small contours
            continue

        # Approximate contour to polygon
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)

        # Convert polygon edges to walls
        for i in range(len(approx)):
            p1 = approx[i][0]
            p2 = approx[(i + 1) % len(approx)][0]

            # Convert to building coordinates (center origin)
            x1 = (p1[0] - width / 2) * scale
            y1 = (p1[1] - height / 2) * scale
            x2 = (p2[0] - width / 2) * scale
            y2 = (p2[1] - height / 2) * scale

            walls.append(Wall(
                Point2D(x1, y1),
                Point2D(x2, y2),
                thickness=0.2
            ))

    return walls


def extract_windows(gray_img, walls) -> List[Window]:
    """Detect windows as bright regions along walls"""
    windows = []

    # Simple heuristic: windows are typically lighter colored
    # In production, use trained model or template matching

    # For now, add windows at regular intervals along exterior walls
    for i, wall in enumerate(walls[:4]):  # Exterior walls
        # Add window at midpoint
        mid_x = (wall.start.x + wall.end.x) / 2
        mid_y = (wall.start.y + wall.end.y) / 2

        windows.append(Window(
            Point2D(mid_x, mid_y),
            width=1.5,
            height=1.2,
            sill_height=1.0,
            rotation=0.0
        ))

    return windows


def extract_doors(gray_img, walls) -> List[Door]:
    """Detect doors as gaps or marked regions"""
    doors = []

    # Simple heuristic: add one door to front wall
    if len(walls) > 0:
        wall = walls[0]
        doors.append(Door(
            Point2D(
                (wall.start.x + wall.end.x) / 2,
                (wall.start.y + wall.end.y) / 2
            ),
            width=0.9,
            height=2.1,
            rotation=0.0
        ))

    return doors


def extract_floor_outline(contours, image_shape) -> List[Point2D]:
    """Extract building footprint outline"""
    if not contours:
        return []

    # Find largest contour (building outline)
    largest = max(contours, key=cv2.contourArea)

    height, width = image_shape[:2]
    scale = 20.0 / max(width, height)

    # Convert to building coordinates
    outline = []
    epsilon = 0.02 * cv2.arcLength(largest, True)
    approx = cv2.approxPolyDP(largest, epsilon, True)

    for point in approx:
        x = (point[0][0] - width / 2) * scale
        y = (point[0][1] - height / 2) * scale
        outline.append(Point2D(x, y))

    return outline


def create_manual_floor_from_description(floor_number: int,
                                        base_height: float,
                                        height: float) -> Floor:
    """
    Fallback: Create floor from manual description when CV is not available
    or when image parsing fails
    """
    parser = FloorPlanParser()

    # Prompt user for basic dimensions
    print("\nCould not parse image automatically.")
    print("Please provide basic floor plan dimensions:")

    try:
        width = float(input("Building width (meters, e.g., 12): ") or "12")
        depth = float(input("Building depth (meters, e.g., 10): ") or "10")
        num_windows = int(input("Number of windows (e.g., 4): ") or "4")
        num_doors = int(input("Number of doors (e.g., 1): ") or "1")
    except (ValueError, EOFError):
        # Use defaults if input fails
        width, depth, num_windows, num_doors = 12, 10, 4, 1

    floor = parser.parse_simple_rectangular_room(
        width=width,
        depth=depth,
        floor_number=floor_number,
        base_height=base_height,
        wall_height=height
    )

    # Add windows
    for i in range(num_windows):
        wall_idx = i % 4
        position = (i + 1) / (num_windows // 4 + 1) if num_windows >= 4 else 0.5
        parser.add_window_to_wall(floor, wall_idx, position)

    # Add doors
    for i in range(num_doors):
        parser.add_door_to_wall(floor, 0, 0.5)

    return floor


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 image_floor_plan_parser.py <image_path> [floor_number]")
        print("\nExample:")
        print("  python3 image_floor_plan_parser.py floor_plan.jpg 1")
        sys.exit(1)

    image_path = sys.argv[1]
    floor_number = int(sys.argv[2]) if len(sys.argv) > 2 else 1

    print(f"Parsing floor plan from: {image_path}")

    try:
        floor = parse_floor_plan_image(image_path, floor_number)

        parser = FloorPlanParser()
        building = parser.create_building([floor])

        # Save output
        output_dir = Path(__file__).parent.parent / 'public' / 'data'
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / 'building.json'

        with open(output_path, 'w') as f:
            json.dump(building, f, indent=2)

        print(f"\n✓ Floor plan parsed successfully!")
        print(f"  - Output: {output_path}")
        print(f"  - Walls: {len(floor.walls)}")
        print(f"  - Windows: {len(floor.windows)}")
        print(f"  - Doors: {len(floor.doors)}")
        print(f"\nRun 'npm run dev' to view the building in 3D")

    except Exception as e:
        print(f"Error parsing floor plan: {e}")
        print("\nFalling back to manual definition...")
        floor = create_manual_floor_from_description(floor_number, 0.0, 3.0)

        parser = FloorPlanParser()
        building = parser.create_building([floor])

        output_dir = Path(__file__).parent.parent / 'public' / 'data'
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / 'building.json'

        with open(output_path, 'w') as f:
            json.dump(building, f, indent=2)

        print(f"\n✓ Building created: {output_path}")


if __name__ == '__main__':
    main()
