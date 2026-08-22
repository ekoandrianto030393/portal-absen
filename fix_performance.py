import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove expensive holographicShift (hue-rotate is VERY costly per frame)
text = text.replace(
    "animation: prismaticShine 5s linear infinite, holographicShift 8s ease-in-out infinite, textGlitch 10s ease infinite;",
    "animation: prismaticShine 5s linear infinite;"
)

# 2. Remove the heavy blur on corona backglow (blur(30px) is very expensive)
text = text.replace(
    "        animation: coronaBreath 5s ease-in-out infinite;\n        pointer-events: none;\n        z-index: 0;\n        filter: blur(30px);",
    "        animation: coronaBreath 5s ease-in-out infinite;\n        pointer-events: none;\n        z-index: 0;"
)

# 3. Remove second corona layer blur(40px)
text = text.replace(
    'filter: blur(40px); animation: coronaBreath 7s ease-in-out infinite reverse;',
    'animation: coronaBreath 7s ease-in-out infinite reverse;'
)

# 4. Reduce sparkles from 10 to 4 (remove 6)
# Remove sparkles 5-10
sparkles_to_remove = [
    '                            <div class="sparkle" style="top:5%; left:50%; --spark-color:rgba(244,114,182,0.8); --dur:1.6s; --delay:0.2s;"></div>\n',
    '                            <div class="sparkle" style="top:50%; left:3%; --spark-color:rgba(251,191,36,0.8); --dur:2.8s; --delay:1.5s;"></div>\n',
    '                            <div class="sparkle" style="top:40%; left:95%; --spark-color:rgba(56,189,248,0.8); --dur:2.1s; --delay:0.6s;"></div>\n',
    '                            <div class="sparkle" style="top:90%; left:40%; --spark-color:rgba(168,85,247,0.8); --dur:1.9s; --delay:1s;"></div>\n',
    '                            <div class="sparkle" style="top:15%; left:70%; --spark-color:rgba(244,114,182,0.8); --dur:2.4s; --delay:1.8s;"></div>\n',
    '                            <div class="sparkle" style="top:60%; left:60%; --spark-color:rgba(52,211,153,0.8); --dur:2.6s; --delay:0.3s;"></div>\n',
]
for s in sparkles_to_remove:
    text = text.replace(s, '')

# 5. Remove backdrop-filter from roster cards (very expensive with many cards)
text = text.replace(
    "                backdrop-filter: blur(20px);\n                -webkit-backdrop-filter: blur(20px);",
    ""
)

# 6. Remove the scanBeam animation (constant repainting)
text = text.replace(
    """    .celestial-frame::after {
        content: '';
        position: absolute;
        top: 0; left: -20%;
        width: 15%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        animation: scanBeam 5s ease-in-out infinite;
        pointer-events: none;
        z-index: 2;
    }""",
    """    .celestial-frame::after {
        content: '';
        position: absolute;
        top: 0; left: -20%;
        width: 15%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        animation: scanBeam 8s ease-in-out infinite;
        pointer-events: none;
        z-index: 2;
        will-change: left;
    }"""
)

# 7. Add will-change to animated border for GPU acceleration
text = text.replace(
    "        animation: borderRotate 6s linear infinite;",
    "        animation: borderRotate 8s linear infinite;\n        will-change: background-position;"
)

# 8. Simplify the laserLineSweep on dividers - slow it down
text = text.replace(
    "        animation: laserLineSweep 3s ease-in-out infinite;",
    "        animation: laserLineSweep 6s ease-in-out infinite;\n        will-change: transform;"
)

# 9. Add will-change to main title
text = text.replace(
    "        animation: prismaticShine 5s linear infinite;\n        filter:",
    "        animation: prismaticShine 5s linear infinite;\n        will-change: background-position;\n        filter:"
)

# 10. Reduce multiple drop-shadows on title to just 2
text = text.replace(
    """        filter:
            drop-shadow(0 0 30px rgba(56, 189, 248, 0.9))
            drop-shadow(0 0 60px rgba(168, 85, 247, 0.5))
            drop-shadow(0 0 80px rgba(52, 211, 153, 0.3))
            drop-shadow(0 5px 15px rgba(0, 0, 0, 0.9));""",
    """        filter:
            drop-shadow(0 0 25px rgba(56, 189, 248, 0.7))
            drop-shadow(0 4px 10px rgba(0, 0, 0, 0.9));"""
)

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("=== PERFORMANCE OPTIMIZED ===")
print("Removed: holographicShift, textGlitch, heavy blurs, 6 sparkles")
print("Optimized: will-change, slower animations, fewer drop-shadows")
