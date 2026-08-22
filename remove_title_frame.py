import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Make the celestial frame transparent
text = text.replace("background: rgba(0,0,0,0.2);", "background: transparent;")

# Hide the animated rainbow border
text = text.replace(".celestial-frame::before {", ".celestial-frame::before {\n        display: none !important;")

# Hide the scan beam
text = text.replace(".celestial-frame::after {", ".celestial-frame::after {\n        display: none !important;")

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("Frame removed!")
