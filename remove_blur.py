import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# REMOVE THE BLUR SHADOW BEHIND THE CERTIFICATE
pattern_blur = re.compile(r'<div style="position: absolute; inset: 10px; background: rgba\(0,0,0,0\.8\); filter: blur\(30px\); z-index: -1; border-radius: 16px; animation: certEntry 1s ease-out forwards 0\.2s; opacity: 0;"></div>\s*', re.DOTALL)

if pattern_blur.search(content):
    content = pattern_blur.sub('', content)
    print("Found and removed blur shadow!")
else:
    print("Could not find blur shadow div.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Removed blur shadow behind card")
