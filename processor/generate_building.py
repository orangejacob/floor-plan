#!/usr/bin/env python3
"""
Building Generator Script - Generates 3D building data from floor plans
"""

import json
import os
import sys
from pathlib import Path
from floor_plan_parser import create_example_building, FloorPlanParser


def ensure_output_dir():
    """Create output directory if it doesn't exist"""
    output_dir = Path(__file__).parent.parent / 'public' / 'data'
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def generate_example():
    """Generate example building and save to JSON"""
    print("Generating example building...")

    building = create_example_building()

    output_dir = ensure_output_dir()
    output_path = output_dir / 'building.json'

    with open(output_path, 'w') as f:
        json.dump(building, f, indent=2)

    print(f"✓ Building data generated: {output_path}")
    print(f"  - Floors: {building['metadata']['num_floors']}")
    print(f"  - Total height: {building['metadata']['total_height']}m")

    return building


def generate_from_input(input_file: str):
    """
    Generate building from input file

    Supports:
    - JSON floor plan definitions
    - Future: SVG, DXF, images
    """
    input_path = Path(input_file)

    if not input_path.exists():
        print(f"Error: Input file not found: {input_file}")
        sys.exit(1)

    print(f"Processing floor plan: {input_file}")

    parser = FloorPlanParser()

    if input_path.suffix == '.json':
        with open(input_path) as f:
            data = json.load(f)

        # Check if it's a multi-floor definition or single floor
        if 'floors' in data:
            floors = [parser.parse_from_json_definition(floor_def)
                     for floor_def in data['floors']]
        else:
            # Single floor definition
            floors = [parser.parse_from_json_definition(data)]

        building = parser.create_building(floors)

        output_dir = ensure_output_dir()
        output_path = output_dir / 'building.json'

        with open(output_path, 'w') as f:
            json.dump(building, f, indent=2)

        print(f"✓ Building generated: {output_path}")
        return building

    else:
        print(f"Error: Unsupported file format: {input_path.suffix}")
        print("Supported formats: .json")
        sys.exit(1)


def main():
    if len(sys.argv) > 1:
        # Process input file
        input_file = sys.argv[1]
        generate_from_input(input_file)
    else:
        # Generate example
        generate_example()


if __name__ == '__main__':
    main()
