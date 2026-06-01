import sys
import re

with open('c:/Users/hi/Desktop/biometrik/scan.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the sci-fi effects
content = re.sub(r'<div id=\"screenFlash\">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div id=\"alarm-overlay\">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div class=\"cyber-frame\">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div id=\"digitalCrack\">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div class=\"satellite-scan\">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div class=\"sensor-control-panel.*?>.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div class=\"news-ticker-top\">.*?</div>', '', content, flags=re.DOTALL)
content = re.sub(r'<div id=\"boot-screen\">.*?</div>', '', content, flags=re.DOTALL)

# Write back
with open('c:/Users/hi/Desktop/biometrik/scan.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Removed sci-fi elements successfully.')
