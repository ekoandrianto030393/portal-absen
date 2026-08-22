import os
import re

def modify_scan_html(text):
    # 1. Update the Main Title
    old_title = 'background: linear-gradient(135deg, #FDE68A 0%, #FFD700 25%, #DAA520 50%, #CD853F 75%, #ffffff 100%); -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 20px rgba(218,165,32,0.4));'
    new_title = 'background: linear-gradient(135deg, #ffffff 0%, #e0f2fe 40%, #7dd3fc 60%, #ffffff 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 15px rgba(56, 189, 248, 0.4));'
    text = text.replace(old_title, new_title)

    # 2. Update statusMessage text-shadow
    text = text.replace('text-shadow: 0 0 20px rgba(218,165,32,0.3);', 'text-shadow: 0 0 20px rgba(34,211,238,0.6);')

    # 3. Update telemetry/scanning texts
    old_telemetry = """<div class="flex items-center gap-1.5 text-[#FDE68A] mb-2 border-b border-[rgba(255,215,0,0.3)] pb-1.5 uppercase font-sans tracking-widest text-[9px] animate-breathing">
                            <i class="fa-solid fa-crosshairs text-[#FFD700]"></i> BIOSCAN_V5.0
                        </div>"""
    new_telemetry = """<div class="flex items-center gap-1.5 text-[#e0f2fe] mb-2 border-b border-[rgba(34,211,238,0.3)] pb-1.5 uppercase font-sans tracking-widest text-[9px] animate-breathing">
                            <i class="fa-solid fa-crosshairs text-[#22d3ee]"></i> BIOSCAN_V5.0
                        </div>"""
    text = text.replace(old_telemetry, new_telemetry)
    
    # 4. Update camera frame corners
    # The user might want the camera frame corners to be cyan instead of gold. Let's do that too since it's scanning panel
    text = text.replace("border-[#FFD700]/80", "border-[#22d3ee]/80")
    text = text.replace("border-[#FFD700]", "border-[#22d3ee]")
    text = text.replace("shadow-[-5px_-5px_15px_rgba(255,215,0,0.1)]", "shadow-[-5px_-5px_15px_rgba(34,211,238,0.2)]")
    text = text.replace("shadow-[5px_-5px_15px_rgba(255,215,0,0.1)]", "shadow-[5px_-5px_15px_rgba(34,211,238,0.2)]")
    text = text.replace("shadow-[-5px_5px_15px_rgba(255,215,0,0.1)]", "shadow-[-5px_5px_15px_rgba(34,211,238,0.2)]")
    text = text.replace("shadow-[5px_5px_15px_rgba(255,215,0,0.1)]", "shadow-[5px_5px_15px_rgba(34,211,238,0.2)]")
    text = text.replace("text-[#FFD700]", "text-[#22d3ee]")
    
    # Wait, text-[#FFD700] is also in ID card!
    # I must only do this carefully.
    return text

def modify_scan_js(text):
    # In scan.js:
    # let shadowColor = '#FFD700'; // Default untuk text-metallic-gold
    text = text.replace("let shadowColor = '#FFD700';", "let shadowColor = '#22d3ee';")
    
    # In updateStatus:
    # statusMessage.className = 'text-2xl lg:text-3xl font-serif font-bold transition-all duration-500 uppercase tracking-widest text-metallic-gold';
    # this will use the cosmic text-metallic-gold if it exists, but wait, text-metallic-gold isn't defined as cosmic.
    # We can just change text-metallic-gold to text-cyan-400
    text = text.replace("text-metallic-gold", "text-cyan-400")
    
    return text

if os.path.exists('scan.html'):
    with open('scan.html', 'r', encoding='utf-8') as f:
        html = f.read()
    # Before we do text-[#FFD700] blindly, we should only apply it to the scanning panel!
    # The scanning panel is:
    # <div class="absolute top-4 left-4 text-xs font-mono font-bold leading-tight pointer-events-none z-20 text-[#FFD700] p-3
    html = html.replace('text-[#FFD700] p-3', 'text-[#22d3ee] p-3')
    html = modify_scan_html(html)
    with open('scan.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Updated scan.html")

if os.path.exists('scan.js'):
    with open('scan.js', 'r', encoding='utf-8') as f:
        js = f.read()
    js = modify_scan_js(js)
    with open('scan.js', 'w', encoding='utf-8') as f:
        f.write(js)
    print("Updated scan.js")
