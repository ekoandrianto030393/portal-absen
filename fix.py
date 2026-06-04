import sys
import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. FIX THE isWarning ERROR
# Find the bgTint lines and replace them
pattern_bg = r"let bgTint1 = result\.success \? \(isWarning \? 'rgba\(150, 120, 0, 0\.85\)' : 'rgba\(6, 78, 59, 0\.85\)'\) : 'rgba\(150, 0, 30, 0\.85\)';\s*let bgTint2 = result\.success \? \(isWarning \? 'rgba\(80, 60, 0, 0\.95\)' : 'rgba\(2, 44, 34, 0\.95\)'\) : 'rgba\(80, 0, 15, 0\.95\)';"
replacement_bg = """
            let safeIsWarning = false;
            try { safeIsWarning = isWarning; } catch (e) { safeIsWarning = false; }
            if (typeof statusColor !== 'undefined' && statusColor === 'yellow') { safeIsWarning = true; }
            let bgTint1 = result.success ? 'rgba(6, 78, 59, 0.85)' : (safeIsWarning ? 'rgba(150, 120, 0, 0.85)' : 'rgba(150, 0, 30, 0.85)');
            let bgTint2 = result.success ? 'rgba(2, 44, 34, 0.95)' : (safeIsWarning ? 'rgba(80, 60, 0, 0.95)' : 'rgba(80, 0, 15, 0.95)');
"""
content = re.sub(pattern_bg, replacement_bg, content)


# 2. REMOVE BACKGROUND ANIMATIONS
# Find the block starting with `<div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none;">`
# and ends with `<div class="spotlight"></div>\n                </div>`
pattern_animations = re.compile(r'<div style="position: absolute; inset: 0; overflow: hidden; pointer-events: none;">.*?<div class="spotlight"></div>\s*</div>', re.DOTALL)
if pattern_animations.search(content):
    content = pattern_animations.sub('<!-- Background Animations Removed as requested -->', content)
else:
    print("Could not find background animations block")


# 3. REMOVE SPINNING SHIELD / DENYUT NADI IN CERTIFICATE
pattern_shield = re.compile(r'<!-- Digital Hologram Stamp -->.*?</div>\s*</div>\s*</div>\s*</div>\s*</div>\s*`;', re.DOTALL)
if pattern_shield.search(content):
    # We must keep the closing divs
    content = pattern_shield.sub('</div>\n                    </div>\n                </div>\n            `;', content)
else:
    print("Could not find spinning shield")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Fix applied")
