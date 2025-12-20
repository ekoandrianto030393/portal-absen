/**
 * rekap.js - Logic untuk Halaman Rekapitulasi
 * Mengambil data real-time dari server.js (Tabel Absensi)
 */

const periodeSelect = document.getElementById('periodeSelect');
const tableBody = document.getElementById('rekapTableBody');
const totalRecordsDisplay = document.getElementById('totalRecords');
const grandTotalHoursDisplay = document.getElementById('grandTotalHours');
const loadingIndicator = document.getElementById('loadingIndicator');
const btnRefresh = document.getElementById('btnRefresh');
const btnPrint = document.getElementById('btnPrint');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const pageStartDisplay = document.getElementById('pageStart');
const pageEndDisplay = document.getElementById('pageEnd');
const totalItemsDisplay = document.getElementById('totalItems');

let allData = []; // Menyimpan semua data untuk pagination
let currentPage = 1;
const rowsPerPage = 10;

// Format angka desimal
const formatDecimal = (num) => parseFloat(num).toFixed(2);

// Fungsi Fetch Data Periode
async function loadPeriods() {
    try {
        const response = await fetch('/api/rekap_all_periodes');
        const result = await response.json();
        
        periodeSelect.innerHTML = '';
        
        if (result.success && result.data.length > 0) {
            result.data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.periode_bulan;
                option.textContent = formatPeriodeLabel(item.periode_bulan);
                periodeSelect.appendChild(option);
            });
            // Pilih periode terbaru secara otomatis
            periodeSelect.selectedIndex = 0;
            loadRekapData(periodeSelect.value);
        } else {
            const option = document.createElement('option');
            option.textContent = "TIDAK ADA DATA";
            periodeSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Error loading periods:', error);
        alert('Gagal memuat daftar periode.');
    }
}

// Helper: Ubah "2023-10" jadi "Oktober 2023"
function formatPeriodeLabel(yyyymm) {
    const [year, month] = yyyymm.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }).toUpperCase();
}

// Fungsi Fetch Data Rekap Utama
async function loadRekapData(periode) {
    if (!periode) return;
    
    showLoading(true);
    try {
        const response = await fetch(`/api/rekap_data?periode=${periode}`);
        const result = await response.json();

        if (result.success && result.data.length > 0) {
            allData = result.data;
            currentPage = 1; // Reset ke halaman pertama
            renderTable();
        } else {
            allData = [];
            renderTable();
        }
    } catch (error) {
        console.error('Error loading rekap data:', error);
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-red-500 font-bold">Gagal Menghubungi Server</td></tr>`;
    } finally {
        showLoading(false);
    }
}

function renderTable() {
    tableBody.innerHTML = '';
    
    // Hitung Total Keseluruhan
    let grandTotal = 0;
    allData.forEach(row => grandTotal += parseFloat(row.total_jam_kerja_decimal));
    
    totalRecordsDisplay.textContent = allData.length;
    grandTotalHoursDisplay.textContent = formatDecimal(grandTotal);
    totalItemsDisplay.textContent = allData.length;

    // Logika Pagination
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = allData.slice(start, end);
    
    pageStartDisplay.textContent = allData.length > 0 ? start + 1 : 0;
    pageEndDisplay.textContent = Math.min(end, allData.length);

    if (paginatedData.length > 0) {
        paginatedData.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-emerald-50 transition-colors text-sm even:bg-slate-50';
            
            const jamDecimal = parseFloat(row.total_jam_kerja_decimal);

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap font-medium text-gray-900">${row.id_karyawan}</td>
                <td class="px-6 py-4 whitespace-nowrap text-gray-700">${row.nama}</td>
                <td class="px-6 py-4 whitespace-nowrap text-center text-gray-500">${row.periode_bulan}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-mono">${formatDecimal(jamDecimal)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-gray-500 font-mono">${row.total_jam_kerja_hms || '00:00:00'}</td>
            `;
            tableBody.appendChild(tr);
        });
    } else {
        tableBody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-gray-500 italic">Tidak ada data absensi untuk periode ini.</td></tr>`;
    }

    // Update Status Tombol Pagination
    btnPrev.disabled = currentPage === 1;
    btnNext.disabled = end >= allData.length;
    
    // Visual Feedback untuk tombol disabled
    btnPrev.classList.toggle('opacity-50', currentPage === 1);
    btnPrev.classList.toggle('cursor-not-allowed', currentPage === 1);
    btnNext.classList.toggle('opacity-50', end >= allData.length);
    btnNext.classList.toggle('cursor-not-allowed', end >= allData.length);
}

function showLoading(show) {
    if (show) loadingIndicator.classList.remove('hidden');
    else loadingIndicator.classList.add('hidden');
}

// Event Listeners
periodeSelect.addEventListener('change', (e) => loadRekapData(e.target.value));
btnRefresh.addEventListener('click', () => loadRekapData(periodeSelect.value));

btnPrev.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});

btnNext.addEventListener('click', () => {
    if ((currentPage * rowsPerPage) < allData.length) {
        currentPage++;
        renderTable();
    }
});

btnPrint.addEventListener('click', () => {
    window.print();
});

// Init
document.addEventListener('DOMContentLoaded', loadPeriods);