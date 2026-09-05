const fs = require('fs');
const html = fs.readFileSync('C:/Users/hi/Desktop/portal-online/portal.html', 'utf8');

const dashStart = html.indexOf('<div id="dashboard-page"');
const riwStart = html.indexOf('<div id="riwayat-page"');
const profStart = html.indexOf('<div id="profil-page"');

console.log('Dash Start:', dashStart);
console.log('Riw Start:', riwStart);
console.log('Prof Start:', profStart);

const dashBlock = html.substring(dashStart, riwStart);
console.log('Dash open divs:', (dashBlock.match(/<div/g) || []).length);
console.log('Dash close divs:', (dashBlock.match(/<\/div>/g) || []).length);

const riwBlock = html.substring(riwStart, profStart);
console.log('Riw open divs:', (riwBlock.match(/<div/g) || []).length);
console.log('Riw close divs:', (riwBlock.match(/<\/div>/g) || []).length);
