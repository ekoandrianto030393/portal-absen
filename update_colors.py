import os
import re

# 1. Update scan.html Panel Backgrounds
with open('scan.html', 'r', encoding='utf-8') as f:
    html_text = f.read()

# Replace the specific backgrounds for cuti, dl, hadir panels
# Since we grouped them together with `#cuti-panel, #dl-panel, #hadir-panel { background: ... }` we need to split them to have individual vibrant colors.

# Let's replace the grouped CSS rule in scan.html
old_css_rule = r"""    /\* === GOD-TIER OBSIDIAN PRISM PANELS === \*/
    #cuti-panel, #dl-panel, #hadir-panel \{
        background: linear-gradient\(180deg, rgba\(15, 15, 20, 0\.4\) 0%, rgba\(5, 5, 10, 0\.9\) 100%\) !important;"""

new_css_rule = """    /* === GOD-TIER JEWEL GLASS PANELS === */
    #cuti-panel, #dl-panel, #hadir-panel {
        backdrop-filter: blur(24px) saturate(200%) !important;
        -webkit-backdrop-filter: blur(24px) saturate(200%) !important;
        border-radius: 24px !important;
        border: 1px solid rgba(255, 255, 255, 0.1) !important;
        position: relative;
        overflow: hidden;
    }
    #cuti-panel { background: linear-gradient(160deg, rgba(120, 53, 15, 0.4) 0%, rgba(67, 20, 7, 0.8) 100%) !important; }
    #dl-panel { background: linear-gradient(160deg, rgba(76, 29, 149, 0.4) 0%, rgba(46, 16, 101, 0.8) 100%) !important; }
    #hadir-panel { background: linear-gradient(160deg, rgba(6, 78, 59, 0.4) 0%, rgba(2, 44, 34, 0.8) 100%) !important; }"""

html_text = re.sub(old_css_rule, new_css_rule, html_text, flags=re.DOTALL)

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(html_text)


# 2. Update scan.js Roster Card Colors
with open('scan.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

old_config_block = r"""            const statusConfig = \{
                cuti:  \{ glow: '#f59e0b', accent: '#fbbf24', text: 'CUTI', bg1: 'rgba\(40, 20, 0, 0\.85\)', bg2: 'rgba\(20, 5, 0, 0\.95\)' \},
                dl:    \{ glow: '#8b5cf6', accent: '#c084fc', text: 'DINAS LUAR', bg1: 'rgba\(25, 10, 45, 0\.85\)', bg2: 'rgba\(10, 0, 20, 0\.95\)' \},
                out:   \{ glow: '#f43f5e', accent: '#fb7185', text: 'PULANG', bg1: 'rgba\(45, 10, 15, 0\.85\)', bg2: 'rgba\(20, 0, 5, 0\.95\)' \},
                hadir: \{ glow: '#10b981', accent: '#34d399', text: 'HADIR', bg1: 'rgba\(5, 30, 20, 0\.85\)', bg2: 'rgba\(0, 10, 5, 0\.95\)' \}
            \};"""

new_config_block = """            const statusConfig = {
                cuti:  { glow: '#f97316', accent: '#fdba74', text: 'CUTI', bg1: 'rgba(255, 237, 213, 0.15)', bg2: 'rgba(255, 255, 255, 0.05)' },
                dl:    { glow: '#8b5cf6', accent: '#d8b4fe', text: 'DINAS LUAR', bg1: 'rgba(243, 232, 255, 0.15)', bg2: 'rgba(255, 255, 255, 0.05)' },
                out:   { glow: '#f43f5e', accent: '#fda4af', text: 'PULANG', bg1: 'rgba(255, 228, 230, 0.15)', bg2: 'rgba(255, 255, 255, 0.05)' },
                hadir: { glow: '#10b981', accent: '#6ee7b7', text: 'HADIR', bg1: 'rgba(209, 250, 229, 0.15)', bg2: 'rgba(255, 255, 255, 0.05)' }
            };"""

js_text = re.sub(old_config_block, new_config_block, js_text, flags=re.DOTALL)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js_text)

print("Colors updated successfully to Jewel Glass theme!")
