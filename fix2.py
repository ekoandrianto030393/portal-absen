import sys
import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# REMOVE SPINNING SHIELD / DENYUT NADI IN CERTIFICATE
pattern_shield = re.compile(r'<!-- Digital Hologram Stamp -->\s*<div style="position: relative; width: 70px; height: 70px;.*?</div>\s*</div>\s*</div>', re.DOTALL)
if pattern_shield.search(content):
    content = pattern_shield.sub('<!-- Shield removed -->', content)
else:
    print("Could not find spinning shield")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Shield removed")
