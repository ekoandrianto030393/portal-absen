// Auto-fetch Nama Instansi dari server.js (.env)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/config');
        const result = await response.json();
        
        if (result.success && result.config) {
            const { nama_instansi, lokasi_instansi } = result.config;
            
            // Ubah semua elemen dengan class dynamic-instansi-nama
            const elementsNama = document.querySelectorAll('.dynamic-instansi-nama');
            elementsNama.forEach(el => {
                // Khusus untuk elemen god-title-main yang pakai data-text
                if (el.hasAttribute('data-text')) {
                    el.setAttribute('data-text', nama_instansi);
                }
                // Jika elemen menggunakan <br> seperti di scan.html (PRESENSI<br>BIOMETRIK),
                // kita hanya mengubah jika elemen tersebut hanya berisi nama instansi biasa,
                // Namun untuk judul PRESENSI BIOMETRIK kita biarkan statis, yang dinamis adalah PUSKESMAS WANA nya.
                el.textContent = nama_instansi;
            });
            
            // Ubah semua elemen dengan class dynamic-instansi-lokasi
            const elementsLokasi = document.querySelectorAll('.dynamic-instansi-lokasi');
            elementsLokasi.forEach(el => {
                el.textContent = lokasi_instansi;
            });

            // Set Title Window Browser
            document.title = `Sistem Biometrik - ${nama_instansi}`;
        }
    } catch (error) {
        console.error("Gagal mengambil konfigurasi instansi:", error);
    }
});
