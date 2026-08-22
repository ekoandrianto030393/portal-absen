import os

with open('scan.html', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add id="hadir-panel" to the Daftar Hadir panel
old_hadir_html = """            <div class="col-span-1 flex flex-col gap-4 order-3 lg:mt-6 mt-4">
                <div class="dark-panel-card relative flex flex-col gap-4 p-4 lg:p-6 transition-all duration-300">
                    <div class="glass-sweep-layer"></div>"""

new_hadir_html = """            <div class="col-span-1 flex flex-col gap-4 order-3 lg:mt-6 mt-4">
                <div id="hadir-panel" class="dark-panel-card relative flex flex-col gap-4 p-4 lg:p-6 transition-all duration-300">
                    <div class="glass-sweep-layer"></div>"""

if old_hadir_html in text:
    text = text.replace(old_hadir_html, new_hadir_html)

# 2. Add specific premium static colors for each panel
inject_css = """    /* === ULTIMATE STATIC PREMIUM PANEL COLORS === */
    /* Cuti Pegawai: Imperial Gold & Obsidian */
    #cuti-panel {
        background: linear-gradient(145deg, rgba(35, 25, 5, 0.95) 0%, rgba(55, 40, 10, 0.9) 35%, rgba(255, 215, 0, 0.15) 50%, rgba(45, 30, 8, 0.9) 65%, rgba(10, 5, 0, 0.98) 100%) !important;
        border: 1px solid rgba(255, 215, 0, 0.3) !important;
        border-top: 2px solid rgba(255, 215, 0, 0.6) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 2px 5px rgba(255,215,0,0.2), 0 0 30px rgba(255,215,0,0.05) !important;
    }
    
    /* Dinas Luar: Deep Copper & Bronze */
    #dl-panel {
        background: linear-gradient(145deg, rgba(40, 15, 5, 0.95) 0%, rgba(60, 25, 10, 0.9) 35%, rgba(205, 133, 63, 0.15) 50%, rgba(50, 20, 8, 0.9) 65%, rgba(15, 5, 0, 0.98) 100%) !important;
        border: 1px solid rgba(205, 133, 63, 0.3) !important;
        border-top: 2px solid rgba(205, 133, 63, 0.6) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 2px 5px rgba(205,133,63,0.2), 0 0 30px rgba(205,133,63,0.05) !important;
    }
    
    /* Daftar Hadir: Royal Sapphire Blue */
    #hadir-panel {
        background: linear-gradient(145deg, rgba(5, 15, 35, 0.95) 0%, rgba(10, 30, 60, 0.9) 35%, rgba(56, 189, 248, 0.15) 50%, rgba(8, 25, 50, 0.9) 65%, rgba(2, 5, 15, 0.98) 100%) !important;
        border: 1px solid rgba(56, 189, 248, 0.3) !important;
        border-top: 2px solid rgba(56, 189, 248, 0.6) !important;
        box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 2px 5px rgba(56,189,248,0.2), 0 0 30px rgba(56,189,248,0.05) !important;
    }
    
    /* Hover effects specifically for them (static enhancement) */
    #cuti-panel:hover {
        border-color: rgba(255, 215, 0, 0.8) !important;
        box-shadow: 0 35px 70px rgba(0,0,0,0.95), inset 0 2px 10px rgba(255,215,0,0.3), 0 0 40px rgba(255,215,0,0.1) !important;
        transform: translateY(-2px);
    }
    #dl-panel:hover {
        border-color: rgba(205, 133, 63, 0.8) !important;
        box-shadow: 0 35px 70px rgba(0,0,0,0.95), inset 0 2px 10px rgba(205,133,63,0.3), 0 0 40px rgba(205,133,63,0.1) !important;
        transform: translateY(-2px);
    }
    #hadir-panel:hover {
        border-color: rgba(56, 189, 248, 0.8) !important;
        box-shadow: 0 35px 70px rgba(0,0,0,0.95), inset 0 2px 10px rgba(56,189,248,0.3), 0 0 40px rgba(56,189,248,0.1) !important;
        transform: translateY(-2px);
    }
"""

# Insert CSS after .dark-panel-card definition
insert_point = "    .dark-panel-card {"
if insert_point in text:
    text = text.replace(insert_point, inject_css + "\n" + insert_point)

with open('scan.html', 'w', encoding='utf-8') as f:
    f.write(text)

print("=== PANEL COLORS UPGRADED ===")
