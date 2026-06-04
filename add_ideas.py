import os

with open('scan.js', 'r', encoding='utf-8') as f:
    js = f.read()

# Idea 1: Typewriter Effect
# Locate drawSmartHUD label drawing logic
label_draw_old = "    ctx.fillText(label.length > 15 ? label.substring(0, 15) + '...' : label, tagX + 15, tagY + 25);"

label_draw_new = """    // --- IDEA 1: AI TYPEWRITER EFFECT ---
    if (!window.typewriterState) window.typewriterState = {};
    if (!window.typewriterState[label]) window.typewriterState[label] = { start: Date.now() };
    
    const elapsed = Date.now() - window.typewriterState[label].start;
    const charsToShow = Math.floor(elapsed / 50); // Speed: 1 char per 50ms
    
    let displayLabel = label.length > 15 ? label.substring(0, 15) + '...' : label;
    let typedText = displayLabel.substring(0, charsToShow);
    
    // Blinking cursor
    if (charsToShow < displayLabel.length || Math.floor(Date.now() / 300) % 2 === 0) {
        typedText += '█';
    }
    
    ctx.fillText(typedText, tagX + 15, tagY + 25);"""

js = js.replace(label_draw_old, label_draw_new)


# Idea 3: Tactical Crosshair
# Locate drawSciFiHUD end of bracket drawing
crosshair_hook_old = "    ctx.restore();\n}"

crosshair_new = """
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

js = js.replace(crosshair_hook_old, crosshair_new)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js)

print("Applied Idea 1 and Idea 3 to scan.js")
