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

// --- HELPER: FORMAT WAKTU ---
function formatPelanggaranToHHMMSS(totalMinutes) {
    if (isNaN(totalMinutes) || totalMinutes <= 0) {
        return '00:00:00';
    }
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // Detik tidak ada di data sumber, jadi kita set 00
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

// --- HELPER: SKELETON LOADER ---
function generateSkeletonRows(cols, rows = 5) {
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += `<tr class="animate-pulse">`;
        for (let j = 0; j < cols; j++) {
            html += `<td class="p-4"><div class="h-4 bg-slate-200 rounded w-full ${j===1 ? 'w-3/4' : ''}"></div></td>`;
        }
        html += `</tr>`;
    }
    return html;
}

// --- INISIALISASI ---
document.addEventListener('DOMContentLoaded', () => {
    // [NEW] Cek Status Login Terlebih Dahulu
    if (!checkAuth()) return;

    updateClock();
    setInterval(updateClock, 1000);

    // [NEW] Init Dark Mode dari LocalStorage
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark');
        const btn = document.getElementById('btn-dark-mode');
        if(btn) {
            btn.innerHTML = '<i class="fa-solid fa-sun"></i>';
            btn.title = 'Light Mode';
        }
    }

    // Init Date Inputs for Chart (Last 7 Days)
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 6);
    const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    
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

    // [NEW] Init Daily Date Filter (Laporan Harian)
    const dailyDateInput = document.getElementById('filter-daily-date');
    if (dailyDateInput) {
        dailyDateInput.valueAsDate = new Date(); // Default Hari Ini
        dailyDateInput.addEventListener('change', () => loadDailyData());
    }

    // Load Config dulu, baru load data
    loadSystemConfig().then(() => {
        loadOverviewData();
        // Init & Load Chart
        initLineChart();
        updateChartFilter();
        loadSignatureConfig(); // Load setting tanda tangan saat start
        setupSidebarToggle(); // [NEW] Init Sidebar Toggle
    });

    // AUTO REFRESH (Setiap 60 Detik) - Fitur Canggih
    setInterval(() => {
        // Hanya refresh jika tab aktif adalah overview atau daily
        const activeTab = document.querySelector('.nav-item.active').id;
        if (activeTab === 'nav-overview') loadOverviewData(true); // true = silent refresh
        if (activeTab === 'nav-daily') loadDailyData(true); // true = silent refresh
    }, 60000);
});

// --- [NEW] AUTHENTICATION LOGIC ---
function checkAuth() {
    const session = localStorage.getItem('pkm_wana_session');
    const loginOverlay = document.getElementById('login-overlay');

    if (session === 'active') {
        if (loginOverlay) loginOverlay.classList.add('hidden');
        return true;
    } else {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        return false;
    }
}

function handleLogin() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;

    // Kredensial Admin yang ditanam (Hardcoded)
    const ADMIN_USER = 'Pkm-wana';
    const ADMIN_PASS = 'Wana2026?';

    if (user === ADMIN_USER && pass === ADMIN_PASS) {
        localStorage.setItem('pkm_wana_session', 'active');
        location.reload();
    } else {
        showLoginError("Username atau password salah!", "bg-rose-50 text-rose-500 border-rose-200");
    }
}

function showLoginError(msg, classes) {
    const errorMsg = document.getElementById('login-error');
    errorMsg.textContent = msg;
    errorMsg.className = `p-2 rounded border text-center animate-pulse ${classes}`;
    errorMsg.classList.remove('hidden');
    setTimeout(() => errorMsg.classList.add('hidden'), 3000);
}

function logout() {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        localStorage.removeItem('pkm_wana_session');
        location.reload();
    }
}

// --- LOAD CONFIG DARI SERVER ---
async function loadSystemConfig() {
    try {
        const response = await fetch(`${API_BASE}/config?_t=${Date.now()}`);
        const result = await response.json();
        if (result.success) {
            systemConfig = result.config;
            // console.log("System Config Loaded:", JSON.stringify(systemConfig, null, 2));
            
            // [NEW] Populate Jam Pulang Khusus dari Server Config (jika input kosong)
            const jumatInput = document.getElementById('conf-jam-pulang-jumat');
            const sabtuInput = document.getElementById('conf-jam-pulang-sabtu');
            if (document.getElementById('conf-lat')) document.getElementById('conf-lat').value = systemConfig.office_lat;
            if (document.getElementById('conf-lon')) document.getElementById('conf-lon').value = systemConfig.office_lon;
            if (document.getElementById('conf-radius')) document.getElementById('conf-radius').value = systemConfig.office_radius;
            if (jumatInput && !jumatInput.value) jumatInput.value = systemConfig.jam_pulang_jumat;
            if (sabtuInput && !sabtuInput.value) sabtuInput.value = systemConfig.jam_pulang_sabtu;
        }
    } catch (e) {
        console.error("Gagal memuat config, menggunakan default.", e);
    }
}

// --- NAVIGASI TAB ---
function switchTab(tabName) {
    // Hide all views
    ['overview', 'daily', 'monthly', 'performance', 'employees', 'view-db', 'view-db-monthly', 'settings'].forEach(id => {
        const viewEl = document.getElementById(`view-${id}`);
        if (viewEl) {
            viewEl.classList.add('hidden');
            viewEl.style.display = ''; // Clear inline styles
            viewEl.classList.remove('animate-fade-in-up');
        }
        const navEl = document.getElementById(`nav-${id}`);
        if (navEl) navEl.classList.remove('active');
    });

    // Show selected view
    const targetView = document.getElementById(`view-${tabName}`);
    if (targetView) {
        targetView.classList.remove('hidden');
        targetView.style.display = ''; // Clear inline styles
        // Trigger reflow to restart animation
        void targetView.offsetWidth; 
        targetView.classList.add('animate-fade-in-up');
    }
    const targetNav = document.getElementById(`nav-${tabName}`);
    if (targetNav) targetNav.classList.add('active');

    // Update Title
    const titles = {
        'overview': 'Dashboard Overview',
        'daily': 'Laporan Absensi Harian',
        'monthly': 'Rekapitulasi Bulanan',
        'performance': 'Monitoring Kinerja Pegawai',
        'employees': 'Direktori Data Pegawai',
        'view-db': 'Data View Absensi Harian',
        'view-db-monthly': 'DATA VIEW BULANAN',
        'settings': 'Pengaturan Sistem'
    };
    document.getElementById('page-title').textContent = titles[tabName];

    // Load Data specific to tab
    if (tabName === 'overview') loadOverviewData();
    if (tabName === 'daily') loadDailyData();
    if (tabName === 'monthly') loadMonthlyRecap();
    if (tabName === 'performance') loadPerformanceData();
    if (tabName === 'employees') loadEmployees();
    if (tabName === 'view-db') loadViewDbData();
    if (tabName === 'view-db-monthly') loadViewDbMonthlyData();
}

// --- JAM DIGITAL ---
function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    document.getElementById('clock-time').innerHTML = `${hours}:${minutes}<span class="text-emerald-400 text-sm animate-pulse ml-1">:${seconds}</span>`;
    
    // Tanggal bergaya formal Indonesia (contoh: 05 Juni 2026)
    const options = { day: '2-digit', month: 'long', year: 'numeric' };
    document.getElementById('clock-date').textContent = now.toLocaleDateString('id-ID', options);
}

// --- HELPER: LOADING SPINNER ---
function showSpinner() {
    document.getElementById('loading-spinner').classList.remove('hidden');
}
function hideSpinner() {
    document.getElementById('loading-spinner').classList.add('hidden');
}

// --- DATA LOADER: OVERVIEW ---
async function loadOverviewData(silent = false) {
    if (!silent) showSpinner();
    try {
        // 1. Ambil Data Harian
        // OPTIMISASI: Gunakan Promise.all untuk request paralel
        const [resDailyRaw, resEmpRaw] = await Promise.all([
            fetch(`${API_BASE}/absensi/harian?_t=${Date.now()}`),
            fetch(`${API_BASE}/karyawan/descriptors?_t=${Date.now()}`)
        ]);

        const jsonDaily = await resDailyRaw.json();
        const dailyData = Array.isArray(jsonDaily.data) ? jsonDaily.data : [];

        // 2. Ambil Data Karyawan (untuk total)
        const jsonEmp = await resEmpRaw.json();
        const totalEmployees = jsonEmp.descriptors ? jsonEmp.descriptors.length : 0;

        // 3. Hitung Statistik Hari Ini
        // Filter Hadir sejati (tidak termasuk Izin/Sakit/Cuti/DL/Libur)
        const activeData = dailyData.filter(d => !['IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR'].includes(d.status));
        const presentCount = activeData.length;
        
        // Hitung status lainnya
        const dlCount = dailyData.filter(d => ['DL', 'DINAS_LUAR'].includes(d.status)).length;
        const iscCount = dailyData.filter(d => ['IZIN', 'SAKIT', 'CUTI'].includes(d.status)).length;
        
        // Hitung terlambat (dari yang hadir)
        const lateCount = activeData.filter(d => d.telat_menit > 0).length;
        
        // Alpa / Belum Hadir (Orang yang tidak ada record sama sekali hari ini)
        const absentCount = Math.max(0, totalEmployees - dailyData.length);

        // 4. Update Kartu Statistik
        document.getElementById('stat-total-emp').textContent = totalEmployees;
        // Tampilkan total hadir + info DL/Izin kecil
        let subText = [];
        if (dlCount > 0) subText.push(`${dlCount} DL`);
        if (iscCount > 0) subText.push(`${iscCount} Izin/Sakit/Cuti`);
        
        document.getElementById('stat-present').innerHTML = `${presentCount} ${subText.length > 0 ? `<span class="text-sm text-white/70 ml-1">(${subText.join(', ')})</span>` : ''}`;
        document.getElementById('stat-late').textContent = lateCount;
        document.getElementById('stat-absent').textContent = absentCount;

        // 5. Render Grafik
        renderPieChart(presentCount, lateCount, absentCount);

        // 6. Render Recent Activity (New Feature)
        renderRecentActivity(dailyData);

    } catch (error) {
        console.error("Error loading overview:", error);
    } finally {
        if (!silent) hideSpinner();
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
        container.innerHTML = '<div class="p-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200"><i class="fa-solid fa-clock-rotate-left text-3xl mb-2 text-slate-300"></i><p class="text-sm font-medium">Belum ada aktivitas hari ini.</p></div>';
        return;
    }

    recent.forEach(item => {
        // [FIX] Gunakan data 'telat_menit' dari DB
        const isLate = item.telat_menit > 0;
        const timeClass = isLate 
            ? 'bg-rose-100 text-rose-800 border-rose-200 font-bold' 
            : 'bg-emerald-100 text-emerald-800 border-emerald-200 font-bold';
        
        const html = `
            <div class="flex items-center gap-4 p-4 rounded-xl bg-white/80 backdrop-blur-sm border border-slate-200/80 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all duration-300 group">
                <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-emerald-500/20 group-hover:shadow-lg group-hover:shadow-emerald-500/30 transition-all">
                    ${escapeHtml(item.nama_karyawan).substring(0, 1).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">${escapeHtml(item.nama_karyawan)}</p>
                    <p class="text-xs text-slate-500 truncate mt-0.5 uppercase tracking-wide font-semibold">${escapeHtml(item.jabatan || 'Staff')}</p>
                </div>
                <div class="text-right">
                    <span class="text-xs font-mono font-medium px-3 py-1 rounded border ${timeClass} block text-center min-w-[70px]">${item.jam_masuk}</span>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// --- DATA LOADER: DAILY ---
async function loadDailyData(silent = false) {
    const tbody = document.getElementById('table-daily-body');
    
    // Skeleton loader instead of full screen spinner
    if (!silent) {
        tbody.innerHTML = generateSkeletonRows(6, 5); // 6 columns
    }

    try {
        let url = `${API_BASE}/absensi/harian?_t=${Date.now()}`;
        
        const dateInput = document.getElementById('filter-daily-date');
        const dateVal = dateInput ? dateInput.value : '';
        if (dateVal) {
            url += `&tanggal=${dateVal}`;
        }

        const response = await fetch(url);
        const result = await response.json();
        
        tbody.innerHTML = '';
        if (result.data && result.data.length > 0) {
            // [FIX] Sort Client-side: Pastikan data tanpa jam (DL/Izin) muncul di atas
            result.data.sort((a, b) => {
                const aNull = !a.jam_masuk;
                const bNull = !b.jam_masuk;
                if (aNull && !bNull) return -1;
                if (!aNull && bNull) return 1;
                // Jika sama-sama ada jam atau tidak ada, urutkan DESC (Terbaru di atas)
                return (b.jam_masuk || '').localeCompare(a.jam_masuk || '');
            });

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
                    statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm flex items-center w-fit gap-1 uppercase tracking-wide"><i class="fa-solid fa-briefcase"></i> Dinas Luar</span>`;
                    // Tampilkan indikator DL di kolom jam agar jelas
                    row.jam_masuk = '<span class="text-blue-600 font-bold tracking-wider">DL</span>';
                    row.jam_keluar = '<span class="text-blue-600 font-bold tracking-wider">DL</span>';
                } else if (status === 'SAKIT') {
                    statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm flex items-center w-fit gap-1 uppercase tracking-wide"><i class="fa-solid fa-heart-pulse"></i> Sakit</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'IZIN') {
                    statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-sm flex items-center w-fit gap-1 uppercase tracking-wide"><i class="fa-solid fa-file-signature"></i> Izin</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'CUTI') {
                    statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-800 border border-orange-200 shadow-sm flex items-center w-fit gap-1 uppercase tracking-wide"><i class="fa-solid fa-calendar-check"></i> Cuti</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'HADIR_MANUAL' || row.jam_masuk) {
                    // --- LOGIKA HADIR NORMAL & MANUAL ---
                    
                    // [FIX] Gunakan data matang dari database (telat_menit)
                    // [FIX] Gunakan data matang dari database, jangan hitung manual di JS
                    // Agar sinkron dengan Rekap Bulanan
                    if (row.telat_menit > 0) {
                        isLate = true;
                        lateMinutes = row.telat_menit;
                    }
                    
                    // UPDATE: Status "Hadir", Keterlambatan "Terlambat/Tepat Waktu"
                    statusBadge = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm flex items-center w-fit gap-1 uppercase tracking-wide"><i class="fa-solid fa-check"></i> Hadir</span>`;

                    
                    if (isLate) {
                        lateDisplay = `Terlambat (${lateMinutes} Menit)`;
                        lateClass = 'text-rose-600 font-bold';
                    } else {
                        lateDisplay = 'Tepat Waktu';
                        lateClass = 'text-emerald-600 font-bold';
                    }

                    // --- LOGIKA VISUAL PSW (PULANG SEBELUM WAKTUNYA) ---
                    // Menambahkan indikator visual di kolom Jam Keluar jika pulang cepat
                    // [FIX] Gunakan data psw_menit dari database
                    if (row.jam_keluar && row.jam_keluar !== '-' && row.psw_menit > 0) {
                        row.jam_keluar = `
                            <div class="flex flex-col">
                                <span class="font-mono text-slate-800 font-bold">${row.jam_keluar}</span>
                                <span class="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 w-fit mt-0.5">PSW: ${row.psw_menit}m</span>
                            </div>
                        `;
                    }
                } else {
                    // Fallback jika data tidak lengkap
                    statusBadge = `<span class="text-slate-400 text-xs italic">Tidak Ada Data</span>`;
                }

                // [NEW] Tampilkan Keterangan dari Database (Sesuai Request)
                // Ini akan memunculkan teks seperti "PSW: 15 menit" atau "Otomatis: Lupa Absen Pulang"
                let keteranganHtml = '';
                if (row.keterangan) {
                    keteranganHtml = `<div class="text-[10px] text-slate-500 italic mt-1.5 border-t border-slate-100 pt-1 leading-tight"><i class="fa-solid fa-circle-info text-[9px] mr-1"></i>${escapeHtml(row.keterangan)}</div>`;
                }

                let tglDisplay = '';

                // [NEW] Highlight baris jika terlambat (Pink Background)
                const rowBgClass = isLate ? 'bg-rose-50 hover:bg-rose-100' : 'hover:bg-slate-50';
                const rowBorderClass = isLate ? 'border-rose-200' : 'border-slate-200';

                const tr = `
                    <tr onclick="openModal('${row.id_karyawan}')" class="${rowBgClass} transition cursor-pointer group border-b ${rowBorderClass} last:border-0">
                        <td class="px-6 py-3 font-mono text-slate-800 font-bold">${tglDisplay}${row.jam_masuk}</td>
                        <td class="px-6 py-3 font-bold text-slate-800 group-hover:text-blue-700 transition">${row.nama_karyawan}</td>
                        <td class="px-6 py-3 text-slate-600 text-xs font-bold uppercase tracking-wider">${row.jabatan || '-'}</td>
                        <td class="p-5">
                            ${statusBadge}
                            ${keteranganHtml}
                        </td>
                        <td class="px-6 py-4 ${lateClass} font-mono">${lateDisplay}</td>
                        <td class="px-6 py-4 font-mono text-slate-800 font-bold">
                            <div class="flex justify-between items-center gap-2">
                                <div>${row.jam_keluar || '<span class="text-slate-400">-</span>'}</div>
                                <button onclick="deleteAbsensi(event, ${row.id_absensi}, this.dataset.name)" data-name="${escapeHtml(row.nama_karyawan)}" class="opacity-0 group-hover:opacity-100 w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Hapus Absensi">
                                    <i class="fa-solid fa-trash text-xs"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
                tbody.innerHTML += tr;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-16 text-center text-slate-400 bg-slate-50/30"><div class="flex flex-col items-center justify-center"><i class="fa-solid fa-inbox text-5xl mb-4 text-emerald-200"></i><p class="text-lg font-bold text-slate-500">Belum Ada Data</p><p class="text-sm mt-1">Data absensi hari ini masih kosong atau tidak ditemukan.</p></div></td></tr>`;
        }
        
        // Update Notifikasi Otomatis
        updateNotifications(result.data || []);

        // [NEW] Re-apply search filter if exists (Agar hasil pencarian tidak hilang saat refresh/ganti tanggal)
        const searchInput = document.getElementById('search-daily');
        if (searchInput && searchInput.value) {
            filterTable('table-daily-body', 'search-daily');
        }

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
    } finally {
        if (!silent) hideSpinner();
    }
}

// --- DATA LOADER: VIEW DB (RAW ABSENSI HARIAN & BULANAN) ---
function toggleFilterTypeViewDb() {
    const type = document.getElementById('filter-view-db-type').value;
    const dateInput = document.getElementById('filter-view-db-date');
    const monthInput = document.getElementById('filter-view-db-month');
    
    if (type === 'daily') {
        dateInput.classList.remove('hidden');
        monthInput.classList.add('hidden');
    } else {
        dateInput.classList.add('hidden');
        monthInput.classList.remove('hidden');
        if (!monthInput.value) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
    }
    loadViewDbData();
}

async function loadViewDbData() {
    const type = document.getElementById('filter-view-db-type').value;
    const dateInput = document.getElementById('filter-view-db-date');
    const monthInput = document.getElementById('filter-view-db-month');
    
    let url = `${API_BASE}/absensi/harian?_t=${Date.now()}`;
    
    // Helper: Dapatkan tanggal lokal YYYY-MM-DD (tanpa timezone UTC shift)
    const getLocalDate = () => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };
    
    if (type === 'daily') {
        const dateVal = dateInput.value || getLocalDate();
        if (!dateInput.value) dateInput.value = dateVal;
        url += `&tanggal=${dateVal}`;
    } else {
        const now = new Date();
        const monthVal = monthInput.value || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (!monthInput.value) monthInput.value = monthVal;
        url += `&bulan=${monthVal}`;
    }

    const tbody = document.getElementById('table-view-db-body');
    tbody.innerHTML = '<tr><td colspan="12" class="p-4 text-center">Memuat data...</td></tr>';

    try {
        const response = await fetch(url);
        const result = await response.json();
        
        tbody.innerHTML = '';
        if (result.data && result.data.length > 0) {
            let htmlContent = '';
            result.data.forEach(row => {
                const dateOnly = row.tanggal ? row.tanggal.split('T')[0] : '-';
                htmlContent += `
                    <tr class="hover:bg-emerald-50/30 transition-colors">
                        <td class="px-4 py-2 font-mono">${row.id_absensi}</td>
                        <td class="px-4 py-2 font-mono">${row.id_karyawan}</td>
                        <td class="px-4 py-2 font-bold">${row.nama_karyawan}</td>
                        <td class="px-4 py-2">${row.jabatan || '-'}</td>
                        <td class="px-4 py-2 font-mono">${dateOnly}</td>
                        <td class="px-4 py-2 font-mono text-emerald-600 font-bold">${row.jam_masuk || '-'}</td>
                        <td class="px-4 py-2 font-mono text-blue-600 font-bold">${row.jam_keluar || '-'}</td>
                        <td class="px-4 py-2"><span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 border border-gray-200">${row.status}</span></td>
                        <td class="px-4 py-2 text-center ${row.telat_menit > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}">${formatPelanggaranToHHMMSS(row.telat_menit)}</td>
                        <td class="px-4 py-2 text-center ${row.psw_menit > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}">${formatPelanggaranToHHMMSS(row.psw_menit)}</td>
                        <td class="px-4 py-2 text-xs text-slate-500 italic">${row.keterangan || '-'}</td>
                        <td class="px-4 py-2 text-center">
                            <div class="flex items-center justify-center gap-1">
                                <button onclick="openEditAbsensiModal('${row.id_absensi}', '${escapeHtml(row.nama_karyawan)}', '${dateOnly}', '${row.jam_masuk || ''}', '${row.jam_keluar || ''}', '${row.status}', '${escapeHtml(row.keterangan || '')}')" class="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Edit Data">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button onclick="deleteAbsensiDb('${row.id_absensi}', '${escapeHtml(row.nama_karyawan)}')" class="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Hapus Data">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            tbody.innerHTML = htmlContent;
        } else {
            tbody.innerHTML = `<tr><td colspan="11" class="p-4 text-center text-slate-500">Tidak ada data untuk ${type === 'daily' ? 'tanggal' : 'bulan'} ini.</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="11" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
    }
}

// --- FITUR: EDIT ABSENSI (MODAL) ---
function openEditAbsensiModal(id, nama, tanggal, masuk, keluar, status, ket) {
    document.getElementById('edit-absensi-id').value = id;
    document.getElementById('edit-absensi-nama').value = nama;
    // Format tanggal YYYY-MM-DD sudah sesuai untuk input type="date"
    document.getElementById('edit-absensi-tanggal').value = tanggal.split('T')[0]; 
    document.getElementById('edit-absensi-masuk').value = masuk;
    document.getElementById('edit-absensi-keluar').value = keluar;
    document.getElementById('edit-absensi-status').value = status;
    document.getElementById('edit-absensi-ket').value = ket;

    const modal = document.getElementById('modal-edit-absensi');
    const content = document.getElementById('modal-edit-absensi-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }, 10);
}

function closeEditAbsensiModal() {
    const modal = document.getElementById('modal-edit-absensi');
    const content = document.getElementById('modal-edit-absensi-content');
    modal.classList.add('opacity-0');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function saveAbsensiChanges() {
    const id = document.getElementById('edit-absensi-id').value;
    const body = {
        tanggal: document.getElementById('edit-absensi-tanggal').value,
        jam_masuk: document.getElementById('edit-absensi-masuk').value,
        jam_keluar: document.getElementById('edit-absensi-keluar').value,
        status: document.getElementById('edit-absensi-status').value,
        keterangan: document.getElementById('edit-absensi-ket').value
    };

    try {
        const response = await fetch(`${API_BASE}/absensi/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const result = await response.json();
        
        if(result.success) {
            showToast('Data absensi berhasil diperbarui', 'success');
            closeEditAbsensiModal();
            loadViewDbData(); // Refresh tabel
            loadDailyData(true); // [FIX] Refresh tabel harian juga agar sinkron
            // Refresh overview juga jika tanggal yang diedit adalah hari ini
            const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            if (body.tanggal === today) loadOverviewData(true);
        } else {
            showToast(`Gagal update: ${result.message}`, 'error');
        }
    } catch(e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// --- DATA LOADER: MONTHLY RECAP ---
async function loadMonthlyRecap(silent = false) {
    const formatEl = document.getElementById('rekap-format');
    const format = formatEl ? formatEl.value : 'ringkasan';
    if (format === 'menyamping') {
        return loadMonthlyMatrix(silent);
    }
    const month = document.getElementById('filter-month').value;
    const table = document.getElementById('table-rekap');

    // [NEW] Format Nama Bulan untuk Judul Formal
    const dateObj = new Date(month);
    const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    
    // Header Table
    table.innerHTML = `
        <caption class="caption-top mb-6 text-center border-b-2 border-slate-800 pb-4 print:border-b-0 print:mb-2 print:pb-0">
            <h2 class="text-2xl font-serif font-bold text-slate-900 uppercase tracking-widest print:text-lg print:tracking-normal print:font-bold">LAPORAN REKAPITULASI PRESENSI</h2>
            <p class="text-sm text-slate-600 font-serif italic mt-1 print:hidden">Periode Laporan: ${monthName}</p>
        </caption>
        <thead class="sticky top-0 z-30 uppercase text-xs font-bold tracking-wider bg-gradient-to-r from-emerald-800 via-emerald-900 to-slate-900 text-white print:bg-white print:text-black">
            <tr>
                <th class="md:sticky md:left-0 md:z-40 bg-emerald-900 text-white print:bg-white print:text-black print:static px-6 py-3 text-center w-16 md:border-r border-slate-700 print:border-black">No.</th>
                <th onclick="sortTable('table-rekap-body', 1)" class="cursor-pointer hover:bg-slate-700 transition-colors md:sticky md:left-16 md:z-40 bg-emerald-900 text-white print:bg-white print:text-black print:static px-6 py-3 w-24 md:border-r border-slate-700 print:border-black text-center">ID <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 2)" class="cursor-pointer hover:bg-slate-700 transition-colors md:sticky md:left-40 md:z-40 bg-emerald-900 text-white print:bg-white print:text-black print:static px-6 py-3 w-64 md:border-r border-slate-700 print:border-black md:shadow-sm text-left">Nama Pegawai <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 3)" class="cursor-pointer hover:bg-slate-700 transition-colors pl-16 pr-6 py-3 text-left">Jabatan <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 4)" class="cursor-pointer hover:bg-slate-700 transition-colors px-6 py-3 text-center">Hadir <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th class="px-6 py-3 text-center">DL</th>
                <th class="px-6 py-3 text-center bg-rose-50 text-rose-800 border-l border-r border-slate-200">S</th>
                <th class="px-6 py-3 text-center bg-purple-50 text-purple-800 border-r border-slate-200">I</th>
                <th class="px-6 py-3 text-center bg-orange-50 text-orange-800 border-r border-slate-200">C</th>
                <th onclick="sortTable('table-rekap-body', 9)" class="cursor-pointer hover:bg-slate-700 transition-colors px-6 py-3 text-center">Alpa <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 10)" class="cursor-pointer hover:bg-slate-700 transition-colors px-6 py-3 text-center font-bold text-yellow-300">% Hadir <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th class="px-6 py-3 text-center">Telat (x)</th>
                <th class="px-6 py-3 text-center">Telat Waktu</th>
                <th class="px-6 py-3 text-center">PSW (x)</th>
                <th class="px-6 py-3 text-center">PSW Waktu</th>
                <th onclick="sortTable('table-rekap-body', 15)" class="cursor-pointer hover:bg-slate-700 transition-colors px-6 py-3 text-center font-bold text-yellow-300 border-l border-slate-700 print:text-black">Pelanggaran (Jam) <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th class="px-6 py-3 text-center">Tanpa Absen Pulang</th>
                <th class="px-6 py-3 text-center">Potongan</th>
                <th class="px-6 py-3 text-center">Total Jam Kerja</th>
                <th class="px-6 py-3 text-center print:hidden">Aksi</th>
            </tr>
        </thead>
        <tbody id="table-rekap-body" class="text-slate-800 divide-y divide-slate-200 text-sm bg-white">
        </tbody>
    `;

    if (!silent) showSpinner();
    try {
        const response = await fetch(`${API_BASE}/rekap?periode=${month}&_t=${Date.now()}`);
        const result = await response.json();
        
        // [UPDATE] Urutkan data berdasarkan Nama Pegawai (A-Z) secara default
        // Menggunakan numeric: true agar "1. Nama" muncul sebelum "10. Nama" (Support penomoran manual)
        if (result.data && Array.isArray(result.data)) {
            result.data.sort((a, b) => {
                const orderA = parseInt(a.no_urut) || 9999;
                const orderB = parseInt(b.no_urut) || 9999;
                if (orderA !== orderB) return orderA - orderB; // Urutkan berdasarkan No Urut dulu
                return (a.nama || '').localeCompare(b.nama || '', undefined, { numeric: true, sensitivity: 'base' }); // Lalu Nama
            });
        }

        // Update global data agar modal detail bisa dibuka saat baris diklik
        globalPerformanceData = result.data || [];

        const tbody = table.querySelector('tbody');
        tbody.innerHTML = '';

        if (result.data && result.data.length > 0) {
            // Inisialisasi variabel total
            let tHadir = 0, tDL = 0, tSakit = 0, tIzin = 0, tCuti = 0, tAlpa = 0, tTelat = 0, tTelatMin = 0, tPsw = 0, tPswMin = 0, tPelanggaranMin = 0, tNoOut = 0, tPot = 0;
            
            // [NEW] Variabel Total Gaji & Load Config
            let totalGaji = 0;
            const savedConfig = localStorage.getItem('signatureConfig');
            const config = savedConfig ? JSON.parse(savedConfig) : {};
            const defGaji = parseInt(config.gajiPokok) || 0;
            const tunjanganJabatan = parseInt(config.tunjanganJabatan) || 0;
            const uangMakan = parseInt(config.uangMakan) || 0;
            const uangTransport = parseInt(config.uangTransport) || 0;
            const bpjs = parseInt(config.bpjs) || 0;
            const pajak = parseInt(config.pajak) || 0;
            const dTelat = parseInt(config.dendaTelat) || 0;
            const dAlpa = parseInt(config.dendaAlpa) || 0;
            const dPsw = parseInt(config.dendaPsw) || 0;
            const dLupa = parseInt(config.dendaLupa) || 0;

            // [NEW] Konfigurasi Poin Jaspel Terintegrasi
            const jaspelPool = (parseInt(config.jaspelPool) || 0) * 0.6; // Langsung ambil 60% untuk Jasa Pelayanan
            const getMap = (str) => {
                const map = {};
                if (str) str.split('\n').forEach(l => {
                    const p = l.split('=');
                    if (p.length === 2) map[p[0].trim().toLowerCase()] = parseFloat(p[1].trim());
                });
                return map;
            };

            const mapJabatan = getMap(config.poinJabatanStr);
            const mapPendidikan = getMap(config.poinPendidikanStr);
            const mapJenis = getMap(config.poinJenisKetenagaanStr);
            const mapStatus = getMap(config.poinStatusKepegawaianStr);
            const poinAdminPerHari = parseFloat(config.poinAdmin) || 0;

            // Tahap 1: Hitung Total Seluruh Poin (Semua Pegawai) untuk Pembagi
            let grandTotalPoinSeluruhPegawai = 0;
            result.data.forEach(row => {
                const pJabatan = mapJabatan[row.jabatan?.toLowerCase()] || 0;
                const pPendidikan = mapPendidikan[row.pendidikan?.toLowerCase()] || 0;
                const pJenis = mapJenis[row.jenis_ketenagaan?.toLowerCase()] || 0;
                const pStatus = mapStatus[row.status_kepegawaian?.toLowerCase()] || 0;
                
                const poinVariabelKetenagaan = pJabatan + pPendidikan + pJenis + pStatus;
                
                // [FIX] DL dihitung sebagai bagian dari kehadiran (Persentase % Hadir)
                const hMasuk = (parseInt(row.total_masuk) || 0) + (parseInt(row.total_dl) || 0);
                const hAdmin = (parseInt(row.total_admin) || 0); // Hari tugas tambahan
                let totalHariKerja = parseInt(row.total_hari_kerja) || 20;
                const totalKehadiranPre = (parseInt(row.total_masuk) || 0) + (parseInt(row.total_izin) || 0) + (parseInt(row.total_sakit) || 0) + (parseInt(row.total_cuti) || 0) + (parseInt(row.alpa) || 0) + (parseInt(row.total_dl) || 0);
                if (totalHariKerja < totalKehadiranPre) totalHariKerja = totalKehadiranPre;
                
                // Rumus Poin: (Poin Variabel * % Hadir) + (Hari Tugas Tambahan * Poin Admin)
                const persentaseHadir = totalHariKerja > 0 ? hMasuk / totalHariKerja : 0;
                const totalPoinIndividu = (poinVariabelKetenagaan * persentaseHadir) + (hAdmin * poinAdminPerHari);
                grandTotalPoinSeluruhPegawai += totalPoinIndividu;
            });

            const nilaiPerSatuPoin = grandTotalPoinSeluruhPegawai > 0 ? jaspelPool / grandTotalPoinSeluruhPegawai : 0;

            // Tampilkan Info Jaspel di Header Tabel
            const jaspelInfo = document.getElementById('jaspel-summary-info');
            if (jaspelInfo) {
                jaspelInfo.innerHTML = `Total Jasa 60%: <b>${new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR'}).format(jaspelPool)}</b> | Nilai/Poin: <b>${new Intl.NumberFormat('id-ID').format(nilaiPerSatuPoin)}</b>`;
            }

            let htmlContent = '';
            result.data.forEach((row, index) => {
                // Hitung total saat looping
                tHadir += parseInt(row.total_masuk) || 0;
                tDL += parseInt(row.total_dl) || 0;
                tSakit += parseInt(row.total_sakit) || 0;
                tIzin += parseInt(row.total_izin) || 0;
                tCuti += parseInt(row.total_cuti) || 0;
                tAlpa += parseInt(row.alpa) || 0;
                tTelat += parseInt(row.telat_kali) || 0;
                tTelatMin += parseInt(row.telat_menit) || 0;
                tPsw += parseInt(row.psw_kali) || 0;
                tPswMin += parseInt(row.psw_menit) || 0;
                
                // [MODIFIED] Hitung total pelanggaran baru (telat + psw + potongan jam)
                const totalMenitPelanggaranBaru = (parseInt(row.total_pelanggaran_menit) || 0) + ((parseInt(row.potongan_jam) || 0) * 60);
                tPelanggaranMin += totalMenitPelanggaranBaru;
                tNoOut += parseInt(row.tanpa_absen_pulang) || 0;
                tPot += parseFloat(row.potongan_jam) || 0;

                // [NEW] Hitung Estimasi Gaji per Pegawai
                let gajiPokok = defGaji;
                // Cek override gaji per jabatan
                if (config.gajiJabatanStr && row.jabatan) {
                    const lines = config.gajiJabatanStr.split('\n');
                    for (const line of lines) {
                        const parts = line.split('=');
                        if (parts.length === 2) {
                            const jobTitle = parts[0].trim().toLowerCase();
                            const salary = parseInt(parts[1].trim());
                            if (row.jabatan.toLowerCase() === jobTitle && !isNaN(salary)) {
                                gajiPokok = salary;
                                break; 
                            }
                        }
                    }
                }
                
                // [NEW] Hitung Jaspel Individu (Detailed)
                const pJabatan = mapJabatan[row.jabatan?.toLowerCase()] || 0;
                const pPendidikan = mapPendidikan[row.pendidikan?.toLowerCase()] || 0;
                const pJenis = mapJenis[row.jenis_ketenagaan?.toLowerCase()] || 0;
                const pStatus = mapStatus[row.status_kepegawaian?.toLowerCase()] || 0;
                const varKetenagaan = pJabatan + pPendidikan + pJenis + pStatus;

                const h = (parseInt(row.total_masuk) || 0) + (parseInt(row.total_dl) || 0);
                let totalHariKerja = parseInt(row.total_hari_kerja) || 20;
                const totalKehadiran = (parseInt(row.total_masuk) || 0) + (parseInt(row.total_izin) || 0) + (parseInt(row.total_sakit) || 0) + (parseInt(row.total_cuti) || 0) + (parseInt(row.alpa) || 0) + (parseInt(row.total_dl) || 0);
                if (totalHariKerja < totalKehadiran) totalHariKerja = totalKehadiran;
                const persentaseHadir = totalHariKerja > 0 ? h / totalHariKerja : 0;
                const totalPoinIndividu = (varKetenagaan * persentaseHadir) + ((parseInt(row.total_admin) || 0) * poinAdminPerHari);
                const estimasiJaspel = totalPoinIndividu * nilaiPerSatuPoin;

                const totalHarian = h * (uangMakan + uangTransport);
                const totalPendapatan = gajiPokok + tunjanganJabatan + totalHarian + estimasiJaspel;
                const totalDenda = ((parseInt(row.telat_kali) || 0) * dTelat) + 
                                   ((parseInt(row.alpa) || 0) * dAlpa) + 
                                   ((parseInt(row.psw_kali) || 0) * dPsw) + 
                                   ((parseInt(row.tanpa_absen_pulang) || 0) * dLupa);
                const totalPotongan = totalDenda + bpjs + pajak;
                totalGaji += Math.max(0, totalPendapatan - totalPotongan);

                // Hitung Persentase Kehadiran
                // [FIX] DL kembali digabung ke dalam persentase karena total_masuk murni sudah tidak memuat DL.
                const totalMasukDanDL = (parseInt(row.total_masuk) || 0) + (parseInt(row.total_dl) || 0);
                const persentase = totalHariKerja > 0 ? Math.round((totalMasukDanDL / totalHariKerja) * 100) : 0;

                htmlContent += `
                    <tr onclick="openModal('${row.id_karyawan}')" class="cursor-pointer hover:bg-emerald-50/30 border-b border-slate-200 last:border-0 group">
                        <td class="md:sticky md:left-0 md:z-10 sticky-col group-hover:!bg-emerald-50/30 px-6 py-3 text-center font-mono text-slate-800 md:border-r border-slate-200 print:static print:bg-white print:border-b print:border-black">${index + 1}</td>
                        <td class="md:sticky md:left-16 md:z-10 sticky-col group-hover:!bg-emerald-50/30 px-6 py-3 font-mono text-slate-800 md:border-r border-slate-200 print:static print:bg-white print:border-b print:border-black text-center">${row.id_karyawan}</td>
                        <td class="md:sticky md:left-40 md:z-10 sticky-col group-hover:!bg-emerald-50/30 px-6 py-3 font-bold text-slate-800 md:border-r border-slate-200 md:shadow-sm print:static print:bg-white print:border-b print:border-black">${row.nama}</td>
                        <td class="pl-16 pr-6 py-3 text-sm text-slate-600 uppercase tracking-wide font-semibold">${row.jabatan || '-'}</td>
                        <td class="px-6 py-3 text-center">
                            <span class="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold text-xs border border-emerald-200">${row.total_masuk}</span>
                        </td>
                        <td class="px-6 py-3 text-center cursor-pointer hover:bg-slate-50" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'DL');" title="Klik untuk melihat di Data View Absensi Harian">
                            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded font-bold text-xs border border-blue-200">${row.total_dl || 0}</span>
                        </td>
                        <td class="px-6 py-3 text-center bg-rose-50/50 text-rose-700 font-bold border-l border-r border-slate-200 cursor-pointer hover:bg-rose-100 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'SAKIT');" title="Klik untuk melihat di Data View Absensi Harian">${row.total_sakit || 0}</td>
                        <td class="px-6 py-3 text-center bg-purple-50/50 text-purple-700 font-bold border-r border-slate-200 cursor-pointer hover:bg-purple-100 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'IZIN');" title="Klik untuk melihat di Data View Absensi Harian">${row.total_izin || 0}</td>
                        <td class="px-6 py-3 text-center bg-orange-50/50 text-orange-700 font-bold border-r border-slate-200 cursor-pointer hover:bg-orange-100 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'CUTI');" title="Klik untuk melihat di Data View Absensi Harian">${row.total_cuti || 0}</td>
                        <td class="px-6 py-3 text-center ${row.alpa > 0 ? 'text-red-600 font-black cursor-pointer hover:underline hover:bg-red-50' : 'text-slate-300 cursor-pointer hover:bg-slate-50'} transition-colors" onclick="event.stopPropagation(); showPelanggaranDates('${row.id_karyawan}', '${escapeHtml(row.nama)}', 'alpa');" title="Klik untuk melihat tanggal Alpa">${row.alpa}</td>
                        <td class="px-6 py-3 text-center font-bold ${persentase >= 95 ? 'text-emerald-600' : (persentase >= 80 ? 'text-blue-600' : 'text-red-600')}">${persentase}%</td>
                        <td class="px-6 py-3 text-center ${row.telat_kali > 0 ? 'text-amber-600 font-black cursor-pointer hover:underline hover:bg-amber-50' : 'text-slate-300 cursor-pointer hover:bg-slate-50'} transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}');" title="Klik untuk melihat di Data View Absensi Harian">${row.telat_kali}</td>
                        <td class="px-6 py-3 text-center text-slate-500">${formatPelanggaranToHHMMSS(row.telat_menit)}</td>
                        <td class="px-6 py-3 text-center ${row.psw_kali > 0 ? 'text-amber-600 font-black cursor-pointer hover:underline hover:bg-amber-50' : 'text-slate-300'}" ${row.psw_kali > 0 ? `onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}');"` : ''} title="Klik untuk melihat di Data View Absensi Harian">${row.psw_kali || 0}</td>
                        <td class="px-6 py-3 text-center ${row.psw_menit > 0 ? 'text-amber-600' : 'text-slate-300'}">${formatPelanggaranToHHMMSS(row.psw_menit || 0)}</td>
                        <td class="px-6 py-3 text-center font-bold text-red-600 bg-red-50 border-l border-slate-200">${formatPelanggaranToHHMMSS(totalMenitPelanggaranBaru)}</td>
                        <td class="px-6 py-3 text-center ${row.tanpa_absen_pulang > 0 ? 'text-red-600 font-black cursor-pointer hover:underline hover:bg-red-50' : 'text-slate-300'}" ${row.tanpa_absen_pulang > 0 ? `onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'Tanpa Absen Pulang');"` : ''} title="Klik untuk melihat di Data View Absensi Harian">${row.tanpa_absen_pulang}</td>
                        <td class="px-6 py-3 text-center text-red-600">${row.potongan_jam} Jam</td>
                        <td class="px-6 py-3 text-center font-mono text-emerald-600 font-bold">${row.total_jam_kerja || '00:00:00'}</td>
                        <td class="px-6 py-3 text-center print:hidden">
                            <button onclick="event.stopPropagation(); deleteEmployee('${row.id_karyawan}', '${escapeHtml(row.nama)}')" class="w-8 h-8 rounded flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all" title="Hapus Pegawai">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            htmlContent += `
                <tr class="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800 print:bg-gray-200 print:border-black break-inside-avoid group">
                    <td colspan="4" class="px-6 py-3 text-right uppercase text-xs tracking-wider">Total Ringkasan:</td>
                    <td class="px-6 py-3 text-center">${tHadir}</td>
                    <td class="px-6 py-3 text-center">${tDL}</td>
                    <td class="px-6 py-3 text-center text-rose-800 bg-rose-100">${tSakit}</td>
                    <td class="px-6 py-3 text-center text-purple-800 bg-purple-100">${tIzin}</td>
                    <td class="px-6 py-3 text-center text-orange-800 bg-orange-100">${tCuti}</td>
                    <td class="px-6 py-3 text-center">${tAlpa}</td>
                    <td class="px-6 py-3 text-center">-</td>
                    <td class="px-6 py-3 text-center">${tTelat}</td>
                    <td class="px-6 py-3 text-center text-slate-500 text-xs">${formatPelanggaranToHHMMSS(tTelatMin)}</td>
                    <td class="px-6 py-3 text-center">${tPsw}</td>
                    <td class="px-6 py-3 text-center text-slate-500 text-xs">${formatPelanggaranToHHMMSS(tPswMin)}</td>
                    <td class="px-6 py-3 text-center font-bold text-red-600 bg-red-50 border-l border-slate-300">${formatPelanggaranToHHMMSS(tPelanggaranMin)}</td>
                    <td class="px-6 py-3 text-center">${tNoOut}</td>
                    <td class="px-6 py-3 text-center">${tPot}</td>
                    <td class="px-6 py-3"></td>
                    <td class="px-6 py-3 print:hidden"></td>
                </tr>
                <!-- [NEW] Baris Total Pengeluaran Gaji -->
                <tr class="bg-emerald-50 font-bold border-t border-emerald-200 text-emerald-900 print:bg-white print:border-black break-inside-avoid">
                    <td colspan="15" class="px-6 py-4 text-right uppercase text-sm tracking-wider">
                        Total Estimasi Pengeluaran Gaji (Bulan Ini):
                    </td>
                    <td colspan="4" class="px-6 py-4 text-right text-xl font-black text-emerald-800 border-l border-emerald-200">
                        ${new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalGaji)}
                    </td>
                    <td class="print:hidden"></td>
                </tr>
            `;
            tbody.innerHTML = htmlContent;
        } else {
            tbody.innerHTML = '<tr><td colspan="15" class="p-4 text-center text-slate-500">Tidak ada data untuk periode ini.</td></tr>';
        }

        // [NEW] Re-apply search filter if exists (Agar hasil pencarian tidak hilang saat refresh)
        const searchInput = document.getElementById('search-rekap');
        if (searchInput && searchInput.value) {
            filterTable('table-rekap-body', 'search-rekap');
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (!silent) hideSpinner();
    }
}

// --- FITUR: TAMPILKAN DETAIL TANGGAL PELANGGARAN ---
async function showPelanggaranDates(idKaryawan, namaKaryawan, tipe) {
    const month = document.getElementById('filter-month').value;
    const title = tipe === 'tanpa_pulang' ? 'Detail Tanpa Absen Pulang' : (tipe === 'alpa' ? 'Detail Alpa (Tidak Hadir)' : (tipe === 'psw' ? 'Detail Pulang Sebelum Waktunya (PSW)' : 'Detail Pelanggaran'));
    
    // Helper: Tutup modal dan refresh rekap agar angka selalu sinkron
    const closeAndRefresh = () => {
        const m = document.getElementById('modal-pelanggaran-dates');
        if (m) {
            m.classList.add('opacity-0');
            setTimeout(() => { m.classList.add('hidden'); loadMonthlyRecap(true); }, 300);
        }
    };
    window._closePelanggaranModal = closeAndRefresh;

    // Create simple modal dynamically
    const modalId = 'modal-pelanggaran-dates';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'fixed inset-0 z-[999999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-0 hidden';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl w-[450px] max-w-full overflow-hidden transform scale-95 transition-transform duration-300 relative">
                <div class="bg-slate-800 p-4 flex justify-between items-center text-white">
                    <div>
                        <h3 class="font-bold text-lg" id="${modalId}-title">Detail</h3>
                        <p class="text-xs text-slate-400 mt-0.5" id="${modalId}-count"></p>
                    </div>
                    <button onclick="window._closePelanggaranModal()" class="text-slate-400 hover:text-white transition-colors">
                        <i class="fa-solid fa-xmark fa-lg"></i>
                    </button>
                </div>
                <div class="p-4">
                    <p class="text-sm text-slate-600 mb-4 font-bold"><i class="fa-regular fa-user mr-2"></i><span id="${modalId}-nama"></span></p>
                    <div id="${modalId}-content" class="max-h-[400px] overflow-y-auto pr-2 space-y-2">
                        <div class="text-center py-4 text-slate-500"><i class="fa-solid fa-circle-notch fa-spin"></i> Memuat data...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById(`${modalId}-title`).textContent = title;
    document.getElementById(`${modalId}-nama`).textContent = namaKaryawan;
    document.getElementById(`${modalId}-count`).textContent = '';
    document.getElementById(`${modalId}-content`).innerHTML = '<div class="text-center py-4 text-slate-500"><i class="fa-solid fa-circle-notch fa-spin"></i> Memuat data...</div>';
    
    modal.classList.remove('hidden');
    // Trigger reflow
    void modal.offsetWidth;
    modal.classList.remove('opacity-0');
    modal.querySelector('.transform').classList.remove('scale-95');
    
    try {
        const response = await fetch(`${API_BASE}/absensi/history/${idKaryawan}?periode=${month}&tipe=${tipe}`);
        const result = await response.json();
        
        let html = '';
        if (result.success && result.data && result.data.length > 0) {
            // Tampilkan jumlah total di header modal
            document.getElementById(`${modalId}-count`).textContent = `Total: ${result.data.length} kejadian`;

            result.data.forEach((item, idx) => {
                const dateObj = new Date(item.tanggal);
                const dateStr = dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                // Format YYYY-MM-DD for checking daily
                const yyyy = dateObj.getFullYear();
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const isoDate = `${yyyy}-${mm}-${dd}`;
                
                html += `
                    <div onclick="window._closePelanggaranModal(); setTimeout(() => checkDailyFromRecap('${isoDate}'), 400);" 
                         class="p-3 border border-slate-200 rounded-lg bg-slate-50 hover:bg-white hover:border-blue-400 hover:shadow-md cursor-pointer transition-all flex justify-between items-center group">
                        <div>
                            <div class="font-bold text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">${idx + 1}. ${dateStr}</div>
                            <div class="text-xs text-slate-500 font-mono">
                                Masuk: <span class="text-emerald-600 font-bold">${item.jam_masuk || '-'}</span> | 
                                Keluar: <span class="text-rose-600 font-bold">${item.jam_keluar || '-'}</span>
                            </div>
                            <div class="text-xs text-rose-600 mt-1 italic"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${item.keterangan || 'Tanpa Absen Pulang'}</div>
                        </div>
                        <div class="flex items-center gap-2">
                            ${tipe === 'alpa' ? `<button onclick="event.stopPropagation(); hapusAlpaDirect('${idKaryawan}', '${isoDate}');" class="px-3 py-1 bg-rose-100 hover:bg-rose-500 hover:text-white text-rose-600 text-xs font-bold rounded shadow-sm transition-colors z-10 relative">Hapus</button>` : ''}
                            <div class="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
                `;
            });
        } else {
            html = '<div class="text-center py-4 text-slate-500 italic">Tidak ada data detail.</div>';
        }
        document.getElementById(`${modalId}-content`).innerHTML = html;
    } catch (e) {
        document.getElementById(`${modalId}-content`).innerHTML = `<div class="text-center py-4 text-red-500">Error: ${e.message}</div>`;
    }
}

// --- FITUR: HAPUS ALPA LANGSUNG DARI MODAL ---
async function hapusAlpaDirect(id_karyawan, tanggal) {
    if(!confirm('Anda yakin ingin menghapus ALPA untuk tanggal ini? (Akan diset menjadi Libur/Dihapus)')) return;
    try {
        const response = await fetch(`${API_BASE}/absensi/manual`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_karyawan, status: 'LIBUR', keterangan: 'Penghapusan Alpa (Manual)', tanggal, jam_masuk: null, jam_keluar: null })
        });
        const result = await response.json();
        if (response.ok && result.success) {
            showToast("Alpa berhasil dihapus!", 'success');
            if(window._closePelanggaranModal) window._closePelanggaranModal();
        } else {
            showToast("Gagal menghapus Alpa: " + result.message, 'error');
        }
    } catch(e) {
        showToast("Error jaringan", 'error');
    }
}

// --- FITUR: SHORTCUT CEK HARIAN DARI REKAP ---
function checkDailyFromRecap(dateVal) {
    if (!dateVal) return;
    
    const dailyInput = document.getElementById('filter-daily-date');
    if (dailyInput) {
        dailyInput.value = dateVal;
        switchTab('daily'); // Pindah tab & otomatis load data
        
        // Reset input ini agar bisa pilih tanggal yang sama lagi jika kembali
        const sourceInput = document.getElementById('quick-daily-check');
        if (sourceInput) sourceInput.value = '';
    }
}

// --- FITUR: SHORTCUT KE DATA VIEW DB DARI REKAP PSW ---
function jumpToViewDbForEmployee(namaKaryawan, extraFilter = '') {
    const month = document.getElementById('filter-month').value;
    
    // Switch to Data View Absensi Harian tab
    switchTab('view-db');
    
    // FORCE HIDE view-monthly just in case switchTab fails or something overrides it
    document.getElementById('view-monthly').classList.add('hidden');
    document.getElementById('view-monthly').style.display = 'none';
    
    // Set type to monthly
    document.getElementById('filter-view-db-type').value = 'monthly';
    
    // Show/hide correct inputs
    document.getElementById('filter-view-db-date').classList.add('hidden');
    document.getElementById('filter-view-db-month').classList.remove('hidden');
    
    // Set the month
    document.getElementById('filter-view-db-month').value = month;
    
    // Set the search text dengan extraFilter jika ada
    const searchInput = document.getElementById('search-view-db');
    searchInput.value = extraFilter ? `${namaKaryawan} ${extraFilter}` : namaKaryawan;
    
    // Load the data and filter
    loadViewDbData().then(() => {
        filterTable('table-view-db-body', 'search-view-db');
        document.getElementById('view-view-db').style.display = 'block';
    });
}

// --- DATA LOADER: PERFORMANCE MONITORING (SCORING SYSTEM) ---
function calculatePerformanceScore(emp) {
    // Skor Awal: 100
    // -5 poin per kali telat
    // -10 poin per hari alpa
    // -2 poin per jam potongan (lupa pulang)
    // -3 poin per kali PSW (Pulang Sebelum Waktunya) -> PENALTI BARU
    let score = 100 - (emp.telat_kali * 5) - (emp.alpa * 10) - (emp.potongan_jam * 2) - ((emp.psw_kali || 0) * 3);
    return Math.max(0, score);
}

async function loadPerformanceData(silent = false) {
    const grid = document.getElementById('performance-grid');
    
    if (!silent) showSpinner();

    try {
        // Gunakan data rekap bulan ini untuk analisis
        const month = document.getElementById('filter-month').value;
        const response = await fetch(`${API_BASE}/rekap?periode=${month}&_t=${Date.now()}`);
        const result = await response.json();
        
        globalPerformanceData = result.data || []; // Simpan ke global
        grid.innerHTML = '';

        if (result.data && result.data.length > 0) {
            result.data.forEach(emp => {
                // --- LOGIKA SCORING KINERJA ---
                const score = calculatePerformanceScore(emp);

                // Tentukan Status & Warna
                let status = 'SANGAT BAIK';
                let colorClass = 'border-emerald-500 text-emerald-600 bg-emerald-50/30';
                let icon = 'fa-medal';

                if (score < 60) {
                    status = 'PERLU PEMBINAAN';
                    colorClass = 'border-rose-500 text-rose-700 bg-rose-50/30';
                    icon = 'fa-triangle-exclamation';
                } else if (score < 80) {
                    status = 'CUKUP';
                    colorClass = 'border-amber-500 text-amber-600 bg-amber-50/30';
                    icon = 'fa-circle-exclamation';
                } else if (score < 90) {
                    status = 'BAIK';
                    colorClass = 'border-blue-500 text-blue-600 bg-blue-50/30';
                    icon = 'fa-thumbs-up';
                }

                // Render Card
                const card = `
                    <div onclick="openModal('${emp.id_karyawan}')" class="bg-white rounded-2xl p-6 border-t-4 ${colorClass} relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer shadow-md border border-slate-200/80">
                        <div class="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition">
                            <i class="fa-solid ${icon} text-6xl"></i>
                        </div>
                        
                        <div class="relative z-10">
                            <h3 class="text-lg font-bold text-[#064e3b] truncate">${escapeHtml(emp.nama)}</h3>
                            <p class="text-xs text-gray-500 mb-4 uppercase tracking-wide">${escapeHtml(emp.jabatan || 'Staff')} • ID: ${emp.id_karyawan}</p>
                            
                            <div class="flex items-end gap-2 mb-2">
                                <span class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-emerald-500">${score}</span>
                                <span class="text-sm text-gray-400 mb-1">/ 100</span>
                            </div>
                            
                            <div class="w-full bg-slate-100 h-2.5 rounded-full mb-4 overflow-hidden">
                                <div class="h-full ${colorClass.replace('text', 'bg').split(' ')[1]}" style="width: ${score}%"></div>
                            </div>

                            <div class="grid grid-cols-3 gap-2 text-center text-xs">
                                <div class="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60">
                                    <div class="text-gray-500">Hadir</div>
                                    <div class="font-bold text-[#064e3b]">${emp.total_masuk}</div>
                                    ${emp.total_dl ? `<div class="text-[9px] text-blue-500">(${emp.total_dl} DL)</div>` : ''}
                                </div>
                                <div class="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60">
                                    <div class="text-gray-500">Telat</div>
                                    <div class="font-bold text-amber-600">${emp.telat_kali}</div>
                                </div>
                                <div class="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/60">
                                    <div class="text-gray-500">Alpa</div>
                                    <div class="font-bold text-red-600">${emp.alpa || 0}</div>
                                </div>
                            </div>

                            <div class="mt-4 text-center font-bold text-xs tracking-widest ${colorClass.split(' ')[1]} border border-dashed border-gray-300 p-2 rounded uppercase">
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
    } finally {
        if (!silent) hideSpinner();
    }
}

// --- DATA LOADER: EMPLOYEES DIRECTORY (NEW) ---
async function loadEmployees(silent = false) {
    const grid = document.getElementById('employees-grid');
    const countSpan = document.getElementById('total-emp-count');
    
    if (!silent) showSpinner();
    let corruptCount = 0; // [NEW] Hitung jumlah data rusak

    try {
        const response = await fetch(`${API_BASE}/karyawan/descriptors?_t=${Date.now()}`);
        const result = await response.json();
        const employees = result.descriptors || [];
        globalEmployees = employees; // Simpan ke global agar bisa diedit
        
        countSpan.textContent = employees.length;
        grid.innerHTML = '';

        if (employees.length > 0) {
            employees.forEach(emp => {
                // Gunakan foto asli jika ada, jika tidak pakai avatar UI
                const photoSrc = emp.foto ? `data:image/jpeg;base64,${emp.foto}` : `https://ui-avatars.com/api/?name=${emp.nama}&background=10b981&color=fff`;

                // [NEW] Hitung Jumlah Sampel Wajah
                let sampleCount = 0;
                let isCorrupt = false; // Flag untuk data rusak

                if (Array.isArray(emp.face_descriptor)) {
                    if (emp.face_descriptor.length > 0 && Array.isArray(emp.face_descriptor[0])) {
                        sampleCount = emp.face_descriptor.length; // Multi Sample
                        // Validasi sampel pertama
                        if (emp.face_descriptor[0].length !== 128) isCorrupt = true;
                    } else if (emp.face_descriptor.length > 0) {
                        sampleCount = 1; // Single Sample (Legacy)
                        // Validasi panjang array harus 128
                        if (emp.face_descriptor.length !== 128) isCorrupt = true;
                    }
                } else {
                    // Jika bukan array (misal null/object kosong), anggap 0
                    sampleCount = 0;
                }
                
                // Cek jika sampel ada tapi terdeteksi corrupt
                if (sampleCount > 0 && isCorrupt) {
                    sampleCount = -1; // Tandai error
                    corruptCount++; // [NEW] Increment counter
                    // [DEBUG] Tampilkan detail data rusak di Console (Tekan F12 di browser)
                    console.group(`🚨 DATA RUSAK DITEMUKAN: ${emp.nama}`);
                    console.error(`ID: ${emp.id_karyawan}`);
                    console.error("Raw Descriptor:", emp.face_descriptor);
                    console.groupEnd();
                }

                // [NEW] Warna Badge Sampel (Indikator Kualitas Data)
                let sampleBadgeColor = 'bg-red-50 text-red-600 border-red-100'; // 0 Sampel (Buruk)
                if (sampleCount >= 5) sampleBadgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-100'; // Sangat Baik
                else if (sampleCount >= 3) sampleBadgeColor = 'bg-blue-50 text-blue-600 border-blue-100'; // Baik
                else if (sampleCount >= 1) sampleBadgeColor = 'bg-amber-50 text-amber-600 border-amber-100'; // Cukup

                let sampleLabel = `${sampleCount} Sampel`;
                if (sampleCount === -1 || isCorrupt) {
                    sampleLabel = "DATA RUSAK";
                    sampleBadgeColor = "bg-red-600 text-white border-red-700 animate-pulse font-bold";
                }

                const card = `
                    <div class="bg-white rounded-2xl shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-300 group border border-slate-200/80 overflow-hidden relative flex flex-col">
                        <!-- Decorative Top Bar -->
                        <div class="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700"></div>
                        
                        <div class="p-5 flex items-start gap-4">
                            <!-- Avatar -->
                            <div onclick="openModal('${emp.id_karyawan}')" class="cursor-pointer relative flex-shrink-0">
                                <div class="w-16 h-16 rounded-full p-0.5 bg-gray-100 shadow-sm group-hover:scale-105 transition-transform duration-300">
                                    <img src="${photoSrc}" class="w-full h-full object-cover rounded-full border-2 border-white bg-slate-100">
                                </div>
                            </div>

                            <!-- Info -->
                            <div class="flex-1 min-w-0">
                                <div class="flex justify-between items-start">
                                    <div onclick="openModal('${emp.id_karyawan}')" class="cursor-pointer flex-1 min-w-0 mr-2">
                                        <h4 class="text-slate-800 font-bold truncate text-base group-hover:text-emerald-600 transition-colors" title="${escapeHtml(emp.nama)}">${escapeHtml(emp.nama)}</h4>
                                        <div class="flex flex-wrap items-center gap-2 mt-1">
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wide truncate max-w-full">${escapeHtml(emp.jabatan || 'Staff')}</span>
                                            <!-- [NEW] Badge Sampel Wajah -->
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sampleBadgeColor} border uppercase tracking-wide truncate" title="Status Data Wajah">
                                                <i class="fa-solid fa-fingerprint mr-1"></i>${sampleLabel}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mt-3 flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <i class="fa-solid fa-id-badge text-gray-400"></i>
                                        <span class="font-bold text-gray-700">${emp.id_karyawan}</span>
                                    </div>
                                    
                                    <!-- Actions -->
                                    <div class="flex gap-1">
                                        <button onclick="window.location.href='admin.html?id=${emp.id_karyawan}&name=${encodeURIComponent(emp.nama)}&role=${encodeURIComponent(emp.jabatan || '')}'" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100" title="Rekam Wajah / Update Descriptor">
                                            <i class="fa-solid fa-camera text-xs"></i>
                                        </button>
                                        <button onclick="resetPasswordPortal('${emp.id_karyawan}', this.dataset.name)" data-name="${escapeHtml(emp.nama)}" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all border border-transparent hover:border-purple-100" title="Reset Password Portal">
                                            <i class="fa-solid fa-key text-xs"></i>
                                        </button>
                                        <button onclick="openEditModal('${emp.id_karyawan}')" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100" title="Edit">
                                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                                        </button>
                                        <button onclick="deleteEmployee('${emp.id_karyawan}', this.dataset.name)" data-name="${escapeHtml(emp.nama)}" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100" title="Hapus">
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

            // [NEW] Tampilkan Banner Peringatan & Tombol Hapus Massal jika ada data rusak
            if (corruptCount > 0) {
                const banner = `
                    <div class="col-span-full bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-4 animate-pulse">
                        <div class="flex items-center gap-3">
                            <i class="fa-solid fa-triangle-exclamation text-2xl"></i>
                            <div>
                                <p class="font-bold text-lg">PERINGATAN: Ditemukan ${corruptCount} Data Wajah Rusak!</p>
                                <p class="text-sm">Data ini dapat menyebabkan kesalahan deteksi (False Positive). Segera hapus dan rekam ulang.</p>
                            </div>
                        </div>
                        <button onclick="deleteAllCorruptData()" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded shadow-lg transition-all transform hover:scale-105 flex items-center gap-2">
                            <i class="fa-solid fa-trash-can"></i> Hapus Semua (${corruptCount})
                        </button>
                    </div>
                `;
                grid.insertAdjacentHTML('afterbegin', banner);
            }

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
    } finally {
        if (!silent) hideSpinner();
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
            // [NEW] Refresh Monthly Recap if active
            if (document.getElementById('view-monthly') && !document.getElementById('view-monthly').classList.contains('hidden')) {
                loadMonthlyRecap(true);
            }
            showToast('Pegawai berhasil dihapus', 'success');
        } else {
            showToast(`Gagal menghapus: ${result.message}`, 'error');
        }
    } catch(e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// --- FITUR: RESET PASSWORD PORTAL PEGAWAI ---
async function resetPasswordPortal(id, nama) {
    if(!confirm(`Apakah Anda yakin ingin me-reset password Portal Pegawai untuk "${nama}"?\n\nPassword akan di-reset menjadi default: 123456`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/pegawai/reset_password/${id}`, { method: 'PUT' });
        const result = await response.json();
        
        if(result.success) {
            showToast(result.message, 'success');
        } else {
            showToast(`Gagal mereset: ${result.message}`, 'warning');
        }
    } catch(e) {
        showToast(`Error koneksi: ${e.message}`, 'error');
    }
}

// --- FITUR: HAPUS SEMUA DATA RUSAK (MASS DELETE) ---
async function deleteAllCorruptData() {
    if (!confirm(`PERINGATAN KERAS:\n\nAnda akan menghapus SEMUA pegawai yang terdeteksi memiliki data wajah rusak.\nTindakan ini TIDAK DAPAT DIBATALKAN.\n\nApakah Anda yakin ingin melanjutkan?`)) return;

    // Filter pegawai yang datanya rusak (Logika sama dengan loadEmployees)
    const corruptEmployees = globalEmployees.filter(emp => {
        let isCorrupt = false;
        let sampleCount = 0;

        if (Array.isArray(emp.face_descriptor)) {
            if (emp.face_descriptor.length > 0 && Array.isArray(emp.face_descriptor[0])) {
                sampleCount = emp.face_descriptor.length;
                if (emp.face_descriptor[0].length !== 128) isCorrupt = true;
            } else if (emp.face_descriptor.length > 0) {
                sampleCount = 1;
                if (emp.face_descriptor.length !== 128) isCorrupt = true;
            }
        }
        
        return sampleCount > 0 && isCorrupt;
    });

    if (corruptEmployees.length === 0) {
        showToast("Tidak ada data rusak yang ditemukan.", "info");
        return;
    }

    showToast(`Memproses penghapusan ${corruptEmployees.length} data...`, "info");
    let successCount = 0;

    for (const emp of corruptEmployees) {
        try {
            const response = await fetch(`${API_BASE}/karyawan/${emp.id_karyawan}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) successCount++;
        } catch (e) {
            console.error(`Gagal hapus ${emp.nama}`, e);
        }
    }

    showToast(`Selesai! Berhasil menghapus ${successCount} dari ${corruptEmployees.length} data rusak.`, "success");
    loadEmployees(); // Refresh halaman
    loadOverviewData(); // Update statistik
}

// --- FITUR: EDIT EMPLOYEE ---
function openEditModal(id) {
    let emp = globalEmployees.find(e => e.id_karyawan === id);
    if (!emp) emp = globalPerformanceData.find(e => e.id_karyawan === id); // Fallback cari di data rekap
    if (!emp) return;

    document.getElementById('edit-id').value = emp.id_karyawan;
    document.getElementById('edit-id-display').value = emp.id_karyawan;
    document.getElementById('edit-nama').value = emp.nama;
    document.getElementById('edit-jabatan').value = emp.jabatan || '';
    document.getElementById('edit-no-urut').value = (emp.no_urut && emp.no_urut !== 9999) ? emp.no_urut : '';

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

// Helper: Convert File to Base64
const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

async function updateEmployee() {
    const id = document.getElementById('edit-id').value;
    const nama = document.getElementById('edit-nama').value;
    const jabatan = document.getElementById('edit-jabatan').value;
    const no_urut = document.getElementById('edit-no-urut').value;
    const fileInput = document.getElementById('edit-foto-input');

    try {
        // 1. Update Data Teks (Nama & Jabatan)
        const response = await fetch(`${API_BASE}/karyawan/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nama, jabatan, no_urut })
        });
        const result = await response.json();

        if (!result.success) throw new Error(result.message);

        // 2. Update Foto (Jika ada file dipilih)
        if (fileInput && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto terlalu besar (Max 5MB).");
            
            const base64Foto = await toBase64(file);
            const resFoto = await fetch(`${API_BASE}/karyawan/${encodeURIComponent(id)}/photo`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ foto: base64Foto })
            });
            
            const resFotoJson = await resFoto.json();
            if (!resFotoJson.success) throw new Error("Gagal upload foto: " + resFotoJson.message);
        }

        showToast('Data pegawai & foto berhasil diperbarui!', 'success');
        closeEditModal();
        loadEmployees(); // Refresh list
        loadOverviewData();
        
        // [NEW] Refresh Monthly Recap if active (Agar urutan nama langsung berubah)
        if (document.getElementById('view-monthly') && !document.getElementById('view-monthly').classList.contains('hidden')) {
            loadMonthlyRecap(true);
        }
        
        // Reset input file
        if(fileInput) fileInput.value = '';

    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// --- FITUR: RESET BIOMETRIC DATA (HAPUS FOTO & DESCRIPTOR) ---
async function resetBiometricData() {
    const id = document.getElementById('edit-id').value;
    if (!id) return showToast('ID Pegawai tidak valid.', 'error');

    if (!confirm('PERINGATAN: Apakah Anda yakin ingin menghapus FOTO dan DATA WAJAH pegawai ini?\n\nPegawai tidak akan bisa absen sampai melakukan perekaman ulang.')) return;

    try {
        // Encode ID untuk menangani karakter spesial dan cek status server
        const response = await fetch(`${API_BASE}/karyawan/${encodeURIComponent(id)}/reset_biometric`, { method: 'PUT' });
        
        if (!response.ok) throw new Error(`Gagal menghubungi server (${response.status}). Pastikan server.js sudah direstart.`);
        
        const result = await response.json();

        if (result.success) {
            showToast('Data biometrik berhasil direset!', 'success');
            closeEditModal();
            loadEmployees(); // Refresh list (akan muncul status "0 Sampel")
        } else {
            showToast(`Gagal: ${result.message}`, 'error');
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
    
    // [NEW] Reset Search Filter saat modal dibuka
    const searchInput = document.getElementById('search-manual-emp');
    if (searchInput) {
        searchInput.value = '';
        filterManualEmp(); // Reset visibility options
    }

    // --- LOGIKA UI: Show/Hide Input Waktu Manual ---
    const typeSelect = document.getElementById('manual-type');
    const timeContainer = document.getElementById('manual-time-container');
    
    if (typeSelect && timeContainer) {
        typeSelect.onchange = function() {
            // [UPDATE] Tampilkan input waktu untuk HADIR_MANUAL dan DL agar bisa set jam kerja custom
            if (this.value === 'HADIR_MANUAL' || this.value === 'DL') {
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
                const res = await fetch(`${API_BASE}/karyawan/descriptors?_t=${Date.now()}`);
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
            loadDailyData(); // Refresh tabel harian
            loadOverviewData(); // Refresh statistik atas (Hadir/Alpa)
        } else {
            // Tampilkan pesan error asli dari server
            showToast(`Gagal menyimpan: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast("Error koneksi: " + e.message, 'error');
    }
}

// --- FITUR: DELETE ABSENSI (VIEW DB) ---
async function deleteAbsensiDb(id, nama) {
    if (!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus data absensi (ID: ${id}) untuk "${nama}"?\n\nData yang dihapus tidak dapat dikembalikan.`)) return;

    try {
        const response = await fetch(`${API_BASE}/absensi/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            showToast('Data absensi berhasil dihapus', 'success');
            loadViewDbData(); // Refresh tabel database
        } else {
            showToast(`Gagal menghapus: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
    }
}

// --- FITUR: DELETE ABSENSI HARIAN ---
async function deleteAbsensi(event, id, nama) {
    event.stopPropagation(); // Mencegah modal detail terbuka saat klik tombol hapus
    if (!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus data absensi harian untuk "${nama}"?\n\nData yang dihapus tidak dapat dikembalikan.`)) return;

    try {
        const response = await fetch(`${API_BASE}/absensi/${id}`, { method: 'DELETE' });
        const result = await response.json();

        if (result.success) {
            showToast('Data absensi berhasil dihapus', 'success');
            loadDailyData(); // Refresh tabel harian
            loadOverviewData(); // Refresh statistik
        } else {
            showToast(`Gagal menghapus: ${result.message}`, 'error');
        }
    } catch (e) {
        showToast(`Error: ${e.message}`, 'error');
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
                hoverBackgroundColor: ['#059669', '#d97706', '#e11d48'],
                borderWidth: 2,
                borderColor: '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: { 
                legend: { 
                    position: 'right', 
                    labels: { usePointStyle: true, padding: 20, boxWidth: 8, color: '#475569', font: {family: 'Inter', size: 11, weight: '500'} } 
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    bodyFont: { family: 'Inter', size: 13, weight: 'bold' },
                    borderColor: 'rgba(0,0,0,0.05)',
                    borderWidth: 1,
                    padding: 12,
                    boxPadding: 6,
                    usePointStyle: true,
                    callbacks: {
                        label: function(context) {
                            return ' ' + context.label + ': ' + context.raw + ' Pegawai';
                        }
                    }
                }
            }
        }
    });
}

// --- CHART RENDERER: LINE CHART (DYNAMIC) ---
async function updateChartFilter() {
    const start = document.getElementById('chart-start').value;
    const end = document.getElementById('chart-end').value;
    
    if(!start || !end) return;

    try {
        const response = await fetch(`${API_BASE}/stats/daily-range?start=${start}&end=${end}&_t=${Date.now()}`);
        
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
                borderColor: '#10b981', // Emerald 500
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
                    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
                    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                    return gradient;
                },
                borderWidth: 2,
                pointBackgroundColor: '#ffffff',
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
                y: { beginAtZero: true, grid: { borderDash: [4, 4], color: '#e2e8f0' }, ticks: { color: '#64748b', font: {family: 'Inter', size: 10}, stepSize: 1 } },
                x: { grid: { display: false }, ticks: { color: '#64748b', font: {family: 'Inter', size: 10} } }
            },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#0f172a',
                    bodyColor: '#334155',
                    titleFont: { family: 'Inter', size: 14, weight: 'bold' },
                    bodyFont: { family: 'Inter', size: 13, weight: '500' },
                    borderColor: 'rgba(0,0,0,0.05)',
                    borderWidth: 1,
                    padding: 12,
                    usePointStyle: true,
                    boxPadding: 6
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

// --- [NEW] HELPER: AMBIL LOKASI GPS ADMIN ---
function getCurrentLocation() {
    if ("geolocation" in navigator) {
        showToast("Mendapatkan posisi GPS...", "info");
        navigator.geolocation.getCurrentPosition(function (position) {
            if (document.getElementById('conf-lat')) document.getElementById('conf-lat').value = position.coords.latitude.toFixed(6);
            if (document.getElementById('conf-lon')) document.getElementById('conf-lon').value = position.coords.longitude.toFixed(6);
            showToast("Lokasi berhasil diambil!", "success");
        }, function (error) {
            showToast("Gagal mengambil lokasi: " + error.message, "error");
        }, { enableHighAccuracy: true });
    } else {
        showToast("Browser tidak mendukung geolokasi.", "error");
    }
}

// --- FITUR: SIDEBAR TOGGLE (Full Width) ---
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (sidebar) {
        const isMobile = window.innerWidth < 768;

        if (isMobile) {
            // Logika Mobile: Slide In/Out dari samping
            sidebar.classList.toggle('-translate-x-full');
            if (overlay) {
                if (overlay.classList.contains('hidden')) {
                    overlay.classList.remove('hidden');
                    setTimeout(() => overlay.classList.replace('opacity-0', 'opacity-100'), 10);
                } else {
                    overlay.classList.replace('opacity-100', 'opacity-0');
                    setTimeout(() => overlay.classList.add('hidden'), 300);
                }
            }
        } else {
            // Logika Desktop: Mempersempit layout
            sidebar.classList.toggle('md:-ml-64');
        }

        // Trigger resize event untuk memperbaiki layout grafik Chart.js
        setTimeout(() => window.dispatchEvent(new Event('resize')), 300);
    }
}

function setupSidebarToggle() {
    const title = document.getElementById('page-title');
    if (title && title.parentNode && !document.getElementById('btn-sidebar-toggle')) {
        const btn = document.createElement('button');
        btn.id = 'btn-sidebar-toggle';
        btn.className = 'mr-4 text-slate-500 hover:text-emerald-700 transition-colors p-1 rounded hover:bg-emerald-50';
        btn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
        btn.onclick = toggleSidebar;
        btn.title = "Sembunyikan Menu (Full Width)";
        title.parentNode.insertBefore(btn, title);
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
    const _now = new Date(); downloadLink.download = `Rekap_Absensi_${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}.csv`;
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}

// --- FITUR: PRINT REPORT ---
function printMonthlyMatrix() {
    printReport(true);
}

function printReport(forceMatrix = false) {
    const isMatrix = forceMatrix || document.getElementById('rekap-format')?.value === 'menyamping';
    
    // Update teks periode di header cetak
    let monthInput = document.getElementById('filter-month');
    if (isMatrix && document.getElementById('view-view-db-monthly') && !document.getElementById('view-view-db-monthly').classList.contains('hidden')) {
        monthInput = document.getElementById('filter-view-db-monthly-month');
    }
    
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

    // [NEW] INJECT TABEL KE AREA CETAK (Gaya Akademik & Resmi)
    let sourceTable = document.getElementById('table-rekap');
    if (isMatrix && document.getElementById('view-view-db-monthly') && !document.getElementById('view-view-db-monthly').classList.contains('hidden')) {
        sourceTable = document.getElementById('table-view-db-monthly');
    }
    const printContainer = document.getElementById('print-table-container');

    if (sourceTable && printContainer) {
        printContainer.innerHTML = ''; // Bersihkan konten lama
        
        // Clone tabel agar tidak merusak tampilan dashboard asli
        const tableClone = sourceTable.cloneNode(true);
        
        // Hapus class Tailwind yang tidak cocok untuk cetak resmi
        if (isMatrix) {
            tableClone.className = 'border-collapse border border-black text-[6pt] font-sans w-full';
        } else {
            tableClone.className = 'border-collapse border-2 border-black text-[12pt] font-serif leading-relaxed w-full';
        }
        
        // Styling Header (Hitam Putih, Tegas)
        const thead = tableClone.querySelector('thead');
        if (thead) {
            thead.className = 'bg-gray-200 text-black font-bold border-b-4 border-black';
            const ths = thead.querySelectorAll('th');
            ths.forEach(th => {
                // [FIX] Hapus kolom Aksi agar tidak terpotong saat dicetak
                if (th.classList.contains('print:hidden') || th.innerText.trim() === 'Aksi') {
                    th.remove();
                    return;
                }

                if (isMatrix) {
                    th.className = 'border border-black align-middle uppercase font-bold bg-gray-100 text-center text-black text-xs';
                    th.style.padding = '2px';
                    th.style.fontSize = '7pt';
                } else {
                    th.className = 'border-2 border-black px-4 py-2 text-center align-middle uppercase font-bold bg-gray-200 text-sm';
                }
                th.style.position = 'static'; // Hapus sticky
                // Hapus ikon sort
                const icon = th.querySelector('i');
                if (icon) icon.remove();
            });
        }

        // Styling Body (Border Hitam, Bersih dari Badge Warna)
        const tbody = tableClone.querySelector('tbody');
        if (tbody) {
            tbody.className = ''; 
            const rows = tbody.querySelectorAll('tr');
            rows.forEach(row => {
                row.className = ''; // Hapus class row (warna bg dll)
                row.style.display = ''; // Reset filter pencarian agar baris yang tersembunyi ikut tercetak
                row.removeAttribute('onclick'); // Hapus interaksi
                
                const cells = row.querySelectorAll('td');
                cells.forEach(cell => {
                    // [FIX] Hapus sel kolom Aksi agar tidak terpotong saat dicetak
                    if (cell.classList.contains('print:hidden')) {
                        cell.remove();
                        return;
                    }

                    // Kolom Nama (idx 2) dan ID (idx 1) dibuat lebih tebal dan besar
                    let extraStyle = '';
                    if (!isMatrix && (cell.cellIndex === 1 || cell.cellIndex === 2)) {
                        extraStyle = ' font-black text-[14pt]'; 
                    }

                    if (isMatrix) {
                        cell.className = 'border border-black align-middle text-center text-black text-xs';
                        cell.style.padding = '2px';
                        cell.style.fontSize = '7pt';
                    } else {
                        cell.className = 'border border-black px-2 py-2 align-middle text-black' + extraStyle;
                    }
                    cell.style.backgroundColor = 'transparent';
                    cell.style.color = 'black';
                    cell.style.position = 'static';
                    
                    // Bersihkan Badge/Icon dan berikan warna pada T, P, TAP serta line-break
                    if (cell.children.length > 0) {
                        let text = cell.innerText.trim();
                        text = text.replace(/\n/g, '<br>');
                        text = text.replace(/(T:\s*\d+m)/g, '<span style="color: red; font-weight: bold;">$1</span>');
                        text = text.replace(/(P:\s*\d+m)/g, '<span style="color: #b45309; font-weight: bold;">$1</span>'); // Amber-700
                        text = text.replace(/(TAP)/g, '<span style="color: red; font-weight: bold;">TAP</span>');
                        cell.innerHTML = text;
                    }
                });
            });
        }

        printContainer.appendChild(tableClone);
    }

    // Pastikan data tanda tangan terbaru diterapkan sebelum print
    applySignatureToPrint();

    window.print();
}

// --- FITUR: MODAL DETAIL PEGAWAI ---
async function openModal(idKaryawan) {
    let emp = globalPerformanceData.find(e => e.id_karyawan === idKaryawan);
    
    // [FIX] Jika data tidak ditemukan (misal dibuka dari tab Harian sebelum Rekap dimuat)
    if (!emp) {
        try {
            // Fetch data rekap bulan ini (default)
            const now = new Date();
            const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const response = await fetch(`${API_BASE}/rekap?periode=${monthStr}&_t=${Date.now()}`);
            const result = await response.json();
            
            if (result.success) {
                globalPerformanceData = result.data || [];
                emp = globalPerformanceData.find(e => e.id_karyawan === idKaryawan);
            }
        } catch (e) {
            console.error("Gagal memuat data rekap untuk modal:", e);
        }
    }

    // [FIX] Fallback jika pegawai baru/tidak ada di rekap
    if (!emp) {
        try {
            const res = await fetch(`${API_BASE}/karyawan/${idKaryawan}`);
            const json = await res.json();
            if (json.success && json.data) {
                // Mock object rekap dengan nilai 0 agar modal tetap bisa render
                emp = {
                    ...json.data,
                    total_masuk: 0, telat_kali: 0, alpa: 0,
                    total_jam_kerja: '0', potongan_jam: 0, psw_kali: 0
                };
            }
        } catch (e) {
            console.error("Gagal memuat data karyawan fallback:", e);
        }
    }

    if (!emp) {
        showToast("Data pegawai tidak ditemukan.", "error");
        return;
    }

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

    // [NEW] Tambahkan Tombol Cetak Slip Gaji di Modal
    const btnContainerId = 'modal-print-btn-container';
    let btnContainer = document.getElementById(btnContainerId);
    
    // Jika container belum ada, buat baru setelah grid stats
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = btnContainerId;
        btnContainer.className = 'mt-6 flex justify-center border-t border-slate-100 pt-4';
        document.getElementById('modal-stats-grid').parentNode.appendChild(btnContainer);
    }

    btnContainer.innerHTML = `
        <button onclick="closeModal(); openEditModal('${emp.id_karyawan}')" class="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-300 rounded-lg font-bold text-sm transition-all shadow-sm hover:shadow-md mr-3">
            <i class="fa-solid fa-pen-to-square"></i> Edit Nama
        </button>
        <button onclick="printSalarySlip('${emp.id_karyawan}')" class="flex items-center gap-2 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold text-sm transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5">
            <i class="fa-solid fa-print"></i> Cetak Slip Gaji
        </button>
    `;

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
async function saveSignatureConfig() {
    const config = {
        kepalaNama: document.getElementById('conf-kepala-nama').value,
        kepalaNip: document.getElementById('conf-kepala-nip').value,
        petugasNama: document.getElementById('conf-petugas-nama').value,
        petugasNip: document.getElementById('conf-petugas-nip').value,
        // NEW: Konfigurasi Gaji
        gajiPokok: document.getElementById('conf-gaji-pokok')?.value || 0,
        tunjanganJabatan: document.getElementById('conf-tunjangan-jabatan')?.value || 0,
        uangMakan: document.getElementById('conf-uang-makan')?.value || 0,
        uangTransport: document.getElementById('conf-uang-transport')?.value || 0,
        bpjs: document.getElementById('conf-bpjs')?.value || 0,
        pajak: document.getElementById('conf-pajak')?.value || 0,
        dendaTelat: document.getElementById('conf-denda-telat')?.value || 0,
        dendaAlpa: document.getElementById('conf-denda-alpa')?.value || 0,
        dendaPsw: document.getElementById('conf-denda-psw')?.value || 0, // [NEW]
        dendaLupa: document.getElementById('conf-denda-lupa')?.value || 0, // [NEW]
        // NEW: Jaspel & Poin
        jaspelPool: document.getElementById('conf-jaspel-pool')?.value || 0,
        poinJabatanStr: document.getElementById('conf-poin-jabatan')?.value || '',
        poinPendidikanStr: document.getElementById('conf-poin-pendidikan')?.value || '',
        poinJenisKetenagaanStr: document.getElementById('conf-poin-jenis')?.value || '',
        poinStatusKepegawaianStr: document.getElementById('conf-poin-status')?.value || '',
        poinAdmin: document.getElementById('conf-poin-admin')?.value || 0,

        gajiJabatanStr: document.getElementById('conf-gaji-jabatan')?.value || '', 
        // [NEW] Konfigurasi Lokasi
        officeLat: document.getElementById('conf-lat')?.value || 0,
        officeLon: document.getElementById('conf-lon')?.value || 0,
        officeRadius: document.getElementById('conf-radius')?.value || 100,
        // [NEW] Simpan string mapping jabatan
        jamPulangJumat: document.getElementById('conf-jam-pulang-jumat')?.value || '', // [NEW]
        jamPulangSabtu: document.getElementById('conf-jam-pulang-sabtu')?.value || ''  // [NEW]
    };
    
    localStorage.setItem('signatureConfig', JSON.stringify(config));
    
    // [NEW] Kirim Update Jam Pulang ke Server
    try {
        const response = await fetch(`${API_BASE}/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                jam_pulang_jumat: config.jamPulangJumat, 
                jam_pulang_sabtu: config.jamPulangSabtu,
                office_lat: config.officeLat,
                office_lon: config.officeLon,
                office_radius: config.officeRadius
            })
        });
        const result = await response.json();
        if(result.success) console.log("Server config updated.");
    } catch(e) { console.error("Gagal update config server:", e); }

    showToast('Konfigurasi & Jam Pulang berhasil disimpan!', 'success');
    applySignatureToPrint(); // Update tampilan langsung
}

function loadSignatureConfig() {
    const saved = localStorage.getItem('signatureConfig');
    if (saved) {
        const config = JSON.parse(saved);
        // Isi Form Settings Tanda Tangan
        if(document.getElementById('conf-kepala-nama')) document.getElementById('conf-kepala-nama').value = config.kepalaNama || '';
        if(document.getElementById('conf-kepala-nip')) document.getElementById('conf-kepala-nip').value = config.kepalaNip || '';
        if(document.getElementById('conf-petugas-nama')) document.getElementById('conf-petugas-nama').value = config.petugasNama || '';
        if(document.getElementById('conf-petugas-nip')) document.getElementById('conf-petugas-nip').value = config.petugasNip || '';
        
        // Isi Form Settings Gaji (NEW)
        if(document.getElementById('conf-gaji-pokok')) document.getElementById('conf-gaji-pokok').value = config.gajiPokok || '';
        if(document.getElementById('conf-tunjangan-jabatan')) document.getElementById('conf-tunjangan-jabatan').value = config.tunjanganJabatan || '';
        if(document.getElementById('conf-uang-makan')) document.getElementById('conf-uang-makan').value = config.uangMakan || '';
        if(document.getElementById('conf-uang-transport')) document.getElementById('conf-uang-transport').value = config.uangTransport || '';
        if(document.getElementById('conf-bpjs')) document.getElementById('conf-bpjs').value = config.bpjs || '';
        if(document.getElementById('conf-pajak')) document.getElementById('conf-pajak').value = config.pajak || '';
        if(document.getElementById('conf-denda-telat')) document.getElementById('conf-denda-telat').value = config.dendaTelat || '';
        if(document.getElementById('conf-denda-alpa')) document.getElementById('conf-denda-alpa').value = config.dendaAlpa || '';
        if(document.getElementById('conf-denda-psw')) document.getElementById('conf-denda-psw').value = config.dendaPsw || ''; // [NEW]
        // Load Jaspel Config
        if(document.getElementById('conf-jaspel-pool')) document.getElementById('conf-jaspel-pool').value = config.jaspelPool || '';
        if(document.getElementById('conf-poin-jabatan')) document.getElementById('conf-poin-jabatan').value = config.poinJabatanStr || '';
        if(document.getElementById('conf-poin-pendidikan')) document.getElementById('conf-poin-pendidikan').value = config.poinPendidikanStr || '';
        if(document.getElementById('conf-poin-jenis')) document.getElementById('conf-poin-jenis').value = config.poinJenisKetenagaanStr || '';
        if(document.getElementById('conf-poin-status')) document.getElementById('conf-poin-status').value = config.poinStatusKepegawaianStr || '';
        if(document.getElementById('conf-poin-admin')) document.getElementById('conf-poin-admin').value = config.poinAdmin || '';

        if(document.getElementById('conf-denda-lupa')) document.getElementById('conf-denda-lupa').value = config.dendaLupa || ''; // [NEW]
        if(document.getElementById('conf-gaji-jabatan')) document.getElementById('conf-gaji-jabatan').value = config.gajiJabatanStr || ''; // [NEW] Load mapping
        if (document.getElementById('conf-lat')) document.getElementById('conf-lat').value = config.officeLat || '';
        if (document.getElementById('conf-lon')) document.getElementById('conf-lon').value = config.officeLon || '';
        if (document.getElementById('conf-radius')) document.getElementById('conf-radius').value = config.officeRadius || '';
        if (document.getElementById('conf-lat')) document.getElementById('conf-lat').value = config.officeLat || '';
        if (document.getElementById('conf-lon')) document.getElementById('conf-lon').value = config.officeLon || '';
        if (document.getElementById('conf-radius')) document.getElementById('conf-radius').value = config.officeRadius || ''; 
        if(document.getElementById('conf-jam-pulang-jumat')) document.getElementById('conf-jam-pulang-jumat').value = config.jamPulangJumat || ''; // [NEW]
        if(document.getElementById('conf-jam-pulang-sabtu')) document.getElementById('conf-jam-pulang-sabtu').value = config.jamPulangSabtu || ''; // [NEW]

        // Terapkan ke View Print
        applySignatureToPrint();
    } else {
        // [FIX] Jika tidak ada data tersimpan (habis reset), paksa kosongkan input
        // Ini mencegah browser mengembalikan nilai lama dari cache saat refresh
        const fields = [
            'conf-kepala-nama', 'conf-kepala-nip', 'conf-petugas-nama', 'conf-petugas-nip',
            'conf-gaji-pokok', 'conf-tunjangan-jabatan', 'conf-uang-makan', 'conf-uang-transport',
            'conf-bpjs', 'conf-pajak', 'conf-denda-telat', 'conf-denda-alpa', 
            'conf-denda-psw', 'conf-denda-lupa', 'conf-gaji-jabatan',
            'conf-jam-pulang-jumat', 'conf-jam-pulang-sabtu'
        ];
        fields.forEach(id => {
            const el = document.getElementById(id);
            if(el) el.value = '';
        });
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

// --- FITUR: RESET CONFIGURATION ---
async function resetSignatureConfig() {
    if (!confirm('Apakah Anda yakin ingin mereset semua pengaturan ke default?\n\nPERINGATAN: Semua data konfigurasi lokal dan cache browser akan dihapus total.')) return;

    // 1. Bersihkan Local Storage & Session Storage (Total Wipe)
    localStorage.clear();
    sessionStorage.clear();

    // 2. Bersihkan Cache API (Service Worker Caches) - Tunggu sampai selesai
    if ('caches' in window) {
        try {
            const keys = await caches.keys();
            await Promise.all(keys.map(key => caches.delete(key)));
        } catch (e) {
            console.error("Cache clear error:", e);
        }
    }

    // 3. Reload Halaman dengan Cache Busting (Timestamp)
    window.location.href = window.location.pathname + '?t=' + new Date().getTime();
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

    toast.className = `flex items-center gap-3 p-4 rounded-xl shadow-xl shadow-black/10 border border-slate-200/80 bg-white/95 backdrop-blur-lg ${borderClass} transform transition-all duration-300 translate-x-full opacity-0 min-w-[300px]`;
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
    if (!tbody) return; // Guard against missing element

    const allRows = Array.from(tbody.rows);

    // Separate data rows from footer/summary rows. Data rows have an 'onclick' handler.
    const dataRows = allRows.filter(row => row.hasAttribute('onclick'));
    const footerRows = allRows.filter(row => !row.hasAttribute('onclick'));

    const isAsc = tbody.getAttribute('data-order') === 'asc';
    
    dataRows.sort((a, b) => {
        const aCell = a.cells[colIndex];
        const bCell = b.cells[colIndex];

        // This should not happen for data rows, but it's a good safety check.
        if (!aCell || !bCell) {
            return 0;
        }
        
        let aVal = aCell.innerText.trim();
        let bVal = bCell.innerText.trim();
        
        // [UPDATE] Cek jika kolom berisi angka (hapus simbol non-digit seperti % atau Rp)
        const aNum = parseFloat(aVal.replace(/[^0-9.-]+/g,""));
        const bNum = parseFloat(bVal.replace(/[^0-9.-]+/g,""));

        if (!isNaN(aNum) && !isNaN(bNum) && aVal.match(/\d/)) {
            return isAsc ? aNum - bNum : bNum - aNum;
        }

        return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });

    tbody.setAttribute('data-order', isAsc ? 'desc' : 'asc');

    // Rebuild the table body, keeping footer rows at the bottom
    tbody.innerHTML = '';
    dataRows.forEach(row => tbody.appendChild(row));
    footerRows.forEach(row => tbody.appendChild(row));
}

// --- HELPER: TABLE FILTERING ---
function filterTable(tableBodyId, inputId) {
    const input = document.getElementById(inputId);
    const filterText = input.value.toLowerCase();
    const filterTerms = filterText.split(' ').filter(t => t.trim() !== '');
    const tbody = document.getElementById(tableBodyId);
    if (!tbody) return;
    const rows = tbody.getElementsByTagName('tr');

    for (let i = 0; i < rows.length; i++) {
        // Abaikan baris "Memuat data..." atau "Tidak ada data"
        if (rows[i].getElementsByTagName('td').length === 1 && rows[i].textContent.includes('data')) continue;
        
        const text = rows[i].textContent.toLowerCase();
        let match = true;
        for (const term of filterTerms) {
            if (text.indexOf(term) === -1) {
                match = false;
                break;
            }
        }
        rows[i].style.display = match ? "" : "none";
    }
}

// --- FITUR: CETAK SLIP GAJI (NEW) ---
function printSalarySlip(id) {
    const emp = globalPerformanceData.find(e => e.id_karyawan === id);
    if (!emp) return;

    const monthInput = document.getElementById('filter-month');
    const _pNow = new Date(); const periode = monthInput ? monthInput.value : `${_pNow.getFullYear()}-${String(_pNow.getMonth()+1).padStart(2,'0')}`;
    
    // [NEW] Ambil Konfigurasi Gaji dari LocalStorage
    const savedConfig = localStorage.getItem('signatureConfig');
    const config = savedConfig ? JSON.parse(savedConfig) : {};
    
    let gajiPokok = parseInt(config.gajiPokok) || 0;

    // [NEW] Override Gaji Pokok jika ada konfigurasi per jabatan
    if (config.gajiJabatanStr && emp.jabatan) {
        const lines = config.gajiJabatanStr.split('\n');
        for (const line of lines) {
            const parts = line.split('=');
            if (parts.length === 2) {
                const jobTitle = parts[0].trim().toLowerCase();
                const salary = parseInt(parts[1].trim());
                // Cek jika jabatan pegawai mengandung kata kunci (misal "Dokter Umum" cocok dengan "Dokter")
                if (emp.jabatan.toLowerCase() === jobTitle && !isNaN(salary)) {
                    gajiPokok = salary;
                    break; 
                }
            }
        }
    }

    // [NEW] Hitung Jaspel Individu
    const jaspelPool = (parseInt(config.jaspelPool) || 0) * 0.6;
    const getMap = (str) => {
        const map = {};
        if (str) str.split('\n').forEach(l => {
            const p = l.split('=');
            if (p.length === 2) map[p[0].trim().toLowerCase()] = parseFloat(p[1].trim());
        });
        return map;
    };

    const mapJab = getMap(config.poinJabatanStr);
    const mapPen = getMap(config.poinPendidikanStr);
    const mapJen = getMap(config.poinJenisKetenagaanStr);
    const mapSta = getMap(config.poinStatusKepegawaianStr);
    const pAdmin = parseFloat(config.poinAdmin) || 0;

    let poolPoinSeluruh = 0;
    globalPerformanceData.forEach(row => {
        const v = (mapJab[row.jabatan?.toLowerCase()] || 0) + (mapPen[row.pendidikan?.toLowerCase()] || 0) + (mapJen[row.jenis_ketenagaan?.toLowerCase()] || 0) + (mapSta[row.status_kepegawaian?.toLowerCase()] || 0);
        const tk = parseInt(row.total_hari_kerja) || 20;
        const prs = tk > 0 ? (parseInt(row.total_masuk) || 0) / tk : 0;
        poolPoinSeluruh += (v * prs) + ((parseInt(row.total_admin) || 0) * pAdmin);
    });

    const pJab = mapJab[emp.jabatan?.toLowerCase()] || 0;
    const pPen = mapPen[emp.pendidikan?.toLowerCase()] || 0;
    const pJen = mapJen[emp.jenis_ketenagaan?.toLowerCase()] || 0;
    const pSta = mapSta[emp.status_kepegawaian?.toLowerCase()] || 0;
    const varKet = pJab + pPen + pJen + pSta;

    const persenPegawai = (parseInt(emp.total_hari_kerja) || 20) > 0 ? (parseInt(emp.total_masuk) || 0) / (parseInt(emp.total_hari_kerja) || 20) : 0;
    const poinIndividu = (varKet * persenPegawai) + ((parseInt(emp.total_admin) || 0) * pAdmin);
    const nilaiSatuPoin = poolPoinSeluruh > 0 ? jaspelPool / poolPoinSeluruh : 0;
    const estimasiJaspel = poinIndividu * nilaiSatuPoin;

    const tunjanganJabatan = parseInt(config.tunjanganJabatan) || 0;
    const uangMakan = parseInt(config.uangMakan) || 0;
    const uangTransport = parseInt(config.uangTransport) || 0;
    const bpjs = parseInt(config.bpjs) || 0;
    const pajak = parseInt(config.pajak) || 0;
    const dendaTelat = parseInt(config.dendaTelat) || 0;
    const dendaAlpa = parseInt(config.dendaAlpa) || 0;
    const dendaPsw = parseInt(config.dendaPsw) || 0; // [NEW]
    const dendaLupa = parseInt(config.dendaLupa) || 50000; // [FIX] Default 50.000 agar sinkron dengan Server

    // [NEW] Hitung Komponen Gaji
    const totalHadir = (parseInt(emp.total_masuk) || 0) + (parseInt(emp.total_dl) || 0);
    const totalUangMakan = totalHadir * uangMakan;
    const totalUangTransport = totalHadir * uangTransport;
    
    const totalDenda = ((parseInt(emp.telat_kali) || 0) * dendaTelat) + 
                       ((parseInt(emp.alpa) || 0) * dendaAlpa) + 
                       ((parseInt(emp.psw_kali) || 0) * dendaPsw) + 
                       ((parseInt(emp.tanpa_absen_pulang) || 0) * dendaLupa);
    
    const totalPotongan = totalDenda + bpjs + pajak;
    const totalPendapatan = gajiPokok + tunjanganJabatan + totalUangMakan + totalUangTransport + estimasiJaspel;
    const totalDiterima = Math.max(0, totalPendapatan - totalPotongan);

    // Helper Format Rupiah
    const formatRupiah = (angka) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
    };

    const printWindow = window.open('', '_blank', 'width=800,height=800');
    
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Slip Gaji - ${emp.nama}</title>
            <style>
                body { font-family: 'Times New Roman', serif; padding: 40px; color: #000; max-width: 800px; margin: 0 auto; }
                
                /* KOP SURAT */
                .kop-surat { display: flex; align-items: center; justify-content: space-between; border-bottom: 4px double #000; padding-bottom: 15px; margin-bottom: 25px; }
                .logo { width: 80px; height: 80px; object-fit: contain; }
                .kop-text { text-align: center; flex: 1; padding: 0 10px; }
                .kop-text h3 { margin: 0; font-size: 14px; text-transform: uppercase; font-weight: bold; line-height: 1.2; }
                .kop-text h1 { margin: 5px 0; font-size: 20px; text-transform: uppercase; font-weight: 900; letter-spacing: 1px; line-height: 1.2; }
                .kop-text p { margin: 0; font-size: 12px; font-style: italic; }

                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
                .info-item { display: flex; flex-direction: column; }
                .label { font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: bold; }
                .value { font-size: 14px; font-weight: bold; }
                
                .section { margin-bottom: 25px; }
                .section-title { font-size: 14px; font-weight: bold; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; color: #374151; }
                
                .table-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #f3f4f6; }
                .table-row:last-child { border-bottom: none; }
                
                .total-box { border: 2px solid #1f2937; padding: 15px; margin-top: 30px; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; }
                .total-label { font-weight: bold; font-size: 16px; text-transform: uppercase; }
                .total-value { font-weight: bold; font-size: 18px; }
                
                .signatures { display: flex; justify-content: space-between; margin-top: 60px; text-align: center; font-size: 12px; }
                .sign-box { width: 200px; }
                .sign-line { margin-top: 80px; border-top: 1px solid #1f2937; }
                
                .footer { margin-top: 50px; text-align: center; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 10px; }
                
                @media print {
                    body { padding: 0; }
                }
            </style>
        </head>
        <body>
            <div class="kop-surat">
                <img src="Lambang_kabupaten_lampung_timur.png" class="logo" alt="Logo Kab" onerror="this.style.display='none'">
                <div class="kop-text">
                    <h3>PEMERINTAH KABUPATEN LAMPUNG TIMUR</h3>
                    <h3>DINAS KESEHATAN</h3>
                    <h1>UPTD PUSKESMAS WANA</h1>
                    <p>Jl. Pengiran Iro Kusumo Wana Kecamatan Melinting</p>
                </div>
                <div class="logo" style="display:flex; align-items:center; justify-content:center; font-size:40px; color:#10b981;"><i class="fa-solid fa-hospital"></i></div>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin:0; text-decoration: underline; text-transform: uppercase;">SLIP GAJI PEGAWAI</h2>
                <p style="margin:5px 0 0; font-size: 14px;">PERIODE: ${periode}</p>
            </div>

            <div class="info-grid">
                <div class="info-item"><span class="label">Nama Pegawai</span><span class="value">${emp.nama}</span></div>
                <div class="info-item"><span class="label">ID Pegawai</span><span class="value">${emp.id_karyawan}</span></div>
                <div class="info-item"><span class="label">Jabatan</span><span class="value">${emp.jabatan || '-'}</span></div>
                <div class="info-item"><span class="label">Tanggal Cetak</span><span class="value">${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
            </div>

            <div class="section">
                <div class="section-title">Rincian Kehadiran</div>
                <div class="table-row"><span>Total Kehadiran</span> <span>${emp.total_masuk} Hari</span></div>
                <div class="table-row"><span>Dinas Luar (DL)</span> <span>${emp.total_dl} Hari</span></div>
                <div class="table-row"><span>Tidak Hadir (Alpa)</span> <span>${emp.alpa} Hari</span></div>
                <div class="table-row"><span><strong>Total Jam Kerja Efektif</strong></span> <span><strong>${emp.total_jam_kerja}</strong></span></div>
            </div>

            <div class="section">
                <div class="section-title">Komponen Poin Jaspel</div>
                <div class="table-row"><span>Poin Variabel (Jab+Pend+Status+Jen)</span> <span>${varKet.toFixed(2)}</span></div>
                <div class="table-row"><span>Poin Kehadiran (${(persenPegawai * 100).toFixed(1)}%)</span> <span>${(varKet * persenPegawai).toFixed(2)}</span></div>
                <div class="table-row"><span>Poin Tugas Tambahan (Admin)</span> <span>${((parseInt(emp.total_admin) || 0) * pAdmin).toFixed(2)}</span></div>
                <div class="table-row"><span><strong>Total Skor Akhir</strong></span> <span><strong>${poinIndividu.toFixed(2)} Poin</strong></span></div>
            </div>

            <div class="section">
                <div class="section-title">Potongan & Disiplin</div>
                <div class="table-row"><span>Keterlambatan</span> <span>${emp.telat_kali}x (${emp.telat_menit} Menit)</span></div>
                <div class="table-row"><span>Pulang Sebelum Waktu (PSW)</span> <span>${emp.psw_kali || 0}x (${emp.psw_menit || 0} Menit)</span></div>
                <div class="table-row"><span>Tanpa Absen Pulang</span> <span>${emp.tanpa_absen_pulang}x</span></div>
                <div class="table-row"><span><strong>Total Potongan Jam</strong></span> <span><strong>${emp.potongan_jam} Jam</strong></span></div>
            </div>

            <div class="section">
                <div class="section-title">Rincian Penerimaan (Estimasi)</div>
                <div class="table-row"><span>Gaji Pokok</span> <span>${formatRupiah(gajiPokok)}</span></div>
                <div class="table-row"><span>Tunjangan Jabatan</span> <span>${formatRupiah(tunjanganJabatan)}</span></div>
                <div class="table-row"><span>Uang Makan (${totalHadir} hari x ${formatRupiah(uangMakan)})</span> <span>${formatRupiah(totalUangMakan)}</span></div>
                <div class="table-row"><span>Jasa Pelayanan (Jaspel)</span> <span>${formatRupiah(estimasiJaspel)}</span></div>
                <div class="table-row"><span>Uang Transport (${totalHadir} hari x ${formatRupiah(uangTransport)})</span> <span>${formatRupiah(totalUangTransport)}</span></div>
                <div class="table-row" style="margin-top:5px; border-top:1px solid #eee; padding-top:5px;"><span><strong>Total Pendapatan</strong></span> <span><strong>${formatRupiah(totalPendapatan)}</strong></span></div>
            </div>

            <div class="section">
                <div class="section-title">Rincian Potongan</div>
                <div class="table-row"><span>BPJS Kesehatan/TK</span> <span>(${formatRupiah(bpjs)})</span></div>
                <div class="table-row"><span>Pajak / PPh21</span> <span>(${formatRupiah(pajak)})</span></div>
                <div class="table-row"><span>Denda Disiplin (Telat/Alpa/PSW)</span> <span>(${formatRupiah(totalDenda)})</span></div>
                <div class="table-row" style="margin-top:5px; border-top:1px solid #eee; padding-top:5px;"><span><strong>Total Potongan</strong></span> <span><strong>(${formatRupiah(totalPotongan)})</strong></span></div>
            </div>

            <div class="total-box"><span class="total-label">Total Diterima</span><span class="total-value">${formatRupiah(totalDiterima)}</span></div>
            <div style="font-size: 11px; color: #666; margin-top: 5px; font-style: italic;">*Slip ini valid sebagai bukti kinerja & kehadiran.</div>

            <div class="signatures">
                <div class="sign-box"><p>Penerima,</p><div class="sign-line"></div><p>${emp.nama}</p></div>
                <div class="sign-box"><p>Kepala Puskesmas Wana,</p><div class="sign-line"></div><p>( ${config.kepalaNama || '...........................'} )</p></div>
            </div>

            <div class="footer">Dicetak otomatis oleh Sistem Biometrik Puskesmas Wana.<br>ID: ${Date.now().toString(36).toUpperCase()}</div>
            <script>window.onload = function() { window.print(); }</script>
        </body></html>`;
    
    printWindow.document.write(html);
    printWindow.document.close();
}

// --- FITUR: REFRESH & CLEAR CACHE ---
async function manualRefresh(btn) {
    // Animasi Spin pada Icon
    let icon;
    if (btn) {
        icon = btn.querySelector('i');
        if (icon) icon.classList.add('fa-spin'); // Tambah animasi putar
        btn.disabled = true; // Cegah klik ganda
    }

    const activeTab = document.querySelector('.nav-item.active');
    if (activeTab) {
        const tabId = activeTab.id;
        
        // Gunakan await agar animasi menunggu proses selesai
        if (tabId === 'nav-overview') await loadOverviewData();
        if (tabId === 'nav-daily') await loadDailyData();
        if (tabId === 'nav-monthly') await loadMonthlyRecap();
        if (tabId === 'nav-performance') await loadPerformanceData();
        if (tabId === 'nav-employees') await loadEmployees();
        if (tabId === 'nav-settings') {
            await loadSystemConfig();
            loadSignatureConfig();
        }
        
        // Beri sedikit delay agar animasi terlihat smooth
        setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin'); // Hapus animasi
            if (btn) btn.disabled = false;
            showToast('Data berhasil diperbarui (Cache Cleared)', 'success');
        }, 500);
    }
}

function hardRefresh() {
    // Hapus cache browser dan reload halaman
    if ('caches' in window) {
        caches.keys().then((names) => {
            names.forEach((name) => caches.delete(name));
        });
    }
    window.location.reload(true);
}

// --- FITUR: DARK MODE TOGGLE ---
function toggleDarkMode() {
    document.body.classList.toggle('dark');
    const isDark = document.body.classList.contains('dark');
    
    // Simpan preferensi user
    localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    
    // Update Icon Button
    const btn = document.getElementById('btn-dark-mode');
    if(btn) {
        btn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        btn.title = isDark ? 'Light Mode' : 'Dark Mode';
    }
}

// --- Filter Nama Pegawai di Input Manual
function filterManualEmp() {
    const input = document.getElementById('search-manual-emp').value.toUpperCase();
    const select = document.getElementById('manual-emp-select');
    for (let i = 0; i < select.options.length; i++) {
        const txtValue = select.options[i].textContent || select.options[i].innerText;
        if (txtValue.toUpperCase().indexOf(input) > -1) {
            select.options[i].style.display = "";
        } else { select.options[i].style.display = "none"; }
    }
}

// --- [NEW] FORMAT PIVOT MATRIX BULANAN MENYAMPING ---
function toggleRekapFormat() {
    loadMonthlyRecap();
}

async function loadMonthlyMatrix(silent = false) {
    const month = document.getElementById('filter-month').value;
    const table = document.getElementById('table-rekap');

    const dateObj = new Date(month);
    const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    if (!silent) showSpinner();

    try {
        const response = await fetch(`${API_BASE}/absensi/bulanan/matrix?periode=${month}&_t=${Date.now()}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.message || 'Gagal mengambil data');

        const days = result.daysInMonth;
        
        let thDays = '';
        for (let d = 1; d <= days; d++) {
            const dateObj = new Date(`${month}-${String(d).padStart(2, '0')}T00:00:00`);
            const isSunday = dateObj.getDay() === 0;
            const thClass = isSunday ? 'text-red-400 font-bold bg-red-900/20' : '';
            thDays += `<th class="px-2 py-3 text-center border border-slate-700 min-w-[80px] ${thClass}">Tgl ${d}</th>`;
        }

        table.innerHTML = `
            <caption class="caption-top mb-6 text-center border-b-2 border-slate-800 pb-4">
                <h2 class="text-2xl font-serif font-bold text-slate-900 uppercase tracking-widest">Detail Presensi Harian Menyamping</h2>
                <p class="text-sm text-slate-600 font-serif italic mt-1">Periode Laporan: ${monthName}</p>
            </caption>
            <thead class="sticky top-0 z-30 uppercase text-xs font-bold tracking-wider bg-slate-800 text-white">
                <tr>
                    <th class="px-4 py-3 text-center border border-slate-700 w-12">No.</th>
                    <th class="px-6 py-3 text-left border border-slate-700 w-56">Nama Pegawai</th>
                    <th class="px-6 py-3 text-left border border-slate-700 w-36">Jabatan</th>
                    ${thDays}
                </tr>
            </thead>
            <tbody id="table-rekap-body" class="text-slate-800 divide-y divide-slate-200 text-xs bg-white">
            </tbody>
        `;

        const tbody = table.querySelector('tbody');

        result.data.forEach((row, index) => {
            let tdDays = '';
            for (let d = 1; d <= days; d++) {
                const dayData = row.hari[d];
                let cellContent = '<span class="text-slate-300">-</span>';
                let cellClass = 'bg-slate-50/50';

                if (dayData) {
                    const status = dayData.status;
                    if (status === 'DL' || status === 'DINAS_LUAR') {
                        cellContent = '<span class="text-blue-600 font-bold">DL</span>';
                        cellClass = 'bg-blue-50';
                    } else if (status === 'SAKIT') {
                        cellContent = '<span class="text-rose-600 font-bold">S</span>';
                        cellClass = 'bg-rose-50';
                    } else if (status === 'IZIN') {
                        cellContent = '<span class="text-purple-600 font-bold">I</span>';
                        cellClass = 'bg-purple-50';
                    } else if (status === 'CUTI') {
                        cellContent = '<span class="text-orange-600 font-bold">C</span>';
                        cellClass = 'bg-orange-50';
                    } else if (status === 'ALPA') {
                        cellContent = '<span class="text-red-600 font-extrabold">A</span>';
                        cellClass = 'bg-red-50';
                    } else {
                        const masuk = dayData.jam_masuk ? dayData.jam_masuk.substring(0, 5) : '';
                        let keluar = dayData.jam_keluar ? dayData.jam_keluar.substring(0, 5) : '';
                        
                        let isLupaPulang = false;
                        if (dayData.keterangan && (dayData.keterangan.includes('Otomatis') || dayData.keterangan.includes('Tanpa Absen Pulang'))) {
                            isLupaPulang = true;
                            keluar = `<span class="text-red-600 font-extrabold text-[10px] bg-red-100 px-1 py-0.5 rounded border border-red-200" title="Tanpa Absen Pulang (TAP)">TAP</span>`;
                        }

                        let lateIndicator = '';
                        if (dayData.telat_menit > 0) {
                            lateIndicator = `<div class="text-[9px] text-red-500 font-bold">T: ${dayData.telat_menit}m</div>`;
                        }
                        let pswIndicator = '';
                        if (dayData.psw_menit > 0) {
                            pswIndicator = `<div class="text-[9px] text-amber-600 font-bold">P: ${dayData.psw_menit}m</div>`;
                        }

                        cellContent = `
                            <div class="font-mono font-bold text-slate-800">${masuk || '-'}</div>
                            <div class="font-mono text-slate-500 border-t border-slate-100 mt-0.5 pt-0.5">${keluar || '-'}</div>
                            ${lateIndicator}
                            ${pswIndicator}
                        `;
                        cellClass = isLupaPulang ? 'bg-rose-100/70' : (dayData.telat_menit > 0 ? 'bg-rose-50/20' : 'bg-emerald-50/20');
                    }

                    const toolTip = `Tanggal: ${d}\nStatus: ${status}\nJam Masuk: ${dayData.jam_masuk || '-'}\nJam Keluar: ${dayData.jam_keluar || '-'}\nKeterangan: ${dayData.keterangan || '-'}`;
                    tdDays += `<td class="px-2 py-2 text-center border border-slate-200 ${cellClass}" title="${escapeHtml(toolTip)}">${cellContent}</td>`;
                } else {
                    tdDays += `<td class="px-2 py-2 text-center border border-slate-200 ${cellClass}">${cellContent}</td>`;
                }
            }

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="px-4 py-2 text-center font-mono border border-slate-200">${index + 1}</td>
                    <td class="px-6 py-2 font-bold text-slate-800 border border-slate-200">${row.nama}</td>
                    <td class="px-6 py-2 text-slate-600 border border-slate-200 uppercase font-semibold">${row.jabatan || '-'}</td>
                    ${tdDays}
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        table.innerHTML = `<tr><td class="p-4 text-red-500">Error: ${e.message}</td></tr>`;
    } finally {
        if (!silent) hideSpinner();
    }
}

// --- DATA LOADER: DATABASE MONTHLY (DATA VIEW BULANAN - MATRIX) ---
async function loadViewDbMonthlyData() {
    const monthInput = document.getElementById('filter-view-db-monthly-month');
    
    if (!monthInput.value) {
        const now = new Date();
        monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    const month = monthInput.value;
    const table = document.getElementById('table-view-db-monthly');
    const tbody = document.getElementById('table-view-db-monthly-body');
    tbody.innerHTML = '<tr><td colspan="3" class="p-4 text-center">Memuat data view bulanan...</td></tr>';

    try {
        const response = await fetch(`${API_BASE}/absensi/bulanan/matrix?periode=${month}&_t=${Date.now()}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.message || 'Gagal mengambil data');

        const days = result.daysInMonth;
        
        let thDays = '';
        for (let d = 1; d <= days; d++) {
            const dateObj = new Date(`${month}-${String(d).padStart(2, '0')}T00:00:00`);
            const isSunday = dateObj.getDay() === 0;
            const thClass = isSunday ? 'text-red-400 print:text-red-600 print:bg-red-100 font-extrabold' : '';
            thDays += `<th class="px-2 py-2 text-center border border-slate-700 min-w-[85px] text-[10px] ${thClass}">Tgl ${d}</th>`;
        }

        const thead = table.querySelector('thead');
        thead.innerHTML = `
            <tr class="bg-slate-800 text-white uppercase text-[10px] font-bold">
                <th class="px-3 py-2 text-center border border-slate-700 w-10">No</th>
                <th class="px-4 py-2 text-left border border-slate-700 w-44">Nama Pegawai</th>
                <th class="px-4 py-2 text-left border border-slate-700 w-32">Jabatan</th>
                ${thDays}
            </tr>
        `;

        tbody.innerHTML = '';

        result.data.forEach((row, index) => {
            let tdDays = '';
            for (let d = 1; d <= days; d++) {
                const dateObj = new Date(`${month}-${String(d).padStart(2, '0')}T00:00:00`);
                const isSunday = dateObj.getDay() === 0;

                const dayData = row.hari[d];
                let cellContent = isSunday ? '<span class="text-red-300 font-bold print:text-red-500">-</span>' : '<span class="text-slate-300">-</span>';
                let cellClass = isSunday ? 'bg-red-50/50 print:bg-red-50' : 'bg-slate-50/50';

                if (dayData) {
                    const status = dayData.status;
                    if (status === 'DL' || status === 'DINAS_LUAR') {
                        cellContent = '<span class="text-blue-600 font-bold">DL</span>';
                        cellClass = 'bg-blue-50';
                    } else if (status === 'SAKIT') {
                        cellContent = '<span class="text-rose-600 font-bold">S</span>';
                        cellClass = 'bg-rose-50';
                    } else if (status === 'IZIN') {
                        cellContent = '<span class="text-purple-600 font-bold">I</span>';
                        cellClass = 'bg-purple-50';
                    } else if (status === 'CUTI') {
                        cellContent = '<span class="text-orange-600 font-bold">C</span>';
                        cellClass = 'bg-orange-50';
                    } else if (status === 'ALPA') {
                        cellContent = '<span class="text-red-600 font-extrabold">A</span>';
                        cellClass = 'bg-red-50';
                    } else {
                        const masuk = dayData.jam_masuk ? dayData.jam_masuk.substring(0, 5) : '-';
                        let keluar = dayData.jam_keluar ? dayData.jam_keluar.substring(0, 5) : '-';
                        
                        let isLupaPulang = false;
                        if (dayData.keterangan && (dayData.keterangan.includes('Otomatis') || dayData.keterangan.includes('Tanpa Absen Pulang'))) {
                            isLupaPulang = true;
                            keluar = `<span class="text-red-600 font-extrabold text-[10px] bg-red-100 px-1 py-0.5 rounded border border-red-200" title="Tanpa Absen Pulang (TAP)">TAP</span>`;
                        }

                        let ketStr = '';
                        if (dayData.telat_menit > 0) ketStr += ` T:${dayData.telat_menit}m`;
                        if (dayData.psw_menit > 0) ketStr += ` P:${dayData.psw_menit}m`;

                        cellContent = `
                            <div class="font-bold text-slate-800 font-mono">${masuk} - ${keluar}</div>
                            ${ketStr ? `<div class="text-[9px] text-red-500 font-bold mt-0.5">${ketStr}</div>` : ''}
                        `;
                        cellClass = isLupaPulang ? 'bg-rose-100/70' : (dayData.telat_menit > 0 ? 'bg-rose-50/20' : 'bg-emerald-50/20');
                    }

                    const toolTip = `Tanggal: ${d}\nStatus: ${status}\nJam Masuk: ${dayData.jam_masuk || '-'}\nJam Keluar: ${dayData.jam_keluar || '-'}\nKeterangan: ${dayData.keterangan || '-'}`;
                    tdDays += `<td class="px-2 py-1.5 text-center border border-slate-200 ${cellClass}" title="${escapeHtml(toolTip)}">${cellContent}</td>`;
                } else {
                    tdDays += `<td class="px-2 py-1.5 text-center border border-slate-200 ${cellClass}">${cellContent}</td>`;
                }
            }

            tbody.innerHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="px-3 py-1.5 text-center font-mono border border-slate-200">${index + 1}</td>
                    <td class="px-4 py-1.5 font-bold text-slate-800 border border-slate-200">${row.nama}</td>
                    <td class="px-4 py-1.5 text-slate-600 border border-slate-200 uppercase font-semibold text-[10px]">${row.jabatan || '-'}</td>
                    ${tdDays}
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
    }
}
