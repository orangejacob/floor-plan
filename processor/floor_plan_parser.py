"""
Floor Plan Parser - Converts 2D floor plan data into 3D building geometry
"""

import json
from typing import List, Dict, Tuple
from dataclasses import dataclass, asdict
import math


@dataclass
class Point2D:
    x: float
    y: float

    def to_list(self):
        return [self.x, self.y]


@dataclass
class Wall:
    start: Point2D
    end: Point2D
    thickness: float = 0.2

    def to_dict(self):
        return {
            'start': self.start.to_list(),
            'end': self.end.to_list(),
            'thickness': self.thickness
        }


@dataclass
class Window:
    position: Point2D
    width: float
    height: float
    sill_height: float = 1.0
    rotation: float = 0.0

    def to_dict(self):
        return {
            'position': self.position.to_list(),
            'width': self.width,
            'height': self.height,
            'sill_height': self.sill_height,
            'rotation': self.rotation
        }


@dataclass
class Door:
    position: Point2D
    width: float
    height: float
    rotation: float = 0.0

    def to_dict(self):
        return {
            'position': self.position.to_list(),
            'width': self.width,
            'height': self.height,
            'rotation': self.rotation
        }


@dataclass
class Slab:
    outline: List[Point2D]
    thickness: float = 0.2

    def to_dict(self):
        return {
            'outline': [p.to_list() for p in self.outline],
            'thickness': self.thickness
        }


@dataclass
class Floor:
    id: str
    floor_number: int
    base_height: float
    height: float
    walls: List[Wall]
    windows: List[Window]
    doors: List[Door]
    slab: Slab

    def to_dict(self):
        return {
            'id': self.id,
            'floor_number': self.floor_number,
            'base_height': self.base_height,
            'height': self.height,
            'walls': [w.to_dict() for w in self.walls],
            'windows': [w.to_dict() for w in self.windows],
            'doors': [d.to_dict() for d in self.doors],
            'slab': self.slab.to_dict() if self.slab else None
        }


class FloorPlanParser:
    """
    Converts 2D floor plan representations into 3D building data

    Input formats supported:
    - JSON with room/wall definitions
    - SVG paths (future)
    - DXF files (future)
    - Image segmentation (future with CV)
    """

    def __init__(self):
        self.floors = []

    def parse_simple_rectangular_room(self, width: float, depth: float,
                                     floor_number: int, base_height: float,
                                     wall_height: float = 3.0) -> Floor:
        """
        Creates a simple rectangular room - useful for testing
        """
        half_width = width / 2
        half_depth = depth / 2

        # Create walls for a rectangular room
        walls = [
            # Front wall (facing -Z)
            Wall(Point2D(-half_width, -half_depth), Point2D(half_width, -half_depth)),
            # Right wall
            Wall(Point2D(half_width, -half_depth), Point2D(half_width, half_depth)),
            # Back wall
            Wall(Point2D(half_width, half_depth), Point2D(-half_width, half_depth)),
            # Left wall
            Wall(Point2D(-half_width, half_depth), Point2D(-half_width, -half_depth))
        ]

        # Floor slab (rectangular outline)
        slab = Slab([
            Point2D(-half_width, -half_depth),
            Point2D(half_width, -half_depth),
            Point2D(half_width, half_depth),
            Point2D(-half_width, half_depth)
        ])

        return Floor(
            id=f"floor-{floor_number}",
            floor_number=floor_number,
            base_height=base_height,
            height=wall_height,
            walls=walls,
            windows=[],
            doors=[],
            slab=slab
        )

    def parse_from_json_definition(self, definition: Dict) -> Floor:
        """
        Parse floor from JSON definition

        Expected format:
        {
            "floor_number": 1,
            "base_height": 0.0,
            "height": 3.0,
            "rooms": [
                {
                    "name": "living_room",
                    "polygon": [[x1, y1], [x2, y2], ...]
                }
            ],
            "walls": [...],
            "windows": [...],
            "doors": [...]
        }
        """
        floor_number = definition['floor_number']
        base_height = definition.get('base_height', 0.0)
        height = definition.get('height', 3.0)

        walls = []
        if 'walls' in definition:
            for wall_data in definition['walls']:
                walls.append(Wall(
                    Point2D(*wall_data['start']),
                    Point2D(*wall_data['end']),
                    wall_data.get('thickness', 0.2)
                ))

        windows = []
        if 'windows' in definition:
            for win_data in definition['windows']:
                windows.append(Window(
                    Point2D(*win_data['position']),
                    win_data['width'],
                    win_data['height'],
                    win_data.get('sill_height', 1.0),
                    win_data.get('rotation', 0.0)
                ))

        doors = []
        if 'doors' in definition:
            for door_data in definition['doors']:
                doors.append(Door(
                    Point2D(*door_data['position']),
                    door_data['width'],
                    door_data['height'],
                    door_data.get('rotation', 0.0)
                ))

        # Create slab from rooms or explicit outline
        slab = None
        if 'slab_outline' in definition:
            slab = Slab([Point2D(*p) for p in definition['slab_outline']])
        elif 'rooms' in definition and len(definition['rooms']) > 0:
            # Use first room's polygon as slab outline (simplified)
            slab = Slab([Point2D(*p) for p in definition['rooms'][0]['polygon']])

        return Floor(
            id=f"floor-{floor_number}",
            floor_number=floor_number,
            base_height=base_height,
            height=height,
            walls=walls,
            windows=windows,
            doors=doors,
            slab=slab
        )

    def add_window_to_wall(self, floor: Floor, wall_index: int,
                          position_ratio: float, width: float = 1.5,
                          height: float = 1.2) -> None:
        """
        Adds a window to a specific wall at a position along its length
        """
        if wall_index >= len(floor.walls):
            return

        wall = floor.walls[wall_index]

        # Calculate position along wall
        x = wall.start.x + (wall.end.x - wall.start.x) * position_ratio
        y = wall.start.y + (wall.end.y - wall.start.y) * position_ratio

        # Calculate wall angle
        dx = wall.end.x - wall.start.x
        dy = wall.end.y - wall.start.y
        rotation = math.atan2(dy, dx)

        window = Window(
            Point2D(x, y),
            width,
            height,
            rotation=rotation
        )
        floor.windows.append(window)

    def add_door_to_wall(self, floor: Floor, wall_index: int,
                        position_ratio: float, width: float = 0.9,
                        height: float = 2.1) -> None:
        """
        Adds a door to a specific wall at a position along its length
        """
        if wall_index >= len(floor.walls):
            return

        wall = floor.walls[wall_index]

        # Calculate position along wall
        x = wall.start.x + (wall.end.x - wall.start.x) * position_ratio
        y = wall.start.y + (wall.end.y - wall.start.y) * position_ratio

        # Calculate wall angle
        dx = wall.end.x - wall.start.x
        dy = wall.end.y - wall.start.y
        rotation = math.atan2(dy, dx)

        door = Door(
            Point2D(x, y),
            width,
            height,
            rotation=rotation
        )
        floor.doors.append(door)

    def create_slab_from_points(self, points: List[Point2D]) -> Slab:
        """
        Create a slab from a list of 2D points
        """
        return Slab(points, thickness=0.2)

    def create_building(self, floors: List[Floor]) -> Dict:
        """
        Combines multiple floors into a single building structure
        """
        return {
            'version': '1.0',
            'floors': [floor.to_dict() for floor in floors],
            'metadata': {
                'num_floors': len(floors),
                'total_height': sum(f.height for f in floors)
            }
        }


def create_example_building() -> Dict:
    """
    Creates an example two-story building with windows and doors
    """
    parser = FloorPlanParser()

    # First floor - larger footprint
    floor1 = parser.parse_simple_rectangular_room(
        width=12.0,
        depth=10.0,
        floor_number=1,
        base_height=0.0,
        wall_height=3.0
    )

    # Add windows to first floor
    parser.add_window_to_wall(floor1, 0, 0.3)  # Front wall, left
    parser.add_window_to_wall(floor1, 0, 0.7)  # Front wall, right
    parser.add_window_to_wall(floor1, 1, 0.5)  # Right wall
    parser.add_window_to_wall(floor1, 2, 0.5)  # Back wall

    # Add door to first floor
    parser.add_door_to_wall(floor1, 0, 0.5)  # Front wall, center

    # Second floor - same footprint
    floor2 = parser.parse_simple_rectangular_room(
        width=12.0,
        depth=10.0,
        floor_number=2,
        base_height=3.0,  # Starts where floor 1 ends
        wall_height=3.0
    )

    # Add windows to second floor
    parser.add_window_to_wall(floor2, 0, 0.25)
    parser.add_window_to_wall(floor2, 0, 0.75)
    parser.add_window_to_wall(floor2, 1, 0.3)
    parser.add_window_to_wall(floor2, 1, 0.7)
    parser.add_window_to_wall(floor2, 2, 0.5)
    parser.add_window_to_wall(floor2, 3, 0.5)

    # Create roof (simple flat roof for now)
    roof = Floor(
        id="roof",
        floor_number=3,
        base_height=6.0,
        height=0.3,
        walls=[],
        windows=[],
        doors=[],
        slab=Slab([
            Point2D(-6.0, -5.0),
            Point2D(6.0, -5.0),
            Point2D(6.0, 5.0),
            Point2D(-6.0, 5.0)
        ], thickness=0.3)
    )

    return parser.create_building([floor1, floor2, roof])


if __name__ == '__main__':
    # Example usage
    building = create_example_building()
    print(json.dumps(building, indent=2))
