import re

with open('scan.js', 'r', encoding='utf-8') as f:
    js = f.read()

# The mistakenly injected block
bad_block = """
    // --- IDEA 3: TACTICAL CROSSHAIR ---
    ctx.beginPath();
    const crossSize = 10 + Math.sin(time * 5) * 5; // Pulsing size
    ctx.moveTo(cx - crossSize, cy);
    ctx.lineTo(cx + crossSize, cy);
    ctx.moveTo(cx, cy - crossSize);
    ctx.lineTo(cx, cy + crossSize);
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}"""

# Replace all occurrences back to the original `ctx.restore();\n}`
js = js.replace(bad_block, "    ctx.restore();\n}")

# Now precisely insert it into drawSciFiHUD only
# Find the exact function block for drawSciFiHUD and replace its `ctx.restore();\n}`
def insert_crosshair(match):
    body = match.group(0)
    # Ensure we only replace the LAST ctx.restore() in this function body
    return body.replace("    ctx.restore();\n}", bad_block)

js = re.sub(r'function drawSciFiHUD.*?^}', insert_crosshair, js, flags=re.MULTILINE|re.DOTALL)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Cleaned up duplicated crosshairs and injected correctly into drawSciFiHUD")
