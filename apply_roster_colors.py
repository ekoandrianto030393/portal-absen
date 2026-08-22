import os

with open('scan.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the "Hadir" colors
old_hadir = """            } else {
                bgGradient = 'linear-gradient(135deg, rgba(34,197,94,0.12) 0%, rgba(255,255,255,0.7) 100%)';
                glowColor = '#e0f2fe';
                badgeStyle = 'bg-[#e0f2fe] text-white border-[#e0f2fe]';
                timeGradient = 'text-[#e0f2fe] bg-white border-[#e0f2fe]';
                statusLabelHtml = `<span class="text-[10px] px-2.5 py-0.5 rounded-md border ${badgeStyle} shadow-[0_2px_8px_rgba(224,242,254,0.3)] font-black tracking-[0.2em] uppercase" style="text-shadow: none;">HADIR</span>`;
            }"""
new_hadir = """            } else {
                bgGradient = 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(255,255,255,0.7) 100%)';
                glowColor = '#10b981';
                badgeStyle = 'bg-[#10b981] text-white border-[#10b981]';
                timeGradient = 'text-[#10b981] bg-white border-[#10b981]';
                statusLabelHtml = `<span class="text-[10px] px-2.5 py-0.5 rounded-md border ${badgeStyle} shadow-[0_2px_8px_rgba(16,185,129,0.3)] font-black tracking-[0.2em] uppercase" style="text-shadow: none;">HADIR</span>`;
            }"""
if old_hadir in text:
    text = text.replace(old_hadir, new_hadir)
else:
    print("Could not find old_hadir")

# Fix the solidStatusBg
text = text.replace("const solidStatusBg = isDL ? 'bg-[#3b82f6]' : isCuti ? 'bg-[#f97316]' : isOut ? 'bg-[#f43f5e]' : 'bg-[#e0f2fe]';",
                    "const solidStatusBg = isDL ? 'bg-[#3b82f6]' : isCuti ? 'bg-[#f97316]' : isOut ? 'bg-[#f43f5e]' : 'bg-[#10b981]';")

# Add the motif background
old_css_text = """            item.style.cssText = `
                background: ${cardBg};
                border-color: ${glowColor}30;
                box-shadow: 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 ${glowColor}20;
            `;"""
            
new_css_text = """            // Pola motif geometris mewah (Holographic Hex)
            const motifBg = `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 0l20 10v20L20 40 0 30V10z' fill-rule='evenodd' stroke='%23ffffff' stroke-width='0.5' stroke-opacity='0.08' fill='none'/%3E%3C/svg%3E")`;

            item.style.cssText = `
                background: ${cardBg}, ${motifBg};
                background-blend-mode: overlay;
                background-size: cover, 40px 40px;
                border-color: ${glowColor}50;
                box-shadow: 0 4px 16px rgba(0,0,0,0.6), inset 0 1px 0 ${glowColor}40;
            `;"""
if old_css_text in text:
    text = text.replace(old_css_text, new_css_text)
else:
    print("Could not find old_css_text")


with open('scan.js', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated scan.js with colors and motif")
