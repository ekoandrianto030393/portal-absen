const API_BASE = '/api';

// Cek Sesi Login
window.onload = () => {
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
            const authPage = document.getElementById('auth-page');
            authPage.classList.remove('hidden');
            setTimeout(() => authPage.style.opacity = '1', 50);
        }
    }, 500);
}

function toggleAuth(type) {
    if (type === 'register') {
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.remove('hidden');
    } else {
        document.getElementById('register-form').classList.add('hidden');
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

function logout() {
    localStorage.removeItem('pegawai_session');
    window.location.reload();
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

    // Load User Photo
    try {
        const resFoto = await fetch(`${API_BASE}/karyawan/${user.id_karyawan}`);
        const photoData = await resFoto.json();
        if (photoData.success && photoData.data && photoData.data.foto) {
            document.getElementById('user-foto').src = 'data:image/jpeg;base64,' + photoData.data.foto;
            document.getElementById('user-foto').classList.remove('hidden');
            document.getElementById('user-foto-icon').classList.add('hidden');
        }
    } catch (e) {
        console.error("Gagal memuat foto profil", e);
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
    
    const navBeranda = document.getElementById('nav-beranda');
    const navRiwayat = document.getElementById('nav-riwayat');
    
    // Reset Nav States
    navBeranda.className = "flex flex-col items-center gap-1.5 p-2 text-slate-400 hover:text-teal-500 transition-colors w-16 active:scale-95 transition-transform";
    navRiwayat.className = "flex flex-col items-center gap-1.5 p-2 text-slate-400 hover:text-teal-500 transition-colors w-16 active:scale-95 transition-transform";
    
    if (tabName === 'beranda') {
        // Set Active Nav
        navBeranda.className = "flex flex-col items-center gap-1.5 p-2 text-teal-600 w-16 active:scale-95 transition-transform";
        
        riwayatPage.style.opacity = '0';
        setTimeout(() => {
            riwayatPage.classList.add('hidden');
            dashPage.classList.remove('hidden');
            setTimeout(() => {
                dashPage.style.opacity = '1';
                // Reload dashboard data every time user goes back to beranda
                const session = localStorage.getItem('pegawai_session');
                if (session) {
                    const user = JSON.parse(session);
                    loadDashboardData(user.id_karyawan);
                }
            }, 50);
        }, 300);
        
    } else if (tabName === 'riwayat') {
        // Set Active Nav
        navRiwayat.className = "flex flex-col items-center gap-1.5 p-2 text-teal-600 w-16 active:scale-95 transition-transform";
        
        dashPage.style.opacity = '0';
        setTimeout(() => {
            dashPage.classList.add('hidden');
            riwayatPage.classList.remove('hidden');
            setTimeout(() => {
                riwayatPage.style.opacity = '1';
                if (!isRiwayatLoaded) {
                    const session = localStorage.getItem('pegawai_session');
                    if (session) {
                        const user = JSON.parse(session);
                        loadRiwayatBulanan(user.id_karyawan);
                    }
                }
            }, 50);
        }, 300);
    }
}

async function loadRiwayatBulanan(idKaryawan) {
    const container = document.getElementById('riwayat-container');
    try {
        const res = await fetch(`${API_BASE}/riwayat/rekap/${idKaryawan}`);
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
            <div class="glass-card rounded-[1.5rem] p-5 premium-shadow hover:-translate-y-1 transition-transform duration-300">
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100/60">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center border border-teal-100/50 shadow-sm">
                            <i class="fa-solid fa-calendar-check text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-slate-800 text-sm uppercase tracking-widest">${formatBulan(item.periode)}</h4>
                            <p class="text-[10px] text-slate-500 font-semibold tracking-wider">${item.total_hari_kerja || 0} Hari Kerja</p>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-5 gap-2 text-center">
                    <div class="bg-slate-50 rounded-xl p-2 border border-slate-100/50">
                        <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">Hadir</p>
                        <p class="text-sm font-black text-emerald-600">${item.total_masuk}</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-2 border border-slate-100/50">
                        <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">I/S/DL</p>
                        <p class="text-sm font-black text-blue-600">${Number(item.total_izin||0) + Number(item.total_sakit||0) + Number(item.total_dl||0)}</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-2 border border-slate-100/50">
                        <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">Telat</p>
                        <p class="text-sm font-black text-amber-500">${item.telat_kali}</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-2 border border-slate-100/50">
                        <p class="text-[9px] font-bold text-slate-400 uppercase mb-1">Alpa</p>
                        <p class="text-sm font-black text-rose-500">${item.alpa}</p>
                    </div>
                    <div class="bg-slate-50 rounded-xl p-2 border border-slate-100/50">
                        <p class="text-[8px] font-bold text-slate-400 uppercase mb-1">Tanpa Plg</p>
                        <p class="text-sm font-black text-red-500">${item.tanpa_absen_pulang || 0}</p>
                    </div>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        isRiwayatLoaded = true;
        
    } catch(e) {
        container.innerHTML = `<div class="text-center text-rose-500 text-sm p-5 font-bold"><i class="fa-solid fa-triangle-exclamation mr-2"></i>Gagal memuat data riwayat.</div>`;
    }
}

async function loadDashboardData(idKaryawan) {
    try {
        const res = await fetch(`${API_BASE}/pegawai/dashboard/today/${idKaryawan}`);
        const result = await res.json();
        if(result.success && result.data) {
            document.getElementById('today-masuk').textContent = result.data.jam_masuk || '--:--';
            document.getElementById('today-pulang').textContent = result.data.jam_keluar || '--:--';
            document.getElementById('today-status').textContent = result.data.status || 'Hadir';
        }
    } catch(e) {}

    // Load Rekap Bulanan dari API yang sudah ada
    try {
        const res = await fetch(`${API_BASE}/rekap/bulanan`);
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
            }
        }
    } catch (e) {
        console.error("Gagal memuat rekap bulanan:", e);
        alert("Gagal memuat rekap bulanan. Silakan refresh (Ctrl+F5) atau cek koneksi server.");
    }
}

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
