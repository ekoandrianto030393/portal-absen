import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# === UPGRADE MAIN TITLE GRADIENT to Ultra Prismatic Diamond ===
old_main_gradient = """        background: linear-gradient(
            90deg,
            #94a3b8 0%,
            #e2e8f0 12%,
            #ffffff 20%,
            #67e8f9 35%,
            #06b6d4 50%,
            #67e8f9 65%,
            #ffffff 80%,
            #e2e8f0 88%,
            #94a3b8 100%
        );
        background-size: 300% auto;"""

new_main_gradient = """        background: linear-gradient(
            90deg,
            #a78bfa 0%,
            #38bdf8 10%,
            #ffffff 18%,
            #67e8f9 28%,
            #34d399 40%,
            #fbbf24 50%,
            #34d399 60%,
            #67e8f9 72%,
            #ffffff 82%,
            #38bdf8 90%,
            #a78bfa 100%
        );
        background-size: 400% auto;"""

text = text.replace(old_main_gradient, new_main_gradient)

# === UPGRADE MAIN TITLE GLOW (more colorful) ===
old_main_filter = """        filter:
            drop-shadow(0 0 40px rgba(6, 182, 212, 0.9))
            drop-shadow(0 0 80px rgba(6, 182, 212, 0.4))
            drop-shadow(0 5px 15px rgba(0, 0, 0, 0.8));"""

new_main_filter = """        filter:
            drop-shadow(0 0 30px rgba(56, 189, 248, 0.9))
            drop-shadow(0 0 60px rgba(168, 85, 247, 0.5))
            drop-shadow(0 0 80px rgba(52, 211, 153, 0.3))
            drop-shadow(0 5px 15px rgba(0, 0, 0, 0.9));"""

text = text.replace(old_main_filter, new_main_filter)

# === UPGRADE SUBTITLE GRADIENT ===
old_sub_gradient = """        background: linear-gradient(
            90deg,
            #3b82f6 0%,
            #22d3ee 20%,
            #ffffff 50%,
            #22d3ee 80%,
            #3b82f6 100%
        );
        background-size: 250% auto;"""

new_sub_gradient = """        background: linear-gradient(
            90deg,
            #c084fc 0%,
            #22d3ee 15%,
            #fde68a 35%,
            #ffffff 50%,
            #fde68a 65%,
            #22d3ee 85%,
            #c084fc 100%
        );
        background-size: 300% auto;"""

text = text.replace(old_sub_gradient, new_sub_gradient)

# === UPGRADE SUBTITLE GLOW ===
old_sub_filter = "filter: drop-shadow(0 0 25px rgba(34, 211, 238, 0.9)) drop-shadow(0 4px 10px rgba(0,0,0,0.8));"
new_sub_filter = "filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.8)) drop-shadow(0 0 40px rgba(34, 211, 238, 0.6)) drop-shadow(0 4px 10px rgba(0,0,0,0.9));"
text = text.replace(old_sub_filter, new_sub_filter)

# === UPGRADE LOCATION COLOR ===
old_location = """        color: #cffafe;
        text-shadow: 0 0 20px rgba(6, 182, 212, 0.8), 0 0 40px rgba(6, 182, 212, 0.3);"""

new_location = """        background: linear-gradient(90deg, #67e8f9, #fde68a, #a78bfa, #fde68a, #67e8f9);
        background-size: 300% auto;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        -webkit-text-fill-color: transparent;
        animation: prismaticShine 8s linear infinite;
        filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.7)) drop-shadow(0 0 30px rgba(168, 85, 247, 0.3));"""

text = text.replace(old_location, new_location)
# Remove the duplicate animation line from god-location
text = text.replace(
    """        animation: prismaticShine 8s linear infinite;
        filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.7)) drop-shadow(0 0 30px rgba(168, 85, 247, 0.3));
        animation: floatSubtle 5s ease-in-out infinite reverse;""",
    """        animation: prismaticShine 8s linear infinite, floatSubtle 5s ease-in-out infinite reverse;
        filter: drop-shadow(0 0 15px rgba(6, 182, 212, 0.7)) drop-shadow(0 0 30px rgba(168, 85, 247, 0.3));"""
)

# === UPGRADE DIVIDER COLORS ===
old_divider_bg = "background: linear-gradient(to var(--dir, right), transparent, rgba(6,182,212,0.5), #22d3ee, #ffffff, #22d3ee, rgba(6,182,212,0.5), transparent);"
new_divider_bg = "background: linear-gradient(to var(--dir, right), transparent, rgba(168,85,247,0.5), #22d3ee, #fde68a, #ffffff, #fde68a, #22d3ee, rgba(168,85,247,0.5), transparent);"
text = text.replace(old_divider_bg, new_divider_bg)

# === UPGRADE DIAMOND COLORS ===
old_diamond = """        background: #22d3ee;
        transform: rotate(45deg);
        box-shadow: 0 0 10px #22d3ee, 0 0 20px rgba(34,211,238,0.5);"""

new_diamond = """        background: linear-gradient(135deg, #fbbf24, #22d3ee, #a78bfa);
        transform: rotate(45deg);
        box-shadow: 0 0 12px #fbbf24, 0 0 24px rgba(34,211,238,0.5), 0 0 36px rgba(168,85,247,0.3);"""

text = text.replace(old_diamond, new_diamond)

# === UPGRADE CORONA BACKGLOW ===
old_corona = """        background: radial-gradient(ellipse at center,
            rgba(6, 182, 212, 0.15) 0%,
            rgba(59, 130, 246, 0.08) 30%,
            transparent 65%
        );"""

new_corona = """        background: radial-gradient(ellipse at center,
            rgba(251, 191, 36, 0.08) 0%,
            rgba(6, 182, 212, 0.12) 20%,
            rgba(168, 85, 247, 0.06) 40%,
            transparent 65%
        );"""

text = text.replace(old_corona, new_corona)

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("=== PRISMATIC RAINBOW DIAMOND COLORS APPLIED ===")
