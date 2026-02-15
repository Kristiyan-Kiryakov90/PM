#!/usr/bin/env python3
"""
Script to convert service files from individual exports to object pattern
"""
import re
import sys
from pathlib import Path

def convert_service_file(filepath, service_name):
    """Convert a service file to object pattern"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Find all exported functions
    export_pattern = r'^export\s+(async\s+)?function\s+(\w+)\s*\('
    exports = re.findall(export_pattern, content, re.MULTILINE)

    if not exports:
        print(f"No exports found in {filepath}")
        return False

    print(f"Found {len(exports)} exports in {service_name}")

    # Get the import section (everything before first export)
    first_export_match = re.search(export_pattern, content, re.MULTILINE)
    if not first_export_match:
        return False

    imports_section = content[:first_export_match.start()].rstrip()

    # Build the new service object
    new_content = imports_section + "\n\n"
    new_content += f"export const {service_name} = {{\n"

    # Extract each function and convert to method
    remaining = content[first_export_match.start():]

    # Split by export statements
    function_blocks = re.split(r'\n(?=export\s+(async\s+)?function)', '\n' + remaining)

    for i, block in enumerate(function_blocks):
        if not block.strip() or not block.startswith('export'):
            continue

        # Remove 'export ' prefix
        block = re.sub(r'^export\s+', '', block, flags=re.MULTILINE)

        # Convert function to method (remove 'function' keyword)
        block = re.sub(r'^(async\s+)?function\s+(\w+)\s*\(', r'\1\2(', block, flags=re.MULTILINE)

        # Indent the entire block
        lines = block.split('\n')
        indented_lines = ['  ' + line if line.strip() else line for line in lines]
        method_block = '\n'.join(indented_lines)

        # Add comma after closing brace (except for last function)
        if i < len(function_blocks) - 1:
            # Find the last closing brace and add comma
            method_block = method_block.rstrip() + ','

        new_content += method_block + '\n'

    new_content += "};\n"

    # Write back
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"[OK] Converted {service_name}")
    return True

def main():
    services_dir = Path(__file__).parent / 'frontend' / 'src' / 'js' / 'services'

    # List of services to convert (excluding already converted and special ones)
    services_to_convert = [
        ('status-service.js', 'statusService'),
        ('checklist-service.js', 'checklistService'),
        ('tag-service.js', 'tagService'),
        ('comment-service.js', 'commentService'),
        ('time-tracking-service.js', 'timeTrackingService'),
        ('auth-service.js', 'authService'),
        ('realtime-service.js', 'realtimeService'),
        ('activity-service.js', 'activityService'),
        ('space-service.js', 'spaceService'),
        ('project-service.js', 'projectService'),
        ('gantt-service.js', 'ganttService'),
        ('dashboard-service.js', 'dashboardService'),
        ('reports-service.js', 'reportsService'),
        ('profile-service.js', 'profileService'),
    ]

    for filename, service_name in services_to_convert:
        filepath = services_dir / filename
        if filepath.exists():
            try:
                convert_service_file(filepath, service_name)
            except Exception as e:
                print(f"[FAIL] Error converting {filename}: {e}")
        else:
            print(f"[FAIL] File not found: {filepath}")

if __name__ == '__main__':
    main()
