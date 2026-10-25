const https = require('https');
const data = JSON.stringify({ username: 'Sunarti', password: '123456' });
const options = {
  hostname: 'portal-absen.onrender.com',
  path: '/api/pegawai/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});
req.on('error', (e) => console.error(e));
req.write(data);
req.end();
