import os
import sys

# Redirect Numba cache to temp directory to bypass permissions issues
os.environ["NUMBA_CACHE_DIR"] = os.environ.get("TEMP", "/tmp")

try:
    from PIL import Image
    from rembg import remove
except ImportError as e:
    print(f"Error: Missing dependency. {e}")
    sys.exit(1)

input_path = "public/hero computer img2.png"
output_path = "public/hero computer img2.png"

if not os.path.exists(input_path):
    print(f"Error: Source image not found at {input_path}")
    sys.exit(1)

print("Starting background removal...")
try:
    input_image = Image.open(input_path)
    output_image = remove(input_image)
    output_image.save(output_path, "PNG")
    print("Background removed successfully!")
except Exception as e:
    print(f"An error occurred during processing: {e}")
    sys.exit(1)
