// rekap.js - JavaScript untuk Dashboard Kinerja Karyawan

document.addEventListener('DOMContentLoaded', () => {
    // --- KONSTANT & VARIABEL GLOBAL ---
    const API_URL_REKAP = '/api/rekap_data';
    const API_URL_PERIODES = '/api/rekap_all_periodes';

    const statusMessage = document.getElementById('statusMessage');
    const totalKaryawanEl = document.getElementById('totalKaryawan');
    const totalJamKerjaEl = document.getElementById('totalJamKerja');
    const periodeDitampilkanEl = document.getElementById('periodeDitampilkan');
    const periodeCetakEl = document.getElementById('periodeCetak');
    const tanggalCetakEl = document.getElementById('tanggalCetak');
    const kotaCetakEl = document.getElementById('kotaCetak'); 
    
    const periodeFilter = document.getElementById('periodeFilter');
    const refreshButton = document.getElementById('refreshButton');
    const btnCetakPDF = document.getElementById('btnCetakPDF');
    const btnExportCSV = document.getElementById('btnExportCSV');
    
    const tableBody = document.getElementById('rekapTableBody');
    const tableFooter = document.getElementById('rekapTableFooter');

    let currentRekapData = []; 

    // --- 🛑 PENTING: KONFIGURASI TANDA TANGAN FINAL ---
    const TTD_CONFIG = {
        kota: 'Lampung Timur', // Kota tempat laporan dibuat
        kepala: {
            // **GANTI DATA INI SESUAI INSTANSI ANDA**
            jabatan: 'Kepala Bagian Operasional',
            nama: 'NARUTO ',
            nip: '198001012005051001'
        },
        ktu: {
            // **GANTI DATA INI SESUAI INSTANSI ANDA**
            jabatan: 'Kepala Tata Usaha',
            nama: 'PAIJO',
            nip: '199002022010062002'
        }
    };


    // --- UTILITY FUNCTIONS ---
    function formatPeriode(periodeString) {
        if (!periodeString) return 'Semua Periode';
        const [year, month] = periodeString.split('-');
        const date = new Date(year, parseInt(month) - 1);
        const options = { year: 'numeric', month: 'long' };
        return date.toLocaleDateString('id-ID', options);
    }

    // Mengkonversi total detik ke format HH:MM:SS
    function secondsToHms(d) {
        d = Number(d);
        if (isNaN(d) || d < 0) d = 0;

        const h = Math.floor(d / 3600);
        const m = Math.floor(d % 3600 / 60);
        const s = Math.floor(d % 3600 % 60);

        const hDisplay = String(h).padStart(2, '0');
        const mDisplay = String(m).padStart(2, '0');
        const sDisplay = String(s).padStart(2, '0');
        
        return `${hDisplay}:${mDisplay}:${sDisplay}`;
    }

    // --- FETCH & POPULATE DATA ---
    async function fetchPeriodes() {
        // ... (Logika fetch periodes) ...
        try {
            const response = await fetch(API_URL_PERIODES);
            const result = await response.json();
            
            periodeFilter.innerHTML = '<option value="">Semua Periode</option>';
            if (result.success && result.data.length > 0) {
                result.data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.periode_bulan;
                    option.textContent = formatPeriode(item.periode_bulan);
                    periodeFilter.appendChild(option);
                });
            } else {
                periodeFilter.innerHTML = '<option value="">Tidak ada data periode</option>';
            }
        } catch (error) {
            console.error('Error fetching periodes:', error);
        }
    }


    async function fetchAndPopulateTable(periode = '') {
        tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Data sedang dimuat...</td></tr>';
        
        try {
            const url = periode ? `${API_URL_REKAP}?periode=${periode}` : API_URL_REKAP;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const result = await response.json();
            currentRekapData = result.data || [];
            
            let totalJamGlobalDecimal = 0;
            
            tableBody.innerHTML = ''; 
            tableFooter.innerHTML = ''; 

            if (result.success && currentRekapData.length > 0) {
                currentRekapData.forEach(row => {
                    const tr = document.createElement('tr');
                    const jamDecimal = parseFloat(row.total_jam_kerja_decimal) || 0;
                    
                    // Konversi jam desimal ke detik, lalu ke H:M:S
                    const totalSeconds = jamDecimal * 3600;
                    const hmsFormatted = secondsToHms(totalSeconds);

                    // 🛑 FINAL FIX: Menampilkan H:M:S (X.XX H) di satu kolom
                    tr.innerHTML = `
                        <td>${row.id_karyawan}</td>
                        <td>${row.nama}</td>
                        <td>${formatPeriode(row.periode_bulan)}</td>
                        <td class="text-end fw-bold">${hmsFormatted} (${jamDecimal.toFixed(2)} H)</td>
                    `;
                    tableBody.appendChild(tr);
                    
                    totalJamGlobalDecimal += jamDecimal;
                });
                
                // --- Footer (Total Keseluruhan) ---
                const trFooter = document.createElement('tr');
                trFooter.className = 'table-success fw-bold';
                
                const globalTotalSeconds = totalJamGlobalDecimal * 3600;
                const globalHmsFormatted = secondsToHms(globalTotalSeconds);

                trFooter.innerHTML = `
                    <td colspan="3" class="text-end">TOTAL KESELURUHAN</td>
                    <td class="text-end">${globalHmsFormatted} (${totalJamGlobalDecimal.toFixed(2)} H)</td>
                `;
                tableFooter.appendChild(trFooter);

                // --- UPDATE CARD DASHBOARD ---
                totalKaryawanEl.textContent = currentRekapData.length;
                totalJamKerjaEl.textContent = `${globalHmsFormatted} (${totalJamGlobalDecimal.toFixed(2)} H)`;
                
                const periodeName = periode ? formatPeriode(periode) : 'Semua Periode';
                periodeDitampilkanEl.textContent = periodeName;
                periodeCetakEl.textContent = periodeName;
                
                statusMessage.className = 'alert alert-success';
                statusMessage.innerHTML = `<i class="fas fa-check-circle me-2"></i> Total ${currentRekapData.length} laporan karyawan berhasil dimuat.`;

            } else {
                // ... (Logika data kosong) ...
                tableBody.innerHTML = '<tr><td colspan="4" class="text-center">Tidak ada data untuk periode ini.</td></tr>';
                totalKaryawanEl.textContent = 0;
                totalJamKerjaEl.textContent = '0.00 H';
                periodeDitampilkanEl.textContent = periode ? formatPeriode(periode) : 'Semua Periode';
                
                statusMessage.className = 'alert alert-warning';
                statusMessage.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> Tidak ada data rekap ditemukan.`;
            }

        } catch (error) {
            // ... (Logika error) ...
            console.error('Error fetching data:', error);
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Gagal memuat data. Cek koneksi server/API.</td></tr>';
        }
    }

    // --- EVENT LISTENERS ---
    
    refreshButton.addEventListener('click', () => fetchAndPopulateTable(periodeFilter.value));
    periodeFilter.addEventListener('change', () => fetchAndPopulateTable(periodeFilter.value));

    // 2. Cetak Laporan (PDF)
    btnCetakPDF.addEventListener('click', () => {
        const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
        
        // 🛑 MENGISI ELEMEN TANDA TANGAN sebelum mencetak
        kotaCetakEl.textContent = TTD_CONFIG.kota; 
        tanggalCetakEl.textContent = new Date().toLocaleDateString('id-ID', dateOptions);

        document.getElementById('jabatanKepala').textContent = TTD_CONFIG.kepala.jabatan;
        document.getElementById('namaKepala').textContent = TTD_CONFIG.kepala.nama;
        document.getElementById('nipKepala').textContent = TTD_CONFIG.kepala.nip;
        
        document.getElementById('jabatanKtu').textContent = TTD_CONFIG.ktu.jabatan;
        document.getElementById('namaKtu').textContent = TTD_CONFIG.ktu.nama;
        document.getElementById('nipKtu').textContent = TTD_CONFIG.ktu.nip;
        
        window.print();
    });

    // 3. Ekspor ke CSV
    btnExportCSV.addEventListener('click', () => {
        if (currentRekapData.length === 0) {
            alert('Tidak ada data untuk diekspor.');
            return;
        }
        
        let csv = 'ID KARYAWAN,NAMA,PERIODE BULAN,TOTAL JAM KERJA (H:M:S),TOTAL JAM KERJA (Decimal H)\n';
        currentRekapData.forEach(row => {
            const periodeFormatted = formatPeriode(row.periode_bulan);
            const jamDecimal = parseFloat(row.total_jam_kerja_decimal).toFixed(2);
            
            const totalSeconds = parseFloat(row.total_jam_kerja_decimal) * 3600;
            const hmsFormatted = secondsToHms(totalSeconds);
            
            csv += `${row.id_karyawan},${row.nama},${periodeFormatted},${hmsFormatted},${jamDecimal}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const periodeExport = periodeFilter.value ? formatPeriode(periodeFilter.value).replace(/\s/g, '_') : 'Semua_Periode';
        link.setAttribute('href', url);
        link.setAttribute('download', `Rekap_Absensi_${periodeExport}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // --- INISIALISASI ---
    fetchPeriodes();
    fetchAndPopulateTable();
});