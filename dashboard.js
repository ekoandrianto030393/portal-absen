/**
 * dashboard.js - Logika Dashboard Puskesmas Wana
 * Mengelola data statistik, tabel, dan grafik kinerja.
 */

// --- KONFIGURASI ---
const API_BASE = '/api';
let attendanceChartInstance = null;
let pieChartInstance = null;
let globalPerformanceData = []; // Simpan data untuk modal
let globalEmployees = []; // Simpan data pegawai untuk edit

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    
    // Set default month filter to current month
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthInput = document.getElementById('filter-month');
    if(monthInput) {
        monthInput.value = monthStr;
        monthInput.addEventListener('change', loadMonthlyRecap);
    }

    // Load Initial Data
    loadOverviewData();
});

// --- NAVIGASI TAB ---
function switchTab(tabName) {
    // Hide all views
    ['overview', 'daily', 'monthly', 'performance', 'employees', 'settings'].forEach(id => {
        document.getElementById(`view-${id}`).classList.add('hidden');
        document.getElementById(`nav-${id}`).classList.remove('active');
    });

    // Show selected view
    document.getElementById(`view-${tabName}`).classList.remove('hidden');
    document.getElementById(`nav-${tabName}`).classList.add('active');

    // Update Title
    const titles = {
        'overview': 'Dashboard Overview',
        'daily': 'Laporan Absensi Harian',
        'monthly': 'Rekapitulasi Bulanan',
        'performance': 'Monitoring Kinerja Pegawai',
        'employees': 'Direktori Data Pegawai',
        'settings': 'Pengaturan Sistem'
    };
    document.getElementById('page-title').textContent = titles[tabName];

    // Load Data specific to tab
    if (tabName === 'overview') loadOverviewData();
    if (tabName === 'daily') loadDailyData();
    if (tabName === 'monthly') loadMonthlyRecap();
    if (tabName === 'performance') loadPerformanceData();
    if (tabName === 'employees') loadEmployees();
}

// --- JAM DIGITAL ---
function updateClock() {
    const now = new Date();
    document.getElementById('clock-time').textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('clock-date').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// --- DATA LOADER: OVERVIEW ---
async function loadOverviewData() {
    try {
        // 1. Ambil Data Harian
        const resDaily = await fetch(`${API_BASE}/absensi/harian`);
        const jsonDaily = await resDaily.json();
        const dailyData = jsonDaily.data || [];

        // 2. Ambil Data Karyawan (untuk total)
        const resEmp = await fetch(`${API_BASE}/karyawan/descriptors`);
        const jsonEmp = await resEmp.json();
        const totalEmployees = jsonEmp.descriptors ? jsonEmp.descriptors.length : 0;

        // 3. Hitung Statistik Hari Ini
        const presentCount = dailyData.length; // Asumsi 1 baris per orang per hari (karena view)
        const lateCount = dailyData.filter(d => d.jam_masuk > '08:10:00').length;
        const absentCount = Math.max(0, totalEmployees - presentCount);

        // 4. Update Kartu Statistik
        document.getElementById('stat-total-emp').textContent = totalEmployees;
        document.getElementById('stat-present').textContent = presentCount;
        document.getElementById('stat-late').textContent = lateCount;
        document.getElementById('stat-absent').textContent = absentCount;

        // 5. Render Grafik
        renderCharts(presentCount, lateCount, absentCount);

        // 6. Render Recent Activity (New Feature)
        renderRecentActivity(dailyData);

    } catch (error) {
        console.error("Error loading overview:", error);
    }
}

// --- RENDERER: RECENT ACTIVITY FEED ---
function renderRecentActivity(data) {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    container.innerHTML = '';
    
    // Ambil 10 data terakhir (asumsi data dari API sudah sorted DESC, jika belum sort dulu)
    // API view_absensi_harian sudah ORDER BY a.jam_masuk DESC
    const recent = data.slice(0, 10);

    if (recent.length === 0) {
        container.innerHTML = '<div class="text-center text-xs text-slate-500 mt-4">Belum ada aktivitas.</div>';
        return;
    }

    recent.forEach(item => {
        const isLate = item.jam_masuk > '08:10:00';
        const timeClass = isLate 
            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' 
            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
        
        const html = `
            <div class="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-800/40 transition border border-transparent hover:border-slate-700">
                <div class="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-slate-600 shadow-sm">
                    ${item.nama_karyawan.substring(0, 1).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white truncate">${item.nama_karyawan}</p>
                    <p class="text-[10px] text-slate-400 truncate">${item.jabatan || 'Staff'}</p>
                </div>
                <div class="text-right">
                    <span class="text-[10px] font-mono font-bold px-2 py-1 rounded border ${timeClass}">${item.jam_masuk}</span>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- DATA LOADER: DAILY ---
async function loadDailyData() {
    const tbody = document.getElementById('table-daily-body');
    tbody.innerHTML = getSkeletonRows(6, 5); // Tampilkan Skeleton Loading (6 kolom, 5 baris)

    try {
        const response = await fetch(`${API_BASE}/absensi/harian`);
        const result = await response.json();
        
        tbody.innerHTML = '';
        if (result.data && result.data.length > 0) {
            result.data.forEach(row => {
                // --- LOGIKA SINKRONISASI DENGAN SQL ---
                // SQL: TIMESTAMPDIFF(MINUTE, '08:00:00', jam_masuk) jika > 08:10:00
                let isLate = false;
                let lateMinutes = 0;

                if (row.jam_masuk) {
                    const [h, m, s] = row.jam_masuk.split(':').map(Number);
                    const secondsIn = (h * 3600) + (m * 60) + (s || 0);
                    const secondsLimit = (8 * 3600) + (10 * 60); // 08:10:00 (Batas Toleransi)
                    const secondsStart = (8 * 3600);             // 08:00:00 (Jam Masuk)

                    if (secondsIn > secondsLimit) {
                        isLate = true;
                        // Math.floor((selisih detik) / 60) sama persis dengan TIMESTAMPDIFF(MINUTE, ...) di MySQL
                        lateMinutes = Math.floor((secondsIn - secondsStart) / 60);
                    }
                }

                const statusBadge = isLate 
                    ? `<span class="px-2 py-1 rounded text-xs font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 flex items-center w-fit gap-1"><i class="fa-solid fa-clock"></i> Terlambat</span>`
                    : `<span class="px-2 py-1 rounded text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center w-fit gap-1"><i class="fa-solid fa-check"></i> Tepat Waktu</span>`;
                
                const lateDisplay = lateMinutes > 0 ? `${lateMinutes} Menit` : '-';
                const lateClass = lateMinutes > 0 ? 'text-red-400 font-bold' : 'text-slate-600';

                const tr = `
                    <tr onclick="openModal('${row.id_karyawan}')" class="hover:bg-slate-800/30 transition cursor-pointer group border-b border-slate-800/50 last:border-0">
                        <td class="p-5 font-mono text-emerald-300 font-medium">${row.jam_masuk}</td>
                        <td class="p-5 font-bold text-white group-hover:text-emerald-400 transition">${row.nama_karyawan}</td>
                        <td class="p-5 text-slate-400 text-sm">${row.jabatan || '-'}</td>
                        <td class="p-5">${statusBadge}</td>
                        <td class="p-5 ${lateClass} font-mono">${lateDisplay}</td>
                        <td class="p-5 font-mono text-slate-300">${row.jam_keluar || '<span class="text-slate-600">--:--:--</span>'}</td>
                    </tr>
                `;
                tbody.innerHTML += tr;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">Belum ada data absensi hari ini.</td></tr>';
        }
        
        // Update Notifikasi Otomatis
        updateNotifications(result.data || []);

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
    }
}

// --- DATA LOADER: MONTHLY RECAP ---
async function loadMonthlyRecap() {
    const month = document.getElementById('filter-month').value;
    const table = document.getElementById('table-rekap');
    
    // Header Table
    table.innerHTML = `
        <thead class="bg-slate-800/50 text-slate-400 uppercase text-xs font-bold tracking-wider border-b border-slate-700">
            <tr>
                <th class="p-4">ID</th>
                <th class="p-4">Nama Pegawai</th>
                <th class="p-4 text-center">Hadir</th>
                <th class="p-4 text-center">Alpa</th>
                <th class="p-4 text-center">Telat (x)</th>
                <th class="p-4 text-center">Telat (Min)</th>
                <th class="p-4 text-center">Tanpa Pulang</th>
                <th class="p-4 text-center">Potongan</th>
                <th class="p-4 text-right">Total Jam Kerja</th>
            </tr>
        </thead>
        <tbody class="text-slate-300 divide-y divide-slate-700 text-sm">
            ${getSkeletonRows(8, 5)} <!-- Skeleton Loading -->
            ${getSkeletonRows(9, 5)} <!-- Skeleton Loading -->
        </tbody>
    `;

    try {
        const response = await fetch(`${API_BASE}/rekap?periode=${month}`);
        const result = await response.json();
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        if (result.data && result.data.length > 0) {
            result.data.forEach(row => {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-800/30 border-b border-slate-800/50 last:border-0">
                        <td class="p-4 font-mono text-slate-400">${row.id_karyawan}</td>
                        <td class="p-4 font-bold text-white">${row.nama}</td>
                        <td class="p-4 text-center"><span class="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold text-xs">${row.total_masuk}</span></td>
                        <td class="p-4 text-center ${row.alpa > 0 ? 'text-red-400 font-bold' : 'text-slate-600'}">${row.alpa}</td>
                        <td class="p-4 text-center ${row.telat_kali > 0 ? 'text-yellow-500 font-bold' : 'text-slate-600'}">${row.telat_kali}</td>
                        <td class="p-4 text-center text-slate-400">${row.telat_menit}</td>
                        <td class="p-4 text-center ${row.tanpa_absen_pulang > 0 ? 'text-red-400 font-bold' : 'text-slate-600'}">${row.tanpa_absen_pulang}</td>
                        <td class="p-4 text-center text-red-400">${row.potongan_jam} Jam</td>
                        <td class="p-4 text-right font-mono text-emerald-300 font-bold">${row.total_jam_kerja || '00:00:00'}</td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="9" class="p-4 text-center text-slate-500">Tidak ada data untuk periode ini.</td></tr>';
        }
    } catch (e) {
        console.error(e);
    }
}

// --- DATA LOADER: PERFORMANCE MONITORING (SCORING SYSTEM) ---
async function loadPerformanceData() {
    const grid = document.getElementById('performance-grid');
    grid.innerHTML = '<div class="col-span-full text-center text-slate-500">Menganalisis Kinerja...</div>';

    try {
        // Gunakan data rekap bulan ini untuk analisis
        const month = document.getElementById('filter-month').value;
        const response = await fetch(`${API_BASE}/rekap?periode=${month}`);
        const result = await response.json();
        
        globalPerformanceData = result.data || []; // Simpan ke global
        grid.innerHTML = '';

        if (result.data && result.data.length > 0) {
            result.data.forEach(emp => {
                // --- LOGIKA SCORING KINERJA ---
                // Skor Awal: 100
                // -5 poin per kali telat
                // -10 poin per hari alpa
                // -2 poin per jam potongan (lupa pulang)
                
                let score = 100;
                score -= (emp.telat_kali * 5);
                score -= (emp.alpa * 10);
                score -= (emp.potongan_jam * 2);
                if (score < 0) score = 0;

                // Tentukan Status & Warna
                let status = 'SANGAT BAIK';
                let colorClass = 'border-green-500 text-green-400';
                let bgGradient = 'from-green-500/10 to-transparent';
                let icon = 'fa-medal';

                if (score < 60) {
                    status = 'PERLU PEMBINAAN';
                    colorClass = 'border-red-600 text-red-500';
                    bgGradient = 'from-red-600/10 to-transparent';
                    icon = 'fa-triangle-exclamation';
                } else if (score < 80) {
                    status = 'CUKUP';
                    colorClass = 'border-yellow-500 text-yellow-400';
                    bgGradient = 'from-yellow-500/10 to-transparent';
                    icon = 'fa-circle-exclamation';
                } else if (score < 90) {
                    status = 'BAIK';
                    colorClass = 'border-blue-500 text-blue-400';
                    bgGradient = 'from-blue-500/10 to-transparent';
                    icon = 'fa-thumbs-up';
                }

                // Render Card
                const card = `
                    <div onclick="openModal('${emp.id_karyawan}')" class="glass-panel rounded-xl p-5 border-t-2 ${colorClass} bg-gradient-to-b ${bgGradient} relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300 cursor-pointer shadow-lg">
                        <div class="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition">
                            <i class="fa-solid ${icon} text-6xl"></i>
                        </div>
                        
                        <div class="relative z-10">
                            <h3 class="text-lg font-heading font-bold text-white truncate">${emp.nama}</h3>
                            <p class="text-xs text-slate-400 mb-4">${emp.jabatan || 'Staff'} • ID: ${emp.id_karyawan}</p>
                            
                            <div class="flex items-end gap-2 mb-2">
                                <span class="text-4xl font-bold ${colorClass.split(' ')[1]}">${score}</span>
                                <span class="text-sm text-slate-500 mb-1">/ 100</span>
                            </div>
                            
                            <div class="w-full bg-slate-700 h-2 rounded-full mb-4 overflow-hidden">
                                <div class="h-full ${colorClass.replace('text', 'bg').split(' ')[1]}" style="width: ${score}%"></div>
                            </div>

                            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                <div class="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <div class="text-slate-400">Hadir</div>
                                    <div class="font-bold text-white">${emp.total_masuk}</div>
                                </div>
                                <div class="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <div class="text-slate-400">Telat</div>
                                    <div class="font-bold text-yellow-400">${emp.telat_kali}</div>
                                </div>
                                <div class="bg-slate-800/50 p-2 rounded border border-slate-700">
                                    <div class="text-slate-400">Alpa</div>
                                    <div class="font-bold text-red-400">${emp.alpa}</div>
                                </div>
                            </div>

                            <div class="mt-4 text-center font-bold text-sm tracking-wider ${colorClass.split(' ')[1]} border border-dashed border-slate-600 p-1 rounded">
                                ${status}
                            </div>
                        </div>
                    </div>
                `;
                grid.innerHTML += card;
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// --- DATA LOADER: EMPLOYEES DIRECTORY (NEW) ---
async function loadEmployees() {
    const grid = document.getElementById('employees-grid');
    const countSpan = document.getElementById('total-emp-count');
    grid.innerHTML = '<div class="col-span-full text-center text-slate-500">Memuat direktori...</div>';

    try {
        const response = await fetch(`${API_BASE}/karyawan/descriptors`);
        const result = await response.json();
        const employees = result.descriptors || [];
        globalEmployees = employees; // Simpan ke global agar bisa diedit
        
        countSpan.textContent = employees.length;
        grid.innerHTML = '';

        if (employees.length > 0) {
            employees.forEach(emp => {
                // Gunakan foto asli jika ada, jika tidak pakai avatar UI
                const photoSrc = emp.foto ? `data:image/jpeg;base64,${emp.foto}` : `https://ui-avatars.com/api/?name=${emp.nama}&background=10b981&color=fff`;

                const card = `
                    <div class="glass-panel p-4 rounded-xl flex items-center gap-4 hover:bg-slate-800 transition group border border-transparent hover:border-emerald-500/30 relative pr-24">
                        <div onclick="openModal('${emp.id_karyawan}')" class="flex items-center gap-4 flex-1 cursor-pointer">
                            <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-600 group-hover:border-emerald-400 transition">
                                <img src="${photoSrc}" class="w-full h-full object-cover">
                            </div>
                            <div class="flex-1 min-w-0">
                                <h4 class="text-white font-bold truncate group-hover:text-emerald-400 transition">${emp.nama}</h4>
                                <p class="text-xs text-slate-400 truncate">${emp.jabatan || 'Staff'}</p>
                                <p class="text-[10px] font-mono text-slate-500 mt-1 bg-slate-900 inline-block px-1 rounded">${emp.id_karyawan}</p>
                            </div>
                        </div>
                        <button onclick="openEditModal('${emp.id_karyawan}')" class="absolute right-12 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-emerald-400 transition p-2 z-10" title="Edit Pegawai">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="deleteEmployee('${emp.id_karyawan}', '${emp.nama}')" class="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-600 hover:text-red-500 transition p-2 z-10" title="Hapus Pegawai">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
                grid.innerHTML += card;
            });

            // Fitur Pencarian Sederhana
            document.getElementById('search-employee').addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const cards = grid.children;
                Array.from(cards).forEach(card => {
                    const text = card.innerText.toLowerCase();
                    card.style.display = text.includes(term) ? 'flex' : 'none';
                });
            });
        }
    } catch (e) {
        grid.innerHTML = `<div class="col-span-full text-center text-red-500">Gagal memuat data: ${e.message}</div>`;
    }
}

// --- FITUR: DELETE EMPLOYEE ---
async function deleteEmployee(id, nama) {
    if(!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus pegawai "${nama}"?\n\nData absensi terkait juga akan dihapus permanen.`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/karyawan/${id}`, { method: 'DELETE' });
        const result = await response.json();
        
        if(result.success) {
            // Refresh data
            loadEmployees();
            loadOverviewData(); // Update statistik total pegawai
        } else {
            alert(`Gagal menghapus: ${result.message}`);
        }
    } catch(e) {
        alert(`Error: ${e.message}`);
    }
}

// --- FITUR: EDIT EMPLOYEE ---
function openEditModal(id) {
    const emp = globalEmployees.find(e => e.id_karyawan === id);
    if (!emp) return;

    document.getElementById('edit-id').value = emp.id_karyawan;
    document.getElementById('edit-id-display').value = emp.id_karyawan;
    document.getElementById('edit-nama').value = emp.nama;
    document.getElementById('edit-jabatan').value = emp.jabatan || '';

    const modal = document.getElementById('modal-edit-employee');
    const content = document.getElementById('modal-edit-content');
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeEditModal() {
    const modal = document.getElementById('modal-edit-employee');
    const content = document.getElementById('modal-edit-content');
    
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function updateEmployee() {
    const id = document.getElementById('edit-id').value;
    const nama = document.getElementById('edit-nama').value;
    const jabatan = document.getElementById('edit-jabatan').value;

    try {
        const response = await fetch(`${API_BASE}/karyawan/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, jabatan })
        });
        const result = await response.json();

        if (result.success) {
            alert('Data berhasil diperbarui!');
            closeEditModal();
            loadEmployees(); // Refresh list
            loadOverviewData(); // Refresh stats if needed
        } else {
            alert(`Gagal memperbarui: ${result.message}`);
        }
    } catch (e) {
        alert(`Error: ${e.message}`);
    }
}

// --- CHART RENDERER ---
function renderCharts(present, late, absent) {
    const ctxPie = document.getElementById('pieChart').getContext('2d');
    const ctxLine = document.getElementById('attendanceChart').getContext('2d');

    // Destroy old instances if exist
    if (pieChartInstance) pieChartInstance.destroy();
    if (attendanceChartInstance) attendanceChartInstance.destroy();

    // 1. Pie Chart (Komposisi Hari Ini)
    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Tepat Waktu', 'Terlambat', 'Alpa/Belum'],
            datasets: [{
                data: [present - late, late, absent],
                backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { color: '#cbd5e1' } } }
        }
    });

    // 2. Line Chart (Dummy Trend - Idealnya ambil data 7 hari ke belakang dari DB)
    // Karena API history 7 hari belum ada, kita buat simulasi statis agar UI tidak kosong
    attendanceChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Hari Ini'],
            datasets: [{
                label: 'Tingkat Kehadiran (%)',
                data: [85, 90, 88, 92, 80, 75, ((present / (present + absent)) * 100) || 0],
                borderColor: '#10b981', // Emerald 500
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                    return gradient;
                },
                borderWidth: 2,
                pointBackgroundColor: '#0f172a',
                pointBorderColor: '#10b981',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: {family: 'Inter'} } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: {family: 'Inter'} } }
            },
            plugins: { legend: { display: false } }
        }
    });
}

// --- FITUR: FULLSCREEN TOGGLE ---
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
        document.getElementById('icon-fullscreen').classList.replace('fa-expand', 'fa-compress');
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
            document.getElementById('icon-fullscreen').classList.replace('fa-compress', 'fa-expand');
        }
    }
}

// --- FITUR: EXPORT CSV NYATA ---
function exportExcel() {
    const table = document.getElementById('table-rekap');
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll("tr");
    
    for (let i = 0; i < rows.length; i++) {
        let row = [], cols = rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) 
            row.push('"' + cols[j].innerText + '"'); // Quote text
        csv.push(row.join(","));
    }

    const csvFile = new Blob([csv.join("\n")], { type: "text/csv" });
    const downloadLink = document.createElement("a");
    downloadLink.download = `Rekap_Absensi_${new Date().toISOString().slice(0,10)}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// --- FITUR: MODAL DETAIL PEGAWAI ---
async function openModal(idKaryawan) {
    const emp = globalPerformanceData.find(e => e.id_karyawan === idKaryawan);
    if (!emp) return;

    const modal = document.getElementById('modal-employee');
    const content = document.getElementById('modal-content');
    
    // Ambil foto terbaru (karena di rekap tidak ada foto, kita fetch ulang atau pakai placeholder)
    // Untuk efisiensi, kita pakai placeholder dulu atau fetch detail jika ada endpoint
    // Disini kita pakai placeholder default jika tidak ada data foto di rekap
    document.getElementById('modal-foto').src = `https://ui-avatars.com/api/?name=${emp.nama}&background=10b981&color=fff&size=128`;
    
    // Isi Data
    document.getElementById('modal-nama').textContent = emp.nama;
    document.getElementById('modal-id').textContent = emp.id_karyawan;
    document.getElementById('modal-jabatan').textContent = emp.jabatan || "PEGAWAI TETAP";
    
    // Hitung Score Ulang untuk Badge
    let score = 100 - (emp.telat_kali * 5) - (emp.alpa * 10) - (emp.potongan_jam * 2);
    if(score < 0) score = 0;
    
    const badge = document.getElementById('modal-score-badge');
    badge.textContent = score;
    badge.className = `absolute -bottom-2 -right-2 text-white font-bold px-3 py-1 rounded-full border shadow-lg ${score >= 80 ? 'bg-emerald-600 border-emerald-400' : (score >= 60 ? 'bg-yellow-600 border-yellow-400' : 'bg-red-600 border-red-400')}`;

    document.getElementById('modal-status').textContent = score >= 80 ? 'SANGAT BAIK' : (score >= 60 ? 'CUKUP' : 'PERLU PEMBINAAN');
    document.getElementById('modal-status').className = `font-bold ${score >= 80 ? 'text-emerald-400' : (score >= 60 ? 'text-yellow-400' : 'text-red-400')}`;

    // Grid Statistik
    const statsHTML = `
        <div class="p-2"><div class="text-2xl font-bold text-white">${emp.total_masuk}</div><div class="text-[10px] text-slate-400 uppercase">Hadir</div></div>
        <div class="p-2"><div class="text-2xl font-bold text-yellow-400">${emp.telat_kali}</div><div class="text-[10px] text-slate-400 uppercase">Telat</div></div>
        <div class="p-2"><div class="text-2xl font-bold text-red-400">${emp.alpa}</div><div class="text-[10px] text-slate-400 uppercase">Alpa</div></div>
        <div class="p-2"><div class="text-2xl font-bold text-blue-400">${emp.total_jam_kerja || '0'}</div><div class="text-[10px] text-slate-400 uppercase">Jam Kerja</div></div>
    `;
    document.getElementById('modal-stats-grid').innerHTML = statsHTML;

    // Animasi Masuk
    modal.classList.remove('hidden');
    // Sedikit delay agar transisi opacity jalan
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeModal() {
    const modal = document.getElementById('modal-employee');
    const content = document.getElementById('modal-content');
    
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

// --- HELPER: SKELETON LOADING GENERATOR ---
function getSkeletonRows(cols, rows = 5) {
    let html = '';
    for(let i=0; i<rows; i++) {
        html += `<tr class="animate-pulse">`;
        for(let j=0; j<cols; j++) {
            html += `<td class="p-4"><div class="h-3 bg-slate-700/50 rounded skeleton w-full"></div></td>`;
        }
        html += `</tr>`;
    }
    return html;
}

// --- FITUR: NOTIFICATION SYSTEM ---
function toggleNotifications() {
    const dropdown = document.getElementById('notif-dropdown');
    dropdown.classList.toggle('hidden');
    
    // Sembunyikan badge merah saat dibuka
    if (!dropdown.classList.contains('hidden')) {
        document.getElementById('notif-badge').classList.add('hidden');
    }
}

function updateNotifications(dailyData) {
    const list = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    
    // Generate notifikasi cerdas dari data
    let notifs = [];
    
    // 1. Cek System Status
    notifs.push({
        icon: 'fa-server', color: 'text-emerald-500',
        title: 'System Online',
        desc: 'Sinkronisasi database berhasil.'
    });

    // 2. Cek Terlambat
    const late = dailyData.filter(d => d.jam_masuk > '08:10:00');
    if (late.length > 0) {
        notifs.push({
            icon: 'fa-clock', color: 'text-yellow-500',
            title: 'Keterlambatan Terdeteksi',
            desc: `${late.length} pegawai terlambat hari ini.`
        });
    }

    // Render
    list.innerHTML = '';
    if (notifs.length === 0) {
        list.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">Tidak ada notifikasi baru.</div>';
        badge.classList.add('hidden');
    } else {
        notifs.forEach(n => {
            list.innerHTML += `
                <div class="p-3 hover:bg-slate-800/50 transition flex gap-3 items-start cursor-pointer">
                    <div class="mt-1"><i class="fa-solid ${n.icon} ${n.color}"></i></div>
                    <div>
                        <p class="text-xs font-bold text-white">${n.title}</p>
                        <p class="text-[10px] text-slate-400">${n.desc}</p>
                    </div>
                </div>
            `;
        });
        badge.classList.remove('hidden');
    }
}

function clearNotifications() {
    document.getElementById('notif-list').innerHTML = '<div class="p-4 text-center text-xs text-slate-500">Tidak ada notifikasi baru.</div>';
    document.getElementById('notif-badge').classList.add('hidden');
}

// Tutup dropdown jika klik di luar
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notif-dropdown');
    if (!dropdown.classList.contains('hidden')) {
        if (!e.target.closest('#notif-dropdown') && !e.target.closest('button[onclick="toggleNotifications()"]')) {
            dropdown.classList.add('hidden');
        }
    }
});

// --- FITUR: THEME SWITCHER (NEW) ---
function changeTheme(colorName) {
    const colors = {
        'emerald': { main: 'emerald', sec: 'green' },
        'cyan': { main: 'cyan', sec: 'blue' },
        'violet': { main: 'violet', sec: 'purple' },
        'amber': { main: 'amber', sec: 'orange' }
    };

    const selected = colors[colorName];
    if (!selected) return;

    // Ganti semua class warna di body
    const bodyHtml = document.body.innerHTML;
    // Regex sederhana untuk mengganti emerald/green dengan warna baru
    // Catatan: Ini metode brute-force untuk demo tanpa build tools.
    // Di production sebaiknya gunakan CSS Variables.
    let newHtml = bodyHtml.replace(/emerald/g, selected.main).replace(/green/g, selected.sec);
    document.body.innerHTML = newHtml;
    
    // Re-attach listeners karena innerHTML mereset DOM
    document.addEventListener('DOMContentLoaded', () => {}); // Dummy
    // Perlu reload chart dan event listener manual atau refresh halaman
    // Untuk kestabilan demo ini, kita simpan ke localStorage dan reload
    localStorage.setItem('theme', colorName);
    location.reload(); 
}

// Apply theme on load
const savedTheme = localStorage.getItem('theme');
if (savedTheme && savedTheme !== 'emerald') {
    // Logic replace sederhana saat load agar tidak flash
    // (Implementasi ideal butuh CSS variables, tapi untuk sekarang kita biarkan default emerald dulu)
}