import json
import os
import math
from PIL import Image

# Configuration
JSON_PATH = os.path.join(os.path.dirname(__file__), '../XIVDyeTools/assets/json/colors_xiv.json')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), 'emoji')
IMG_SIZE = 128
RADIUS = 60.0
CENTER = 63.5

# Light source direction (normalized)
# Light coming from top-left-front
LX, LY, LZ = -0.5, -0.5, 0.8
len_l = math.sqrt(LX*LX + LY*LY + LZ*LZ)
LX, LY, LZ = LX/len_l, LY/len_l, LZ/len_l

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) for i in (0, 2, 4))

def generate_sphere(rgb):
    # Create a new RGBA image
    img = Image.new('RGBA', (IMG_SIZE, IMG_SIZE), (0, 0, 0, 0))
    pixels = img.load()
    
    r_base, g_base, b_base = rgb

    for y in range(IMG_SIZE):
        for x in range(IMG_SIZE):
            # Normalize coordinates to -1..1 range for the sphere calculation
            dx = x - CENTER
            dy = y - CENTER
            dist_sq = dx*dx + dy*dy
            
            if dist_sq > RADIUS * RADIUS:
                continue # Outside the sphere
            
            # Calculate Z (depth) of the sphere at this point
            z = math.sqrt(RADIUS*RADIUS - dist_sq)
            
            # Normal vector (normalized because we divide by Radius)
            nx = dx / RADIUS
            ny = dy / RADIUS
            nz = z / RADIUS
            
            # Diffuse lighting (Dot product of Normal and Light)
            diffuse = max(0, nx*LX + ny*LY + nz*LZ)
            
            # Specular lighting (Phong reflection model)
            # View vector is (0,0,1)
            # Reflect vector R = 2*(N.L)*N - L
            # Specular = (R.V)^n
            # Since V is (0,0,1), R.V is just Rz
            # Rz = 2 * diffuse * nz - LZ
            
            specular = 0
            if diffuse > 0:
                rz = 2 * diffuse * nz - LZ
                if rz > 0:
                    specular = rz ** 20 # Shininess
            
            # Combine lighting
            # Ambient + Diffuse + Specular
            ambient = 0.3
            light_intensity = ambient + (diffuse * 0.7)
            
            # Apply lighting to base color
            r = int(r_base * light_intensity + specular * 255 * 0.4)
            g = int(g_base * light_intensity + specular * 255 * 0.4)
            b = int(b_base * light_intensity + specular * 255 * 0.4)
            
            # Clamp values
            r = min(255, max(0, r))
            g = min(255, max(0, g))
            b = min(255, max(0, b))
            
            # Anti-aliasing for edges (simple alpha blending based on distance)
            alpha = 255
            edge_dist = RADIUS - math.sqrt(dist_sq)
            if edge_dist < 1.0:
                alpha = int(255 * edge_dist)
            
            pixels[x, y] = (r, g, b, alpha)
            
    return img

def main():
    # Ensure output directory exists
    if not os.path.exists(OUTPUT_DIR):
        os.makedirs(OUTPUT_DIR)
        print(f"Created output directory: {OUTPUT_DIR}")

    # Read JSON
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: Could not find JSON file at {JSON_PATH}")
        return

    print(f"Found {len(data)} entries. Generating images...")
    
    count = 0
    for entry in data:
        item_id = entry.get('itemID')
        hex_color = entry.get('hex')
        
        if item_id is not None and hex_color:
            try:
                rgb = hex_to_rgb(hex_color)
                img = generate_sphere(rgb)
                
                output_path = os.path.join(OUTPUT_DIR, f"{item_id}.webp")
                img.save(output_path, 'WEBP', lossless=True, quality=100)
                count += 1
                
                if count % 50 == 0:
                    print(f"Generated {count} images...")
            except Exception as e:
                print(f"Failed to generate image for ID {item_id}: {e}")
    
    print(f"Done! Generated {count} sphere images in {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
