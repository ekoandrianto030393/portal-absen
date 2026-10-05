const fs = require('fs');
const path = require('path');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    let modified = false;

    // 1. Inject script if not present
    if (!content.includes('instansi_config.js')) {
        content = content.replace('</body>', '    <script src="instansi_config.js"></script>\n</body>');
        modified = true;
    }

    // 2. Replace "PUSKESMAS WANA" (case insensitive) outside of tags
    // A simple regex that avoids replacing inside HTML attributes:
    // But since "Puskesmas Wana" doesn't usually appear in attributes, it's mostly safe.
    // However, if it's already in a tag, wrapping it in a span is fine.
    
    // We will target exactly "PUSKESMAS WANA" and "Puskesmas Wana"
    const regexWana = /PUSKESMAS WANA/gi;
    
    // To avoid double wrapping if we run it multiple times:
    if (!content.includes('dynamic-instansi-nama')) {
        content = content.replace(regexWana, '<span class="dynamic-instansi-nama">$&</span>');
        modified = true;
    }

    const regexLampung = /KABUPATEN LAMPUNG TIMUR/gi;
    if (!content.includes('dynamic-instansi-lokasi')) {
        content = content.replace(regexLampung, '<span class="dynamic-instansi-lokasi">$&</span>');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(path.join(dir, file), content, 'utf8');
        console.log('Updated:', file);
    }
});

console.log('Done refactoring HTML files.');
