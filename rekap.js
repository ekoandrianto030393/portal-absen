// Frontend Logic untuk rekap.html

async function loadRekap() {
    const periodeInput = document.getElementById('periode');
    const tbody = document.getElementById('rekapBody');
    
    let url = '/api/rekap';
    if (periodeInput && periodeInput.value) {
        // Kirim format YYYY-MM langsung ke API
        url += `?periode=${periodeInput.value}`;
    }

    tbody.innerHTML = '<tr><td colspan="9" class="muted">Memuat data...</td></tr>';

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Server Error: ${response.status}`);
        
        const result = await response.json();
        
        if (!result.success) {
            throw new Error(result.message || 'Gagal memuat data dari server');
        }

        if (result.data && result.data.length > 0) {
            tbody.innerHTML = '';
            
            // Data sudah dihitung oleh Database (View), tinggal tampilkan
            result.data.forEach(row => {
                // Hitung Lupa Pulang berdasarkan potongan jam (Potongan / 2)
                // Karena di database: Potongan = 2 jam * jumlah lupa pulang
                const lupaPulangCount = Math.floor(row.potongan_jam / 2);
                
                const tr = `
                    <tr>
                        <td>${row.id_karyawan}</td>
                        <td class="left">${row.nama}</td>
                        <td style="text-align:center; font-weight:bold; color:#00eaff;">${row.total_masuk}</td>
                        <td style="text-align:center; color:#ff4444; font-weight:bold;">${row.alpa}</td>
                        <td style="${row.telat_kali > 0 ? 'color:orange;' : ''}">${row.telat_kali}</td>
                        <td>${row.telat_menit}</td>
                        <td>${row.pulang_kali}</td>
                        <td style="${lupaPulangCount > 0 ? 'color:red;font-weight:bold;' : ''}">${lupaPulangCount}</td>
                        <td style="color:#ef4444;">${row.potongan_jam} Jam</td>
                        <td style="color:#22c55e; font-weight:bold;">${row.total_jam_kerja || '00:00:00'}</td>
                    </tr>
                `;
                tbody.innerHTML += tr;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="muted">Tidak ada data absensi untuk periode ini.</td></tr>';
        }

    } catch (error) {
        console.error('Failed to load rekap:', error);
        tbody.innerHTML = `<tr><td colspan="9" class="muted" style="color:red;">Error: ${error.message}</td></tr>`;
    }
}
// Load otomatis saat halaman dibuka
document.addEventListener('DOMContentLoaded', loadRekap);