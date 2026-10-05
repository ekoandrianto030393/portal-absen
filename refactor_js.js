const fs = require('fs');
const path = require('path');

const dir = __dirname;
// Target JS files that generate HTML with hardcoded names
const files = ['admin.js', 'dashboard.js', 'portal.js', 'rekap.js'];

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    let modified = false;

    const regexWana = /PUSKESMAS WANA/gi;
    if (content.match(regexWana) && !content.includes('dynamic-instansi-nama')) {
        // Only replace inside HTML template literals or strings
        content = content.replace(regexWana, '<span class="dynamic-instansi-nama">$&</span>');
        modified = true;
    }

    const regexLampung = /KABUPATEN LAMPUNG TIMUR/gi;
    if (content.match(regexLampung) && !content.includes('dynamic-instansi-lokasi')) {
        content = content.replace(regexLampung, '<span class="dynamic-instansi-lokasi">$&</span>');
        modified = true;
    }

    if (modified) {
        fs.writeFileSync(path.join(dir, file), content, 'utf8');
        console.log('Updated JS:', file);
    }
});

console.log('Done refactoring JS files.');
