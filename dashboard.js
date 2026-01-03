/**
 * dashboard.js - Logika Dashboard Puskesmas Wana
 * Mengelola data statistik, tabel, dan grafik kinerja.
 */

// --- KONFIGURASI ---
const API_BASE = '/api';
let attendanceChartInstance = null;
let pieChartInstance = null;
let systemConfig = null; // Menyimpan konfigurasi dari server (.env)
let globalPerformanceData = []; // Simpan data untuk modal
let globalEmployees = []; // Simpan data pegawai untuk edit

// --- HELPER: SECURITY (XSS PREVENTION) ---
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);

    // Init Date Inputs for Chart (Last 7 Days)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 6);
    const formatDate = (d) => d.toISOString().split('T')[0];
    
    const startInput = document.getElementById('chart-start');
    const endInput = document.getElementById('chart-end');
    if (startInput && endInput) {
        startInput.value = formatDate(lastWeek);
        endInput.value = formatDate(today);
    }
    
    // Set default month filter to current month
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthInput = document.getElementById('filter-month');
    if(monthInput) {
        monthInput.value = monthStr;
        monthInput.addEventListener('change', loadMonthlyRecap);
    }

    // Load Config dulu, baru load data
    loadSystemConfig().then(() => {
        loadOverviewData();
        // Init & Load Chart
        initLineChart();
        updateChartFilter();
        loadSignatureConfig(); // Load setting tanda tangan saat start
    });

    // AUTO REFRESH (Setiap 60 Detik) - Fitur Canggih
    setInterval(() => {
        // Hanya refresh jika tab aktif adalah overview atau daily
        const activeTab = document.querySelector('.nav-item.active').id;
        if (activeTab === 'nav-overview') loadOverviewData();
        if (activeTab === 'nav-daily') loadDailyData(true); // true = silent refresh
    }, 60000);
});

// --- LOAD CONFIG DARI SERVER ---
async function loadSystemConfig() {
    try {
        const response = await fetch(`${API_BASE}/config`);
        const result = await response.json();
        if (result.success) {
            systemConfig = result.config;
            console.log("System Config Loaded:", systemConfig);
        }
    } catch (e) {
        console.error("Gagal memuat config, menggunakan default.", e);
    }
}

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
        // OPTIMISASI: Gunakan Promise.all untuk request paralel
        const [resDailyRaw, resEmpRaw] = await Promise.all([
            fetch(`${API_BASE}/absensi/harian`),
            fetch(`${API_BASE}/karyawan/descriptors`)
        ]);

        const jsonDaily = await resDailyRaw.json();
        const dailyData = jsonDaily.data || [];

        // 2. Ambil Data Karyawan (untuk total)
        const jsonEmp = await resEmpRaw.json();
        const totalEmployees = jsonEmp.descriptors ? jsonEmp.descriptors.length : 0;

        // 3. Hitung Statistik Hari Ini
        const presentCount = dailyData.length; // Asumsi 1 baris per orang per hari (karena view)
        // Hitung DL secara spesifik
        const dlCount = dailyData.filter(d => ['DL', 'DINAS_LUAR'].includes(d.status)).length;
        // Hitung terlambat (exclude DL)
        const limitStr = systemConfig?.batas_telat || '08:25:00';
        const lateCount = dailyData.filter(d => d.jam_masuk > limitStr && !['DL', 'DINAS_LUAR'].includes(d.status)).length;
        const absentCount = Math.max(0, totalEmployees - presentCount);

        // 4. Update Kartu Statistik
        document.getElementById('stat-total-emp').textContent = totalEmployees;
        // Tampilkan total hadir + info DL kecil
        document.getElementById('stat-present').innerHTML = `${presentCount} <span class="text-sm opacity-80 ml-1">(${dlCount} DL)</span>`;
        document.getElementById('stat-late').textContent = lateCount;
        document.getElementById('stat-absent').textContent = absentCount;

        // 5. Render Grafik
        renderPieChart(presentCount, lateCount, absentCount);

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
        const limitStr = systemConfig?.batas_telat || '08:25:00';
        const isLate = item.jam_masuk > limitStr;
        const timeClass = isLate 
            ? 'bg-red-100 text-red-700 border-red-200' 
            : 'bg-emerald-100 text-emerald-700 border-emerald-200';
        
        const html = `
            <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-white hover:shadow-md hover:border-blue-200 transition-all duration-200 group">
                <div class="w-12 h-12 rounded-full bg-white flex items-center justify-center text-sm font-bold text-slate-700 shadow-sm border border-slate-200 group-hover:border-blue-500 group-hover:text-blue-600 transition-colors">
                    ${escapeHtml(item.nama_karyawan).substring(0, 1).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate group-hover:text-blue-600 transition-colors">${escapeHtml(item.nama_karyawan)}</p>
                    <p class="text-xs text-slate-500 truncate mt-0.5">${escapeHtml(item.jabatan || 'Staff')}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-mono font-bold px-3 py-1.5 rounded-lg border ${timeClass} shadow-sm block text-center min-w-[80px]">${item.jam_masuk}</span>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- DATA LOADER: DAILY ---
async function loadDailyData(silent = false) {
    const tbody = document.getElementById('table-daily-body');
    if (!silent) {
        tbody.innerHTML = getSkeletonRows(6, 5);
    }

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
                let statusBadge = '';
                let lateDisplay = '-';
                let lateClass = 'text-slate-500';

                // --- LOGIKA STATUS KHUSUS (DL/IZIN/SAKIT) ---
                // Gunakan field 'status' dari view_absensi_harian
                const status = row.status;
                
                if (status === 'DL' || status === 'DINAS_LUAR') {
                    statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200 flex items-center w-fit gap-1"><i class="fa-solid fa-briefcase"></i> Dinas Luar</span>`;
                    // Tampilkan indikator DL di kolom jam agar jelas
                    row.jam_masuk = '<span class="text-blue-600 font-bold tracking-wider">DL</span>';
                    row.jam_keluar = '<span class="text-blue-600 font-bold tracking-wider">DL</span>';
                } else if (status === 'SAKIT') {
                    statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 flex items-center w-fit gap-1"><i class="fa-solid fa-heart-pulse"></i> Sakit</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'IZIN' || status === 'CUTI') {
                    statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200 flex items-center w-fit gap-1"><i class="fa-solid fa-file-signature"></i> Izin/Cuti</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (row.jam_masuk) {
                    // --- LOGIKA HADIR NORMAL ---
                    const [h, m, s] = row.jam_masuk.split(':').map(Number);
                    const secondsIn = (h * 3600) + (m * 60) + (s || 0);
                    
                    // Ambil dari config server atau fallback ke default jika gagal load
                    const limitStr = systemConfig?.batas_telat || '08:25:00';
                    const startStr = systemConfig?.jam_kerja_mulai || '08:00:00';

                    const [lh, lm, ls] = limitStr.split(':').map(Number);
                    const [sh, sm, ss] = startStr.split(':').map(Number);

                    const secondsLimit = (lh * 3600) + (lm * 60) + (ls || 0);
                    const secondsStart = (sh * 3600) + (sm * 60) + (ss || 0);

                    if (secondsIn > secondsLimit) {
                        isLate = true;
                        // Math.floor((selisih detik) / 60) sama persis dengan TIMESTAMPDIFF(MINUTE, ...) di MySQL
                        lateMinutes = Math.floor((secondsIn - secondsLimit) / 60);
                    }
                    
                    // UPDATE: Status "Hadir", Keterlambatan "Terlambat/Tepat Waktu"
                    statusBadge = `<span class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center w-fit gap-1"><i class="fa-solid fa-check"></i> Hadir</span>`;
                    
                    if (isLate) {
                        lateDisplay = `Terlambat (${lateMinutes} Menit)`;
                        lateClass = 'text-red-600 font-bold';
                    } else {
                        lateDisplay = 'Tepat Waktu';
                        lateClass = 'text-emerald-600 font-bold';
                    }
                } else {
                    // Fallback jika data tidak lengkap
                    statusBadge = `<span class="text-slate-400 text-xs">Tidak Ada Data</span>`;
                }

                const tr = `
                    <tr onclick="openModal('${row.id_karyawan}')" class="hover:bg-blue-50/50 transition cursor-pointer group border-b border-slate-100 last:border-0">
                        <td class="px-6 py-4 font-mono text-blue-600 font-medium">${row.jam_masuk}</td>
                        <td class="px-6 py-4 font-bold text-slate-800 group-hover:text-blue-600 transition">${row.nama_karyawan}</td>
                        <td class="px-6 py-4 text-slate-500 text-sm">${row.jabatan || '-'}</td>
                        <td class="p-5">${statusBadge}</td>
                        <td class="px-6 py-4 ${lateClass} font-mono">${lateDisplay}</td>
                        <td class="px-6 py-4 font-mono text-slate-600">${row.jam_keluar || '<span class="text-slate-400">-</span>'}</td>
                    </tr>
                `;
                tbody.innerHTML += tr;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 italic">Belum ada data absensi hari ini.</td></tr>';
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
        <thead class="uppercase text-xs font-bold tracking-wider border-b border-slate-200">
            <tr>
                <th class="px-6 py-4 text-center w-12">No.</th>
                <th class="px-6 py-4">ID</th>
                <th class="px-6 py-4">Nama Pegawai</th>
                <th class="px-6 py-4">Jabatan</th>
                <th class="px-6 py-4 text-center">Hadir</th>
                <th class="px-6 py-4 text-center">DL</th>
                <th class="px-6 py-4 text-center">Alpa</th>
                <th class="px-6 py-4 text-center">Telat (x)</th>
                <th class="px-6 py-4 text-center">Telat (Min)</th>
                <th class="px-6 py-4 text-center">Tanpa Pulang</th>
                <th class="px-6 py-4 text-center">Potongan</th>
                <th class="px-6 py-4 text-right">Total Jam Kerja</th>
            </tr>
        </thead>
        <tbody class="text-slate-700 divide-y divide-slate-100 text-sm bg-white">
        </tbody>
    `;

    try {
        const response = await fetch(`${API_BASE}/rekap?periode=${month}`);
        const result = await response.json();
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        if (result.data && result.data.length > 0) {
            // Inisialisasi variabel total
            let tHadir = 0, tDL = 0, tAlpa = 0, tTelat = 0, tTelatMin = 0, tNoOut = 0, tPot = 0;

            result.data.forEach((row, index) => {
                // Hitung total saat looping
                tHadir += parseInt(row.total_masuk) || 0;
                tDL += parseInt(row.total_dl) || 0;
                tAlpa += parseInt(row.alpa) || 0;
                tTelat += parseInt(row.telat_kali) || 0;
                tTelatMin += parseInt(row.telat_menit) || 0;
                tNoOut += parseInt(row.tanpa_absen_pulang) || 0;
                tPot += parseFloat(row.potongan_jam) || 0;

                tbody.innerHTML += `
                    <tr class="hover:bg-blue-50/50 border-b border-slate-100 last:border-0">
                        <td class="px-6 py-4 text-center font-mono text-slate-500">${index + 1}</td>
                        <td class="px-6 py-4 font-mono text-slate-500">${row.id_karyawan}</td>
                        <td class="px-6 py-4 font-bold text-slate-800">${row.nama}</td>
                        <td class="px-6 py-4 text-sm text-slate-600">${row.jabatan || '-'}</td>
                        <td class="px-6 py-4 text-center">
                            <span class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold text-xs border border-emerald-200">${row.total_masuk}</span>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <span class="bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold text-xs border border-blue-200">${row.total_dl || 0}</span>
                        </td>
                        <td class="px-6 py-4 text-center ${row.alpa > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}">${row.alpa}</td>
                        <td class="px-6 py-4 text-center ${row.telat_kali > 0 ? 'text-amber-600 font-bold' : 'text-slate-500'}">${row.telat_kali}</td>
                        <td class="px-6 py-4 text-center text-slate-500">${row.telat_menit}</td>
                        <td class="px-6 py-4 text-center ${row.tanpa_absen_pulang > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}">${row.tanpa_absen_pulang}</td>
                        <td class="px-6 py-4 text-center text-red-600">${row.potongan_jam} Jam</td>
                        <td class="px-6 py-4 text-right font-mono text-emerald-600 font-bold">${row.total_jam_kerja || '00:00:00'}</td>
                    </tr>
                `;
            });

            // Tambahkan Baris Total Ringkasan di Paling Bawah
            tbody.innerHTML += `
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900 print:bg-gray-200 print:border-black break-inside-avoid">
                    <td colspan="4" class="px-6 py-3 text-right uppercase text-xs tracking-wider">Total Ringkasan:</td>
                    <td class="px-6 py-3 text-center">${tHadir}</td>
                    <td class="px-6 py-3 text-center">${tDL}</td>
                    <td class="px-6 py-3 text-center">${tAlpa}</td>
                    <td class="px-6 py-3 text-center">${tTelat}</td>
                    <td class="px-6 py-3 text-center text-slate-500 text-xs">${tTelatMin}</td>
                    <td class="px-6 py-3 text-center">${tNoOut}</td>
                    <td class="px-6 py-3 text-center">${tPot}</td>
                    <td class="px-6 py-3"></td>
                </tr>
            `;
        } else {
            tbody.innerHTML = '<tr><td colspan="12" class="p-4 text-center text-slate-500">Tidak ada data untuk periode ini.</td></tr>';
        }
    } catch (e) {
        console.error(e);
    }
}

// --- DATA LOADER: PERFORMANCE MONITORING (SCORING SYSTEM) ---
function calculatePerformanceScore(emp) {
    // Skor Awal: 100
    // -5 poin per kali telat
    // -10 poin per hari alpa
    // -2 poin per jam potongan (lupa pulang)
    let score = 100 - (emp.telat_kali * 5) - (emp.alpa * 10) - (emp.potongan_jam * 2);
    return Math.max(0, score);
}

async function loadPerformanceData() {
    const grid = document.getElementById('performance-grid');
    grid.innerHTML = '<div class="col-span-full text-center text-slate-500 italic py-8">Menganalisis Kinerja...</div>';

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
                const score = calculatePerformanceScore(emp);

                // Tentukan Status & Warna
                let status = 'SANGAT BAIK';
                let colorClass = 'border-emerald-500 text-emerald-600 bg-emerald-50/30';
                let bgGradient = ''; // Removed gradient for clean look
                let icon = 'fa-medal';

                if (score < 60) {
                    status = 'PERLU PEMBINAAN';
                    colorClass = 'border-rose-500 text-rose-700 bg-rose-50/30';
                    bgGradient = '';
                    icon = 'fa-triangle-exclamation';
                } else if (score < 80) {
                    status = 'CUKUP';
                    colorClass = 'border-amber-500 text-amber-600 bg-amber-50/30';
                    bgGradient = '';
                    icon = 'fa-circle-exclamation';
                } else if (score < 90) {
                    status = 'BAIK';
                    colorClass = 'border-blue-500 text-blue-600 bg-blue-50/30';
                    bgGradient = '';
                    icon = 'fa-thumbs-up';
                }

                // Render Card
                const card = `
                    <div onclick="openModal('${emp.id_karyawan}')" class="bg-white rounded-2xl p-6 border-t-4 ${colorClass} relative overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer shadow-sm border border-slate-100">
                        <div class="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition">
                            <i class="fa-solid ${icon} text-6xl"></i>
                        </div>
                        
                        <div class="relative z-10">
                            <h3 class="text-lg font-bold text-slate-800 truncate">${escapeHtml(emp.nama)}</h3>
                            <p class="text-xs text-slate-500 mb-4 uppercase tracking-wide">${escapeHtml(emp.jabatan || 'Staff')} • ID: ${emp.id_karyawan}</p>
                            
                            <div class="flex items-end gap-2 mb-2">
                                <span class="text-4xl font-bold text-slate-800">${score}</span>
                                <span class="text-sm text-slate-400 mb-1">/ 100</span>
                            </div>
                            
                            <div class="w-full bg-slate-100 h-2 rounded-full mb-4 overflow-hidden">
                                <div class="h-full ${colorClass.replace('text', 'bg').split(' ')[1]}" style="width: ${score}%"></div>
                            </div>

                            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                <div class="bg-slate-50 p-2 rounded border border-slate-200">
                                    <div class="text-slate-500">Hadir</div>
                                    <div class="font-bold text-slate-800">${emp.total_masuk}</div>
                                    ${emp.total_dl ? `<div class="text-[9px] text-blue-500">(${emp.total_dl} DL)</div>` : ''}
                                </div>
                                <div class="bg-slate-50 p-2 rounded border border-slate-200">
                                    <div class="text-slate-500">Telat</div>
                                    <div class="font-bold text-amber-600">${emp.telat_kali}</div>
                                </div>
                                <div class="bg-slate-50 p-2 rounded border border-slate-200">
                                    <div class="text-slate-500">Alpa</div>
                                    <div class="font-bold text-red-600">${emp.alpa}</div>
                                </div>
                            </div>

                            <div class="mt-4 text-center font-bold text-xs tracking-widest ${colorClass.split(' ')[1]} border border-dashed border-slate-300 p-2 rounded uppercase">
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
    grid.innerHTML = '<div class="col-span-full text-center text-slate-400 italic py-8">Memuat direktori...</div>';

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
                    <div class="bg-white rounded-xl shadow-sm hover:shadow-xl transition-all duration-300 group border border-slate-200 overflow-hidden relative flex flex-col">
                        <!-- Decorative Top Bar -->
                        <div class="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500"></div>
                        
                        <div class="p-5 flex items-start gap-4">
                            <!-- Avatar -->
                            <div onclick="openModal('${emp.id_karyawan}')" class="cursor-pointer relative flex-shrink-0">
                                <div class="w-16 h-16 rounded-full p-0.5 bg-gradient-to-br from-blue-400 to-purple-500 shadow-md group-hover:scale-105 transition-transform duration-300">
                                    <img src="${photoSrc}" class="w-full h-full object-cover rounded-full border-2 border-white bg-slate-100">
                                </div>
                            </div>

                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start">
                                    <div onclick="openModal('${emp.id_karyawan}')" class="cursor-pointer flex-1 min-w-0 mr-2">
                                        <h4 class="text-slate-800 font-bold truncate text-base group-hover:text-indigo-600 transition-colors" title="${escapeHtml(emp.nama)}">${escapeHtml(emp.nama)}</h4>
                                        <div class="flex items-center gap-2 mt-1">
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wide truncate max-w-full">${escapeHtml(emp.jabatan || 'Staff')}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mt-3 flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-xs text-slate-500 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                        <i class="fa-solid fa-id-badge text-slate-400"></i>
                                        <span class="font-bold text-slate-700">${emp.id_karyawan}</span>
                                    </div>
                                    
                                    <!-- Actions -->
                                    <div class="flex gap-1">
                                        <button onclick="openEditModal('${emp.id_karyawan}')" class="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100" title="Edit">
                                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                                        </button>
                                        <button onclick="deleteEmployee('${emp.id_karyawan}', this.dataset.name)" data-name="${escapeHtml(emp.nama)}" class="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100" title="Hapus">
                                            <i class="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
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
            showToast('Pegawai berhasil dihapus', 'success');
        } else {
            showToast(`Gagal menghapus: ${result.message}`, 'error');
        }
    } catch(e) {
        showToast(`Error: ${e.message}`, 'error');
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
            showToast('Data berhasil diperbarui!', 'success');
            closeEditModal();
            loadEmployees(); // Refresh list
            loadOverviewData(); // Refresh stats if needed
        } else {
            showToast(`Gagal memperbarui: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// --- FITUR: INPUT MANUAL (DINAS LUAR / IZIN) ---
async function openManualModal() {
    const modal = document.getElementById('modal-manual-status');
    const content = document.getElementById('modal-manual-content');
    const select = document.getElementById('manual-emp-select');
    
    // --- LOGIKA UI: Show/Hide Input Waktu Manual ---
    const typeSelect = document.getElementById('manual-type');
    const timeContainer = document.getElementById('manual-time-container');
    
    if (typeSelect && timeContainer) {
        typeSelect.onchange = function() {
            if (this.value === 'HADIR_MANUAL') {
                timeContainer.classList.remove('hidden');
            } else {
                timeContainer.classList.add('hidden');
            }
        };
        // Trigger saat modal dibuka untuk reset state
        typeSelect.onchange();
    }

    // Set tanggal hari ini sebagai default
    document.getElementById('manual-date').valueAsDate = new Date();

    // Populate Select jika belum ada data atau kosong
    if (select.options.length <= 1) {
        if (globalEmployees.length === 0) {
            // Coba load data pegawai jika belum ada
            try {
                const res = await fetch(`${API_BASE}/karyawan/descriptors`);
                const json = await res.json();
                globalEmployees = json.descriptors || [];
            } catch (e) {
                console.error("Gagal load pegawai untuk dropdown", e);
            }
        }
        
        globalEmployees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id_karyawan;
            opt.text = `${emp.nama} (${emp.jabatan || '-'})`;
            select.appendChild(opt);
        });
    }

    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeManualModal() {
    const modal = document.getElementById('modal-manual-status');
    const content = document.getElementById('modal-manual-content');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function submitManualStatus() {
    const id_karyawan = document.getElementById('manual-emp-select').value;
    const status = document.getElementById('manual-type').value;
    const keterangan = document.getElementById('manual-desc').value;
    const tanggal = document.getElementById('manual-date').value;
    
    // Ambil data waktu manual (jika ada)
    const jam_masuk = document.getElementById('manual-jam-masuk')?.value;
    const jam_keluar = document.getElementById('manual-jam-keluar')?.value;

    if (!id_karyawan || !tanggal) {
        showToast("Mohon pilih pegawai dan tanggal.", 'warning');
        return;
    }

    if (status === 'HADIR_MANUAL' && !jam_masuk) {
        showToast("Untuk Masuk Normal, Jam Masuk wajib diisi.", 'warning');
        return;
    }

    // Simulasi Kirim ke API (Anda perlu membuat endpoint ini di backend)
    // POST /api/absensi/manual { id_karyawan, status, keterangan, tanggal, jam_masuk, jam_keluar }
    try {
        const response = await fetch(`${API_BASE}/absensi/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan, status, keterangan, tanggal, jam_masuk, jam_keluar })
        });
        
        // Parse JSON response untuk melihat status sukses/gagal dari server
        const result = await response.json();

        if (response.ok && result.success) {
            showToast("Status berhasil disimpan!", 'success');
            closeManualModal();
            loadDailyData(); // Refresh tabel
        } else {
            // Tampilkan pesan error asli dari server
            showToast(`Gagal menyimpan: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast("Error koneksi: " + e.message, 'error');
    }
}

// --- CHART RENDERER: PIE CHART ---
function renderPieChart(present, late, absent) {
    const ctxPie = document.getElementById('pieChart').getContext('2d');

    // Destroy old instances if exist
    if (pieChartInstance) pieChartInstance.destroy();

    // 1. Pie Chart (Komposisi Hari Ini)
    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Tepat Waktu', 'Terlambat', 'Alpa/Belum'],
            datasets: [{
                data: [present - late, late, absent],
                backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { usePointStyle: true, boxWidth: 8, color: '#64748b', font: {family: 'Inter', size: 11} } } }
        }
    });
}

// --- CHART RENDERER: LINE CHART (DYNAMIC) ---
async function updateChartFilter() {
    const start = document.getElementById('chart-start').value;
    const end = document.getElementById('chart-end').value;
    
    if(!start || !end) return;

    try {
        const response = await fetch(`${API_BASE}/stats/daily-range?start=${start}&end=${end}`);
        
        // Handle jika endpoint belum ada (404) atau error server (500)
        if (!response.ok) {
            console.warn(`⚠️ Gagal mengambil data grafik (${response.status}). Pastikan server.js sudah direstart.`);
            showToast('Gagal memuat grafik. Mohon restart server.js', 'warning');
            return;
        }

        const result = await response.json();
        
        if(result.success) {
            updateLineChartData(result.data);
        }
    } catch(e) {
        console.error("Error fetching chart data:", e);
    }
}

function updateLineChartData(data) {
    if (!attendanceChartInstance) return;

    const labels = data.map(d => {
        const date = new Date(d.tanggal);
        return date.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });
    });
    const presenceData = data.map(d => d.total_hadir);

    attendanceChartInstance.data.labels = labels;
    attendanceChartInstance.data.datasets[0].data = presenceData;
    attendanceChartInstance.update();
}

function initLineChart() {
    const ctxLine = document.getElementById('attendanceChart').getContext('2d');
    
    if (attendanceChartInstance) attendanceChartInstance.destroy();

    attendanceChartInstance = new Chart(ctxLine, {
        type: 'line',
        data: {
            labels: [], // Init kosong
            datasets: [{
                label: 'Total Hadir',
                data: [],
                borderColor: '#3b82f6', // Blue 500
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.5)');
                    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                    return gradient;
                },
                borderWidth: 2,
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#3b82f6',
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
                y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: {family: 'Inter', size: 10}, stepSize: 1 } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: {family: 'Inter', size: 10} } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            }
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
        for (let j = 0; j < cols.length; j++) {
            // FIX: Escape double quotes dengan benar untuk CSV (replace " dengan "")
            let cleanText = cols[j].innerText.replace(/"/g, '""');
            row.push('"' + cleanText + '"'); 
        }
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

// --- FITUR: PRINT REPORT ---
function printReport() {
    // Update teks periode di header cetak
    const monthInput = document.getElementById('filter-month');
    if (monthInput && monthInput.value) {
        const date = new Date(monthInput.value);
        const options = { year: 'numeric', month: 'long' };
        const periodText = date.toLocaleDateString('id-ID', options);
        document.getElementById('print-period').textContent = `Periode: ${periodText}`;
    }
    
    // Update Tanggal Cetak (Tgl Th Otomatis) untuk Tanda Tangan
    const now = new Date();
    const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const dateText = now.toLocaleDateString('id-ID', dateOptions);
    const dateEl = document.getElementById('print-date-now');
    if (dateEl) dateEl.textContent = dateText;

    // Update Timestamp Lengkap untuk Footer per Halaman
    const fullTime = now.toLocaleDateString('id-ID', { 
        day: 'numeric', month: 'long', year: 'numeric', 
        hour: '2-digit', minute: '2-digit' 
    });
    const tsEl = document.getElementById('print-timestamp');
    if (tsEl) tsEl.textContent = fullTime;

    // Pastikan data tanda tangan terbaru diterapkan sebelum print
    applySignatureToPrint();

    window.print();
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
    const score = calculatePerformanceScore(emp);
    
    const badge = document.getElementById('modal-score-badge');
    badge.textContent = score;
    badge.className = `absolute -bottom-2 -right-2 text-white font-bold px-3 py-1 rounded-full border shadow-lg ${score >= 80 ? 'bg-emerald-600 border-emerald-400' : (score >= 60 ? 'bg-yellow-600 border-yellow-400' : 'bg-red-600 border-red-400')}`;

    document.getElementById('modal-status').textContent = score >= 80 ? 'SANGAT BAIK' : (score >= 60 ? 'CUKUP' : 'PERLU PEMBINAAN');
    document.getElementById('modal-status').className = `font-bold ${score >= 80 ? 'text-emerald-400' : (score >= 60 ? 'text-yellow-400' : 'text-red-400')}`;

    // Grid Statistik
    const statsHTML = `
        <div class="p-2"><div class="text-2xl font-bold text-slate-800">${emp.total_masuk}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider">Hadir</div></div>
        <div class="p-2"><div class="text-2xl font-bold text-amber-600">${emp.telat_kali}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider">Telat</div></div>
        <div class="p-2"><div class="text-2xl font-bold text-red-600">${emp.alpa}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider">Alpa</div></div>
        <div class="p-2"><div class="text-2xl font-bold text-blue-600">${emp.total_jam_kerja || '0'}</div><div class="text-[10px] text-slate-500 uppercase tracking-wider">Jam Kerja</div></div>
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
            html += `<td class="p-4"><div class="h-3 bg-slate-200 rounded skeleton w-full"></div></td>`;
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
                <div class="p-3 hover:bg-slate-50 transition flex gap-3 items-start cursor-pointer">
                    <div class="mt-1"><i class="fa-solid ${n.icon} ${n.color}"></i></div>
                    <div>
                        <p class="text-xs font-bold text-slate-800">${n.title}</p>
                        <p class="text-[10px] text-slate-500">${n.desc}</p>
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

    localStorage.setItem('theme', colorName);
    location.reload(); 
}

// --- FITUR: KONFIGURASI TANDA TANGAN (LOCAL STORAGE) ---
function saveSignatureConfig() {
    const config = {
        kepalaNama: document.getElementById('conf-kepala-nama').value,
        kepalaNip: document.getElementById('conf-kepala-nip').value,
        petugasNama: document.getElementById('conf-petugas-nama').value,
        petugasNip: document.getElementById('conf-petugas-nip').value
    };
    
    localStorage.setItem('signatureConfig', JSON.stringify(config));
    showToast('Konfigurasi tanda tangan disimpan!', 'success');
    applySignatureToPrint(); // Update tampilan langsung
}

function loadSignatureConfig() {
    const saved = localStorage.getItem('signatureConfig');
    if (saved) {
        const config = JSON.parse(saved);
        // Isi Form Settings
        if(document.getElementById('conf-kepala-nama')) document.getElementById('conf-kepala-nama').value = config.kepalaNama || '';
        if(document.getElementById('conf-kepala-nip')) document.getElementById('conf-kepala-nip').value = config.kepalaNip || '';
        if(document.getElementById('conf-petugas-nama')) document.getElementById('conf-petugas-nama').value = config.petugasNama || '';
        if(document.getElementById('conf-petugas-nip')) document.getElementById('conf-petugas-nip').value = config.petugasNip || '';
        
        // Terapkan ke View Print
        applySignatureToPrint();
    }
}

function applySignatureToPrint() {
    const saved = localStorage.getItem('signatureConfig');
    if (saved) {
        const config = JSON.parse(saved);
        if(config.kepalaNama) document.getElementById('print-kepala-nama').textContent = `( ${config.kepalaNama} )`;
        if(config.kepalaNip) document.getElementById('print-kepala-nip').textContent = `NIP. ${config.kepalaNip}`;
        if(config.petugasNama) document.getElementById('print-petugas-nama').textContent = `( ${config.petugasNama} )`;
        if(config.petugasNip) document.getElementById('print-petugas-nip').textContent = `NIP. ${config.petugasNip}`;
    }
}

// Apply theme on load
const savedTheme = localStorage.getItem('theme');
if (savedTheme && savedTheme !== 'emerald') {
    // Logic replace sederhana saat load agar tidak flash
    // (Implementasi ideal butuh CSS variables, tapi untuk sekarang kita biarkan default emerald dulu)
}

// --- HELPER: TOAST NOTIFICATION (PROFESSIONAL) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    
    // Warna berdasarkan tipe
    let bgClass = 'bg-white';
    let borderClass = 'border-l-4 border-blue-500';
    let icon = '<i class="fa-solid fa-circle-info text-blue-500"></i>';

    if (type === 'success') {
        borderClass = 'border-l-4 border-emerald-500';
        icon = '<i class="fa-solid fa-circle-check text-emerald-500"></i>';
    } else if (type === 'error') {
        borderClass = 'border-l-4 border-rose-500';
        icon = '<i class="fa-solid fa-circle-xmark text-rose-500"></i>';
    } else if (type === 'warning') {
        borderClass = 'border-l-4 border-amber-500';
        icon = '<i class="fa-solid fa-triangle-exclamation text-amber-500"></i>';
    }

    toast.className = `flex items-center gap-3 p-4 rounded shadow-lg border border-slate-100 ${bgClass} ${borderClass} transform transition-all duration-300 translate-x-full opacity-0 min-w-[300px]`;
    toast.innerHTML = `
        <div class="text-lg">${icon}</div>
        <div class="text-sm font-medium text-slate-700">${message}</div>
    `;

    container.appendChild(toast);

    // Animate In
    requestAnimationFrame(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
    });

    // Remove after 3s
    setTimeout(() => {
        toast.classList.add('translate-x-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// --- HELPER: TABLE SORTING ---
function sortTable(tableBodyId, colIndex) {
    const tbody = document.getElementById(tableBodyId);
    const rows = Array.from(tbody.rows);
    const isAsc = tbody.getAttribute('data-order') === 'asc';
    
    rows.sort((a, b) => {
        const aText = a.cells[colIndex].innerText.toLowerCase();
        const bText = b.cells[colIndex].innerText.toLowerCase();
        return isAsc ? aText.localeCompare(bText) : bText.localeCompare(aText);
    });

    tbody.setAttribute('data-order', isAsc ? 'desc' : 'asc');
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

// --- HELPER: TABLE FILTERING ---
function filterTable(tableBodyId, inputId) {
    const input = document.getElementById(inputId);
    const filter = input.value.toLowerCase();
    const tbody = document.getElementById(tableBodyId);
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        const text = rows[i].textContent.toLowerCase();
        rows[i].style.display = text.indexOf(filter) > -1 ? "" : "none";
    }
}