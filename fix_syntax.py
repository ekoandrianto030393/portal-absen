import os
import re

with open('scan.js', 'r', encoding='utf-8') as f:
    js_text = f.read()

# We need to replace the broken block.
# Let's match from `            if (isDL) {` all the way to `            const cfg = `
regex_pattern = r'            if \(isDL\) \{.*?            const cfg ='

fixed_logic = """            let timeDisplay = '';
            let statusText = '';
            let glowColor = '';
            
            if (isDL) {
                timeDisplay = 'DINAS LUAR';
                statusText = 'DINAS LUAR';
            } else if (isCuti) {
                timeDisplay = 'CUTI';
                statusText = 'CUTI';
            } else if (isOut) {
                timeDisplay = row.jam_keluar ? row.jam_keluar.substring(0,5) : '-';
                statusText = 'PULANG';
            } else {
                timeDisplay = row.jam_hadir ? row.jam_hadir.substring(0,5) : '-';
                statusText = 'HADIR';
            }

            // === BEYOND GOD-TIER CARD STYLING ===
            const statusConfig = {
                cuti:  { glow: '#f59e0b', accent: '#fbbf24', text: 'CUTI', bg1: 'rgba(40, 20, 0, 0.85)', bg2: 'rgba(20, 5, 0, 0.95)' },
                dl:    { glow: '#8b5cf6', accent: '#c084fc', text: 'DINAS LUAR', bg1: 'rgba(25, 10, 45, 0.85)', bg2: 'rgba(10, 0, 20, 0.95)' },
                out:   { glow: '#f43f5e', accent: '#fb7185', text: 'PULANG', bg1: 'rgba(45, 10, 15, 0.85)', bg2: 'rgba(20, 0, 5, 0.95)' },
                hadir: { glow: '#10b981', accent: '#34d399', text: 'HADIR', bg1: 'rgba(5, 30, 20, 0.85)', bg2: 'rgba(0, 10, 5, 0.95)' }
            };

            const cfg = """

js_text = re.sub(regex_pattern, fixed_logic, js_text, flags=re.DOTALL)

with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(js_text)

print("Syntax fixed!")
