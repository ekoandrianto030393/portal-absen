import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Make the certificate background use medis.jpg with a dark elegant overlay
cert_bg_pattern = r'background: linear-gradient\(135deg, rgba\(15,15,15,0\.95\) 0%, rgba\(5,5,5,0\.98\) 100%\);'
cert_bg_replacement = r"background: linear-gradient(135deg, rgba(10,25,20,0.85) 0%, rgba(0,5,5,0.95) 100%), url('medis.jpg') center/cover; background-blend-mode: overlay, normal;"
content = re.sub(cert_bg_pattern, cert_bg_replacement, content)

# Make the room background (successOverlay) use medis.jpg 
overlay_bg_pattern = r'successOverlay\.style\.background = finalBackground;'
overlay_bg_replacement = """
            // Set dynamic background using medis.jpg with a status-colored tint
            let bgTint1 = result.success ? (isWarning ? 'rgba(150, 120, 0, 0.85)' : 'rgba(6, 78, 59, 0.85)') : 'rgba(150, 0, 30, 0.85)';
            let bgTint2 = result.success ? (isWarning ? 'rgba(80, 60, 0, 0.95)' : 'rgba(2, 44, 34, 0.95)') : 'rgba(80, 0, 15, 0.95)';
            successOverlay.style.background = `linear-gradient(${bgTint1}, ${bgTint2}), url('medis.jpg') center/cover`;
"""
content = re.sub(overlay_bg_pattern, overlay_bg_replacement, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("medis_bg_applied")
