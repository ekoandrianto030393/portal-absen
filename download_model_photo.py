import urllib.request
import os

# Using a stable dummy image URL
image_url = "https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=1200&auto=format&fit=crop"
output_path = r"c:\Users\hi\Desktop\biometrik\screenshot.png"

print(f"Downloading high-quality model photo from Unsplash...")

try:
    # Adding headers to prevent 403 Forbidden
    req = urllib.request.Request(image_url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(output_path, 'wb') as out_file:
        out_file.write(response.read())
    print("Download successful! Saved as screenshot.png")
except Exception as e:
    print(f"Failed to download image: {e}")
