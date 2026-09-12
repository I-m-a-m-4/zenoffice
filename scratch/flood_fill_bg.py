import collections
import os
import sys
from PIL import Image

def flood_fill_transparency(img_path, threshold=20):
    if not os.path.exists(img_path):
        print(f"Error: {img_path} not found.")
        return

    print(f"Processing background removal on: {img_path}")
    img = Image.open(img_path).convert("RGBA")
    width, height = img.size
    pixels = img.load()
    
    visited = set()
    queue = collections.deque()
    
    # Detect the target background color from the corner pixels
    corners = [pixels[0, 0], pixels[width-1, 0], pixels[0, height-1], pixels[width-1, height-1]]
    bg_r = sum(c[0] for c in corners) // 4
    bg_g = sum(c[1] for c in corners) // 4
    bg_b = sum(c[2] for c in corners) // 4
    print(f"Detected background average color: R={bg_r}, G={bg_g}, B={bg_b}")
    
    # Initialize queue with boundary pixels matching the background color
    for x in range(width):
        for y in [0, height - 1]:
            c = pixels[x, y]
            if abs(c[0]-bg_r) < threshold and abs(c[1]-bg_g) < threshold and abs(c[2]-bg_b) < threshold:
                queue.append((x, y))
                visited.add((x, y))
    for y in range(height):
        for x in [0, width - 1]:
            c = pixels[x, y]
            if (x, y) not in visited:
                if abs(c[0]-bg_r) < threshold and abs(c[1]-bg_g) < threshold and abs(c[2]-bg_b) < threshold:
                    queue.append((x, y))
                    visited.add((x, y))
                    
    # Perform Breadth-First Search (BFS) to flood fill the background
    while queue:
        cx, cy = queue.popleft()
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = cx + dx, cy + dy
            if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                c = pixels[nx, ny]
                if abs(c[0]-bg_r) < threshold and abs(c[1]-bg_g) < threshold and abs(c[2]-bg_b) < threshold:
                    visited.add((nx, ny))
                    queue.append((nx, ny))
                    
    # Convert all filled background pixels to transparent
    for x, y in visited:
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        
    img.save(img_path, "PNG")
    print(f"Success: Background removed from {img_path} while preserving the internal components and stands!")

# Process hero images
flood_fill_transparency("public/hero computer img original.png", threshold=15)
