const http = require('http');

// Get all users first to find Eko's ID
http.get('http://localhost:3000/api/karyawan/descriptors', (res) => {
    let data = '';
    res.on('data', (c) => data += c);
    res.on('end', () => {
        const users = JSON.parse(data).data;
        const eko = users.find(u => u.nama.toLowerCase().includes('eko'));
        if (eko) {
            console.log("Found Eko:", eko.id_karyawan);
            fetchHistory(eko.id_karyawan);
        } else {
            console.log("Eko not found. Fetching for id 2 (Sigit)");
            fetchHistory(2);
        }
    });
});

function fetchHistory(id) {
    http.get(`http://localhost:3000/api/absensi/history/${id}?periode=2026-08`, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
            console.log(JSON.stringify(JSON.parse(data).data.slice(0, 5), null, 2));
        });
    });
}
