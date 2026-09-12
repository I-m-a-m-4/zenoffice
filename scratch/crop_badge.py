import sys
from PIL import Image

def process_image(input_path, output_path):
    # Open the image
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    new_data = []
    # Background color is around (24, 24, 24) or slightly varying due to noise
    # Let's make everything that is dark gray/black transparent
    for item in data:
        # Check if the pixel is dark (r, g, b all below ~40)
        if item[0] < 45 and item[1] < 45 and item[2] < 45:
            # Fully transparent
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    
    # Crop to content (bounding box of non-transparent pixels)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Successfully processed {input_path} and saved to {output_path}")

if __name__ == "__main__":
    process_image(sys.argv[1], sys.argv[2])
