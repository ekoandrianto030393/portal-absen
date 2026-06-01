import sys
import re

with open('c:/Users/hi/Desktop/biometrik/scan.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace root variables in initHUD()
content = re.sub(r'const primary =.*?;', 'const primary = "#10b981";', content) # emerald-500
content = re.sub(r'const secondary =.*?;', 'const secondary = "#34d399";', content) # emerald-400
content = re.sub(r'const glow =.*?;', 'const glow = "rgba(16, 185, 129, 0.4)";', content)

# Remove the custom text shadows in updateStatus
content = re.sub(r'statusMessage\.style\.fontFamily =.*?;\n', '', content)
content = re.sub(r'statusMessage\.style\.textShadow =.*?;\n', '', content)
content = re.sub(r'statusMessage\.style\.filter =.*?;\n', '', content)
content = re.sub(r'statusMessage\.classList\.remove\(.*?\);', 'statusMessage.className = "text-xl lg:text-2xl font-bold transition-colors duration-300";', content)
content = re.sub(r'statusMessage\.classList\.add\(.*?\);', '', content)
content = re.sub(r'statusMessage\.style\.color = (.*?);', r'statusMessage.style.color = \1;', content)

# Update createSigerHeader
siger_replacement = '''function createSigerHeader() {
    let fancyHeader = document.querySelector('.w-full.text-center.flex');
    if (!fancyHeader) return;
    
    fancyHeader.innerHTML = '';
    
    let headerHtml = `
        <div class="flex items-center justify-between w-full px-8 py-2 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg shadow-emerald-900/20">
            <div class="flex items-center gap-4">
                <img src="logo.jpg" class="w-12 h-12 rounded-full shadow-md shadow-emerald-500/20" alt="Logo">
                <div class="text-left">
                    <h1 class="text-2xl font-bold tracking-widest text-emerald-100">PUSKESMAS WANA</h1>
                    <p class="text-xs font-medium tracking-widest text-emerald-400/80 uppercase">Gerbang Biometrik Utama</p>
                </div>
            </div>
            
            <div class="flex flex-col items-end">
                <div class="flex items-baseline gap-2">
                    <span id="clock-h-m" class="text-4xl font-extrabold tracking-wider text-white">00:00</span>
                    <span id="clock-s" class="text-xl font-bold text-emerald-400">00</span>
                </div>
                <div id="date-display" class="text-xs font-semibold tracking-widest text-emerald-200/70 uppercase">SENIN, 01 JANUARI 2026</div>
            </div>
        </div>
    `;
    
    fancyHeader.innerHTML = headerHtml;
}

setInterval(() => {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    
    const hmEl = document.getElementById('clock-h-m');
    const sEl = document.getElementById('clock-s');
    if (hmEl) hmEl.innerText = h + ':' + m;
    if (sEl) sEl.innerText = s;
    
    const dateEl = document.getElementById('date-display');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateEl.innerText = now.toLocaleDateString('id-ID', options).toUpperCase();
    }
}, 1000);
'''
content = re.sub(r'function createSigerHeader\(\).*?// Panggil fungsi segera setelah didefinisikan\ncreateSigerHeader\(\);', siger_replacement + '\ncreateSigerHeader();', content, flags=re.DOTALL)

with open('c:/Users/hi/Desktop/biometrik/scan.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated scan.js successfully.')
