const API_BASE = '/api';

// Cek Sesi Login
window.onload = () => {
    // Inisialisasi Dark Mode
    if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }

    // Clock & Greeting Engine
    setInterval(() => {
        const now = new Date();
        const clockEl = document.getElementById('realtime-clock');
        const greetEl = document.getElementById('greeting-text');
        
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
        }
        
        if (greetEl) {
            const hour = now.getHours();
            let greet = 'Selamat Malam 🌙';
            if (hour >= 5 && hour < 11) greet = 'Selamat Pagi 🌅';
            else if (hour >= 11 && hour < 15) greet = 'Selamat Siang ☀️';
            else if (hour >= 15 && hour < 18) greet = 'Selamat Sore 🌇';
            greetEl.textContent = greet + ',';
        }
    }, 1000);

    const session = localStorage.getItem('pegawai_session');
    
    // Hilangkan loader
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if(loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
        
        if (session) {
            showDashboard(JSON.parse(session));
        } else {
            // Cek apakah ada request ganti password yang pending di localStorage
            const pendingReqId = localStorage.getItem('pending_reset_id');
            
            if (pendingReqId) {
                // Verifikasi ke server
                fetch(`${API_BASE}/pegawai/lupa-password/status/${pendingReqId}`)
                    .then(r => r.json())
                    .then(data => {
                        if (data.success && data.hasPending) {
                            showLockScreen();
                        } else {
                            localStorage.removeItem('pending_reset_id');
                            showAuthPage();
                        }
                    })
                    .catch(() => showLockScreen()); // Jika error koneksi, tetap kunci
            } else {
                showAuthPage();
            }
        }
    }, 500);
}

function showAuthPage() {
    const authPage = document.getElementById('auth-page');
    if (authPage) {
        authPage.classList.remove('hidden');
        setTimeout(() => authPage.style.opacity = '1', 50);
    }
}

function showLockScreen() {
    document.getElementById('auth-page').classList.remove('hidden');
    document.getElementById('auth-page').style.opacity = '1';
    
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    document.getElementById('lock-screen').classList.remove('hidden');
}

function toggleAuth(type) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');
    
    if (type === 'register') {
        document.getElementById('register-form').classList.remove('hidden');
    } else if (type === 'forgot-password') {
        document.getElementById('forgot-password-form').classList.remove('hidden');
    } else {
        document.getElementById('login-form').classList.remove('hidden');
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    
    if(!username || !password) return alert('Isi username dan password');
    
    try {
        const res = await fetch(`${API_BASE}/pegawai/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        const data = await res.json();
        
        if(data.success) {
            localStorage.setItem('pegawai_session', JSON.stringify(data.data));
            showDashboard(data.data);
        } else {
            alert(data.message);
        }
    } catch (e) {
        alert("Gagal koneksi ke server");
    }
}

async function register() {
    const id_karyawan = document.getElementById('reg-id').value.toUpperCase();
    const nama = document.getElementById('reg-nama').value.toUpperCase();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    
    if(!id_karyawan || !nama || !username || !password) return alert('Lengkapi semua data');
    
    try {
        const res = await fetch(`${API_BASE}/pegawai/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id_karyawan, nama, username, password})
        });
        const data = await res.json();
        alert(data.message);
        if(data.success) toggleAuth('login');
    } catch (e) {
        alert("Gagal koneksi ke server");
    }
}

async function ajukanLupaPassword() {
    const id_karyawan = document.getElementById('fp-id').value.toUpperCase();
    const password_baru = document.getElementById('fp-password').value;
    
    if (!id_karyawan || !password_baru) return alert('Isi ID Karyawan dan Password Baru');
    
    try {
        const res = await fetch(`${API_BASE}/pegawai/lupa-password`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id_karyawan, password_baru})
        });
        const data = await res.json();
        
        alert(data.message);
        if (data.success) {
            localStorage.setItem('pending_reset_id', id_karyawan);
            showLockScreen();
        }
    } catch (e) {
        alert("Gagal menghubungi server");
    }
}

async function checkStatusPassword() {
    const pendingReqId = localStorage.getItem('pending_reset_id');
    if (!pendingReqId) return window.location.reload();
    
    try {
        const res = await fetch(`${API_BASE}/pegawai/lupa-password/status/${pendingReqId}`);
        const data = await res.json();
        
        if (data.success && data.hasPending) {
            alert('Permintaan Anda masih sedang diproses oleh Admin. Harap tunggu.');
        } else {
            alert('Status berubah! Silakan coba login.');
            localStorage.removeItem('pending_reset_id');
            window.location.reload();
        }
    } catch (e) {
        alert('Gagal mengecek status');
    }
}

function logout() {
    localStorage.removeItem('pegawai_session');
    window.location.reload();
}

async function handleLogoutFromAll() {
    if(confirm('Anda yakin ingin logout dari semua perangkat?')) {
        await logout();
    }
}

// ========================
// UI PREFERENCES
// ========================
function toggleDarkMode() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    if(isDark) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    }
}

async function hapusAkun() {
    const session = localStorage.getItem('pegawai_session');
    if (!session) return;
    
    const user = JSON.parse(session);
    
    const confirmDelete = confirm("⚠️ PERHATIAN ⚠️\n\nApakah Anda yakin ingin MENGHAPUS Akun Portal ini?\nData absensi/wajah Anda TIDAK AKAN HILANG, namun Anda (atau pemilik ID sebenarnya) harus Mendaftar Ulang akun baru untuk bisa login ke Portal ini lagi.");
    
    if (!confirmDelete) return;
    
    try {
        const res = await fetch(`${API_BASE}/pegawai/akun/${user.id_karyawan}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        alert(data.message);
        
        if (data.success) {
            localStorage.removeItem('pegawai_session');
            window.location.reload();
        }
    } catch (e) {
        alert("Gagal koneksi ke server");
    }
}

async function showDashboard(user) {
    const authPage = document.getElementById('auth-page');
    const dashPage = document.getElementById('dashboard-page');
    const bottomNav = document.getElementById('bottom-nav');
    
    authPage.style.opacity = '0';
    setTimeout(() => {
        authPage.classList.add('hidden');
        dashPage.classList.remove('hidden');
        
        // Show Bottom Nav
        if(bottomNav) bottomNav.classList.remove('hidden');
        
        setTimeout(() => {
            dashPage.style.opacity = '1';
            if(bottomNav) {
                bottomNav.classList.remove('opacity-0', 'translate-y-full');
            }
        }, 50);
    }, 500);
    
    document.getElementById('user-nama').textContent = user.nama;
    document.getElementById('user-jabatan').textContent = user.jabatan || 'Pegawai';
    document.getElementById('user-id').textContent = user.id_karyawan;

    // Set Date Today
    const today = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('today-date').textContent = today.toLocaleDateString('id-ID', options);

    // Load User Photo & Sync Profile Info
    try {
        const resFoto = await fetch(`${API_BASE}/karyawan/${user.id_karyawan}?_t=${Date.now()}`);
        const photoData = await resFoto.json();
        if (photoData.success && photoData.data) {
            if (photoData.data.foto) {
                document.getElementById('user-foto').src = 'data:image/jpeg;base64,' + photoData.data.foto;
                document.getElementById('user-foto').classList.remove('hidden');
                document.getElementById('user-foto-icon').classList.add('hidden');
            }
            
            // Sync session data with server
            let sessionUpdated = false;
            if (photoData.data.nama && photoData.data.nama !== user.nama) {
                user.nama = photoData.data.nama;
                document.getElementById('user-nama').textContent = user.nama;
                sessionUpdated = true;
            }
            if (photoData.data.jabatan && photoData.data.jabatan !== user.jabatan) {
                user.jabatan = photoData.data.jabatan;
                document.getElementById('user-jabatan').textContent = user.jabatan;
                sessionUpdated = true;
            }
            if (sessionUpdated) {
                localStorage.setItem('pegawai_session', JSON.stringify(user));
            }
        }
    } catch (e) {
        console.error("Gagal memuat profil dari server", e);
    }
    
    loadDashboardData(user.id_karyawan);
}

// ========================
// TAB NAVIGATION LOGIC
// ========================
let isRiwayatLoaded = false;

function switchTab(tabName) {
    const dashPage = document.getElementById('dashboard-page');
    const riwayatPage = document.getElementById('riwayat-page');
    const profilPage = document.getElementById('profil-page');
    
    const navBeranda = document.getElementById('nav-beranda');
    const navRiwayat = document.getElementById('nav-riwayat');
    const navProfil = document.getElementById('nav-profil');
    
    // Define classes for modern floating dock navigation (with Ripple & Spring)
    const inactiveClass = "ripple spring-bounce flex flex-col items-center justify-center gap-1 p-2 text-slate-400 hover:text-teal-600 hover:bg-slate-50 w-[70px] h-14 rounded-2xl transition-all";
    const activeClass = "ripple spring-bounce flex flex-col items-center justify-center gap-1 p-2 text-teal-600 bg-teal-50 w-[70px] h-14 rounded-2xl transition-all shadow-inner";
    
    // Special CTA classes for Profil
    const profilInactiveClass = "ripple spring-bounce flex flex-col items-center justify-center gap-0.5 p-2 text-white bg-gradient-to-tr from-teal-500 to-emerald-400 shadow-[0_4px_15px_rgba(20,184,166,0.4)] w-[75px] h-[60px] rounded-2xl hover:-translate-y-1 transition-all";
    const profilActiveClass = "ripple spring-bounce flex flex-col items-center justify-center gap-0.5 p-2 text-white bg-gradient-to-tr from-teal-600 to-emerald-500 shadow-inner w-[75px] h-[60px] rounded-2xl ring-4 ring-teal-500/30 transition-all scale-105";

    // Reset Nav States
    navBeranda.className = inactiveClass;
    navRiwayat.className = inactiveClass;
    if(navProfil) navProfil.className = profilInactiveClass;
    
    // Setup slide directions based on tab order (Beranda 0, Riwayat 1, Profil 2)
    const tabs = ['beranda', 'riwayat', 'profil'];
    const currentTabId = !dashPage.classList.contains('hidden') ? 0 : (!riwayatPage.classList.contains('hidden') ? 1 : 2);
    const newTabId = tabs.indexOf(tabName);
    const isForward = newTabId > currentTabId;

    if (tabName === 'beranda') {
        // Set Active Nav
        navBeranda.className = activeClass;
        
        // Animasi Keluar
        riwayatPage.classList.remove('slide-in-center');
        riwayatPage.classList.add('slide-out-right');
        if(profilPage) {
            profilPage.classList.remove('slide-in-center');
            profilPage.classList.add('slide-out-right');
        }
        
        setTimeout(() => {
            riwayatPage.classList.add('hidden');
            if(profilPage) profilPage.classList.add('hidden');
            dashPage.classList.remove('hidden');
            dashPage.classList.remove('slide-out-left', 'slide-out-right');
            // Sedikit delay agar browser render display:block sebelum animasi transform masuk
            setTimeout(() => {
                dashPage.classList.add('slide-in-center');
                // Reload dashboard data every time user goes back to beranda
                const session = localStorage.getItem('pegawai_session');
                if (session) {
                    const user = JSON.parse(session);
                    loadDashboardData(user.id_karyawan);
                }
            }, 20);
        }, 350);
        
    } else if (tabName === 'riwayat') {
        // Set Active Nav
        navRiwayat.className = activeClass;
        
        // Animasi Keluar
        if (currentTabId === 0) { // Dari Beranda -> Riwayat (Maju)
            dashPage.classList.remove('slide-in-center');
            dashPage.classList.add('slide-out-left');
        } else { // Dari Profil -> Riwayat (Mundur)
            if(profilPage) {
                profilPage.classList.remove('slide-in-center');
                profilPage.classList.add('slide-out-right');
            }
        }
        
        setTimeout(() => {
            dashPage.classList.add('hidden');
            if(profilPage) profilPage.classList.add('hidden');
            riwayatPage.classList.remove('hidden');
            riwayatPage.classList.remove('slide-out-left', 'slide-out-right');
            
            setTimeout(() => {
                riwayatPage.classList.add('slide-in-center');
                
                // Lazy load riwayat data
                if (!isRiwayatLoaded) {
                    const session = localStorage.getItem('pegawai_session');
                    if (session) {
                        const user = JSON.parse(session);
                        loadRiwayatBulanan(user.id_karyawan);
                    }
                }
            }, 20);
        }, 350);
    } else if (tabName === 'profil') {
        // Set Active Nav
        if(navProfil) navProfil.className = profilActiveClass;
        
        // Animasi Keluar
        dashPage.classList.remove('slide-in-center');
        dashPage.classList.add('slide-out-left');
        riwayatPage.classList.remove('slide-in-center');
        riwayatPage.classList.add('slide-out-left');
        
        setTimeout(() => {
            dashPage.classList.add('hidden');
            riwayatPage.classList.add('hidden');
            if(profilPage) {
                profilPage.classList.remove('hidden');
                profilPage.classList.remove('slide-out-left', 'slide-out-right');
                setTimeout(() => {
                    profilPage.classList.add('slide-in-center');
                    // Populate data if needed
                    const session = localStorage.getItem('pegawai_session');
                    if(session) {
                        const user = JSON.parse(session);
                        document.getElementById('profil-nama').textContent = user.nama;
                        document.getElementById('profil-jabatan').textContent = user.jabatan || 'Pegawai';
                        document.getElementById('profil-id').textContent = user.id_karyawan;
                        
                        // Ensure Gamification stats are loaded
                        if (typeof isRiwayatLoaded !== 'undefined' && !isRiwayatLoaded) {
                            loadRiwayatBulanan(user.id_karyawan);
                        }
                        
                        // Load image to profil
                        const imgNode = document.getElementById('user-foto');
                        if(imgNode && !imgNode.classList.contains('hidden')) {
                            document.getElementById('profil-foto').src = imgNode.src;
                            document.getElementById('profil-foto').classList.remove('hidden');
                            document.getElementById('profil-foto-icon').classList.add('hidden');
                        }
                    }
                }, 50);
            }
        }, 300);
    }
}

async function loadRiwayatBulanan(idKaryawan) {
    const container = document.getElementById('riwayat-container');
    try {
        const res = await fetch(`${API_BASE}/riwayat/rekap/${idKaryawan}?_t=${Date.now()}`);
        const result = await res.json();
        
        if (!result.success || !result.data || result.data.length === 0) {
            container.innerHTML = `
                <div class="glass-card rounded-[2rem] p-8 premium-shadow text-center">
                    <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <i class="fa-solid fa-folder-open text-2xl"></i>
                    </div>
                    <h3 class="text-slate-800 font-bold mb-1">Belum Ada Riwayat</h3>
                    <p class="text-xs text-slate-500">Anda belum memiliki riwayat absensi bulanan.</p>
                </div>`;
            return;
        }
        
        // Format bulan
        const formatBulan = (periode) => {
            if(!periode) return "Tidak Diketahui";
            const [y, m] = periode.split('-');
            const date = new Date(y, m - 1);
            return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        };
        
        let html = '';
        result.data.forEach(item => {
            html += `
            <div class="riwayat-card">
                <!-- Card Header -->
                <div style="background:linear-gradient(135deg,rgba(13,148,136,0.12),rgba(6,182,212,0.06));border-bottom:1px solid rgba(255,255,255,0.05);" class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-[13px] flex items-center justify-center flex-shrink-0"
                             style="background:linear-gradient(135deg,#0d9488,#0891b2);box-shadow:0 0 16px rgba(13,148,136,0.35);">
                            <i class="fa-solid fa-calendar-check text-white"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-white/90 text-sm uppercase tracking-widest">${formatBulan(item.periode)}</h4>
                            <p style="color:rgba(45,212,191,0.6);" class="text-[10px] font-bold tracking-wider">${item.total_hari_kerja || 0} Hari &nbsp;·&nbsp; ${item.total_jam_kerja || '00:00:00'} Jam Kerja</p>
                        </div>
                    </div>
                </div>
                
                <!-- Stats Grid -->
                <div class="p-4 grid grid-cols-4 gap-2 text-center">
                    <div class="rounded-xl p-2.5" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(52,211,153,0.5);">Hadir</p>
                        <p class="text-sm font-black text-emerald-400">${item.total_masuk}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(244,63,94,0.08);border:1px solid rgba(244,63,94,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(253,164,175,0.5);">Alpa</p>
                        <p class="text-sm font-black text-rose-400">${item.alpa}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(147,197,253,0.5);">I/S/C/DL</p>
                        <p class="text-sm font-black text-blue-400">${Number(item.total_izin||0) + Number(item.total_sakit||0) + Number(item.total_cuti||0) + Number(item.total_dl||0)}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(252,165,165,0.5);">T.Plg</p>
                        <p class="text-sm font-black text-red-400">${item.tanpa_absen_pulang || 0}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(252,211,77,0.5);">Telat X</p>
                        <p class="text-sm font-black text-amber-400">${item.telat_kali || 0}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(253,186,116,0.5);">Telat M</p>
                        <p class="text-sm font-black text-orange-400">${item.telat_menit || 0}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(139,92,246,0.08);border:1px solid rgba(139,92,246,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(196,181,253,0.5);">PSW X</p>
                        <p class="text-sm font-black text-violet-400">${item.psw_kali || 0}</p>
                    </div>
                    <div class="rounded-xl p-2.5" style="background:rgba(217,70,239,0.08);border:1px solid rgba(217,70,239,0.15);">
                        <p class="text-[8px] font-bold uppercase tracking-wider mb-1" style="color:rgba(240,171,252,0.5);">PSW M</p>
                        <p class="text-sm font-black text-fuchsia-400">${item.psw_menit || 0}</p>
                    </div>
                    <!-- Total Jam Kerja Full Width -->
                    <div class="col-span-4 flex items-center justify-between p-3 rounded-[14px] overflow-hidden relative mt-1"
                         style="background:linear-gradient(135deg,#042f2e,#0f766e,#0d9488);box-shadow:0 0 20px rgba(13,148,136,0.25);border:1px solid rgba(13,148,136,0.25);">
                        <div class="flex items-center gap-2 relative z-10">
                            <div class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.15);">
                                <i class="fa-solid fa-business-time text-white text-xs"></i>
                            </div>
                        </div>
                        <p class="text-sm font-black text-white tracking-wide">${item.total_jam_kerja || '00:00:00'}</p>
                    </div>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        isRiwayatLoaded = true;
        
        // Render Chart.js
        renderRiwayatChart(result.data);
        
        const chartCard = document.getElementById('riwayat-chart-card');
        if(chartCard) {
            chartCard.classList.remove('hidden');
            setTimeout(() => chartCard.classList.remove('opacity-0'), 50);
        }
        
    } catch(e) {
        container.innerHTML = `<div class="text-center text-rose-500 text-sm p-5 font-bold"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Gagal memuat data riwayat.</div>`;
    }
}

// Global variable untuk menyimpan instance chart agar bisa di-destroy (update)
let riwayatChartInstance = null;

function renderRiwayatChart(data) {
    let totalHadir = 0;
    let totalAlpa = 0;
    let totalIzinDll = 0;
    let totalTelat = 0;
    let totalPSW = 0;
    let totalTAP = 0;
    let totalTelatMenit = 0;
    let totalPSWMenit = 0;
    
    // AMBIL HANYA DATA BULAN INI (Sesuai Permintaan User)
    const now = new Date();
    const currentPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentData = data.find(item => item.periode === currentPeriode);

    if (currentData) {
        totalHadir = Number(currentData.total_masuk || 0);
        totalAlpa = Number(currentData.alpa || 0);
        totalIzinDll = Number(currentData.total_izin || 0) + Number(currentData.total_sakit || 0) + Number(currentData.total_cuti || 0) + Number(currentData.total_dl || 0);
        totalTelat = Number(currentData.telat_kali || 0);
        totalPSW = Number(currentData.psw_kali || 0);
        totalTAP = Number(currentData.tanpa_absen_pulang || 0);

        let pelanggaran_menit_db = Number(currentData.total_pelanggaran_menit || 0);
        let potongan_menit = Number(currentData.potongan_jam || 0) * 60;
        let menit_biasa = Number(currentData.telat_menit || 0) + Number(currentData.psw_menit || 0);
        
        let menit_total = pelanggaran_menit_db > 0 ? pelanggaran_menit_db : menit_biasa;
        menit_total += potongan_menit;
        totalTelatMenit = menit_total;
    } else {
        totalHadir = 0; totalAlpa = 0; totalIzinDll = 0; totalTelat = 0; totalPSW = 0; totalTAP = 0; totalTelatMenit = 0;
    }
    
    // GAMIFIKASI: Hitung XP Hanya Bulan Ini
    // Dasar poin kehadiran (+10 XP per kehadiran, +2 per Izin/Sakit)
    let baseXP = (totalHadir * 10) + (totalIzinDll * 2);
    
    // Hukuman (Penalti) DIPERADIL
    let penalty = (totalAlpa * 20) + 
                  (totalTAP * 10) + 
                  Math.floor(totalTelatMenit / 2);
    
    let totalXP = baseXP - penalty;
    
    // Tampilkan rata-rata XP di layar
    if(totalXP < 0) totalXP = 0;
    let userXP = totalXP;
    
    // Pesan Dinamis berdasarkan Metrik Kedisiplinan BULAN INI
    const avgAlpa = totalAlpa;
    const avgTAP = totalTAP;
    const avgTelat = totalTelat;
    const avgPSW = totalPSW;
    
    let maxCount = 0;
    let dominant = "";
    
    // Check in order of severity in case of ties
    if (avgAlpa > maxCount) { maxCount = avgAlpa; dominant = "alpa"; }
    if (avgTAP > maxCount) { maxCount = avgTAP; dominant = "tap"; }
    if (avgTelat > maxCount) { maxCount = avgTelat; dominant = "telat"; }
    if (avgPSW > maxCount) { maxCount = avgPSW; dominant = "psw"; }
    
    let advice = "";
    if (maxCount > 0) {
        if (dominant === "alpa") {
            advice = `Pelanggaran terbanyak Anda adalah ketidakhadiran (Alpa) sebanyak ${avgAlpa} kali. Mohon perbaiki dan utamakan kehadiran Anda!`;
        } else if (dominant === "tap") {
            advice = `Pelanggaran terbanyak Anda adalah lupa Absen Pulang (TAP) sebanyak ${avgTAP} kali. Pastikan Anda selalu menekan tombol pulang!`;
        } else if (dominant === "telat") {
            advice = `Pelanggaran terbanyak Anda adalah datang Terlambat sebanyak ${avgTelat} kali. Mohon perbaiki jam kedatangan Anda!`;
        } else if (dominant === "psw") {
            advice = `Pelanggaran terbanyak Anda adalah Pulang Sebelum Waktunya (PSW) sebanyak ${avgPSW} kali. Harap perbaiki kedisiplinan jam pulang Anda!`;
        }
    } else {
        advice = "Tingkatkan terus kedisiplinan Anda dan hindari pelanggaran sekecil apapun.";
    }

    let rankInfo = {};
    if(userXP > 180) { 
        rankInfo = { 
            title: 'Legend Teladan 👑', color: 'bg-gradient-to-r from-teal-100 to-emerald-200 text-teal-900 ring-2 ring-emerald-300 shadow-[0_0_12px_rgba(20,184,166,0.6)]', 
            notes: 'Luar Biasa! Rekam jejak kedisiplinan Anda nyaris tanpa cela. Pertahankan prestasimu sebagai teladan bagi pegawai yang lain.',
            headerBg: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)' // Dark Emerald
        };
    } else if(userXP > 130) {
        rankInfo = { 
            title: 'Bintang Puskesmas ⭐', color: 'bg-gradient-to-r from-teal-50 to-teal-100 text-teal-900 ring-1 ring-teal-200 shadow-sm', 
            notes: 'Kerja bagus! Sedikit lagi menuju predikat Legend. ' + advice,
            headerBg: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)' // Teal
        };
    } else if(userXP > 80) {
        rankInfo = { 
            title: 'Pegawai Andalan 🚀', color: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200 shadow-sm', 
            notes: 'Kedisiplinan rata-rata Anda cukup baik. ' + advice,
            headerBg: 'linear-gradient(135deg, #334155 0%, #475569 100%)' // Slate
        };
    } else if(userXP >= 10) {
        rankInfo = { 
            title: 'Pegawai Aktif 🎖️', color: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 shadow-sm', 
            notes: 'Kedisiplinan Anda di batas wajar. ' + advice,
            headerBg: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)' // Blue
        };
    } else {
        rankInfo = { 
            title: 'Perlu Pembinaan ⚠️', color: 'bg-rose-50 text-rose-700 ring-1 ring-rose-300 shadow-md animate-pulse', 
            notes: 'Peringatan Keras: Peringkat kedisiplinan Anda di bawah standar. ' + advice,
            headerBg: 'linear-gradient(135deg, #9f1239 0%, #be123c 100%)' // Red
        };
    }
    
    const xpEl = document.getElementById('profil-xp');
    const pangkatEl = document.getElementById('profil-pangkat');
    const notesEl = document.getElementById('profil-notes');
    
    // Terapkan warna background header secara dinamis
    const headers = document.querySelectorAll('.bg-gradient-premium');
    headers.forEach(el => {
        el.style.background = rankInfo.headerBg;
    });
    
    if(xpEl && pangkatEl) {
        xpEl.innerHTML = `${userXP} <span class="text-xs text-teal-400">XP</span>`;
        pangkatEl.textContent = rankInfo.title;
        pangkatEl.className = 'px-3 py-1.5 text-xs font-bold rounded-xl inline-block ' + rankInfo.color;
        if(notesEl) notesEl.textContent = rankInfo.notes;
    }
    
    // Jika tidak ada data sama sekali, jangan render
    if(totalHadir === 0 && totalAlpa === 0 && totalIzinDll === 0) return;
    
    if(!window.Chart) return;
    
    const ctx = document.getElementById('riwayatChart');
    if(!ctx) return;
    
    if(riwayatChartInstance) {
        riwayatChartInstance.destroy();
    }
    
    riwayatChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Hadir', 'Alpa', 'Izin/Sakit/DL'],
            datasets: [{
                data: [totalHadir, totalAlpa, totalIzinDll],
                backgroundColor: [
                    '#10b981', // emerald-500
                    '#f43f5e', // rose-500
                    '#3b82f6', // blue-500
                ],
                borderWidth: 2,
                borderColor: '#070d1a',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 10,
                        usePointStyle: true,
                        font: {
                            family: "'Plus Jakarta Sans', sans-serif",
                            size: 10,
                            weight: 'bold'
                        }
                    }
                }
            },
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });
}

function toggleSkeleton(enable) {
    const ids = ['today-masuk', 'today-pulang', 'today-status', 'rekap-hadir', 'rekap-alpa', 'rekap-telat', 'rekap-isc', 'rekap-tap', 'rekap-telat-menit', 'rekap-psw-kali', 'rekap-psw-menit', 'rekap-jam-kerja'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            if(enable) el.classList.add('skeleton', 'text-transparent', 'bg-slate-200');
            else el.classList.remove('skeleton', 'text-transparent', 'bg-slate-200');
        }
    });
}

async function loadDashboardData(idKaryawan) {
    toggleSkeleton(true);
    try {
        const res = await fetch(`${API_BASE}/pegawai/dashboard/today/${idKaryawan}?_t=${Date.now()}`);
        const result = await res.json();
        if(result.success && result.data) {
            toggleSkeleton(false);
            const elMasuk = document.getElementById('today-masuk');
            const elStatus = document.getElementById('today-status');
            elMasuk.textContent = result.data.jam_masuk || '--:--';
            document.getElementById('today-pulang').textContent = result.data.jam_keluar || '--:--';
            elStatus.textContent = result.data.status || 'Hadir';
            
            // Kalau telat, buat merah
            if (result.data.status && result.data.status.toLowerCase().includes('telat')) {
                elMasuk.classList.add('text-rose-500', 'font-bold');
                elStatus.classList.remove('text-slate-700', 'bg-slate-50/80');
                elStatus.classList.add('text-rose-600', 'bg-rose-50', 'border-rose-200');
            } else {
                elMasuk.classList.remove('text-rose-500', 'font-bold');
                elStatus.classList.remove('text-rose-600', 'bg-rose-50', 'border-rose-200');
                elStatus.classList.add('text-slate-700', 'bg-slate-50/80');
            }
        }
    } catch(e) {}

    // Load Rekap Bulanan dari API yang sudah ada
    try {
        const res = await fetch(`${API_BASE}/rekap/bulanan?_t=${Date.now()}`);
        const result = await res.json();
        if(result.success) {
            const myData = result.data.find(d => String(d.id_karyawan).trim().toLowerCase() === String(idKaryawan).trim().toLowerCase());
            if (myData) {
                document.getElementById('rekap-hadir').textContent = myData.total_masuk || 0;
                document.getElementById('rekap-alpa').textContent = myData.alpa || 0;
                document.getElementById('rekap-telat').textContent = myData.telat_kali || 0;
                
                const isc = (parseInt(myData.total_izin)||0) + (parseInt(myData.total_sakit)||0) + (parseInt(myData.total_cuti)||0) + (parseInt(myData.total_dl)||0);
                document.getElementById('rekap-isc').textContent = isc;
                document.getElementById('rekap-tap').textContent = myData.tanpa_absen_pulang || 0;
                
                if(document.getElementById('rekap-telat-menit')) {
                    document.getElementById('rekap-telat-menit').textContent = myData.telat_menit || 0;
                }
                
                if(document.getElementById('rekap-psw-kali')) {
                    document.getElementById('rekap-psw-kali').textContent = myData.psw_kali || 0;
                }
                
                if(document.getElementById('rekap-psw-menit')) {
                    document.getElementById('rekap-psw-menit').textContent = myData.psw_menit || 0;
                }

                if(document.getElementById('rekap-jam-kerja')) {
                    document.getElementById('rekap-jam-kerja').textContent = myData.total_jam_kerja || '00:00:00';
                }

                // Populate Detail Modal
                document.getElementById('dtl-hadir').textContent = myData.total_masuk || 0;
                document.getElementById('dtl-alpa').textContent = myData.alpa || 0;
                document.getElementById('dtl-izin').textContent = myData.total_izin || 0;
                document.getElementById('dtl-sakit').textContent = myData.total_sakit || 0;
                document.getElementById('dtl-cuti').textContent = myData.total_cuti || 0;
                document.getElementById('dtl-dl').textContent = myData.total_dl || 0;
                document.getElementById('dtl-telat').textContent = myData.telat_kali || 0;
                document.getElementById('dtl-psw').textContent = myData.psw_kali || 0;
                document.getElementById('dtl-tap').textContent = myData.tanpa_absen_pulang || 0;
                if(document.getElementById('dtl-jam-kerja')) {
                    document.getElementById('dtl-jam-kerja').textContent = (myData.total_jam_kerja || 0) + ' Jam';
                }
            }
        }
    } catch (e) {
        console.error("Gagal memuat rekap bulanan:", e);
        // alert("Gagal memuat rekap bulanan. Silakan refresh (Ctrl+F5) atau cek koneksi server.");
    } finally {
        toggleSkeleton(false); // Ensure skeleton is removed
    }
    
    // Panggil tabel metrik harian
    loadDailyMetricsTable(idKaryawan);
    
    // Panggil gamifikasi riwayat (agar badge rank muncul di dashboard)
    if (!isRiwayatLoaded) {
        loadRiwayatBulanan(idKaryawan);
    }
}

async function loadDailyMetricsTable(idKaryawan, targetPeriode = null) {
    const tbody = document.getElementById('daily-metrics-tbody');
    if (!tbody) return;

    try {
        const now = new Date();
        const year = targetPeriode ? targetPeriode.split('-')[0] : now.getFullYear();
        const month = targetPeriode ? targetPeriode.split('-')[1] : String(now.getMonth() + 1).padStart(2, '0');
        const periode = `${year}-${month}`;
        
        // Set nilai input filter bulan jika dipanggil pertama kali
        const filterInput = document.getElementById('filter-bulan');
        if (filterInput && !filterInput.value) {
            filterInput.value = periode;
        }
        
        // Menentukan jumlah hari dalam bulan ini
        const targetDate = new Date(year, parseInt(month) - 1, 1);
        const daysInMonth = new Date(year, targetDate.getMonth() + 1, 0).getDate();
        
        // Ambil data API dari matrix bulanan agar tidak perlu restart server (sesuai saran user)
        const res = await fetch(`${API_BASE}/absensi/bulanan/matrix?periode=${periode}&_t=${Date.now()}`, { cache: 'no-store' });
        const result = await res.json();
        
        // Ambil data alpa akurat dari backend
        const resAlpa = await fetch(`${API_BASE}/absensi/history/${idKaryawan}?periode=${periode}&tipe=alpa&_t=${Date.now()}`);
        const resultAlpa = await resAlpa.json();
        const alpaDates = new Set();
        if (resultAlpa.success && resultAlpa.data) {
            resultAlpa.data.forEach(item => {
                const dateNum = new Date(item.tanggal).getDate();
                alpaDates.add(dateNum);
            });
        }

        let html = '';
        if (result.success) {
            const historyMap = {};
            
            // Cari data user ini dari matrix secara case-insensitive
            const userData = result.data.find(k => String(k.id_karyawan).toLowerCase() === String(idKaryawan).toLowerCase());
            
            if (userData && userData.hari) {
                // userData.hari berisi { "1": {jam_masuk, jam_keluar, status...}, "2": {...} }
                for (let d = 1; d <= 31; d++) {
                    if (userData.hari[d]) {
                        historyMap[d] = userData.hari[d];
                    }
                }
            }

            for (let i = 1; i <= 31; i++) {
                if (i > daysInMonth) {
                    html += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                            <td class="p-2.5 text-center font-bold" style="color:rgba(255,255,255,0.12);border-right:1px solid rgba(255,255,255,0.04);">${i}</td>
                            <td class="p-2.5 text-center" style="color:rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.04);">-</td>
                            <td class="p-2.5 text-center" style="color:rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.04);">-</td>
                            <td class="p-2.5 text-center" style="color:rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.04);">-</td>
                            <td class="p-2.5 text-center" style="color:rgba(255,255,255,0.1);">-</td>
                        </tr>
                    `;
                    continue;
                }

                const d = historyMap[i];
                if (d) {
                    // Data ada
                    let statusLabel = '';
                    if (d.status === 'IZIN' || d.status === 'SAKIT' || d.status === 'CUTI' || d.status === 'DL' || d.status === 'DINAS_LUAR') {
                         html += `
                            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);background:rgba(59,130,246,0.04);">
                                <td class="p-2.5 text-center font-black" style="color:#2dd4bf;border-right:1px solid rgba(255,255,255,0.04);">${i}</td>
                                <td class="p-2.5 text-center font-black" style="color:#60a5fa;border-right:1px solid rgba(255,255,255,0.04);" colspan="2">${d.status}</td>
                                <td class="p-2.5 text-center" style="color:rgba(255,255,255,0.15);border-right:1px solid rgba(255,255,255,0.04);">-</td>
                                <td class="p-2.5 text-center" style="color:rgba(255,255,255,0.15);">-</td>
                            </tr>
                        `;
                        continue;
                    }

                    const masuk = d.jam_masuk && d.jam_masuk !== '-' ? d.jam_masuk.slice(0, 5) : '-';
                    let pulang = d.jam_keluar && d.jam_keluar !== '-' ? d.jam_keluar.slice(0, 5) : '-';
                    
                    if ((masuk !== '-' && pulang === '-') || (d.keterangan && (d.keterangan.includes('Otomatis') || d.keterangan.includes('Tanpa Absen Pulang')))) {
                        pulang = '<span style="background:rgba(239,68,68,0.12);color:#f87171;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:800;border:1px solid rgba(239,68,68,0.2);">TAP</span>';
                    }

                    const psw = (d.psw_menit && d.psw_menit > 0) ? `<span style="color:#f87171;font-weight:700;font-size:11px;">P:${d.psw_menit}m</span>` : `<span style="color:rgba(255,255,255,0.18);">-</span>`;
                    const telat = (d.telat_menit && d.telat_menit > 0) ? `<span style="color:#fb923c;font-weight:700;font-size:11px;">T:${d.telat_menit}m</span>` : `<span style="color:rgba(255,255,255,0.18);">-</span>`;
                    
                    // Kalau telat, buat text merah
                    const isTelat = d.status && d.status.toLowerCase().includes('telat');
                    const masukHTML = isTelat ? `<span style="color:#f87171;font-weight:700;">${masuk}</span>` : `<span style="color:rgba(255,255,255,0.75);font-weight:600;">${masuk}</span>`;
                    const pulangStyle = typeof pulang === 'string' && pulang !== '-' && !pulang.includes('TAP') ? `style="color:rgba(255,255,255,0.65);font-weight:600;"` : '';
                    
                    html += `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.04);" class="table-row-hover">
                            <td class="p-2.5 text-center font-black" style="color:#2dd4bf;border-right:1px solid rgba(255,255,255,0.04);">${i}</td>
                            <td class="p-2.5 text-center" style="border-right:1px solid rgba(255,255,255,0.04);">${masukHTML}</td>
                            <td class="p-2.5 text-center" style="border-right:1px solid rgba(255,255,255,0.04);" ${pulangStyle}>${pulang}</td>
                            <td class="p-2.5 text-center" style="border-right:1px solid rgba(255,255,255,0.04);">${psw}</td>
                            <td class="p-2.5 text-center">${telat}</td>
                        </tr>
                    `;
                } else {
                    const dateObj = new Date(year, targetDate.getMonth(), i);
                    const dayOfWeek = dateObj.getDay(); 
                    const isFuture = dateObj > now;
                    
                    let rowStyle = 'border-bottom:1px solid rgba(255,255,255,0.04);';
                    let info = '<span style="color:rgba(255,255,255,0.18);">-</span>';
                    
                    if (isFuture) {
                        rowStyle += 'opacity:0.4;';
                    } else if (dayOfWeek === 0) {
                        rowStyle += 'background:rgba(244,63,94,0.04);';
                        info = '<span style="color:#f87171;font-size:10px;font-weight:800;background:rgba(244,63,94,0.1);padding:2px 8px;border-radius:6px;">LBR</span>';
                    } else if (alpaDates.has(i)) {
                        info = '<span style="color:#f43f5e;font-size:10px;font-weight:800;background:rgba(244,63,94,0.12);padding:2px 8px;border-radius:6px;">ALPA</span>';
                    }

                    html += `
                        <tr style="${rowStyle}">
                            <td class="p-2.5 text-center font-bold" style="color:rgba(255,255,255,0.3);border-right:1px solid rgba(255,255,255,0.04);">${i}</td>
                            <td class="p-2.5 text-center" colspan="4">${info}</td>
                        </tr>
                    `;
                }
            }
        } else {
            html = `<tr><td colspan="5" class="text-center p-4" style="color:rgba(255,255,255,0.25);">Gagal memuat data</td></tr>`;
        }
        tbody.innerHTML = html;
        
    } catch (e) {
        console.error("Error daily metrics:", e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-xs" style="color:rgba(248,113,113,0.7);">Koneksi Error</td></tr>`;
    }
}

function onMonthFilterChange(val) {
    const userStr = localStorage.getItem('pegawai_session');
    if(userStr) {
        const user = JSON.parse(userStr);
        loadDailyMetricsTable(user.id_karyawan, val);
    }
}

// ========================
// PULL TO REFRESH
// ========================
let touchStartY = 0;
let touchEndY = 0;
const pTrThreshold = 100;
let isRefreshing = false;

window.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
        touchStartY = e.changedTouches[0].screenY;
    }
}, {passive: true});

window.addEventListener('touchmove', e => {
    if(isRefreshing || window.scrollY > 0) return;
    const currentY = e.changedTouches[0].screenY;
    const pullDistance = currentY - touchStartY;
    
    if (pullDistance > 0 && pullDistance < pTrThreshold + 50) {
        const indicator = document.getElementById('ptr-indicator');
        if(indicator) {
            indicator.style.transform = `translate(-50%, ${pullDistance - 50}px)`;
            indicator.style.transition = 'none';
        }
    }
}, {passive: true});

window.addEventListener('touchend', e => {
    if(isRefreshing || window.scrollY > 0) return;
    touchEndY = e.changedTouches[0].screenY;
    const pullDistance = touchEndY - touchStartY;
    
    const indicator = document.getElementById('ptr-indicator');
    if(!indicator) return;
    
    indicator.style.transition = 'transform 0.3s ease';
    
    if (pullDistance > pTrThreshold) {
        // Trigger Refresh
        isRefreshing = true;
        indicator.style.transform = `translate(-50%, 20px)`;
        
        // Cek halaman aktif
        const session = localStorage.getItem('pegawai_session');
        if(session) {
            const user = JSON.parse(session);
            const dashPage = document.getElementById('dashboard-page');
            const riwayatPage = document.getElementById('riwayat-page');
            
            let promises = [];
            if(!dashPage.classList.contains('hidden')) {
                promises.push(loadDashboardData(user.id_karyawan));
            } else if (!riwayatPage.classList.contains('hidden')) {
                promises.push(loadRiwayatBulanan(user.id_karyawan));
            }
            
            Promise.all(promises).then(() => {
                setTimeout(() => {
                    indicator.style.transform = `translate(-50%, -150%)`;
                    isRefreshing = false;
                }, 500);
            });
        }
    } else {
        // Batal
        indicator.style.transform = `translate(-50%, -150%)`;
    }
}, {passive: true});

function toggleDetailModal() {
    const modal = document.getElementById('detail-modal');
    const content = document.getElementById('detail-modal-content');
    
    if (modal.classList.contains('opacity-0')) {
        // Buka Modal
        modal.classList.remove('opacity-0', 'pointer-events-none');
        content.classList.remove('translate-y-full');
    } else {
        // Tutup Modal
        modal.classList.add('opacity-0', 'pointer-events-none');
        content.classList.add('translate-y-full');
    }
}

function togglePasswordVisibility(inputId, buttonEl) {
    const input = document.getElementById(inputId);
    const icon = buttonEl.querySelector('i');
    if (input && icon) {
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}
