const originalFetch = window.fetch;
window.fetch = async function() {
    let [resource, config] = arguments;
    if (!config) config = {};
    
    // Jangan ubah headers jika config.body adalah FormData (browser otomatis set Content-Type dengan boundary)
    if (!(config.body instanceof FormData)) {
        if (!config.headers) config.headers = {};
    }
    
    const token = localStorage.getItem('admin_token');
    if (token) {
        if (!config.headers) config.headers = {};
        // Periksa apakah headers adalah Headers object atau object biasa
        if (config.headers instanceof Headers) {
            config.headers.append('Authorization', 'Bearer ' + token);
        } else {
            config.headers['Authorization'] = 'Bearer ' + token;
        }
    }
    
    const response = await originalFetch(resource, config);
    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem('admin_token');
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.classList.remove('hidden');
    }
    return response;
};



/**
 * dashboard.js - Logika Dashboard <span class="dynamic-instansi-nama">Puskesmas Wana</span>
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
        // [FIX] Gunakan tanggal lokal YYYY-MM-DD agar tidak tergeser ke kemarin akibat timezone UTC pada valueAsDate
        const now = new Date();
        dailyDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
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

    // --- DRAG-SCROLL untuk Tabel & Grid Data ---
    initDragScroll('akun-table-scroll');
    initDragScroll('env-table-container');
    initDragScroll('employees-grid');
    initDragScroll('performance-table-scroll');
    initDragScroll('performance-cards-scroll');
});

// Fungsi Drag-Scroll Universal (Mouse + Touch)
function initDragScroll(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    let isDown = false;
    let startX, startY, scrollLeft, scrollTop;

    // Mouse Events
    el.addEventListener('mousedown', (e) => {
        // Jangan aktifkan drag jika klik pada tombol/link/input
        if (e.target.closest('button, a, input, select, textarea')) return;
        isDown = true;
        el.style.cursor = 'grabbing';
        startX = e.pageX - el.offsetLeft;
        startY = e.pageY - el.offsetTop;
        scrollLeft = el.scrollLeft;
        scrollTop = el.scrollTop;
        e.preventDefault();
    });
    
    el.addEventListener('mouseleave', () => {
        isDown = false;
        el.style.cursor = 'grab';
    });
    
    el.addEventListener('mouseup', () => {
        isDown = false;
        el.style.cursor = 'grab';
    });
    
    el.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - el.offsetLeft;
        const y = e.pageY - el.offsetTop;
        const walkX = (x - startX) * 1.5; // Kecepatan scroll horizontal
        const walkY = (y - startY) * 1.5; // Kecepatan scroll vertikal
        el.scrollLeft = scrollLeft - walkX;
        el.scrollTop = scrollTop - walkY;
    });
}

// --- [NEW] AUTHENTICATION LOGIC ---
function checkAuth() {
    const token = localStorage.getItem('admin_token');
    const session = localStorage.getItem('pkm_wana_session');
    const loginOverlay = document.getElementById('login-overlay');

    if (token && session === 'active') {
        if (loginOverlay) loginOverlay.classList.add('hidden');
        return true;
    } else {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        return false;
    }
}

async function handleLogin() {
    const user = document.getElementById('login-username').value;
    const pass = document.getElementById('login-password').value;
    const errDiv = document.getElementById('login-error');
    if(errDiv) errDiv.classList.add('hidden');
    
    const btn = document.getElementById('btn-login-submit');
    const originalText = btn ? btn.innerHTML : '';
    if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

    try {
        const response = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: user, password: pass })
        });
        const result = await response.json();

        if(btn) btn.innerHTML = originalText;

        if (result.success && result.token) {
            localStorage.setItem('admin_token', result.token);
            localStorage.setItem('pkm_wana_session', 'active');
            location.reload();
        } else {
            showLoginError("Username atau password salah!", "bg-rose-50 text-rose-500 border-rose-200");
        }
    } catch (e) {
        if(btn) btn.innerHTML = originalText;
        showLoginError("Gagal terhubung ke server!", "bg-rose-50 text-rose-500 border-rose-200");
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
        localStorage.removeItem('admin_token');
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
    ['overview', 'daily', 'monthly', 'performance', 'employees', 'scan-portal', 'view-db', 'view-db-monthly', 'req-password', 'settings', 'environment'].forEach(id => {
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
        'scan-portal': 'Tabel Kontrol Scan.html Portal Online (Jadwal Libur)',
        'view-db': 'Data View Absensi Harian',
        'view-db-monthly': 'DATA VIEW BULANAN',
        'req-password': 'Permintaan Ubah Password',
        'settings': 'Pengaturan Sistem',
        'environment': 'Tabel Konfigurasi Environment (.env)'
    };
    document.getElementById('page-title').textContent = titles[tabName];

    // Jika sedang fullscreen dan sidebar sempat dibuka, tutup kembali agar layar tetap lega
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && sidebar.classList.contains('fullscreen-show')) {
        sidebar.classList.remove('fullscreen-show');
        if (overlay) overlay.classList.remove('fullscreen-show');
    }

    // Pastikan layout tidak tergeser ke kanan/kiri secara tidak sengaja
    window.scrollTo(0, 0);
    document.body.scrollLeft = 0;
    document.documentElement.scrollLeft = 0;
    const mainEl = document.querySelector('main');
    if (mainEl) mainEl.scrollLeft = 0;
    const contentScroll = document.getElementById('content-views-scroll');
    if (contentScroll) {
        contentScroll.scrollLeft = 0;
        contentScroll.scrollTop = 0;
    }

    // Load Data specific to tab
    if (tabName === 'overview') loadOverviewData();
    if (tabName === 'daily') loadDailyData();
    if (tabName === 'monthly') loadMonthlyRecap();
    if (tabName === 'performance') loadPerformanceData();
    if (tabName === 'employees') loadEmployees();
    if (tabName === 'scan-portal' && typeof loadScanPortalAccessTable === 'function') loadScanPortalAccessTable();
    if (tabName === 'view-db') loadViewDbData();
    if (tabName === 'view-db-monthly') loadViewDbMonthlyData();
    if (tabName === 'req-password') loadReqPassword();
    if (tabName === 'environment' && typeof loadEnvData === 'function') loadEnvData();
}

// --- DATA LOADER: REQ UBAH PASSWORD ---
async function loadReqPassword() {
    const tbody = document.getElementById('table-req-password-body');
    if (!tbody) return;
    tbody.innerHTML = generateSkeletonRows(6, 3);

    try {
        const response = await fetch(`${API_BASE}/admin/lupa-password/pending?_t=${Date.now()}`);
        const result = await response.json();

        tbody.innerHTML = '';
        if (result.success && result.data && result.data.length > 0) {
            result.data.forEach(req => {
                const dateStr = req.created_at ? new Date(req.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                tbody.innerHTML += `
                    <tr class="hover:bg-emerald-50/30 transition-colors">
                        <td class="px-6 py-4 font-mono text-slate-500 font-bold">#${req.id_req}</td>
                        <td class="px-6 py-4 font-mono font-bold text-slate-800">${escapeHtml(req.id_karyawan)}</td>
                        <td class="px-6 py-4 font-bold text-slate-800">${escapeHtml(req.nama)}</td>
                        <td class="px-6 py-4 text-sm text-slate-600">${dateStr}</td>
                        <td class="px-6 py-4">
                            <span class="badge-pro-amber">
                                <span class="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse inline-block mr-1"></span>Pending
                            </span>
                        </td>
                        <td class="px-6 py-4 text-center">
                            <div class="flex items-center justify-center gap-2">
                                <button onclick="approveReqPassword(${req.id_req}, '${escapeHtml(req.nama)}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-md transition-all hover:-translate-y-0.5" title="Setujui">
                                    <i class="fa-solid fa-check mr-1"></i>Setujui
                                </button>
                                <button onclick="rejectReqPassword(${req.id_req}, '${escapeHtml(req.nama)}')" class="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-md transition-all hover:-translate-y-0.5" title="Tolak">
                                    <i class="fa-solid fa-xmark mr-1"></i>Tolak
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = `<tr><td colspan="6" class="p-16 text-center text-slate-400 bg-slate-50/30"><div class="flex flex-col items-center justify-center"><i class="fa-solid fa-check-double text-5xl mb-4 text-emerald-200"></i><p class="text-lg font-bold text-slate-500">Tidak Ada Permintaan</p><p class="text-sm mt-1">Semua permintaan ubah password sudah diproses.</p></div></td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500 font-bold"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Gagal memuat data: ${e.message}</td></tr>`;
    }
}

async function approveReqPassword(idReq, nama) {
    if (!confirm(`Setujui perubahan password untuk ${nama}?`)) return;
    try {
        const res = await fetch(`${API_BASE}/admin/lupa-password/approve/${idReq}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`Password ${nama} berhasil diubah`, 'success');
            loadReqPassword();
        } else {
            showToast(data.message || 'Gagal menyetujui', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function rejectReqPassword(idReq, nama) {
    if (!confirm(`Tolak perubahan password untuk ${nama}?`)) return;
    try {
        const res = await fetch(`${API_BASE}/admin/lupa-password/reject/${idReq}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast(`Permintaan ${nama} ditolak`, 'success');
            loadReqPassword();
        } else {
            showToast(data.message || 'Gagal menolak', 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
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

// --- DYNAMIC OVERVIEW HERO & PALETTE HELPER ---
function getAvatarGradient(name = '') {
    const gradients = [
        'from-emerald-500 to-teal-600',
        'from-blue-500 to-indigo-600',
        'from-violet-500 to-purple-600',
        'from-amber-500 to-orange-600',
        'from-rose-500 to-pink-600',
        'from-cyan-500 to-blue-600',
        'from-teal-500 to-emerald-600'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % gradients.length;
    return gradients[idx];
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
        const grad = getAvatarGradient(item.nama_karyawan);
        const timeBadge = isLate 
            ? `<span class="badge-pro-rose min-w-[74px] justify-center text-xs font-mono"><i class="fa-solid fa-clock-rotate-left mr-1"></i>${item.jam_masuk}</span>` 
            : `<span class="badge-pro-emerald min-w-[74px] justify-center text-xs font-mono"><i class="fa-solid fa-clock mr-1"></i>${item.jam_masuk}</span>`;
        
        const html = `
            <div class="flex items-center gap-3.5 p-3.5 rounded-xl bg-white/90 backdrop-blur-sm border border-slate-200/80 hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-300 transition-all duration-300 group">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-xs font-black text-white shadow-md shadow-emerald-500/15 group-hover:scale-105 transition-all flex-shrink-0">
                    ${escapeHtml(item.nama_karyawan).substring(0, 1).toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-slate-800 truncate group-hover:text-emerald-600 transition-colors">${escapeHtml(item.nama_karyawan)}</p>
                    <p class="text-[11px] text-slate-500 truncate mt-0.5 uppercase tracking-wide font-semibold">${escapeHtml(item.jabatan || 'Staff')}</p>
                </div>
                <div class="text-right">
                    ${timeBadge}
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

                // --- LOGIKA STATUS KHUSUS (DL/IZIN/SAKIT) ---
                // Gunakan field 'status' dari view_absensi_harian
                const status = row.status;
                
                if (status === 'DL' || status === 'DINAS_LUAR') {
                    statusBadge = `<span class="badge-pro-blue"><i class="fa-solid fa-briefcase mr-1"></i>Dinas Luar</span>`;
                    // Tampilkan indikator DL di kolom jam agar jelas
                    row.jam_masuk = '<span class="text-blue-600 font-bold tracking-wider">DL</span>';
                    row.jam_keluar = '<span class="text-blue-600 font-bold tracking-wider">DL</span>';
                } else if (status === 'SAKIT') {
                    statusBadge = `<span class="badge-pro-rose"><i class="fa-solid fa-heart-pulse mr-1"></i>Sakit</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'IZIN') {
                    statusBadge = `<span class="badge-pro-purple"><i class="fa-solid fa-file-signature mr-1"></i>Izin</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'CUTI') {
                    statusBadge = `<span class="badge-pro-amber"><i class="fa-solid fa-calendar-check mr-1"></i>Cuti</span>`;
                    row.jam_masuk = '-';
                    row.jam_keluar = '-';
                } else if (status === 'HADIR_MANUAL' || row.jam_masuk) {
                    // --- LOGIKA HADIR NORMAL & MANUAL ---
                    
                    // [FIX] Gunakan data matang dari database (telat_menit)
                    if (row.telat_menit > 0) {
                        isLate = true;
                        lateMinutes = row.telat_menit;
                    }
                    
                    statusBadge = `<span class="badge-pro-emerald"><i class="fa-solid fa-circle-check mr-1"></i>Hadir</span>`;

                    if (isLate) {
                        lateDisplay = `<span class="badge-pro-rose"><i class="fa-solid fa-clock-rotate-left mr-1"></i>Terlambat (${lateMinutes}m)</span>`;
                    } else {
                        lateDisplay = `<span class="badge-pro-emerald"><i class="fa-solid fa-check-double mr-1"></i>Tepat Waktu</span>`;
                    }

                    // --- LOGIKA VISUAL PSW (PULANG SEBELUM WAKTUNYA) ---
                    if (row.jam_keluar && row.jam_keluar !== '-' && row.psw_menit > 0) {
                        row.jam_keluar = `
                            <div class="flex flex-col">
                                <span class="font-mono text-slate-800 font-bold">${row.jam_keluar}</span>
                                <span class="badge-pro-amber mt-1"><i class="fa-solid fa-person-walking-arrow-right mr-1"></i>PSW: ${row.psw_menit}m</span>
                            </div>
                        `;
                    }
                } else {
                    // Fallback jika data tidak lengkap
                    statusBadge = `<span class="text-slate-400 text-xs italic">Tidak Ada Data</span>`;
                }

                // [NEW] Tampilkan Keterangan dari Database (Sesuai Request)
                let keteranganHtml = '';
                if (row.keterangan) {
                    keteranganHtml = `<div class="text-[10px] text-slate-500 italic mt-1.5 border-t border-slate-100 pt-1 leading-tight"><i class="fa-solid fa-circle-info text-[9px] mr-1 text-slate-400"></i>${escapeHtml(row.keterangan)}</div>`;
                }

                let tglDisplay = '';
                const grad = getAvatarGradient(row.nama_karyawan);
                const initial = escapeHtml(row.nama_karyawan).substring(0, 1).toUpperCase();

                const tr = `
                    <tr onclick="openModal('${row.id_karyawan}')" class="hover:bg-emerald-50/40 transition cursor-pointer group border-b border-slate-200/80 last:border-0 ${isLate ? 'bg-rose-50/20' : ''}">
                        <td class="px-6 py-3.5 font-mono text-slate-800 font-bold text-xs">${tglDisplay}${row.jam_masuk}</td>
                        <td class="px-6 py-3.5 font-bold text-slate-800 group-hover:text-emerald-700 transition">
                            <div class="flex items-center gap-3">
                                <div class="w-8 h-8 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white text-xs font-black shadow-sm flex-shrink-0">
                                    ${initial}
                                </div>
                                <div class="truncate">
                                    <div class="font-bold text-slate-900 group-hover:text-emerald-700 transition">${escapeHtml(row.nama_karyawan)}</div>
                                    <div class="text-[10px] font-mono text-slate-400">${escapeHtml(row.id_karyawan || '')}</div>
                                </div>
                            </div>
                        </td>
                        <td class="px-6 py-3.5 text-slate-600 text-xs font-bold uppercase tracking-wider">${escapeHtml(row.jabatan || '-')}</td>
                        <td class="px-6 py-3.5">
                            ${statusBadge}
                            ${keteranganHtml}
                        </td>
                        <td class="px-6 py-3.5">${lateDisplay}</td>
                        <td class="px-6 py-3.5 font-mono text-slate-800 font-bold text-xs">
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
                let statusBadge = `<span class="badge-pro-slate">${row.status || '-'}</span>`;
                const s = (row.status || '').toUpperCase();
                if (s === 'HADIR' || s === 'HADIR_MANUAL') {
                    statusBadge = `<span class="badge-pro-emerald"><i class="fa-solid fa-circle-check mr-1"></i>${row.status}</span>`;
                } else if (s === 'DL' || s === 'DINAS_LUAR') {
                    statusBadge = `<span class="badge-pro-blue"><i class="fa-solid fa-briefcase mr-1"></i>DL</span>`;
                } else if (s === 'SAKIT') {
                    statusBadge = `<span class="badge-pro-rose"><i class="fa-solid fa-heart-pulse mr-1"></i>Sakit</span>`;
                } else if (s === 'IZIN') {
                    statusBadge = `<span class="badge-pro-purple"><i class="fa-solid fa-file-signature mr-1"></i>Izin</span>`;
                } else if (s === 'CUTI') {
                    statusBadge = `<span class="badge-pro-amber"><i class="fa-solid fa-calendar-check mr-1"></i>Cuti</span>`;
                } else if (s === 'LIBUR') {
                    statusBadge = `<span class="badge-pro-cyan"><i class="fa-solid fa-mug-hot mr-1"></i>Libur</span>`;
                }

                htmlContent += `
                    <tr class="hover:bg-emerald-50/30 transition-colors">
                        <td class="px-4 py-2 font-mono text-slate-500">#${row.id_absensi}</td>
                        <td class="px-4 py-2 font-mono font-bold text-slate-700">${row.id_karyawan}</td>
                        <td class="px-4 py-2 font-bold text-slate-900">${escapeHtml(row.nama_karyawan)}</td>
                        <td class="px-4 py-2 text-slate-600 text-xs font-semibold uppercase">${escapeHtml(row.jabatan || '-')}</td>
                        <td class="px-4 py-2 font-mono text-xs text-slate-600">${dateOnly}</td>
                        <td class="px-4 py-2 font-mono text-emerald-600 font-bold">${row.jam_masuk || '<span class="text-slate-300">-</span>'}</td>
                        <td class="px-4 py-2 font-mono text-blue-600 font-bold">${row.jam_keluar || '<span class="text-slate-300">-</span>'}</td>
                        <td class="px-4 py-2">${statusBadge}</td>
                        <td class="px-4 py-2 text-center">${row.telat_menit > 0 ? `<span class="badge-pro-rose font-mono">${formatPelanggaranToHHMMSS(row.telat_menit)}</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-4 py-2 text-center">${row.psw_menit > 0 ? `<span class="badge-pro-amber font-mono">${formatPelanggaranToHHMMSS(row.psw_menit)}</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-4 py-2 text-xs text-slate-500 italic">${escapeHtml(row.keterangan || '-')}</td>
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
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
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
        <thead class="sticky top-0 z-30 uppercase text-[11px] font-black tracking-wider table-head-pro text-white print:bg-white print:text-black shadow-md">
            <tr>
                <th class="md:sticky md:left-0 md:z-40 bg-[#0f172a] text-white print:bg-white print:text-black print:static px-4 py-3.5 text-center w-14 md:border-r border-slate-700/80 print:border-black"><i class="fa-solid fa-hashtag text-slate-400"></i></th>
                <th onclick="sortTable('table-rekap-body', 1)" class="cursor-pointer hover:bg-slate-800 transition-colors md:sticky md:left-14 md:z-40 bg-[#0f172a] text-white print:bg-white print:text-black print:static px-4 py-3.5 w-24 md:border-r border-slate-700/80 print:border-black text-center"><i class="fa-solid fa-id-badge text-emerald-400 mr-1"></i>ID <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 2)" class="cursor-pointer hover:bg-slate-800 transition-colors md:sticky md:left-38 md:z-40 bg-[#0f172a] text-white print:bg-white print:text-black print:static px-5 py-3.5 w-64 md:border-r border-slate-700/80 print:border-black md:shadow-sm text-left"><i class="fa-solid fa-user-tie text-indigo-400 mr-1.5"></i>Nama Pegawai <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 3)" class="cursor-pointer hover:bg-slate-800 transition-colors px-4 py-3.5 text-left"><i class="fa-solid fa-briefcase text-cyan-400 mr-1.5"></i>Jabatan <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 4)" class="cursor-pointer hover:bg-slate-800 transition-colors px-3 py-3.5 text-center"><i class="fa-solid fa-circle-check text-emerald-400 mr-1"></i>Hadir <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-car-side text-blue-400 mr-1"></i>DL</th>
                <th class="px-3 py-3.5 text-center bg-rose-950/40 text-rose-300 border-l border-r border-slate-700/60"><i class="fa-solid fa-heart-pulse mr-1 text-rose-400"></i>S</th>
                <th class="px-3 py-3.5 text-center bg-purple-950/40 text-purple-300 border-r border-slate-700/60"><i class="fa-solid fa-envelope-open-text mr-1 text-purple-400"></i>I</th>
                <th class="px-3 py-3.5 text-center bg-amber-950/40 text-amber-300 border-r border-slate-700/60"><i class="fa-solid fa-calendar-day mr-1 text-amber-400"></i>C</th>
                <th onclick="sortTable('table-rekap-body', 9)" class="cursor-pointer hover:bg-slate-800 transition-colors px-3 py-3.5 text-center"><i class="fa-solid fa-circle-xmark text-red-400 mr-1"></i>Alpa <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th onclick="sortTable('table-rekap-body', 10)" class="cursor-pointer hover:bg-slate-800 transition-colors px-3 py-3.5 text-center font-black text-amber-300"><i class="fa-solid fa-chart-pie mr-1"></i>% Hadir <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-clock text-amber-400 mr-1"></i>Telat</th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-hourglass-half text-amber-300 mr-1"></i>Telat (Wkt)</th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-person-walking-arrow-right text-orange-400 mr-1"></i>PSW</th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-business-time text-orange-300 mr-1"></i>PSW (Wkt)</th>
                <th onclick="sortTable('table-rekap-body', 15)" class="cursor-pointer hover:bg-slate-800 transition-colors px-3 py-3.5 text-center font-black text-rose-300 border-l border-slate-700/60"><i class="fa-solid fa-triangle-exclamation mr-1 text-rose-400"></i>Pelanggaran <i class="fa-solid fa-sort ml-1 text-slate-500 text-[10px]"></i></th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-right-from-bracket text-red-400 mr-1"></i>Tanpa Pulang</th>
                <th class="px-3 py-3.5 text-center"><i class="fa-solid fa-scissors text-rose-300 mr-1"></i>Potongan</th>
                <th class="px-4 py-3.5 text-center"><i class="fa-solid fa-clock text-teal-400 mr-1"></i>Total Jam</th>
                <th class="px-3 py-3.5 text-center print:hidden"><i class="fa-solid fa-gear text-slate-400"></i></th>
            </tr>
        </thead>
        <tbody id="table-rekap-body" class="table-pro-body divide-y divide-slate-100 text-xs bg-white">
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
            let tHadir = 0, tDL = 0, tSakit = 0, tIzin = 0, tCuti = 0, tAlpa = 0, tTelat = 0, tTelatMin = 0, tPsw = 0, tPswMin = 0, tPelanggaranMin = 0, tNoOut = 0, tPot = 0, tJamKerjaSecs = 0;
            
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
                
                if (row.total_jam_kerja) {
                    const p = row.total_jam_kerja.split(':').map(Number);
                    if (p.length === 3) {
                        tJamKerjaSecs += (p[0] * 3600) + (p[1] * 60) + p[2];
                    }
                }

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

                const grad = getAvatarGradient(row.nama);
                const initial = escapeHtml(row.nama || '').substring(0, 1).toUpperCase();

                let percentBadge = `<span class="badge-pro-rose">${persentase}%</span>`;
                if (persentase >= 95) percentBadge = `<span class="badge-pro-emerald">${persentase}%</span>`;
                else if (persentase >= 80) percentBadge = `<span class="badge-pro-blue">${persentase}%</span>`;

                htmlContent += `
                    <tr onclick="openModal('${row.id_karyawan}')" class="cursor-pointer hover:bg-emerald-50/40 border-b border-slate-100 last:border-0 group transition-colors">
                        <td class="md:sticky md:left-0 md:z-10 sticky-col bg-white group-hover:!bg-emerald-50/60 px-4 py-3 text-center font-mono text-slate-700 md:border-r border-slate-200/80 print:static print:bg-white print:border-b print:border-black">${index + 1}</td>
                        <td class="md:sticky md:left-14 md:z-10 sticky-col bg-white group-hover:!bg-emerald-50/60 px-4 py-3 font-mono font-bold text-slate-800 md:border-r border-slate-200/80 print:static print:bg-white print:border-b print:border-black text-center">${row.id_karyawan}</td>
                        <td class="md:sticky md:left-38 md:z-10 sticky-col bg-white group-hover:!bg-emerald-50/60 px-5 py-3 font-bold text-slate-900 md:border-r border-slate-200/80 md:shadow-xs print:static print:bg-white print:border-b print:border-black">
                            <div class="flex items-center gap-2.5">
                                <div class="w-7 h-7 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white text-[10px] font-black shadow-xs flex-shrink-0">
                                    ${initial}
                                </div>
                                <span class="truncate group-hover:text-emerald-700 transition">${escapeHtml(row.nama)}</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-xs text-slate-600 uppercase tracking-wide font-semibold truncate max-w-[140px]">${escapeHtml(row.jabatan || '-')}</td>
                        <td class="px-3 py-3 text-center">
                            <span class="badge-pro-emerald">${row.total_masuk}</span>
                        </td>
                        <td class="px-3 py-3 text-center cursor-pointer hover:bg-blue-50/60 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'DL');" title="Klik untuk melihat di Data View Absensi Harian">
                            <span class="badge-pro-blue">${row.total_dl || 0}</span>
                        </td>
                        <td class="px-3 py-3 text-center bg-rose-50/40 text-rose-700 font-bold border-l border-r border-slate-100 cursor-pointer hover:bg-rose-100/60 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'SAKIT');" title="Klik untuk melihat di Data View Absensi Harian">
                            ${row.total_sakit > 0 ? `<span class="badge-pro-rose">${row.total_sakit}</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center bg-purple-50/40 text-purple-700 font-bold border-r border-slate-100 cursor-pointer hover:bg-purple-100/60 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'IZIN');" title="Klik untuk melihat di Data View Absensi Harian">
                            ${row.total_izin > 0 ? `<span class="badge-pro-purple">${row.total_izin}</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center bg-amber-50/40 text-amber-700 font-bold border-r border-slate-100 cursor-pointer hover:bg-amber-100/60 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'CUTI');" title="Klik untuk melihat di Data View Absensi Harian">
                            ${row.total_cuti > 0 ? `<span class="badge-pro-amber">${row.total_cuti}</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center cursor-pointer hover:bg-red-50/60 transition-colors" onclick="event.stopPropagation(); showPelanggaranDates('${row.id_karyawan}', '${escapeHtml(row.nama)}', 'alpa');" title="Klik untuk melihat tanggal Alpa">
                            ${row.alpa > 0 ? `<span class="badge-pro-rose">${row.alpa}</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center">
                            ${percentBadge}
                        </td>
                        <td class="px-3 py-3 text-center cursor-pointer hover:bg-amber-50/60 transition-colors" onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}');" title="Klik untuk melihat di Data View Absensi Harian">
                            ${row.telat_kali > 0 ? `<span class="badge-pro-amber">${row.telat_kali}x</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center text-slate-500 font-mono text-[11px]">${formatPelanggaranToHHMMSS(row.telat_menit)}</td>
                        <td class="px-3 py-3 text-center ${row.psw_kali > 0 ? 'cursor-pointer hover:bg-amber-50/60' : ''}" ${row.psw_kali > 0 ? `onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}');"` : ''} title="Klik untuk melihat di Data View Absensi Harian">
                            ${row.psw_kali > 0 ? `<span class="badge-pro-amber">${row.psw_kali}x</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center text-slate-500 font-mono text-[11px]">${formatPelanggaranToHHMMSS(row.psw_menit || 0)}</td>
                        <td class="px-3 py-3 text-center border-l border-slate-100">
                            ${totalMenitPelanggaranBaru > 0 ? `<span class="badge-pro-rose font-mono">${formatPelanggaranToHHMMSS(totalMenitPelanggaranBaru)}</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center ${row.tanpa_absen_pulang > 0 ? 'cursor-pointer hover:bg-red-50/60' : ''}" ${row.tanpa_absen_pulang > 0 ? `onclick="event.stopPropagation(); jumpToViewDbForEmployee('${escapeHtml(row.nama)}', 'Tanpa Absen Pulang');"` : ''} title="Klik untuk melihat di Data View Absensi Harian">
                            ${row.tanpa_absen_pulang > 0 ? `<span class="badge-pro-rose">${row.tanpa_absen_pulang}</span>` : '<span class="text-slate-300 font-mono">-</span>'}
                        </td>
                        <td class="px-3 py-3 text-center font-mono text-rose-600 font-semibold">${row.potongan_jam}j</td>
                        <td class="px-4 py-3 text-center">
                            <span class="badge-pro-emerald font-mono">${row.total_jam_kerja || '00:00:00'}</span>
                        </td>
                        <td class="px-3 py-3 text-center print:hidden">
                            <button onclick="event.stopPropagation(); deleteEmployee('${row.id_karyawan}', '${escapeHtml(row.nama)}')" class="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all mx-auto" title="Hapus Pegawai">
                                <i class="fa-solid fa-trash text-xs"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });

            const tHrsSum = Math.floor(tJamKerjaSecs / 3600);
            const tMinsSum = Math.floor((tJamKerjaSecs % 3600) / 60);
            const tSecsSum = Math.floor(tJamKerjaSecs % 60);
            const formattedTotalJamKerjaSum = `${String(tHrsSum).padStart(2, '0')}:${String(tMinsSum).padStart(2, '0')}:${String(tSecsSum).padStart(2, '0')}`;

            htmlContent += `
                <tr class="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white font-bold border-t-2 border-emerald-500 print:bg-gray-200 print:border-black break-inside-avoid group">
                    <td colspan="4" class="px-5 py-3.5 text-right uppercase text-xs tracking-wider text-slate-300 font-black">
                        <i class="fa-solid fa-calculator mr-1.5 text-emerald-400"></i>Total Ringkasan:
                    </td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-emerald">${tHadir}</span></td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-blue">${tDL}</span></td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-rose">${tSakit}</span></td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-purple">${tIzin}</span></td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-amber">${tCuti}</span></td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-rose">${tAlpa}</span></td>
                    <td class="px-3 py-3.5 text-center text-slate-400">-</td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-amber">${tTelat}x</span></td>
                    <td class="px-3 py-3.5 text-center font-mono text-[11px] text-amber-300">${formatPelanggaranToHHMMSS(tTelatMin)}</td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-amber">${tPsw}x</span></td>
                    <td class="px-3 py-3.5 text-center font-mono text-[11px] text-amber-300">${formatPelanggaranToHHMMSS(tPswMin)}</td>
                    <td class="px-3 py-3.5 text-center border-l border-slate-700"><span class="badge-pro-rose font-mono">${formatPelanggaranToHHMMSS(tPelanggaranMin)}</span></td>
                    <td class="px-3 py-3.5 text-center"><span class="badge-pro-rose">${tNoOut}</span></td>
                    <td class="px-3 py-3.5 text-center text-rose-300 font-mono">${tPot}j</td>
                    <td class="px-4 py-3.5 text-center"><span class="badge-pro-emerald font-mono">${formattedTotalJamKerjaSum}</span></td>
                    <td class="px-3 py-3.5 print:hidden"></td>
                </tr>
                <!-- [NEW] Baris Total Pengeluaran Gaji -->
                <tr class="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 font-bold border-t border-emerald-500/50 text-white print:bg-white print:border-black break-inside-avoid">
                    <td colspan="15" class="px-6 py-4 text-right uppercase text-xs tracking-wider text-emerald-300 font-black">
                        <i class="fa-solid fa-money-bill-wave mr-1.5 text-emerald-400"></i>Total Estimasi Pengeluaran Gaji (Bulan Ini):
                    </td>
                    <td colspan="4" class="px-6 py-4 text-right text-lg font-black text-emerald-300 border-l border-emerald-500/30">
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
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
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

// --- DATA LOADER: PERFORMANCE MONITORING (SCORING SYSTEM & TABLE VIEW) ---
let perfStatusFilter = 'ALL';
let perfSearchQuery = '';

async function loadPerformanceData(silent = false) {
    if (!silent) showSpinner();

    try {
        // Gunakan data rekap bulan ini untuk analisis
        const monthInput = document.getElementById('filter-month');
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const month = (monthInput && monthInput.value) ? monthInput.value : currentMonth;

        const response = await fetch(`${API_BASE}/rekap?periode=${month}&_t=${Date.now()}`);
        const result = await response.json();
        
        const rawData = result.data || [];
        globalPerformanceData = rawData.map(emp => {
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

            return {
                ...emp,
                perfScore: score,
                perfStatus: status,
                perfColorClass: colorClass,
                perfIcon: icon
            };
        });

        // Urutkan peringkat berdasarkan skor kinerja tertinggi
        globalPerformanceData.sort((a, b) => b.perfScore - a.perfScore);

        // Render data ke tampilan tabel & kartu
        renderPerformanceViews();

        // Inisialisasi Drag Scroll universal
        setTimeout(() => {
            initDragScroll('performance-table-scroll');
            initDragScroll('performance-cards-scroll');
        }, 80);

    } catch (e) { 
        console.error('Error loading performance data:', e);
        if (typeof showToast === 'function') showToast(`Gagal memuat data kinerja: ${e.message}`, 'error');
    } finally {
        if (!silent) hideSpinner();
    }
}

// Render data kinerja ke tabel dan mode kartu
function renderPerformanceViews() {
    const tableBody = document.getElementById('table-performance-body');
    const grid = document.getElementById('performance-grid');
    const countSpan = document.getElementById('perf-emp-count');

    const query = (perfSearchQuery || '').toLowerCase().trim();
    const filtered = (globalPerformanceData || []).filter(emp => {
        if (perfStatusFilter !== 'ALL' && emp.perfStatus !== perfStatusFilter) {
            return false;
        }
        if (query) {
            const matchName = (emp.nama || '').toLowerCase().includes(query);
            const matchId = String(emp.id_karyawan || '').toLowerCase().includes(query);
            const matchJabatan = (emp.jabatan || '').toLowerCase().includes(query);
            if (!matchName && !matchId && !matchJabatan) return false;
        }
        return true;
    });

    if (countSpan) countSpan.textContent = filtered.length;

    // 1. Render Tabel Kinerja
    if (tableBody) {
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="13" class="px-6 py-12 text-center text-slate-400">
                        <i class="fa-solid fa-folder-open text-4xl mb-3 text-slate-300"></i>
                        <p class="font-bold text-sm text-slate-600">Tidak ada data pegawai yang sesuai</p>
                        <p class="text-xs text-slate-400 mt-1">Coba ubah kata kunci pencarian atau filter status</p>
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = filtered.map((emp, index) => {
                let rankBadge = `<span class="font-bold text-slate-500 text-xs">${index + 1}</span>`;
                if (index === 0) {
                    rankBadge = `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-black text-xs border border-amber-300 shadow-xs" title="Peringkat 1"><i class="fa-solid fa-crown text-[11px] text-amber-500"></i></span>`;
                } else if (index === 1) {
                    rankBadge = `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-black text-xs border border-slate-300 shadow-xs" title="Peringkat 2">2</span>`;
                } else if (index === 2) {
                    rankBadge = `<span class="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700/20 text-amber-900 font-black text-xs border border-amber-600/30 shadow-xs" title="Peringkat 3">3</span>`;
                }

                let statusBadge = '';
                let scoreColor = 'text-emerald-700';
                let barColor = 'bg-emerald-500';

                if (emp.perfStatus === 'PERLU PEMBINAAN') {
                    statusBadge = `<span class="badge-pro-rose"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Perlu Pembinaan</span>`;
                    scoreColor = 'text-rose-700';
                    barColor = 'bg-rose-500';
                } else if (emp.perfStatus === 'CUKUP') {
                    statusBadge = `<span class="badge-pro-amber"><i class="fa-solid fa-circle-exclamation mr-1"></i>Cukup</span>`;
                    scoreColor = 'text-amber-700';
                    barColor = 'bg-amber-500';
                } else if (emp.perfStatus === 'BAIK') {
                    statusBadge = `<span class="badge-pro-blue"><i class="fa-solid fa-thumbs-up mr-1"></i>Baik</span>`;
                    scoreColor = 'text-blue-700';
                    barColor = 'bg-blue-500';
                } else {
                    statusBadge = `<span class="badge-pro-emerald"><i class="fa-solid fa-medal mr-1"></i>Sangat Baik</span>`;
                    scoreColor = 'text-emerald-700';
                    barColor = 'bg-emerald-500';
                }

                const grad = getAvatarGradient(emp.nama);
                const initial = escapeHtml(emp.nama || '').substring(0, 1).toUpperCase();

                return `
                    <tr class="hover:bg-slate-50/90 transition-colors cursor-pointer group" onclick="openModal('${emp.id_karyawan}')">
                        <td class="px-3.5 py-3 text-center">${rankBadge}</td>
                        <td class="px-4 py-3 font-mono font-bold text-slate-800 text-xs">${emp.id_karyawan}</td>
                        <td class="px-4 py-3 font-bold text-slate-900 text-xs">
                            <div class="flex items-center gap-2">
                                <div class="w-7 h-7 rounded-full bg-gradient-to-tr ${grad} flex items-center justify-center text-white text-[10px] font-black shadow-xs flex-shrink-0">
                                    ${initial}
                                </div>
                                <span class="truncate group-hover:text-emerald-700 transition">${escapeHtml(emp.nama)}</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-slate-600 text-xs font-semibold uppercase tracking-wider">${escapeHtml(emp.jabatan || 'Staff')}</td>
                        <td class="px-4 py-3 text-center">
                            <div class="flex items-center gap-2 justify-center">
                                <span class="font-black text-sm ${scoreColor}">${emp.perfScore}</span>
                                <div class="w-14 bg-slate-200 h-2 rounded-full overflow-hidden">
                                    <div class="h-full ${barColor}" style="width: ${emp.perfScore}%"></div>
                                </div>
                                <span class="text-[10px] text-slate-400">/100</span>
                            </div>
                        </td>
                        <td class="px-4 py-3 text-center">${statusBadge}</td>
                        <td class="px-3.5 py-3 text-center"><span class="badge-pro-emerald">${emp.total_masuk || 0}</span></td>
                        <td class="px-3.5 py-3 text-center">${emp.total_dl > 0 ? `<span class="badge-pro-blue">${emp.total_dl}</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-3.5 py-3 text-center">${emp.telat_kali > 0 ? `<span class="badge-pro-amber">${emp.telat_kali}x</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-3.5 py-3 text-center">${emp.alpa > 0 ? `<span class="badge-pro-rose">${emp.alpa}</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-3.5 py-3 text-center">${emp.psw_kali > 0 ? `<span class="badge-pro-amber">${emp.psw_kali}x</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-3.5 py-3 text-center font-mono text-xs">${emp.potongan_jam > 0 ? `<span class="badge-pro-rose">${emp.potongan_jam}j</span>` : '<span class="text-slate-300 font-mono">-</span>'}</td>
                        <td class="px-4 py-3 text-center" onclick="event.stopPropagation()">
                            <button onclick="openModal('${emp.id_karyawan}')" class="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5" title="Detail Evaluasi & Profil Pegawai">
                                <i class="fa-solid fa-chart-pie"></i> Detail
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // 2. Render Kartu Kinerja
    if (grid) {
        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-400">
                    <i class="fa-solid fa-folder-open text-4xl mb-3 text-slate-300"></i>
                    <p class="font-bold text-sm text-slate-600">Tidak ada kartu pegawai yang sesuai</p>
                </div>
            `;
        } else {
            grid.innerHTML = filtered.map(emp => {
                return `
                    <div onclick="openModal('${emp.id_karyawan}')" class="bg-white rounded-2xl p-6 border-t-4 ${emp.perfColorClass} relative overflow-hidden group hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-1.5 transition-all duration-300 cursor-pointer shadow-md border border-slate-200/80">
                        <div class="absolute top-0 right-0 p-4 opacity-20 group-hover:opacity-40 transition">
                            <i class="fa-solid ${emp.perfIcon} text-6xl"></i>
                        </div>
                        
                        <div class="relative z-10">
                            <h3 class="text-lg font-bold text-[#064e3b] truncate">${escapeHtml(emp.nama)}</h3>
                            <p class="text-xs text-gray-500 mb-4 uppercase tracking-wide">${escapeHtml(emp.jabatan || 'Staff')} • ID: ${emp.id_karyawan}</p>
                            
                            <div class="flex items-end gap-2 mb-2">
                                <span class="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-700 to-emerald-500">${emp.perfScore}</span>
                                <span class="text-sm text-gray-400 mb-1">/ 100</span>
                            </div>
                            
                            <div class="w-full bg-slate-100 h-2.5 rounded-full mb-4 overflow-hidden">
                                <div class="h-full ${emp.perfColorClass.replace('text', 'bg').split(' ')[1]}" style="width: ${emp.perfScore}%"></div>
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

                            <div class="mt-4 text-center font-bold text-xs tracking-widest ${emp.perfColorClass.split(' ')[1]} border border-dashed border-gray-300 p-2 rounded uppercase">
                                ${emp.perfStatus}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
}

function filterPerformanceData() {
    const input = document.getElementById('search-performance');
    perfSearchQuery = input ? input.value : '';
    renderPerformanceViews();
}

function filterPerformanceStatus(status) {
    perfStatusFilter = status;

    const btnAll = document.getElementById('perf-filter-all');
    const btnSangat = document.getElementById('perf-filter-sangat-baik');
    const btnBaik = document.getElementById('perf-filter-baik');
    const btnCukup = document.getElementById('perf-filter-cukup');
    const btnPembinaan = document.getElementById('perf-filter-pembinaan');

    const inactiveClass = 'px-2.5 py-1 rounded text-slate-600 hover:text-emerald-700 text-[11px] transition-all';
    const activeClass = 'px-2.5 py-1 rounded bg-white text-emerald-800 shadow-sm font-bold text-[11px] transition-all';

    if (btnAll) btnAll.className = (status === 'ALL') ? activeClass : inactiveClass;
    if (btnSangat) btnSangat.className = (status === 'SANGAT BAIK') ? activeClass : inactiveClass;
    if (btnBaik) btnBaik.className = (status === 'BAIK') ? activeClass : inactiveClass;
    if (btnCukup) btnCukup.className = (status === 'CUKUP') ? activeClass : inactiveClass;
    if (btnPembinaan) btnPembinaan.className = (status === 'PERLU PEMBINAAN') ? activeClass : inactiveClass;

    renderPerformanceViews();
}

function switchPerformanceView(mode) {
    const tableContainer = document.getElementById('performance-table-container');
    const cardsContainer = document.getElementById('performance-cards-container');
    const btnTable = document.getElementById('btn-perf-table');
    const btnCard = document.getElementById('btn-perf-card');

    if (mode === 'card') {
        if (tableContainer) tableContainer.classList.add('hidden');
        if (cardsContainer) cardsContainer.classList.remove('hidden');

        if (btnTable) btnTable.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-emerald-700 transition-all';
        if (btnCard) btnCard.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-white text-emerald-700 shadow-sm transition-all';

        initDragScroll('performance-cards-scroll');
    } else {
        // Default Table
        if (cardsContainer) cardsContainer.classList.add('hidden');
        if (tableContainer) tableContainer.classList.remove('hidden');

        if (btnCard) btnCard.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-emerald-700 transition-all';
        if (btnTable) btnTable.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-white text-emerald-700 shadow-sm transition-all';

        initDragScroll('performance-table-scroll');
    }
}

function scrollPerformance(direction) {
    const cardsContainer = document.getElementById('performance-cards-container');
    const isCard = cardsContainer && !cardsContainer.classList.contains('hidden');
    const container = isCard 
        ? document.getElementById('performance-cards-scroll') 
        : document.getElementById('performance-table-scroll');

    if (!container) return;

    if (direction === 'left') {
        container.scrollBy({ left: -320, behavior: 'smooth' });
    } else if (direction === 'right') {
        container.scrollBy({ left: 320, behavior: 'smooth' });
    } else if (direction === 'up') {
        container.scrollBy({ top: -260, behavior: 'smooth' });
    } else if (direction === 'down') {
        container.scrollBy({ top: 260, behavior: 'smooth' });
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
        const rawEmployees = result.descriptors || [];
        const seenIds = new Set();
        const employees = [];
        rawEmployees.forEach(e => {
            const idKey = String(e.id_karyawan || '').trim().toLowerCase();
            if (idKey && !seenIds.has(idKey)) {
                seenIds.add(idKey);
                employees.push(e);
            }
        });
        globalEmployees = employees; // Simpan ke global agar bisa diedit
        
        countSpan.textContent = employees.length;
        grid.innerHTML = '';
        const tableBody = document.getElementById('table-employees-body');
        if (tableBody) tableBody.innerHTML = '';

        if (employees.length > 0) {
            employees.forEach(emp => {
                // Gunakan foto asli jika ada, jika tidak pakai avatar UI
                const photoSrc = emp.foto ? `data:image/jpeg;base64,${emp.foto}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.nama)}&background=10b981&color=fff`;

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
                    sampleCount = 0;
                }
                
                // Cek jika sampel ada tapi terdeteksi corrupt
                if (sampleCount > 0 && isCorrupt) {
                    sampleCount = -1; // Tandai error
                    corruptCount++; // Increment counter
                    console.group(`🚨 DATA RUSAK DITEMUKAN: ${emp.nama}`);
                    console.error(`ID: ${emp.id_karyawan}`);
                    console.error("Raw Descriptor:", emp.face_descriptor);
                    console.groupEnd();
                }

                // Warna Badge Sampel Wajah
                let sampleBadgeColor = 'bg-red-50 text-red-600 border-red-100';
                if (sampleCount >= 5) sampleBadgeColor = 'bg-emerald-50 text-emerald-600 border-emerald-100';
                else if (sampleCount >= 3) sampleBadgeColor = 'bg-blue-50 text-blue-600 border-blue-100';
                else if (sampleCount >= 1) sampleBadgeColor = 'bg-amber-50 text-amber-600 border-amber-100';

                let sampleLabel = `${sampleCount} Sampel`;
                if (sampleCount === -1 || isCorrupt) {
                    sampleLabel = "DATA RUSAK";
                    sampleBadgeColor = "bg-red-600 text-white border-red-700 animate-pulse font-bold";
                }

                // Status Akun Portal Pegawai
                const hasAccount = !!emp.username;
                const portalUsernameTag = hasAccount 
                    ? `<span class="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1"><i class="fa-solid fa-at text-indigo-400"></i>${escapeHtml(emp.username)}</span>`
                    : `<span class="text-slate-400 italic text-[11px]">- Belum Mendaftar -</span>`;

                const portalAccountBadge = hasAccount
                    ? `<span class="badge-pro-emerald"><i class="fa-solid fa-circle-check mr-1"></i>Terdaftar</span>`
                    : `<span class="badge-pro-slate"><i class="fa-solid fa-circle-minus mr-1"></i>Belum Ada Akun</span>`;

                // Render Mode 1: Cards Grid
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
                                        <div class="flex flex-wrap items-center gap-1.5 mt-1">
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wide truncate max-w-full">${escapeHtml(emp.jabatan || 'Staff')}</span>
                                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${sampleBadgeColor} border uppercase tracking-wide truncate" title="Status Data Wajah">
                                                <i class="fa-solid fa-fingerprint mr-1"></i>${sampleLabel}
                                            </span>
                                            ${hasAccount ? `<span class="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200" title="Username Portal">@${escapeHtml(emp.username)}</span>` : ''}
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="mt-3 flex items-center justify-between">
                                    <div class="flex items-center gap-2 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                        <i class="fa-solid fa-id-badge text-gray-400"></i>
                                        <span class="font-bold text-gray-700">${emp.id_karyawan}</span>
                                    </div>
                                    
                                    <!-- Actions -->
                                    <div class="flex gap-1 flex-wrap">
                                        ${hasAccount ? `<button onclick="deletePortalAccount('${emp.id_karyawan}', this.dataset.name)" data-name="${escapeHtml(emp.nama)}" class="w-7 h-7 rounded flex items-center justify-center text-rose-500 hover:text-white hover:bg-rose-600 transition-all border border-rose-200 hover:border-rose-600" title="Hapus Akun Portal Pegawai"><i class="fa-solid fa-user-slash text-xs"></i></button>` : ''}
                                        <button onclick="window.location.href='admin.html?id=${emp.id_karyawan}&name=${encodeURIComponent(emp.nama)}&role=${encodeURIComponent(emp.jabatan || '')}'" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-100" title="Rekam Wajah / Update Descriptor">
                                            <i class="fa-solid fa-camera text-xs"></i>
                                        </button>
                                        <button onclick="resetPasswordPortal('${emp.id_karyawan}', this.dataset.name)" data-name="${escapeHtml(emp.nama)}" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-all border border-transparent hover:border-purple-100" title="Reset Password Portal">
                                            <i class="fa-solid fa-key text-xs"></i>
                                        </button>
                                        <button onclick="openEditModal('${emp.id_karyawan}')" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all border border-transparent hover:border-blue-100" title="Edit">
                                            <i class="fa-solid fa-pen-to-square text-xs"></i>
                                        </button>
                                        <button onclick="deleteEmployee('${emp.id_karyawan}', this.dataset.name)" data-name="${escapeHtml(emp.nama)}" class="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all border border-transparent hover:border-red-100" title="Hapus Permanen Pegawai">
                                            <i class="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                grid.innerHTML += card;

                // Render Mode 2: Table View (Akun Portal & Biometrik)
                if (tableBody) {
                    let tableSampleBadge = `<span class="badge-pro-rose"><i class="fa-solid fa-triangle-exclamation mr-1"></i>0 Sampel</span>`;
                    if (isCorrupt) {
                        tableSampleBadge = `<span class="badge-pro-rose animate-pulse font-black"><i class="fa-solid fa-triangle-exclamation mr-1"></i>DATA RUSAK</span>`;
                    } else if (sampleCount >= 5) {
                        tableSampleBadge = `<span class="badge-pro-emerald"><i class="fa-solid fa-fingerprint mr-1"></i>${sampleCount} Sampel (Baik)</span>`;
                    } else if (sampleCount >= 1) {
                        tableSampleBadge = `<span class="badge-pro-blue"><i class="fa-solid fa-fingerprint mr-1"></i>${sampleCount} Sampel</span>`;
                    }

                    const tableActionButtons = `
                        <div class="flex items-center justify-center gap-1.5 flex-wrap">
                            ${hasAccount ? `<button onclick="deletePortalAccount('${emp.id_karyawan}', '${escapeHtml(emp.nama)}')" class="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 font-bold text-[11px] transition-all flex items-center gap-1 shadow-sm" title="Hapus Akun Portal Pegawai (Bisa Daftar Ulang)"><i class="fa-solid fa-user-slash"></i> Hapus Akun Portal</button>` : `<span class="text-slate-400 text-[10px] italic bg-slate-50 px-2 py-1 rounded border border-slate-200">Belum Ada Akun</span>`}
                            <button onclick="resetPasswordPortal('${emp.id_karyawan}', '${escapeHtml(emp.nama)}')" class="p-1.5 rounded-lg bg-purple-50 hover:bg-purple-600 text-purple-600 hover:text-white border border-purple-200 text-xs transition-all" title="Reset Password Portal"><i class="fa-solid fa-key"></i></button>
                            <button onclick="openEditModal('${emp.id_karyawan}')" class="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-200 text-xs transition-all" title="Edit Pegawai"><i class="fa-solid fa-pen-to-square"></i></button>
                            <button onclick="deleteEmployee('${emp.id_karyawan}', '${escapeHtml(emp.nama)}')" class="p-1.5 rounded-lg bg-red-50 hover:bg-red-700 text-red-600 hover:text-white border border-red-200 text-xs transition-all" title="Hapus Data Pegawai Permanen"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    `;

                    const passwordPlainTag = emp.password_plain 
                        ? `<span class="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200"><i class="fa-solid fa-lock text-slate-400 mr-1"></i>${escapeHtml(emp.password_plain)}</span>` 
                        : `<span class="text-slate-300 italic text-[10px]">-</span>`;

                    const rowHtml = `
                        <tr class="hover:bg-slate-50/80 transition-colors">
                            <td class="px-4 py-3 text-center">
                                <div class="w-9 h-9 rounded-full p-0.5 bg-slate-100 mx-auto shadow-sm">
                                    <img src="${photoSrc}" class="w-full h-full object-cover rounded-full border border-slate-200">
                                </div>
                            </td>
                            <td class="px-4 py-3 font-mono font-bold text-slate-800 text-xs">${emp.id_karyawan}</td>
                            <td class="px-4 py-3 font-bold text-slate-900 text-xs">
                                <button onclick="openScanPortalForEmployee('${emp.id_karyawan}')" class="group text-left flex items-center gap-1.5 hover:text-emerald-700 transition-colors" title="Klik nama untuk mengatur munculnya scan.html di Portal Online">
                                    <span class="underline decoration-dotted decoration-emerald-400 underline-offset-2">${escapeHtml(emp.nama)}</span>
                                    <span class="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-extrabold opacity-80 group-hover:opacity-100"><i class="fa-solid fa-camera-rotate mr-0.5"></i>Scan.html</span>
                                </button>
                            </td>
                            <td class="px-4 py-3 text-slate-600 text-xs font-medium">${escapeHtml(emp.jabatan || 'Staff')}</td>
                            <td class="px-4 py-3">${portalUsernameTag}</td>
                            <td class="px-4 py-3 text-center">${passwordPlainTag}</td>
                            <td class="px-4 py-3 text-center">${portalAccountBadge}</td>
                            <td class="px-4 py-3 text-center">${tableSampleBadge}</td>
                            <td class="px-4 py-3 text-center">${tableActionButtons}</td>
                        </tr>
                    `;
                    tableBody.innerHTML += rowHtml;
                }
            });

            // Tampilkan Banner Peringatan jika ada data rusak
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

            // Fitur Pencarian Real-time (Grid & Table)
            const searchInput = document.getElementById('search-employee');
            if (searchInput) {
                searchInput.oninput = (e) => {
                    const term = e.target.value.toLowerCase();
                    // Filter Cards
                    Array.from(grid.children).forEach(card => {
                        const text = card.innerText.toLowerCase();
                        card.style.display = text.includes(term) ? 'flex' : 'none';
                    });
                    // Filter Table Rows
                    if (tableBody) {
                        Array.from(tableBody.children).forEach(row => {
                            const text = row.innerText.toLowerCase();
                            row.style.display = text.includes(term) ? '' : 'none';
                        });
                    }
                };
            }
        }
    } catch (e) {
        grid.innerHTML = `<div class="col-span-full text-center text-red-500">Gagal memuat data: ${e.message}</div>`;
    } finally {
        if (!silent) hideSpinner();
    }
}

// --- FITUR: SWITCH VIEW PEGAWAI (KARTU / TABEL AKUN PORTAL) ---
function switchEmployeeView(mode) {
    const grid = document.getElementById('employees-grid');
    const tableContainer = document.getElementById('employees-table-container');
    const btnGrid = document.getElementById('btn-view-grid');
    const btnTable = document.getElementById('btn-view-table');

    const navEmp = document.getElementById('nav-employees');
    const navBiometrik = document.getElementById('nav-biometrik-akun');

    if (mode === 'table') {
        // Sembunyikan grid sepenuhnya (display:none agar tidak bertumpuk)
        if (grid) { grid.classList.add('hidden'); grid.style.display = 'none'; }
        if (tableContainer) { tableContainer.classList.remove('hidden'); tableContainer.style.display = ''; }
        
        if (btnGrid) {
            btnGrid.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-emerald-700 transition-all';
        }
        if (btnTable) {
            btnTable.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-white text-emerald-700 shadow-sm transition-all';
        }

        if (navBiometrik) navBiometrik.classList.add('active');
        if (navEmp) navEmp.classList.remove('active');
    } else {
        // Sembunyikan tabel sepenuhnya (display:none agar tidak bertumpuk)
        if (tableContainer) { tableContainer.classList.add('hidden'); tableContainer.style.display = 'none'; }
        if (grid) { grid.classList.remove('hidden'); grid.style.display = ''; }
        
        if (btnGrid) {
            btnGrid.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold bg-white text-emerald-700 shadow-sm transition-all';
        }
        if (btnTable) {
            btnTable.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold text-slate-600 hover:text-emerald-700 transition-all';
        }

        if (navEmp) navEmp.classList.add('active');
        if (navBiometrik) navBiometrik.classList.remove('active');
    }
}

// --- FITUR: HAPUS AKUN PORTAL PEGAWAI ---
async function deletePortalAccount(id, nama) {
    if (!confirm(`PERINGATAN HAPUS AKUN PORTAL:\n\nApakah Anda yakin ingin menghapus AKUN PORTAL untuk:\nNama: ${nama}\nID: ${id}\n\nPegawai tidak akan bisa login ke Portal Online sampai mereka melakukan registrasi akun kembali.\n(Data biometrik & absensi pegawai TETAP AMAN)`)) {
        return;
    }

    showSpinner();
    try {
        const response = await fetch(`${API_BASE}/pegawai/akun/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') }
        });
        const result = await response.json();
        hideSpinner();

        if (result.success) {
            showToast(result.message || 'Akun portal pegawai berhasil dihapus.', 'success');
            loadEmployees(); // Reload data pegawai & tabel akun
        } else {
            showToast(result.message || 'Gagal menghapus akun portal pegawai.', 'error');
        }
    } catch (e) {
        hideSpinner();
        showToast('Error: ' + e.message, 'error');
    }
}

// --- FITUR: DELETE EMPLOYEE ---
async function deleteEmployee(id, nama) {
    if(!confirm(`PERINGATAN: Apakah Anda yakin ingin menghapus pegawai "${nama}"?\n\nData absensi terkait juga akan dihapus permanen.`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/karyawan/${id}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') } });
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
        const response = await fetch(`${API_BASE}/pegawai/reset_password/${id}`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') } });
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
            const response = await fetch(`${API_BASE}/karyawan/${emp.id_karyawan}`, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') } });
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
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
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
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
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
        const response = await fetch(`${API_BASE}/karyawan/${encodeURIComponent(id)}/reset_biometric`, { method: 'PUT', headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') } });
        
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

    // [FIX] Set tanggal lokal hari ini sebagai default (mencegah bug tanggal mundur ke kemarin akibat UTC valueAsDate)
    const nowLocal = new Date();
    document.getElementById('manual-date').value = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`;

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
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
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
        const response = await fetch(`${API_BASE}/absensi/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') }
        });
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
        const response = await fetch(`${API_BASE}/absensi/${id}`, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') }
        });
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
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    if (!isFull) {
        const el = document.documentElement;
        if (el.requestFullscreen) {
            el.requestFullscreen().catch(err => console.warn('Fullscreen request error:', err));
        } else if (el.webkitRequestFullscreen) {
            el.webkitRequestFullscreen();
        } else if (el.mozRequestFullScreen) {
            el.mozRequestFullScreen();
        } else if (el.msRequestFullscreen) {
            el.msRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.warn('Exit fullscreen error:', err));
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    }
}

function handleFullscreenChange() {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const icon = document.getElementById('icon-fullscreen');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (icon) {
        if (isFull) {
            icon.classList.replace('fa-expand', 'fa-compress');
        } else {
            icon.classList.replace('fa-compress', 'fa-expand');
        }
    }

    if (isFull) {
        document.documentElement.classList.add('is-fullscreen');
        document.body.classList.add('is-fullscreen');
        if (sidebar) sidebar.classList.remove('fullscreen-show');
        if (overlay) overlay.classList.remove('fullscreen-show');
    } else {
        document.documentElement.classList.remove('is-fullscreen');
        document.body.classList.remove('is-fullscreen');
        if (sidebar) sidebar.classList.remove('fullscreen-show');
        if (overlay) overlay.classList.remove('fullscreen-show');
    }

    // Trigger resize event agar grafik Chart.js & layout segera menyesuaikan ukuran layar penuh
    setTimeout(() => window.dispatchEvent(new Event('resize')), 200);
}

document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);

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

    if (!sidebar) return;

    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || document.body.classList.contains('is-fullscreen'));

    if (isFullscreen) {
        // Logika saat Fullscreen: Buka/Tutup sebagai floating drawer
        sidebar.classList.toggle('fullscreen-show');
        if (overlay) {
            overlay.classList.toggle('fullscreen-show');
        }
        setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
        return;
    }

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
        // Logika Desktop: Bergeser ke kiri (slide out) atau muncul kembali (slide in)
        sidebar.classList.toggle('collapsed');
        try {
            localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed') ? '1' : '0');
        } catch (e) {}
    }

    // Trigger resize event agar grafik Chart.js & tabel langsung beradaptasi secara mulus
    setTimeout(() => window.dispatchEvent(new Event('resize')), 350);
}

function setupSidebarToggle() {
    // Restore preferensi sidebar jika sebelumnya disembunyikan di desktop
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth >= 768) {
        try {
            if (localStorage.getItem('sidebar_collapsed') === '1') {
                sidebar.classList.add('collapsed');
            }
        } catch (e) {}
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
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
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
                    <h3>PEMERINTAH <span class="dynamic-instansi-lokasi">${document.querySelector('.dynamic-instansi-lokasi')?.textContent || 'PEMERINTAH DAERAH'}</span></h3>
                    <h3>DINAS KESEHATAN</h3>
                    <h1>UPTD <span class="dynamic-instansi-nama">${document.querySelector('.dynamic-instansi-nama')?.textContent || 'INSTANSI'}</span></h1>
                    <p>${document.querySelector('.dynamic-instansi-lokasi')?.textContent || 'Lokasi'}</p>
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
                <div class="sign-box"><p>Kepala <span class="dynamic-instansi-nama">${document.querySelector('.dynamic-instansi-nama')?.textContent || 'Instansi'}</span>,</p><div class="sign-line"></div><p>( ${config.kepalaNama || '...........................'} )</p></div>
            </div>

            <div class="footer">Dicetak otomatis oleh Sistem Biometrik <span class="dynamic-instansi-nama">${document.querySelector('.dynamic-instansi-nama')?.textContent || 'Instansi'}</span>.<br>ID: ${Date.now().toString(36).toUpperCase()}</div>
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
            <thead class="sticky top-0 z-30 uppercase text-[11px] font-black tracking-wider table-head-pro text-white shadow-md">
                <tr>
                    <th class="px-3 py-2.5 text-center border border-slate-700/80 w-12"><i class="fa-solid fa-hashtag text-slate-400"></i></th>
                    <th class="px-5 py-2.5 text-left border border-slate-700/80 w-56"><i class="fa-solid fa-user-tie text-indigo-400 mr-1.5"></i>Nama Pegawai</th>
                    <th class="px-4 py-2.5 text-left border border-slate-700/80 w-36"><i class="fa-solid fa-briefcase text-cyan-400 mr-1.5"></i>Jabatan</th>
                    ${thDays}
                    <th class="px-4 py-2.5 text-center border border-slate-700/80 min-w-[120px] bg-emerald-950 text-emerald-300 font-black"><i class="fa-solid fa-clock text-emerald-400 mr-1"></i>Total Jam Kerja</th>
                </tr>
            </thead>
            <tbody id="table-rekap-body" class="table-pro-body divide-y divide-slate-100 text-xs bg-white">
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
                    <td class="px-4 py-2 text-center font-mono font-bold text-emerald-600 border border-slate-200">${row.total_jam_kerja || '00:00:00'}</td>
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
            <tr class="table-head-pro text-white uppercase text-[10px] font-black shadow-md">
                <th class="px-3 py-2 text-center border border-slate-700/80 w-10"><i class="fa-solid fa-hashtag text-slate-400"></i></th>
                <th class="px-4 py-2 text-left border border-slate-700/80 w-44"><i class="fa-solid fa-user-tie text-indigo-400 mr-1"></i>Nama Pegawai</th>
                <th class="px-4 py-2 text-left border border-slate-700/80 w-32"><i class="fa-solid fa-briefcase text-cyan-400 mr-1"></i>Jabatan</th>
                ${thDays}
                <th class="px-3 py-2 text-center border border-slate-700/80 min-w-[120px] bg-emerald-950 text-emerald-300 font-black"><i class="fa-solid fa-clock text-emerald-400 mr-1"></i>Total Jam Kerja</th>
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
                    <td class="px-3 py-1.5 text-center font-mono font-bold text-emerald-600 border border-slate-200">${row.total_jam_kerja || '00:00:00'}</td>
                </tr>
            `;
        });

    } catch (e) {
        console.error(e);
        tbody.innerHTML = `<tr><td colspan="3" class="p-4 text-center text-red-500">Error: ${e.message}</td></tr>`;
    }
}

// =========================================================================
// [NEW] MODUL TABEL KONTROL AKSES SCAN.HTML PORTAL ONLINE (JADWAL LIBUR)
// =========================================================================
let globalScanPortalRows = [];
let currentScanPortalFilter = 'ALL';
let currentScanPortalDayName = '';
let currentScanPortalDateStr = '';
let highlightedScanPortalEmpId = null;

const HARI_PORTAL_SHORT = [
    { full: 'Senin', short: 'Sen' },
    { full: 'Selasa', short: 'Sel' },
    { full: 'Rabu', short: 'Rab' },
    { full: 'Kamis', short: 'Kam' },
    { full: 'Jumat', short: 'Jum' },
    { full: 'Sabtu', short: 'Sab' },
    { full: 'Minggu', short: 'Min' }
];

async function openScanPortalForEmployee(idKaryawan) {
    highlightedScanPortalEmpId = idKaryawan;
    switchTab('scan-portal');
    await loadScanPortalAccessTable(true);
    // Toggle langsung atau scroll ke baris pegawai yang diklik namanya
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (row && Number(row.aktif) === 0) {
        await toggleEmployeeScanPortalByClick(idKaryawan);
    }
    setTimeout(() => {
        const el = document.getElementById(`scan-portal-row-${idKaryawan}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-amber-400', 'bg-amber-50/70');
            setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400'), 3000);
        }
    }, 200);
}

async function loadScanPortalAccessTable(silent = false) {
    const tbody = document.getElementById('table-scan-portal-body');
    if (!tbody) return;
    if (!silent) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500"><i class="fa-solid fa-circle-notch fa-spin text-emerald-600 text-xl mr-2"></i>Memuat tabel jadwal akses scan.html Portal Online...</td></tr>`;
    }

    try {
        const res = await fetch(`${API_BASE}/akses-scan-portal?_t=${Date.now()}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Gagal memuat data akses scan portal');

        globalScanPortalRows = json.data || [];
        currentScanPortalDayName = json.day_name || '';
        currentScanPortalDateStr = json.today || '';

        const badgeEl = document.getElementById('scan-portal-today-badge');
        if (badgeEl) badgeEl.textContent = `Hari Ini: ${currentScanPortalDayName}, ${currentScanPortalDateStr}`;

        const statDayEl = document.getElementById('scan-portal-stat-day');
        if (statDayEl) statDayEl.textContent = `${currentScanPortalDayName} (${currentScanPortalDateStr})`;

        const activeCount = globalScanPortalRows.filter(r => Number(r.aktif) === 1).length;
        const todayAllowedCount = globalScanPortalRows.filter(r => r.allowed_today).length;
        const doneTodayCount = globalScanPortalRows.filter(r => r.allowed_today && r.absen_hari_ini_masuk).length;

        const statTodayEl = document.getElementById('scan-portal-stat-today');
        if (statTodayEl) statTodayEl.textContent = `${todayAllowedCount} Pegawai`;

        const statActiveEl = document.getElementById('scan-portal-stat-active');
        if (statActiveEl) statActiveEl.textContent = `${activeCount} Pegawai`;

        const statDoneEl = document.getElementById('scan-portal-stat-done');
        if (statDoneEl) statDoneEl.textContent = `${doneTodayCount} Pegawai`;

        renderScanPortalAccessTable();
    } catch (e) {
        console.error('Error loadScanPortalAccessTable:', e);
        tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-rose-600 font-bold">Gagal memuat tabel: ${escapeHtml(e.message)}</td></tr>`;
    }
}

function setScanPortalFilter(filterVal) {
    currentScanPortalFilter = filterVal;
    document.querySelectorAll('#scan-portal-day-filters .scan-filter-btn').forEach(btn => {
        const f = btn.getAttribute('data-filter');
        if (f === filterVal) {
            btn.className = 'scan-filter-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all';
        } else {
            btn.className = 'scan-filter-btn px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-emerald-50 transition-all';
        }
    });
    renderScanPortalAccessTable();
}

function normScanSearch(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function onScanPortalSearchInput() {
    const searchInput = document.getElementById('search-scan-portal');
    const clearBtn = document.getElementById('btn-clear-scan-search');
    const val = searchInput ? searchInput.value.trim() : '';
    if (clearBtn) {
        if (val) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }
    openScanPortalSearchDropdown();
    renderScanPortalAccessTable();
}

function clearScanPortalSearch() {
    const searchInput = document.getElementById('search-scan-portal');
    const clearBtn = document.getElementById('btn-clear-scan-search');
    const dropdown = document.getElementById('scan-portal-search-dropdown');
    const selectedCard = document.getElementById('selected-scan-portal-emp-card');
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.classList.add('hidden');
    if (dropdown) dropdown.classList.add('hidden');
    if (selectedCard) selectedCard.classList.add('hidden');
    highlightedScanPortalEmpId = null;
    renderScanPortalAccessTable();
}

function openScanPortalSearchDropdown() {
    const dropdown = document.getElementById('scan-portal-search-dropdown');
    const searchInput = document.getElementById('search-scan-portal');
    if (!dropdown || !searchInput) return;

    const rawTerm = searchInput.value.trim().toLowerCase();
    const cleanTerm = normScanSearch(rawTerm);

    const matches = globalScanPortalRows.filter(row => {
        if (!rawTerm) return true;
        const hayRaw = `${row.nama || ''} ${row.id_karyawan || ''} ${row.jabatan || ''} ${row.username_portal || ''}`.toLowerCase();
        const hayClean = normScanSearch(hayRaw);
        return hayRaw.includes(rawTerm) || (cleanTerm && hayClean.includes(cleanTerm));
    });

    if (matches.length === 0) {
        dropdown.innerHTML = `<div class="p-3 text-center text-xs text-slate-400 italic">Nama pegawai tidak ditemukan.</div>`;
    } else {
        dropdown.innerHTML = `
            <div class="px-3 py-2 bg-emerald-900 text-white text-[10px] font-extrabold uppercase tracking-wider flex justify-between items-center sticky top-0 z-10">
                <span><i class="fa-solid fa-hand-pointer text-amber-300 mr-1"></i>Klik Nama Pegawai untuk Memunculkan Data & Mengaktifkan Scan.html</span>
                <button type="button" onclick="document.getElementById('scan-portal-search-dropdown').classList.add('hidden')" class="text-emerald-200 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>
        ` + matches.map(r => {
            const isAktif = Number(r.aktif) === 1;
            return `
                <button type="button" onclick="selectEmployeeFromScanSearch('${r.id_karyawan}')"
                    class="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 flex items-center justify-between gap-2 transition-colors group">
                    <div class="min-w-0 flex-1">
                        <div class="font-extrabold text-xs text-slate-800 group-hover:text-emerald-800 truncate flex items-center gap-1.5">
                            <span>${escapeHtml(r.nama)}</span>
                            <span class="font-mono text-[10px] text-slate-400">(${escapeHtml(r.id_karyawan)})</span>
                        </div>
                        <div class="text-[10px] text-slate-500 truncate mt-0.5">
                            ${escapeHtml(r.jabatan || 'Staff')} • ${r.username_portal ? `<span class="text-indigo-600 font-bold">@${escapeHtml(r.username_portal)}</span>` : '<span class="text-rose-500">Belum ada akun portal</span>'}
                        </div>
                    </div>
                    <span class="shrink-0 px-2 py-1 rounded-lg text-[10px] font-extrabold ${
                        isAktif
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-amber-100 text-amber-800 border border-amber-300 group-hover:bg-emerald-600 group-hover:text-white'
                    }">
                        ${isAktif ? `✓ Aktif (${escapeHtml(r.hari_diizinkan || 'Terjadwal')})` : '+ Klik Pilih'}
                    </span>
                </button>
            `;
        }).join('');
    }
    dropdown.classList.remove('hidden');
}

async function selectEmployeeFromScanSearch(idKaryawan) {
    const dropdown = document.getElementById('scan-portal-search-dropdown');
    const searchInput = document.getElementById('search-scan-portal');
    const clearBtn = document.getElementById('btn-clear-scan-search');
    if (dropdown) dropdown.classList.add('hidden');

    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;

    if (searchInput) searchInput.value = row.nama;
    if (clearBtn) clearBtn.classList.remove('hidden');
    highlightedScanPortalEmpId = row.id_karyawan;

    // Jika pegawai yang diklik namanya belum aktif, otomatis aktifkan agar langsung terjadwal!
    if (Number(row.aktif) === 0) {
        let defaultDay = String(row.hari_diizinkan || '').trim();
        if (!defaultDay) {
            if (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].includes(currentScanPortalFilter)) {
                defaultDay = currentScanPortalFilter;
            } else {
                defaultDay = currentScanPortalDayName || 'Senin';
            }
        }
        await saveScanPortalRow({
            id_karyawan: row.id_karyawan,
            aktif: 1,
            hari_diizinkan: defaultDay,
            tanggal_khusus: row.tanggal_khusus || null,
            mode_kehadiran: row.mode_kehadiran || 'SCAN_FULL_HADIR',
            keterangan_default: row.keterangan_default
        });
    } else {
        renderScanPortalAccessTable();
    }
}

function renderSelectedScanPortalEmpCard(row) {
    const card = document.getElementById('selected-scan-portal-emp-card');
    if (!card) return;
    if (!row) {
        card.classList.add('hidden');
        return;
    }
    const isAktif = Number(row.aktif) === 1;
    const allowedToday = Boolean(row.allowed_today);
    const daysArr = String(row.hari_diizinkan || '').split(',').map(s => s.trim()).filter(Boolean);
    const isAllDays = daysArr.some(d => d.toLowerCase() === 'semua');

    const dayPills = HARI_PORTAL_SHORT.map(d => {
        const selected = isAktif && (isAllDays || daysArr.some(x => x.toLowerCase() === d.full.toLowerCase()));
        return `<button type="button" onclick="toggleDayScanPortal('${row.id_karyawan}', '${d.full}')"
            class="px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                selected ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-105' : 'bg-white text-slate-700 border-slate-300 hover:bg-emerald-50'
            }">
            <i class="fa-solid ${selected ? 'fa-calendar-check mr-1' : 'fa-calendar mr-1 text-slate-400'}"></i>${d.full}
        </button>`;
    }).join('');

    card.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-4 pb-3 mb-3 border-b border-emerald-200">
            <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-2xl ${isAktif ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'} flex items-center justify-center text-xl font-black shadow-md">
                    <i class="fa-solid ${isAktif ? 'fa-user-check' : 'fa-user'}"></i>
                </div>
                <div>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase">Data Pegawai Pilihan</span>
                        <h4 class="text-base font-black text-slate-900">${escapeHtml(row.nama)}</h4>
                        <span class="font-mono text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">ID: ${escapeHtml(row.id_karyawan)}</span>
                    </div>
                    <p class="text-xs text-slate-600 font-semibold mt-0.5">
                        Jabatan: <b>${escapeHtml(row.jabatan || 'Staff')}</b> • 
                        Username Portal: <b>${row.username_portal ? '@' + escapeHtml(row.username_portal) : 'Belum Daftar Akun Portal'}</b> • 
                        Biometrik: <b>${row.has_biometric ? 'Wajah Siap ✓' : 'Belum Rekam Wajah'}</b>
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button type="button" onclick="toggleEmployeeScanPortalByClick('${row.id_karyawan}')"
                    class="px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all ${
                        isAktif ? 'bg-emerald-600 hover:bg-rose-600 text-white' : 'bg-amber-500 hover:bg-emerald-600 text-slate-950 hover:text-white'
                    }">
                    <i class="fa-solid ${isAktif ? 'fa-circle-check mr-1' : 'fa-power-off mr-1'}"></i>
                    ${isAktif ? 'Status Scan.html: AKTIF (Klik untuk Matikan)' : 'Status Scan.html: NONAKTIF (Klik untuk Aktifkan)'}
                </button>
                <button type="button" onclick="clearScanPortalSearch()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">
                    <i class="fa-solid fa-xmark mr-1"></i>Tutup
                </button>
            </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div class="md:col-span-2">
                <p class="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                    <i class="fa-solid fa-calendar-week text-emerald-600 mr-1"></i>Pilih Hari Munculnya <code class="text-emerald-700">scan.html</code> di Akun Portal ${escapeHtml(row.nama)}:
                </p>
                <div class="flex flex-wrap items-center gap-1.5">
                    ${dayPills}
                    <button type="button" onclick="toggleDayScanPortal('${row.id_karyawan}', 'Semua')"
                        class="px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                            isAktif && isAllDays ? 'bg-amber-500 text-white border-amber-600 shadow-md' : 'bg-white text-slate-700 border-slate-300 hover:bg-amber-50'
                        }">
                        Semua Hari
                    </button>
                </div>
            </div>
            <div class="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm">
                <p class="text-[10px] font-extrabold text-slate-500 uppercase">Status di Portal Hari Ini (${escapeHtml(currentScanPortalDayName)}):</p>
                <div class="mt-1 font-black text-xs ${allowedToday ? 'text-emerald-700' : 'text-slate-600'}">
                    ${allowedToday ? '🟢 MUNCUL DI PORTAL HARI INI' : (isAktif ? `🔵 Terjadwal Hari: ${escapeHtml(row.hari_diizinkan)}` : '⚪ Disembunyikan')}
                </div>
                <div class="mt-2">
                    <select onchange="changeModeScanPortal('${row.id_karyawan}', this.value)"
                        class="w-full text-[11px] font-bold border border-slate-300 rounded-lg px-2 py-1.5 bg-slate-50 text-slate-800">
                        <option value="SCAN_FULL_HADIR" ${row.mode_kehadiran === 'SCAN_FULL_HADIR' ? 'selected' : ''}>✅ 1x Scan = Masuk Penuh</option>
                        <option value="AUTO_HADIR" ${row.mode_kehadiran === 'AUTO_HADIR' ? 'selected' : ''}>⚡ Otomatis Masuk Tanpa Scan</option>
                        <option value="SCAN_NORMAL" ${row.mode_kehadiran === 'SCAN_NORMAL' ? 'selected' : ''}>📷 Scan Normal 2x</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    card.classList.remove('hidden');
}

// Tutup dropdown pencarian saat klik di luar
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('scan-portal-search-wrapper');
    const dropdown = document.getElementById('scan-portal-search-dropdown');
    if (wrapper && dropdown && !wrapper.contains(e.target)) {
        dropdown.classList.add('hidden');
    }
});

function renderScanPortalAccessTable() {
    const tbody = document.getElementById('table-scan-portal-body');
    if (!tbody) return;

    const searchInput = document.getElementById('search-scan-portal');
    const rawTerm = (searchInput ? searchInput.value : '').trim().toLowerCase();
    const cleanTerm = normScanSearch(rawTerm);

    const filtered = globalScanPortalRows.filter(row => {
        // Jika user sedang mengetik nama di kotak pencarian, cari di SEMUA pegawai (abaikan filter tab supaya pasti ketemu!)
        if (rawTerm) {
            const hayRaw = `${row.nama || ''} ${row.id_karyawan || ''} ${row.jabatan || ''} ${row.username_portal || ''} ${row.hari_diizinkan || ''}`.toLowerCase();
            const hayClean = normScanSearch(hayRaw);
            return hayRaw.includes(rawTerm) || (cleanTerm && hayClean.includes(cleanTerm));
        }
        if (currentScanPortalFilter === 'TODAY') return Boolean(row.allowed_today);
        if (currentScanPortalFilter === 'ACTIVE') return Number(row.aktif) === 1;
        if (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].includes(currentScanPortalFilter)) {
            if (Number(row.aktif) !== 1) return false;
            const days = String(row.hari_diizinkan || '').split(',').map(s => s.trim().toLowerCase());
            return days.includes('semua') || days.includes(currentScanPortalFilter.toLowerCase());
        }
        return true;
    });

    // Tampilkan kartu detail pegawai jika ada 1 pegawai yang cocok atau sedang dipilih dari pencarian
    if (highlightedScanPortalEmpId) {
        const selRow = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(highlightedScanPortalEmpId).toLowerCase());
        renderSelectedScanPortalEmpCard(selRow || null);
    } else if (rawTerm && filtered.length === 1) {
        renderSelectedScanPortalEmpCard(filtered[0]);
    } else if (!rawTerm) {
        renderSelectedScanPortalEmpCard(null);
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 italic">Tidak ada pegawai yang cocok dengan filter ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map((row, idx) => {
        const isAktif = Number(row.aktif) === 1;
        const allowedToday = Boolean(row.allowed_today);
        const daysArr = String(row.hari_diizinkan || '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        const isAllDays = daysArr.some(d => d.toLowerCase() === 'semua');

        // Day pill buttons
        const dayButtonsHtml = HARI_PORTAL_SHORT.map(d => {
            const selected = isAktif && (isAllDays || daysArr.some(x => x.toLowerCase() === d.full.toLowerCase()));
            const isTodayDay = d.full.toLowerCase() === String(currentScanPortalDayName).toLowerCase();
            const btnCls = selected
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700';
            const todayRing = isTodayDay ? 'ring-2 ring-amber-400 ring-offset-1' : '';
            return `<button onclick="toggleDayScanPortal('${row.id_karyawan}', '${d.full}')" 
                        class="px-2 py-1 rounded-md text-[10px] font-extrabold border transition-all ${btnCls} ${todayRing}"
                        title="Jadwalkan hari ${d.full}${isTodayDay ? ' (HARI INI)' : ''} untuk ${escapeHtml(row.nama)}">
                        ${d.short}
                    </button>`;
        }).join('');

        const semuaSelected = isAktif && isAllDays;
        const semuaBtnHtml = `
            <button onclick="toggleDayScanPortal('${row.id_karyawan}', 'Semua')"
                class="px-2 py-1 rounded-md text-[10px] font-extrabold border transition-all ${semuaSelected ? 'bg-amber-500 text-white border-amber-600 shadow-sm' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-amber-50 hover:text-amber-700'}"
                title="Munculkan scan.html Setiap Hari untuk ${escapeHtml(row.nama)}">
                Semua
            </button>
        `;

        // Status Portal Hari Ini
        let statusPortalBadge = '';
        if (allowedToday) {
            statusPortalBadge = `
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold text-[10px] shadow-sm">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    MUNCUL HARI INI
                </div>
            `;
        } else if (isAktif) {
            statusPortalBadge = `
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px]">
                    <i class="fa-solid fa-clock"></i> Terjadwal (${escapeHtml(row.hari_diizinkan || row.tanggal_khusus || '-')})
                </div>
            `;
        } else {
            statusPortalBadge = `
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200 font-bold text-[10px]">
                    <i class="fa-solid fa-eye-slash"></i> Disembunyikan
                </div>
            `;
        }

        // Info Absensi Hari Ini
        let absenInfoHtml = '';
        if (row.absen_hari_ini_masuk) {
            const jm = String(row.absen_hari_ini_masuk).substring(0, 5);
            const jk = row.absen_hari_ini_keluar ? String(row.absen_hari_ini_keluar).substring(0, 5) : 'Belum Pulang';
            absenInfoHtml = `<div class="mt-1 text-[10px] font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block"><i class="fa-solid fa-check-double mr-1"></i>Hadir: ${jm} - ${jk}</div>`;
        } else if (allowedToday) {
            absenInfoHtml = `<div class="mt-1 text-[10px] font-semibold text-amber-700">Menunggu pegawai scan di Portal</div>`;
        }

        const akunBadge = row.username_portal
            ? `<span class="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[10px]"><i class="fa-solid fa-at mr-0.5"></i>${escapeHtml(row.username_portal)}</span>`
            : `<span class="px-2 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 font-bold text-[10px]">Belum Daftar Akun</span>`;

        const bioBadge = row.has_biometric
            ? `<span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]"><i class="fa-solid fa-fingerprint mr-0.5"></i>Wajah Siap</span>`
            : `<span class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px]">Belum Rekam Wajah</span>`;

        const rowBg = allowedToday
            ? 'bg-emerald-50/40 hover:bg-emerald-50/80'
            : (isAktif ? 'bg-blue-50/20 hover:bg-blue-50/40' : 'hover:bg-slate-50');

        return `
            <tr id="scan-portal-row-${row.id_karyawan}" class="transition-all ${rowBg}">
                <td class="px-3 py-3 text-center font-mono font-bold text-slate-400">${idx + 1}</td>
                <td class="px-4 py-3">
                    <button onclick="toggleEmployeeScanPortalByClick('${row.id_karyawan}')"
                        class="w-full text-left group flex items-center gap-3 p-2 rounded-xl border transition-all ${
                            isAktif
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-500 shadow-md'
                                : 'bg-white hover:bg-emerald-50 text-slate-800 border-slate-200 hover:border-emerald-400 shadow-sm'
                        }"
                        title="Klik nama ${escapeHtml(row.nama)} untuk ${isAktif ? 'MENONAKTIFKAN' : 'MENGAKTIFKAN'} munculnya scan.html di Portal Online">
                        <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isAktif ? 'bg-white/20 text-amber-300' : 'bg-slate-100 group-hover:bg-emerald-100 text-slate-400 group-hover:text-emerald-600'
                        }">
                            <i class="fa-solid ${isAktif ? 'fa-circle-check text-lg' : 'fa-hand-pointer text-sm'}"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="font-extrabold text-xs truncate flex items-center gap-1.5">
                                <span>${escapeHtml(row.nama)}</span>
                                <span class="text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                    isAktif ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-600 group-hover:text-white'
                                }">${isAktif ? 'AKTIF DIKLIK' : 'KLIK NAMA'}</span>
                            </div>
                            <div class="text-[10px] truncate mt-0.5 ${isAktif ? 'text-emerald-100' : 'text-slate-500'}">
                                <span class="font-mono font-bold">${escapeHtml(row.id_karyawan)}</span> • ${escapeHtml(row.jabatan || 'Staff')}
                            </div>
                        </div>
                    </button>
                </td>
                <td class="px-3 py-3">
                    <div class="flex flex-col gap-1 items-start">
                        ${akunBadge}
                        ${bioBadge}
                    </div>
                </td>
                <td class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-1">
                        ${dayButtonsHtml}
                        ${semuaBtnHtml}
                    </div>
                    <div class="mt-1.5 flex items-center gap-2">
                        <span class="text-[10px] text-slate-400 font-semibold"><i class="fa-regular fa-calendar mr-1"></i>Tgl Khusus:</span>
                        <input type="date" value="${row.tanggal_khusus || ''}"
                            onchange="changeDateKhususScanPortal('${row.id_karyawan}', this.value)"
                            class="text-[10px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:border-emerald-500 focus:outline-none">
                        ${row.tanggal_khusus ? `<button onclick="changeDateKhususScanPortal('${row.id_karyawan}', '')" class="text-[10px] text-rose-500 hover:underline font-bold">Reset</button>` : ''}
                    </div>
                </td>
                <td class="px-3 py-3">
                    <select onchange="changeModeScanPortal('${row.id_karyawan}', this.value)"
                        class="w-full text-[11px] font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:border-emerald-500 focus:outline-none shadow-sm">
                        <option value="SCAN_FULL_HADIR" ${row.mode_kehadiran === 'SCAN_FULL_HADIR' ? 'selected' : ''}>✅ 1x Scan di Portal = Dianggap Masuk Penuh (Masuk+Pulang)</option>
                        <option value="AUTO_HADIR" ${row.mode_kehadiran === 'AUTO_HADIR' ? 'selected' : ''}>⚡ Otomatis Masuk Penuh Tanpa Scan di Hari Terjadwal</option>
                        <option value="SCAN_NORMAL" ${row.mode_kehadiran === 'SCAN_NORMAL' ? 'selected' : ''}>📷 Scan Normal 2x (Masuk & Pulang via Portal)</option>
                    </select>
                    <p class="text-[10px] text-slate-400 mt-1 truncate">Tanpa input manual Admin • Bebas Telat/PSW</p>
                </td>
                <td class="px-3 py-3 text-center">
                    ${statusPortalBadge}
                    <br>
                    ${absenInfoHtml}
                </td>
                <td class="px-3 py-3 text-center">
                    <div class="flex flex-col gap-1.5 items-center justify-center">
                        <button onclick="quickActivateTodayScanPortal('${row.id_karyawan}')"
                            class="w-full px-2.5 py-1 rounded-lg text-[10px] font-extrabold border transition-all ${
                                allowedToday
                                    ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-600 hover:text-white'
                            }"
                            title="Jadwalkan muncul hari ini (${currentScanPortalDayName})">
                            <i class="fa-solid fa-bolt mr-1"></i>${allowedToday ? `Aktif Hari ${currentScanPortalDayName}` : `Set Hari Ini (${currentScanPortalDayName})`}
                        </button>
                        ${isAktif ? `
                        <button onclick="disableSingleScanPortal('${row.id_karyawan}')"
                            class="w-full px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 transition-all">
                            <i class="fa-solid fa-power-off mr-1"></i>Matikan Akses
                        </button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function saveScanPortalRow(payload) {
    try {
        const res = await fetch(`${API_BASE}/akses-scan-portal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Gagal menyimpan akses scan portal');
        if (typeof showToast === 'function') {
            showToast(json.message || 'Jadwal scan.html Portal diperbarui', 'success');
        }
        await loadScanPortalAccessTable(true);
    } catch (e) {
        alert('Gagal menyimpan jadwal Scan Portal: ' + e.message);
    }
}

async function toggleEmployeeScanPortalByClick(idKaryawan) {
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;
    const willBeActive = Number(row.aktif) === 1 ? 0 : 1;
    let nextHari = String(row.hari_diizinkan || '').trim();
    // Jika baru diaktifkan dengan klik nama dan belum ada hari yang dipilih, otomatis set ke hari yang sedang difilter atau hari ini!
    if (willBeActive === 1 && !nextHari && !row.tanggal_khusus) {
        if (['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].includes(currentScanPortalFilter)) {
            nextHari = currentScanPortalFilter;
        } else {
            nextHari = currentScanPortalDayName || 'Senin';
        }
    }
    await saveScanPortalRow({
        id_karyawan: row.id_karyawan,
        aktif: willBeActive,
        hari_diizinkan: nextHari,
        tanggal_khusus: row.tanggal_khusus || null,
        mode_kehadiran: row.mode_kehadiran || 'SCAN_FULL_HADIR',
        keterangan_default: row.keterangan_default
    });
}

async function toggleDayScanPortal(idKaryawan, dayTarget) {
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;

    let currentDays = String(row.hari_diizinkan || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    if (dayTarget === 'Semua') {
        if (currentDays.some(d => d.toLowerCase() === 'semua') && Number(row.aktif) === 1) {
            currentDays = [];
        } else {
            currentDays = ['Semua'];
        }
    } else {
        currentDays = currentDays.filter(d => d.toLowerCase() !== 'semua');
        const exists = currentDays.some(d => d.toLowerCase() === dayTarget.toLowerCase());
        if (exists && Number(row.aktif) === 1) {
            currentDays = currentDays.filter(d => d.toLowerCase() !== dayTarget.toLowerCase());
        } else {
            currentDays.push(dayTarget);
        }
    }

    const nextHari = currentDays.join(', ');
    const nextAktif = (nextHari.length > 0 || row.tanggal_khusus) ? 1 : 0;

    await saveScanPortalRow({
        id_karyawan: row.id_karyawan,
        aktif: nextAktif,
        hari_diizinkan: nextHari,
        tanggal_khusus: row.tanggal_khusus || null,
        mode_kehadiran: row.mode_kehadiran || 'SCAN_FULL_HADIR',
        keterangan_default: row.keterangan_default
    });
}

async function quickActivateTodayScanPortal(idKaryawan) {
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;
    const todayDay = currentScanPortalDayName || 'Senin';
    let currentDays = String(row.hari_diizinkan || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
    if (!currentDays.some(d => d.toLowerCase() === todayDay.toLowerCase() || d.toLowerCase() === 'semua')) {
        currentDays.push(todayDay);
    }
    await saveScanPortalRow({
        id_karyawan: row.id_karyawan,
        aktif: 1,
        hari_diizinkan: currentDays.join(', '),
        tanggal_khusus: row.tanggal_khusus || null,
        mode_kehadiran: row.mode_kehadiran || 'SCAN_FULL_HADIR',
        keterangan_default: row.keterangan_default
    });
}

async function disableSingleScanPortal(idKaryawan) {
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;
    await saveScanPortalRow({
        id_karyawan: row.id_karyawan,
        aktif: 0,
        hari_diizinkan: row.hari_diizinkan || '',
        tanggal_khusus: row.tanggal_khusus || null,
        mode_kehadiran: row.mode_kehadiran || 'SCAN_FULL_HADIR',
        keterangan_default: row.keterangan_default
    });
}

async function changeDateKhususScanPortal(idKaryawan, dateVal) {
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;
    const nextAktif = (dateVal || row.hari_diizinkan) ? 1 : Number(row.aktif);
    await saveScanPortalRow({
        id_karyawan: row.id_karyawan,
        aktif: nextAktif,
        hari_diizinkan: row.hari_diizinkan || '',
        tanggal_khusus: dateVal || null,
        mode_kehadiran: row.mode_kehadiran || 'SCAN_FULL_HADIR',
        keterangan_default: row.keterangan_default
    });
}

async function changeModeScanPortal(idKaryawan, modeVal) {
    const row = globalScanPortalRows.find(r => String(r.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
    if (!row) return;
    await saveScanPortalRow({
        id_karyawan: row.id_karyawan,
        aktif: row.aktif,
        hari_diizinkan: row.hari_diizinkan || '',
        tanggal_khusus: row.tanggal_khusus || null,
        mode_kehadiran: modeVal,
        keterangan_default: row.keterangan_default
    });
}

async function disableAllScanPortalAccess() {
    const activeRows = globalScanPortalRows.filter(r => Number(r.aktif) === 1);
    if (activeRows.length === 0) return;
    if (!confirm(`Nonaktifkan fitur scan.html Portal Online untuk ${activeRows.length} pegawai terjadwal?`)) return;
    for (const r of activeRows) {
        await fetch(`${API_BASE}/akses-scan-portal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_karyawan: r.id_karyawan,
                aktif: 0,
                hari_diizinkan: r.hari_diizinkan || '',
                tanggal_khusus: r.tanggal_khusus || null,
                mode_kehadiran: r.mode_kehadiran || 'SCAN_FULL_HADIR',
                keterangan_default: r.keterangan_default
            })
        });
    }
    await loadScanPortalAccessTable(true);
}


