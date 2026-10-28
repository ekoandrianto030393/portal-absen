
const INDONESIA_HOLIDAYS = {
    // Daftar Hari Libur Nasional Resmi (SKB 3 Menteri)
    '01-01': 'Tahun Baru Masehi',
    '01-16': 'Isra Mikraj Nabi Muhammad SAW',
    '01-27': 'Isra Mikraj 1446 H',
    '01-29': 'Tahun Baru Imlek',
    '02-17': 'Tahun Baru Imlek',
    '03-20': 'Hari Raya Idul Fitri',
    '03-21': 'Hari Raya Idul Fitri',
    '03-22': 'Hari Suci Nyepi',
    '03-29': 'Hari Suci Nyepi',
    '03-31': 'Hari Raya Idul Fitri',
    '04-01': 'Hari Raya Idul Fitri',
    '04-03': 'Wafat Yesus Kristus',
    '04-18': 'Wafat Yesus Kristus',
    '04-20': 'Hari Paskah',
    '05-01': 'Hari Buruh Internasional',
    '05-12': 'Hari Raya Waisak',
    '05-14': 'Kenaikan Yesus Kristus',
    '05-29': 'Kenaikan Yesus Kristus',
    '05-31': 'Hari Raya Waisak',
    '06-01': 'Hari Lahir Pancasila',
    '06-07': 'Hari Raya Idul Adha',
    '06-16': 'Hari Raya Idul Adha',
    '06-27': 'Tahun Baru Islam',
    '07-07': 'Tahun Baru Islam',
    '08-17': 'Hari Kemerdekaan RI',
    '09-05': 'Maulid Nabi Muhammad SAW',
    '09-15': 'Maulid Nabi Muhammad SAW',
    '12-25': 'Hari Raya Natal'
};


// ========================
// PUSAT NOTIFIKASI & PENGINGAT CERDAS
// ========================
function openNotificationModal() {
    const modal = document.getElementById('notification-modal');
    const content = document.getElementById('notification-modal-content');
    const dot = document.getElementById('notif-badge-dot');
    if (!modal || !content) return;

    renderNotificationList();
    if (dot) dot.classList.add('hidden');

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('translate-y-full');
}

function closeNotificationModal() {
    const modal = document.getElementById('notification-modal');
    const content = document.getElementById('notification-modal-content');
    if (!modal || !content) return;

    content.classList.add('translate-y-full');
    modal.classList.add('opacity-0', 'pointer-events-none');
}

function markAllNotificationsRead() {
    const dot = document.getElementById('notif-badge-dot');
    if (dot) dot.classList.add('hidden');
    if (typeof showPortalToast === 'function') {
        showPortalToast('Semua notifikasi telah ditandai dibaca.', 'success', 'Pusat Notifikasi');
    }
}

function renderNotificationList() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    const masuk = document.getElementById('today-masuk')?.textContent || '--:--';
    const pulang = document.getElementById('today-pulang')?.textContent || '--:--';
    const alpaVal = document.getElementById('rekap-alpa')?.textContent || '0';
    const pangkat = document.getElementById('beranda-pangkat-text')?.textContent || 'Pegawai Aktif';

    const now = new Date();
    const day = now.getDay();
    let shiftPulangStr = '14:00';
    if (day === 5) shiftPulangStr = '11:30';
    else if (day === 6) shiftPulangStr = '13:00';

    let notifs = [];

    // 1. Status presensi hari ini
    if (masuk && masuk !== '--:--') {
        const isTelat = document.getElementById('today-status')?.textContent?.toLowerCase().includes('telat');
        if (isTelat) {
            notifs.push({
                type: 'warning',
                icon: 'fa-triangle-exclamation',
                title: 'Presensi Masuk (Terlambat)',
                desc: 'Presensi masuk tercatat pukul ' + masuk + ' WIB. Harap perhatikan jam kehadiran agar akumulasi skor disiplin tetap optimal.',
                time: 'Hari ini'
            });
        } else {
            notifs.push({
                type: 'success',
                icon: 'fa-circle-check',
                title: 'Presensi Masuk Tepat Waktu',
                desc: 'Scan kehadiran berhasil tercatat pukul ' + masuk + ' WIB. Selamat bertugas dan berikan pelayanan terbaik!',
                time: 'Hari ini'
            });
        }
    } else {
        notifs.push({
            type: 'info',
            icon: 'fa-clock',
            title: 'Pengingat Presensi Hari Ini',
            desc: 'Anda belum tercatat melakukan presensi masuk hari ini. Pastikan melakukan scan biometrik pada mesin Puskesmas.',
            time: 'Hari ini'
        });
    }

    // 2. Info Shift & Jam Pulang
    if (day === 0) {
        notifs.push({
            type: 'neutral',
            icon: 'fa-mug-hot',
            title: 'Hari Libur Pelayanan Reguler',
            desc: 'Hari ini hari Minggu. Selamat beristirahat bersama keluarga dan jaga selalu kesehatan.',
            time: 'Info'
        });
    } else if (pulang && pulang !== '--:--') {
        notifs.push({
            type: 'success',
            icon: 'fa-door-open',
            title: 'Presensi Pulang Selesai',
            desc: 'Presensi pulang telah tercatat pukul ' + pulang + ' WIB. Terima kasih atas dedikasi dan pelayanan Anda hari ini.',
            time: 'Hari ini'
        });
    } else {
        notifs.push({
            type: 'warning',
            icon: 'fa-hourglass-half',
            title: 'Batas Kepulangan Shift: ' + shiftPulangStr + ' WIB',
            desc: 'Jadwal resmi kepulangan shift hari ini adalah pukul ' + shiftPulangStr + ' WIB. Pastikan melakukan scan pulang sebelum meninggalkan faskes.',
            time: 'Penting'
        });
    }

    // 3. Status Rekap Alpa & Disiplin Bulan Ini
    if (Number(alpaVal) === 0) {
        notifs.push({
            type: 'success',
            icon: 'fa-award',
            title: 'Prestasi Disiplin: Bebas Alpa',
            desc: 'Rekam jejak kehadiran Anda bulan ini masih 0 Alpa. Pertahankan predikat ' + pangkat + '!',
            time: 'Bulan Ini'
        });
    } else {
        notifs.push({
            type: 'danger',
            icon: 'fa-circle-exclamation',
            title: 'Perhatian: ' + alpaVal + ' Hari Alpa',
            desc: 'Tercatat ' + alpaVal + ' hari ketidakhadiran tanpa keterangan. Segera konfirmasi ke Kasubag TU jika ada surat tugas/izin resmi.',
            time: 'Perhatian'
        });
    }

    // 4. Layanan Pengaduan & Bantuan WhatsApp
    notifs.push({
        type: 'info',
        icon: 'fa-headset',
        title: 'Layanan Admin Kepegawaian',
        desc: 'Jika terdapat kendala mesin biometrik wajah/jari, hubungi Admin Kepegawaian di 0819-9159-1834.',
        time: 'Pusat Bantuan'
    });

    const styleMap = {
        success: { border: 'border-emerald-200', bg: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', iconBg: '#10b981', color: '#065f46' },
        warning: { border: 'border-amber-200', bg: 'linear-gradient(135deg, #fffbeb, #fef3c7)', iconBg: '#f59e0b', color: '#92400e' },
        danger: { border: 'border-rose-200', bg: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', iconBg: '#f43f5e', color: '#9f1239' },
        info: { border: 'border-sky-200', bg: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)', iconBg: '#0284c7', color: '#075985' },
        neutral: { border: 'border-slate-200', bg: 'linear-gradient(135deg, #f8fafc, #f1f5f9)', iconBg: '#64748b', color: '#334155' }
    };

    container.innerHTML = notifs.map(n => {
        const s = styleMap[n.type] || styleMap.info;
        return '<div class="rounded-2xl p-3 border ' + s.border + ' shadow-sm flex items-start gap-2.5" style="background: ' + s.bg + ';">' +
            '<div class="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0 mt-0.5 shadow-sm" style="background: ' + s.iconBg + ';">' +
            '<i class="fa-solid ' + n.icon + ' text-[11px]"></i></div>' +
            '<div class="flex-1 min-w-0">' +
            '<div class="flex items-center justify-between gap-1 mb-0.5">' +
            '<h4 class="text-[11px] font-black uppercase tracking-wider" style="color: ' + s.color + ';">' + n.title + '</h4>' +
            '<span class="text-[8px] font-bold text-slate-400 font-mono shrink-0">' + n.time + '</span></div>' +
            '<p class="text-[10px] font-semibold text-slate-700 leading-relaxed">' + n.desc + '</p></div></div>';
    }).join('');
}

const API_BASE = '/api';

// Helper fungsi untuk JWT
function getAuthHeader(extraHeaders = {}) {
    const token = localStorage.getItem('pegawai_token');
    if (token) {
        return { 'Authorization': `Bearer ${token}`, ...extraHeaders };
    }
    return extraHeaders;
}

// Global Luxury Toast Notification (Menggantikan alert browser yang kaku)
function showPortalToast(message, type = 'info', title = '') {
    const container = document.getElementById('portal-toast-container');
    if (!container) {
        alert(message);
        return;
    }
    const styles = {
        success: {
            bg: 'linear-gradient(135deg, #065f46 0%, #0d9488 100%)',
            border: 'border-emerald-300/70',
            icon: 'fa-circle-check text-amber-300',
            defaultTitle: 'Berhasil'
        },
        error: {
            bg: 'linear-gradient(135deg, #9f1239 0%, #e11d48 100%)',
            border: 'border-rose-300/70',
            icon: 'fa-triangle-exclamation text-amber-200',
            defaultTitle: 'Perhatian'
        },
        warning: {
            bg: 'linear-gradient(135deg, #92400e 0%, #d97706 100%)',
            border: 'border-amber-300/70',
            icon: 'fa-circle-info text-amber-200',
            defaultTitle: 'Informasi'
        },
        info: {
            bg: 'linear-gradient(135deg, #042f2e 0%, #0f766e 55%, #0284c7 100%)',
            border: 'border-teal-300/70',
            icon: 'fa-bell text-amber-300',
            defaultTitle: 'Info Portal'
        }
    };
    const st = styles[type] || styles.info;
    const toast = document.createElement('div');
    toast.className = `pointer-events-auto rounded-2xl p-3.5 text-white border ${st.border} shadow-[0_16px_36px_rgba(4,47,46,0.45)] flex items-start gap-3 transition-all duration-300 opacity-0 -translate-y-2 cursor-pointer`;
    toast.style.background = st.bg;
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
            <i class="fa-solid ${st.icon} text-sm"></i>
        </div>
        <div class="flex-1 min-w-0 text-left">
            <p class="text-[10px] font-black uppercase tracking-widest text-amber-200 leading-none mb-1">${title || st.defaultTitle}</p>
            <p class="text-xs font-bold text-white leading-snug break-words">${String(message || '').replace(/\n/g, '<br>')}</p>
        </div>
        <button type="button" class="text-white/70 hover:text-white text-xs px-1"><i class="fa-solid fa-xmark"></i></button>
    `;
    const dismiss = () => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 250);
    };
    toast.onclick = dismiss;
    container.appendChild(toast);
    requestAnimationFrame(() => {
        toast.classList.remove('opacity-0', '-translate-y-2');
    });
    setTimeout(dismiss, 4200);
}

// Generator SVG QR Matrix Deterministik untuk E-ID Card & Slip Resmi
function generateDeterministicQrSvg(seedText) {
    const str = String(seedText || 'PUSKESMAS-BIO-VERIFIED');
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    const size = 11;
    let rects = '';
    const isFinder = (r, c) => (r < 3 && c < 3) || (r < 3 && c >= size - 3) || (r >= size - 3 && c < 3);
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (isFinder(r, c)) continue;
            hash ^= (r * 31 + c * 17) & 0xff;
            hash = Math.imul(hash, 16777619);
            if ((Math.abs(hash) % 10) < 5) {
                rects += `<rect x="${c * 8 + 6}" y="${r * 8 + 6}" width="7" height="7" rx="1.2" fill="#042f2e"/>`;
            }
        }
    }
    const finderSvg = (x, y) => `
        <rect x="${x}" y="${y}" width="22" height="22" rx="4" fill="none" stroke="#042f2e" stroke-width="3"/>
        <rect x="${x + 6}" y="${y + 6}" width="10" height="10" rx="2" fill="#0d9488"/>
    `;
    return `<svg viewBox="0 0 100 100" class="w-full h-full">${finderSvg(6, 6)}${finderSvg(72, 6)}${finderSvg(6, 72)}${rects}</svg>`;
}

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
        const authClockEl = document.getElementById('auth-live-clock');
        if (authClockEl) {
            const dStr = now.toLocaleDateString('id-ID', { weekday: 'short', day: '2-digit', month: 'short' });
            const tStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
            authClockEl.textContent = `${dStr} • ${tStr} WIB`;
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
    const token = localStorage.getItem('pegawai_token');
    
    // Paksa Logout jika user punya sesi tapi tidak punya token (Migrasi JWT)
    if (session && !token) {
        localStorage.removeItem('pegawai_session');
    localStorage.removeItem('pegawai_token');
        window.location.reload();
        return;
    }
    
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
                // Verifikasi ke server apakah benar ada request pending
                fetch(`${API_BASE}/pegawai/lupa-password/status/${pendingReqId}`)
                    .then(r => {
                        if (!r.ok) throw new Error('API Error');
                        return r.json();
                    })
                    .then(data => {
                        if (data.success && data.hasPending) {
                            showLockScreen();
                        } else {
                            // Tidak ada request pending di server, bersihkan localStorage
                            localStorage.removeItem('pending_reset_id');
                            showAuthPage();
                        }
                    })
                    .catch(() => {
                        // Jika server error/tidak bisa dihubungi, 
                        // bersihkan state agar pegawai tidak terkunci selamanya
                        localStorage.removeItem('pending_reset_id');
                        showAuthPage();
                    });
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
    const savedUser = localStorage.getItem('saved_pegawai_username');
    const savedLabel = localStorage.getItem('saved_pegawai_label');
    const chip = document.getElementById('saved-account-chip');
    const chipName = document.getElementById('saved-account-name');
    const loginInput = document.getElementById('login-username');
    if (savedUser) {
        if (loginInput && !loginInput.value) loginInput.value = savedUser;
        if (chip && chipName) {
            chipName.textContent = savedLabel ? `${savedLabel} (@${savedUser})` : `@${savedUser}`;
            chip.classList.remove('hidden');
        }
    }
}

function useSavedAccount() {
    const savedUser = localStorage.getItem('saved_pegawai_username');
    const loginInput = document.getElementById('login-username');
    const pwdInput = document.getElementById('login-password');
    if (savedUser && loginInput) {
        loginInput.value = savedUser;
        if (pwdInput) pwdInput.focus();
        showPortalToast('Username terakhir berhasil diisi. Silakan masukkan password Anda.', 'info', 'Login Cepat');
    }
}

function toggleAuthGuide() {
    const box = document.getElementById('auth-guide-box');
    if (box) box.classList.toggle('hidden');
}

function updatePasswordStrength(val) {
    const box = document.getElementById('reg-pwd-strength-box');
    const lbl = document.getElementById('reg-pwd-strength-label');
    const bar = document.getElementById('reg-pwd-strength-bar');
    if (!box || !lbl || !bar) return;
    const s = String(val || '');
    if (!s) {
        box.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');
    let score = 0;
    if (s.length >= 4) score++;
    if (s.length >= 6) score++;
    if (/[0-9]/.test(s) && /[a-zA-Z]/.test(s)) score++;
    if (score <= 1) {
        lbl.textContent = 'Lemah';
        lbl.className = 'text-rose-600';
        bar.style.width = '33%';
        bar.style.background = '#f43f5e';
    } else if (score === 2) {
        lbl.textContent = 'Cukup Baik';
        lbl.className = 'text-amber-600';
        bar.style.width = '68%';
        bar.style.background = '#f59e0b';
    } else {
        lbl.textContent = 'Kuat & Aman ✓';
        lbl.className = 'text-emerald-600';
        bar.style.width = '100%';
        bar.style.background = '#10b981';
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

let cachedKaryawanList = null;

async function ensureKaryawanListLoaded() {
    if (cachedKaryawanList) return cachedKaryawanList;
    try {
        const res = await fetch(`${API_BASE}/karyawan/descriptors?_t=${Date.now()}`);
        const data = await res.json();
        if (data && Array.isArray(data.descriptors)) {
            cachedKaryawanList = data.descriptors;
            return cachedKaryawanList;
        }
    } catch (e) {}
    return [];
}

async function onRegIdInput(val) {
    const statusBox = document.getElementById('reg-id-status');
    const namaInput = document.getElementById('reg-nama');
    const cleanId = String(val || '').trim().toUpperCase();
    if (!statusBox) return;

    if (!cleanId) {
        statusBox.classList.add('hidden');
        return;
    }

    const list = await ensureKaryawanListLoaded();
    if (!list || list.length === 0) return;

    const match = list.find(k => String(k.id_karyawan || '').trim().toUpperCase() === cleanId);
    statusBox.classList.remove('hidden');

    if (match) {
        if (namaInput) namaInput.value = match.nama || '';
        if (match.username) {
            statusBox.className = 'text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all leading-snug bg-amber-50 text-amber-800 border-amber-300';
            statusBox.innerHTML = `<i class="fa-solid fa-circle-info text-amber-600 mr-1"></i> Pegawai <b>${match.nama}</b> sudah memiliki akun (Username: <b>${match.username}</b>). Silakan Login atau gunakan Lupa Password.`;
        } else {
            statusBox.className = 'text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all leading-snug bg-emerald-50 text-emerald-800 border-emerald-300';
            statusBox.innerHTML = `<i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i> ID Terverifikasi: <b>${match.nama}</b> (${match.jabatan || 'Pegawai'}). Nama terisi otomatis!`;
        }
    } else {
        statusBox.className = 'text-[10px] font-extrabold px-3 py-2 rounded-xl border transition-all leading-snug bg-rose-50 text-rose-700 border-rose-200';
        statusBox.innerHTML = `<i class="fa-solid fa-circle-exclamation text-rose-500 mr-1"></i> ID <b>${cleanId}</b> belum ditemukan pada data biometrik Puskesmas.`;
    }
}

function toggleAuth(type) {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('forgot-password-form').classList.add('hidden');

    const tabLogin = document.getElementById('tab-btn-login');
    const tabReg = document.getElementById('tab-btn-register');
    const activeTabCls = "py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all bg-white text-teal-800 shadow-sm border border-teal-200/80";
    const inactiveTabCls = "py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all text-slate-500 hover:text-teal-700";
    
    if (type === 'register') {
        document.getElementById('register-form').classList.remove('hidden');
        if (tabLogin) tabLogin.className = inactiveTabCls;
        if (tabReg) tabReg.className = activeTabCls;
        ensureKaryawanListLoaded();
    } else if (type === 'forgot-password') {
        document.getElementById('forgot-password-form').classList.remove('hidden');
        if (tabLogin) tabLogin.className = inactiveTabCls;
        if (tabReg) tabReg.className = inactiveTabCls;
    } else {
        document.getElementById('login-form').classList.remove('hidden');
        if (tabLogin) tabLogin.className = activeTabCls;
        if (tabReg) tabReg.className = inactiveTabCls;
    }
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if(!username || !password) return showPortalToast('Mohon isi Username dan Password terlebih dahulu.', 'warning', 'Data Belum Lengkap');

    // Cegah double-submit
    const btn = document.querySelector('#login-form button');
    const origText = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa...'; }

    try {
        const res = await fetch(`${API_BASE}/pegawai/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username, password})
        });
        const data = await res.json();

        if (res.status === 429) {
            const menit = data.retry_after_minutes || 15;
            alert(`Terlalu banyak percobaan login.\n\nCoba lagi dalam ${menit} menit.\n(Sistem membatasi percobaan login untuk keamanan)`);
            return;
        }

        if(data.success) {
            localStorage.setItem('pegawai_session', JSON.stringify(data.data));
            localStorage.setItem('pegawai_token', data.token);
            const remEl = document.getElementById('remember-username');
            if (!remEl || remEl.checked) {
                localStorage.setItem('saved_pegawai_username', username);
                localStorage.setItem('saved_pegawai_label', data.data?.nama || username);
            } else {
                localStorage.removeItem('saved_pegawai_username');
                localStorage.removeItem('saved_pegawai_label');
            }
            showPortalToast(`Selamat datang kembali, ${data.data?.nama || username}!`, 'success', 'Login Berhasil');
            showDashboard(data.data);
        } else {
            showPortalToast(data.message || 'Username atau password tidak sesuai.', 'error', 'Gagal Masuk');
        }
    } catch (e) {
        if (e instanceof TypeError) {
            alert('Tidak dapat terhubung ke server.\n\nPastikan:\n- Server biometrik sedang berjalan\n- Koneksi jaringan Anda aktif\n\nHubungi Admin jika masalah berlanjut.');
        } else {
            alert('Gagal koneksi ke server: ' + e.message);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = origText || 'Masuk'; }
    }
}

async function register() {
    const id_karyawan = document.getElementById('reg-id').value.toUpperCase();
    const nama = document.getElementById('reg-nama').value.toUpperCase();
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    
    if(!id_karyawan || !nama || !username || !password) return showPortalToast('Mohon lengkapi seluruh kolom pendaftaran.', 'warning', 'Data Belum Lengkap');
    
    try {
        const res = await fetch(`${API_BASE}/pegawai/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id_karyawan, nama, username, password})
        });
        const data = await res.json();
        showPortalToast(data.message, data.success ? 'success' : 'error', data.success ? 'Registrasi Berhasil' : 'Registrasi Gagal');
        if(data.success) {
            localStorage.setItem('saved_pegawai_username', username);
            localStorage.setItem('saved_pegawai_label', nama);
            const loginInput = document.getElementById('login-username');
            if (loginInput) loginInput.value = username;
            toggleAuth('login');
        }
    } catch (e) {
        showPortalToast('Gagal terhubung ke server biometrik.', 'error', 'Koneksi Bermasalah');
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
    localStorage.removeItem('pegawai_token');
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
        const resFoto = await fetch(`${API_BASE}/karyawan/${user.id_karyawan}?_t=${Date.now()}`, { headers: getAuthHeader() });
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
    
    // Define classes for Luxury Floating Capsule Dock
    const inactiveClass = "nav-dock-btn active:scale-95";
    const activeClass = "nav-dock-btn nav-dock-btn-active active:scale-95";
    
    // Profil classes
    const profilInactiveClass = inactiveClass;
    const profilActiveClass = activeClass;

    // Reset Nav States
    navBeranda.className = inactiveClass;
    navRiwayat.className = inactiveClass;
    if(navProfil) navProfil.className = profilInactiveClass;
    
    // Setup slide directions based on tab order (Beranda 0, Riwayat 1, Profil 2)
    const tabs = ['beranda', 'riwayat', 'profil'];
    const currentTabId = !dashPage.classList.contains('hidden') ? 0 : (!riwayatPage.classList.contains('hidden') ? 1 : 2);
    const newTabId = tabs.indexOf(tabName);
    const isForward = newTabId > currentTabId;

    // Clean all leftover slide transform classes so pages never clip or tear
    [dashPage, riwayatPage, profilPage].forEach(p => {
        if (p) p.classList.remove('slide-in-center', 'slide-out-left', 'slide-out-right');
    });

    if (tabName === 'beranda') {
        navBeranda.className = activeClass;
        riwayatPage.classList.add('hidden');
        if (profilPage) profilPage.classList.add('hidden');
        dashPage.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'instant' });
        const session = localStorage.getItem('pegawai_session');
        if (session) {
            const user = JSON.parse(session);
            loadDashboardData(user.id_karyawan);
        }
    } else if (tabName === 'riwayat') {
        navRiwayat.className = activeClass;
        dashPage.classList.add('hidden');
        if (profilPage) profilPage.classList.add('hidden');
        riwayatPage.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (!isRiwayatLoaded) {
            const session = localStorage.getItem('pegawai_session');
            if (session) {
                const user = JSON.parse(session);
                loadRiwayatBulanan(user.id_karyawan);
            }
        }
    } else if (tabName === 'profil') {
        if (navProfil) navProfil.className = profilActiveClass;
        dashPage.classList.add('hidden');
        riwayatPage.classList.add('hidden');
        if (profilPage) {
            profilPage.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'instant' });
            const session = localStorage.getItem('pegawai_session');
            if (session) {
                const user = JSON.parse(session);
                const pNama = document.getElementById('profil-nama');
                if (pNama) pNama.textContent = user.nama;
                const pJabatan = document.getElementById('profil-jabatan');
                if (pJabatan) pJabatan.textContent = user.jabatan || 'Pegawai';
                const pId = document.getElementById('profil-id');
                if (pId) pId.textContent = user.id_karyawan;
                if (typeof isRiwayatLoaded !== 'undefined' && !isRiwayatLoaded) {
                    loadRiwayatBulanan(user.id_karyawan);
                }
                const imgNode = document.getElementById('user-foto');
                if (imgNode && !imgNode.classList.contains('hidden')) {
                    document.getElementById('profil-foto').src = imgNode.src;
                    document.getElementById('profil-foto').classList.remove('hidden');
                    document.getElementById('profil-foto-icon').classList.add('hidden');
                }
            }
        }
    }
}

async function loadRiwayatBulanan(idKaryawan) {
    const container = document.getElementById('riwayat-container');
    try {
        const res = await fetch(`${API_BASE}/riwayat/rekap/${idKaryawan}?_t=${Date.now()}`, { headers: getAuthHeader() });
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
            renderRiwayatChart([]);
            return;
        }
        
        // Format bulan
        const formatBulan = (periode) => {
            if(!periode) return "Tidak Diketahui";
            const [y, m] = periode.split('-');
            const date = new Date(y, m - 1);
            return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
        };

        const formatBulanShort = (periode) => {
            if(!periode) return "-";
            const [y, m] = periode.split('-');
            const date = new Date(y, m - 1);
            return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        };
        
        // === HITUNG RINGKASAN KUMULATIF DI ATAS RIWAYAT ===
        let kumHadir = 0;
        let kumAlpa = 0;
        let kumIsc = 0;
        result.data.forEach(it => {
            kumHadir += Number(it.total_masuk || 0) + Number(it.total_dl || 0);
            kumAlpa += Number(it.alpa || 0);
            kumIsc += Number(it.total_izin || 0) + Number(it.total_sakit || 0) + Number(it.total_cuti || 0);
        });
        const kumTotal = kumHadir + kumAlpa;
        const kumPct = kumTotal > 0 ? Math.round((kumHadir / kumTotal) * 100) : 100;
        const elKumBulan = document.getElementById('kumulatif-bulan');
        const elKumHadir = document.getElementById('kumulatif-hadir');
        const elKumPersen = document.getElementById('kumulatif-persen');
        if (elKumBulan) elKumBulan.textContent = result.data.length + ' Bulan';
        if (elKumHadir) elKumHadir.textContent = kumHadir + ' Hari';
        if (elKumPersen) elKumPersen.textContent = kumPct + '%';

        // === RENDER SUMMARY CARDS (original cards style) ===
        let html = '';
        result.data.forEach(item => {
            html += `
            <div class="rounded-[1.5rem] p-5 shadow-[0_14px_35px_-10px_rgba(13,148,136,0.16)] border border-teal-200/80 hover:-translate-y-1 transition-transform duration-300 relative overflow-hidden" style="background: linear-gradient(155deg, #ffffff 0%, #f8fafc 55%, #f0fdfa 100%);">
                <div class="absolute top-0 left-0 right-0 h-1" style="background: linear-gradient(90deg, #10b981, #0d9488, #0284c7);"></div>
                <div class="flex justify-between items-center mb-4 pb-3 border-b border-teal-100/80">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 text-white rounded-xl flex items-center justify-center border border-teal-300/60 shadow-[0_6px_14px_-3px_rgba(13,148,136,0.4)]" style="background: linear-gradient(135deg, #0d9488, #0284c7);">
                            <i class="fa-solid fa-calendar-check text-lg"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-teal-950 text-sm uppercase tracking-widest">${formatBulan(item.periode)}</h4>
                            <p class="text-[10px] text-teal-700 font-extrabold tracking-wider mt-0.5"><span class="bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md">${item.total_hari_kerja || 0} Hari</span> <span class="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-mono ml-1">${item.total_jam_kerja || 0} Jam</span></p>
                        </div>
                    </div>
                    <button type="button" onclick="openSlipModalForMonth('${item.periode}')" class="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider text-white shadow-sm flex items-center gap-1 active:scale-95 transition-all" style="background: linear-gradient(135deg, #0d9488, #0284c7);">
                        <i class="fa-solid fa-file-invoice text-amber-200"></i> Slip
                    </button>
                </div>
                
                <div class="grid grid-cols-4 gap-3 text-center">
                    <div class="bg-gradient-to-br from-emerald-50 to-emerald-100/60 rounded-xl p-2.5 border border-emerald-200/50 shadow-[0_4px_12px_rgba(16,185,129,0.15)] hover:shadow-[0_6px_16px_rgba(16,185,129,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-emerald-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-check-double text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-emerald-600/80 uppercase tracking-widest mb-0.5 relative z-10">Hadir</p>
                        <p class="text-sm font-black text-emerald-600 relative z-10">${item.total_masuk}</p>
                    </div>
                    <div class="bg-gradient-to-br from-rose-50 to-rose-100/60 rounded-xl p-2.5 border border-rose-200/50 shadow-[0_4px_12px_rgba(244,63,94,0.15)] hover:shadow-[0_6px_16px_rgba(244,63,94,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-rose-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-triangle-exclamation text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-rose-600/80 uppercase tracking-widest mb-0.5 relative z-10">Alpa</p>
                        <p class="text-sm font-black text-rose-600 relative z-10">${item.alpa}</p>
                    </div>
                    <div class="bg-gradient-to-br from-blue-50 to-blue-100/60 rounded-xl p-2.5 border border-blue-200/50 shadow-[0_4px_12px_rgba(59,130,246,0.15)] hover:shadow-[0_6px_16px_rgba(59,130,246,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-blue-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-suitcase-medical text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-blue-600/80 uppercase tracking-widest mb-0.5 relative z-10">I/S/C/DL</p>
                        <p class="text-sm font-black text-blue-600 relative z-10">${Number(item.total_izin||0) + Number(item.total_sakit||0) + Number(item.total_cuti||0) + Number(item.total_dl||0)}</p>
                    </div>
                    <div class="bg-gradient-to-br from-red-50 to-red-100/60 rounded-xl p-2.5 border border-red-200/50 shadow-[0_4px_12px_rgba(239,68,68,0.15)] hover:shadow-[0_6px_16px_rgba(239,68,68,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-red-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-door-open text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-red-600/80 uppercase tracking-widest mb-0.5 relative z-10">Tanpa Plg</p>
                        <p class="text-sm font-black text-red-600 relative z-10">${item.tanpa_absen_pulang || 0}</p>
                    </div>
                    <div class="bg-gradient-to-br from-amber-50 to-amber-100/60 rounded-xl p-2.5 border border-amber-200/50 shadow-[0_4px_12px_rgba(245,158,11,0.15)] hover:shadow-[0_6px_16px_rgba(245,158,11,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-amber-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-clock-rotate-left text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-amber-600/80 uppercase tracking-widest mb-0.5 relative z-10">Telat (X)</p>
                        <p class="text-sm font-black text-amber-600 relative z-10">${item.telat_kali || 0}</p>
                    </div>
                    <div class="bg-gradient-to-br from-orange-50 to-orange-100/60 rounded-xl p-2.5 border border-orange-200/50 shadow-[0_4px_12px_rgba(249,115,22,0.15)] hover:shadow-[0_6px_16px_rgba(249,115,22,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-orange-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-stopwatch text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-orange-600/80 uppercase tracking-widest mb-0.5 relative z-10">Telat (M)</p>
                        <p class="text-sm font-black text-orange-600 relative z-10">${item.telat_menit || 0}</p>
                    </div>
                    <div class="bg-gradient-to-br from-purple-50 to-purple-100/60 rounded-xl p-2.5 border border-purple-200/50 shadow-[0_4px_12px_rgba(168,85,247,0.15)] hover:shadow-[0_6px_16px_rgba(168,85,247,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-purple-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-person-running text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-purple-600/80 uppercase tracking-widest mb-0.5 relative z-10">PSW (X)</p>
                        <p class="text-sm font-black text-purple-600 relative z-10">${item.psw_kali || 0}</p>
                    </div>
                    <div class="bg-gradient-to-br from-fuchsia-50 to-fuchsia-100/60 rounded-xl p-2.5 border border-fuchsia-200/50 shadow-[0_4px_12px_rgba(217,70,239,0.15)] hover:shadow-[0_6px_16px_rgba(217,70,239,0.3)] transition-shadow duration-300 relative overflow-hidden group">
                        <div class="absolute -right-2 -top-2 text-fuchsia-500/10 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-12"><i class="fa-solid fa-hourglass-end text-4xl"></i></div>
                        <p class="text-[8px] font-bold text-fuchsia-600/80 uppercase tracking-widest mb-0.5 relative z-10">PSW (M)</p>
                        <p class="text-sm font-black text-fuchsia-600 relative z-10">${item.psw_menit || 0}</p>
                    </div>
                </div>
            </div>`;
        });
        
        container.innerHTML = html;
        isRiwayatLoaded = true;

        // === RENDER TABLE RIWAYAT REKAP BULANAN ===
        const tableBody = document.getElementById('riwayat-table-tbody');
        if (tableBody) {
            // Sort chronologically (oldest first)
            const sortedData = [...result.data].sort((a, b) => {
                if (!a.periode || !b.periode) return 0;
                return a.periode.localeCompare(b.periode);
            });

            let tableHtml = '';
            sortedData.forEach((item, idx) => {
                const isc = Number(item.total_izin||0) + Number(item.total_sakit||0) + Number(item.total_cuti||0) + Number(item.total_dl||0);
                const alpa = Number(item.alpa||0);
                const telatK = Number(item.telat_kali||0);
                const telatM = Number(item.telat_menit||0);
                const pswK = Number(item.psw_kali||0);
                const pswM = Number(item.psw_menit||0);
                const tap = Number(item.tanpa_absen_pulang||0);

                const isEven = idx % 2 === 0;
                const rowBg = isEven ? 'bg-white' : 'bg-slate-50/50';

                tableHtml += `
                <tr class="${rowBg} hover:bg-teal-50/50 transition-colors duration-200">
                    <td class="p-3 text-center font-black text-teal-800 whitespace-nowrap sticky left-0 z-10 border-r border-teal-100/70 ${rowBg}">${formatBulanShort(item.periode)}</td>
                    <td class="p-3 text-center font-black text-emerald-600 border-r border-teal-100/70">${item.total_masuk || 0}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${alpa > 0 ? 'text-rose-600 bg-rose-50/60' : 'text-slate-400'}">${alpa}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${isc > 0 ? 'text-sky-600 bg-sky-50/50' : 'text-slate-400'}">${isc}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${telatK > 0 ? 'text-amber-600 bg-amber-50/60' : 'text-slate-400'}">${telatK}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${telatM > 0 ? 'text-orange-600 bg-orange-50/60' : 'text-slate-400'}">${telatM}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${pswK > 0 ? 'text-purple-600 bg-purple-50/60' : 'text-slate-400'}">${pswK}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${pswM > 0 ? 'text-fuchsia-600 bg-fuchsia-50/60' : 'text-slate-400'}">${pswM}</td>
                    <td class="p-3 text-center font-black border-r border-teal-100/70 ${tap > 0 ? 'text-red-600 bg-red-50/60' : 'text-slate-400'}">${tap}</td>
                    <td class="p-3 text-center font-black text-teal-800 whitespace-nowrap font-mono text-[10px] bg-teal-50/30">${item.total_jam_kerja || '00:00:00'}</td>
                </tr>`;
            });
            
            tableBody.innerHTML = tableHtml;

            // Hitung Total Kumulatif pada Footer Tabel Riwayat
            const tableFoot = document.getElementById('riwayat-table-tfoot');
            if (tableFoot) {
                let sumH = 0, sumA = 0, sumI = 0, sumTK = 0, sumTM = 0, sumPK = 0, sumPM = 0, sumTAP = 0;
                sortedData.forEach(it => {
                    sumH += Number(it.total_masuk || 0);
                    sumA += Number(it.alpa || 0);
                    sumI += Number(it.total_izin || 0) + Number(it.total_sakit || 0) + Number(it.total_cuti || 0) + Number(it.total_dl || 0);
                    sumTK += Number(it.telat_kali || 0);
                    sumTM += Number(it.telat_menit || 0);
                    sumPK += Number(it.psw_kali || 0);
                    sumPM += Number(it.psw_menit || 0);
                    sumTAP += Number(it.tanpa_absen_pulang || 0);
                });
                tableFoot.innerHTML = `
                    <tr>
                        <td class="p-2.5 text-center font-black text-amber-300 sticky left-0 z-30 border-r border-teal-700/60" style="background: #042f2e;">Total</td>
                        <td class="p-2.5 text-center text-emerald-300 border-r border-teal-700/60">${sumH}</td>
                        <td class="p-2.5 text-center text-rose-300 border-r border-teal-700/60">${sumA}</td>
                        <td class="p-2.5 text-center text-sky-300 border-r border-teal-700/60">${sumI}</td>
                        <td class="p-2.5 text-center text-amber-300 border-r border-teal-700/60">${sumTK}</td>
                        <td class="p-2.5 text-center text-orange-300 border-r border-teal-700/60 font-mono">${sumTM}m</td>
                        <td class="p-2.5 text-center text-purple-300 border-r border-teal-700/60">${sumPK}</td>
                        <td class="p-2.5 text-center text-fuchsia-300 border-r border-teal-700/60 font-mono">${sumPM}m</td>
                        <td class="p-2.5 text-center text-red-300 border-r border-teal-700/60">${sumTAP}</td>
                        <td class="p-2.5 text-center text-teal-200 font-mono text-[9px]">${sortedData.length} Bln</td>
                    </tr>
                `;
            }

            // Show table card with animation
            const tableCard = document.getElementById('riwayat-table-card');
            if (tableCard) {
                tableCard.classList.remove('hidden');
                setTimeout(() => tableCard.classList.remove('opacity-0'), 50);
            }
        }
        
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

// Global variable untuk menyimpan instance chart & mode analitik
let riwayatChartInstance = null;
let cachedRiwayatData = [];
function renderRiwayatChart(data) {
    cachedRiwayatData = Array.isArray(data) ? data : [];
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
    
    // Pertahankan warna gradien utama Emerald-Teal-Ocean pada header agar tampilan Beranda selalu segar & elegan
    
    if(xpEl && pangkatEl) {
        xpEl.innerHTML = `${userXP} <span class="text-xs text-teal-400">XP</span>`;
        pangkatEl.textContent = rankInfo.title;
        pangkatEl.className = 'px-3 py-1 text-[11px] font-bold rounded-full inline-block ' + rankInfo.color;
        if(notesEl) notesEl.textContent = rankInfo.notes;
    }

    // Update Lencana Pangkat, XP & Grade langsung di Header Beranda
    const berandaPangkatEl = document.getElementById('beranda-pangkat-text');
    const berandaXpEl = document.getElementById('beranda-xp-text');


    // Update Progress Bar Level XP & 5-Tier Roadmap di halaman Profil
    const xpBarEl = document.getElementById('profil-xp-bar');
    const nextRankLbl = document.getElementById('profil-next-rank-label');
    const nextRankTarget = document.getElementById('profil-next-rank-target');
    let nextTargetXP = 180;
    let nextRankName = 'Legend Teladan 👑';
    let currentTierIdx = 1;
    if (userXP > 180) {
        nextTargetXP = 200;
        nextRankName = 'Level Maksimal Tercapai 👑';
        currentTierIdx = 5;
    } else if (userXP > 130) {
        nextTargetXP = 181;
        nextRankName = 'Menuju Legend Teladan 👑';
        currentTierIdx = 4;
    } else if (userXP > 80) {
        nextTargetXP = 131;
        nextRankName = 'Menuju Bintang Puskesmas ⭐';
        currentTierIdx = 3;
    } else if (userXP >= 10) {
        nextTargetXP = 81;
        nextRankName = 'Menuju Pegawai Andalan 🚀';
        currentTierIdx = 2;
    } else {
        nextTargetXP = 10;
        nextRankName = 'Menuju Pegawai Aktif 🎖️';
        currentTierIdx = 1;
    }
    const xpPct = currentTierIdx === 5 ? 100 : Math.min(100, Math.round((userXP / nextTargetXP) * 100));
    if (xpBarEl) xpBarEl.style.width = xpPct + '%';
    if (nextRankLbl) nextRankLbl.innerHTML = '<i class="fa-solid fa-bolt text-amber-500"></i> ' + nextRankName;
    if (nextRankTarget) nextRankTarget.textContent = currentTierIdx === 5 ? (userXP + ' XP (MAX)') : (userXP + ' / ' + nextTargetXP + ' XP');
    for (let t = 1; t <= 5; t++) {
        const pill = document.getElementById('tier-pill-' + t);
        if (!pill) continue;
        if (t === currentTierIdx) {
            pill.className = 'rounded-lg py-1 px-0.5 border border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100/90 text-[7px] font-black text-teal-950 shadow-sm scale-105 transition-all';
        } else if (t < currentTierIdx) {
            pill.className = 'rounded-lg py-1 px-0.5 border border-emerald-200 bg-emerald-50/70 text-[7px] font-extrabold text-emerald-700 transition-all';
        } else {
            pill.className = 'rounded-lg py-1 px-0.5 border border-slate-200 bg-white/80 text-[7px] font-extrabold text-slate-400 transition-all';
        }
    }

    // Update 4-Pillar Evaluasi Kedisiplinan 360° di halaman Profil
    const sumChart = totalHadir + totalAlpa + totalIzinDll;
    const hadirScore = sumChart > 0 ? Math.min(100, Math.round(((totalHadir + totalIzinDll) / sumChart) * 100)) : 100;
    const tepatScore = totalHadir > 0 ? Math.max(0, Math.round(((totalHadir - totalTelat) / totalHadir) * 100)) : 100;
    const pulangScore = totalHadir > 0 ? Math.max(0, Math.round(((totalHadir - totalPSW - totalTAP) / totalHadir) * 100)) : 100;
    const integritasScore = Math.round((hadirScore + tepatScore + pulangScore) / 3);
    const setPillar = (idPct, idBar, val) => {
        const pEl = document.getElementById(idPct);
        const bEl = document.getElementById(idBar);
        if (pEl) pEl.textContent = val + '%';
        if (bEl) bEl.style.width = val + '%';
    };
    setPillar('pillar-hadir-pct', 'pillar-hadir-bar', hadirScore);
    setPillar('pillar-tepat-pct', 'pillar-tepat-bar', tepatScore);
    setPillar('pillar-pulang-pct', 'pillar-pulang-bar', pulangScore);
    setPillar('pillar-integritas-pct', 'pillar-integritas-bar', integritasScore);
    renderAchievementBadges({ hadir: totalHadir, alpa: totalAlpa, telat: totalTelat, psw: totalPSW, tap: totalTAP, integritas: integritasScore, xp: userXP });
    renderRiwayatInsights(cachedRiwayatData, currentPeriode);

    if(!window.Chart) return;
    const ctx = document.getElementById('riwayatChart');
    if(!ctx) return;
    
    if(riwayatChartInstance) {
        riwayatChartInstance.destroy();
    }

    if (Array.isArray(data) && data.length > 0) {
        const sorted = [...data].sort((a, b) => (a.periode || '').localeCompare(b.periode || '')).slice(-6);
        const labels = sorted.map(it => {
            if (!it.periode) return '-';
            const [y, m] = it.periode.split('-');
            return new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
        });
        riwayatChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Hadir',
                        data: sorted.map(it => Number(it.total_masuk || 0)),
                        backgroundColor: '#10b981',
                        borderRadius: 6
                    },
                    {
                        label: 'I/S/C/DL',
                        data: sorted.map(it => Number(it.total_izin || 0) + Number(it.total_sakit || 0) + Number(it.total_cuti || 0) + Number(it.total_dl || 0)),
                        backgroundColor: '#0ea5e9',
                        borderRadius: 6
                    },
                    {
                        label: 'Alpa',
                        data: sorted.map(it => Number(it.alpa || 0)),
                        backgroundColor: '#f43f5e',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 10,
                            usePointStyle: true,
                            font: { family: "'Plus Jakarta Sans', sans-serif", size: 10, weight: 'bold' }
                        }
                    }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0, font: { size: 9 } } },
                    x: { ticks: { font: { size: 9, weight: 'bold' } } }
                }
            }
        });
        return;
    }

}

// ========================
// LENCANA PENCAPAIAN (PROFIL) & INSIGHT CERDAS (RIWAYAT)
// ========================
function renderAchievementBadges(s) {
    const grid = document.getElementById('profil-badge-grid');
    const countEl = document.getElementById('profil-badge-count');
    if (!grid) return;
    const defs = [
        { icon: 'fa-bullseye', title: 'Nol Alpa', hint: 'Tanpa Alpa bulan ini', ok: s.hadir > 0 && s.alpa === 0, tone: 'emerald' },
        { icon: 'fa-clock', title: 'Tepat Waktu', hint: 'Tanpa terlambat', ok: s.hadir > 0 && s.telat === 0, tone: 'amber' },
        { icon: 'fa-door-open', title: 'Pulang Disiplin', hint: 'Tanpa PSW & TAP', ok: s.hadir > 0 && s.psw === 0 && s.tap === 0, tone: 'sky' },
        { icon: 'fa-fire', title: 'Rajin 20 Hari', hint: s.hadir + ' / 20 hari hadir', ok: s.hadir >= 20, tone: 'rose' },
        { icon: 'fa-shield-halved', title: 'Integritas Emas', hint: 'Skor integritas ' + s.integritas + '% (min 90%)', ok: s.hadir > 0 && s.integritas >= 90, tone: 'teal' },
        { icon: 'fa-crown', title: 'Legend Teladan', hint: s.xp + ' / 181 XP', ok: s.xp > 180, tone: 'amber' }
    ];
    const toneMap = {
        emerald: ['#d1fae5', '#10b981', '#065f46'],
        amber: ['#fef3c7', '#f59e0b', '#92400e'],
        sky: ['#e0f2fe', '#0ea5e9', '#075985'],
        rose: ['#ffe4e6', '#f43f5e', '#9f1239'],
        teal: ['#ccfbf1', '#14b8a6', '#115e59']
    };
    let unlocked = 0;
    grid.innerHTML = defs.map(d => {
        if (d.ok) unlocked++;
        const t = toneMap[d.tone];
        if (d.ok) {
            return '<div class="rounded-2xl p-2.5 text-center border shadow-sm" style="background: linear-gradient(145deg, #ffffff, ' + t[0] + '); border-color: ' + t[1] + '66;">' +
                '<div class="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-white text-base shadow-md" style="background: linear-gradient(135deg, ' + t[1] + ', ' + t[2] + ');"><i class="fa-solid ' + d.icon + '"></i></div>' +
                '<p class="mt-1.5 text-[9px] font-black uppercase tracking-wider leading-tight" style="color: ' + t[2] + ';">' + d.title + '</p>' +
                '<p class="text-[8px] font-bold text-emerald-700 mt-0.5"><i class="fa-solid fa-circle-check"></i> Diraih</p></div>';
        }
        return '<div class="rounded-2xl p-2.5 text-center border border-slate-200 bg-slate-50/80">' +
            '<div class="w-10 h-10 mx-auto rounded-xl flex items-center justify-center text-slate-400 text-base bg-slate-200/80"><i class="fa-solid fa-lock"></i></div>' +
            '<p class="mt-1.5 text-[9px] font-black uppercase tracking-wider leading-tight text-slate-500">' + d.title + '</p>' +
            '<p class="text-[8px] font-semibold text-slate-400 mt-0.5 leading-tight">' + d.hint + '</p></div>';
    }).join('');
    if (countEl) countEl.textContent = unlocked + ' / ' + defs.length;
}

function renderRiwayatInsights(data, currentPeriode) {
    const box = document.getElementById('riwayat-insight-box');
    if (!box) return;
    if (!Array.isArray(data) || data.length === 0) { box.innerHTML = ''; return; }
    const n = v => Number(v || 0);
    const bulanLabel = (periode) => {
        if (!periode) return '-';
        const p = periode.split('-');
        return new Date(p[0], p[1] - 1).toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
    };
    const sorted = [...data].sort((a, b) => (a.periode || '').localeCompare(b.periode || ''));
    let curIdx = sorted.findIndex(i => i.periode === currentPeriode);
    if (curIdx < 0) curIdx = sorted.length - 1;
    const cur = sorted[curIdx];
    const prev = curIdx > 0 ? sorted[curIdx - 1] : null;

    let best = sorted[0];
    sorted.forEach(it => {
        if (n(it.total_masuk) > n(best.total_masuk) || (n(it.total_masuk) === n(best.total_masuk) && n(it.telat_kali) < n(best.telat_kali))) best = it;
    });
    const avgHadir = (sorted.reduce((a, it) => a + n(it.total_masuk), 0) / sorted.length).toFixed(1).replace('.', ',');

    const diffTile = (title, curVal, prevVal, goodWhenUp, unit) => {
        if (prevVal === null) {
            return '<div class="rounded-xl p-2.5 border border-slate-200 bg-slate-50"><p class="text-[8px] font-extrabold uppercase tracking-wider text-slate-500">' + title + '</p><p class="text-[11px] font-black text-slate-500 mt-1">Belum ada pembanding</p></div>';
        }
        const d = curVal - prevVal;
        const same = d === 0;
        const good = goodWhenUp ? d > 0 : d < 0;
        const color = same ? '#475569' : (good ? '#047857' : '#be123c');
        const bg = same ? '#f1f5f9' : (good ? '#ecfdf5' : '#fff1f2');
        const bd = same ? '#cbd5e1' : (good ? '#a7f3d0' : '#fecdd3');
        const icon = same ? 'fa-equals' : (d > 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down');
        const txt = same ? 'Sama dgn bln lalu' : (d > 0 ? '+' + d : String(d)) + ' ' + unit + ' vs bln lalu';
        return '<div class="rounded-xl p-2.5 border" style="background: ' + bg + '; border-color: ' + bd + ';"><p class="text-[8px] font-extrabold uppercase tracking-wider" style="color: ' + color + ';">' + title + '</p>' +
            '<p class="text-[11px] font-black mt-1 leading-tight" style="color: ' + color + ';"><i class="fa-solid ' + icon + ' mr-1"></i>' + txt + '</p></div>';
    };

    box.innerHTML =
        diffTile('Kehadiran', n(cur.total_masuk), prev ? n(prev.total_masuk) : null, true, 'hari') +
        diffTile('Keterlambatan', n(cur.telat_kali), prev ? n(prev.telat_kali) : null, false, 'kali') +
        '<div class="rounded-xl p-2.5 border border-amber-200" style="background: #fffbeb;"><p class="text-[8px] font-extrabold uppercase tracking-wider text-amber-800"><i class="fa-solid fa-trophy mr-1"></i>Bulan Terbaik</p>' +
        '<p class="text-[11px] font-black text-amber-950 mt-1 leading-tight">' + bulanLabel(best.periode) + ' &bull; ' + n(best.total_masuk) + ' hari</p></div>' +
        '<div class="rounded-xl p-2.5 border border-sky-200" style="background: #f0f9ff;"><p class="text-[8px] font-extrabold uppercase tracking-wider text-sky-800"><i class="fa-solid fa-chart-simple mr-1"></i>Rata-Rata Hadir</p>' +
        '<p class="text-[11px] font-black text-sky-950 mt-1 leading-tight">' + avgHadir + ' hari / bulan</p></div>';
}

function toggleSkeleton(enable) {
    // Dinonaktifkan agar kartu gradien di Beranda tidak berkedip kotak abu-abu (patah-patah) saat memuat data
}

let liveDurationTimer = null;
let currentTodayMasuk = null;
let currentTodayPulang = null;

function parseTimeToMinutes(timeStr) {
    if (!timeStr || timeStr === '-' || timeStr === '--:--') return null;
    const parts = String(timeStr).trim().split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

function updateLiveWorkDuration() {
    const dotEl = document.getElementById('today-duration-dot');
    const labelEl = document.getElementById('today-duration-label');
    const valEl = document.getElementById('today-duration-val');
    const boxEl = document.getElementById('today-duration-box');
    const shiftBarEl = document.getElementById('today-shift-bar');
    const shiftSchedEl = document.getElementById('today-shift-schedule');
    const shiftPctEl = document.getElementById('today-shift-pct');
    if (!dotEl || !labelEl || !valEl || !boxEl) return;

    // Tentukan jadwal standar Puskesmas berdasarkan hari
    const nowDay = new Date().getDay(); // 0=Min, 5=Jum, 6=Sab
    let targetPulangStr = '14:00';
    let targetShiftMinutes = 390; // 07:30 -> 14:00 (6.5 jam = 390 menit)
    if (nowDay === 5) { targetPulangStr = '11:30'; targetShiftMinutes = 240; }
    else if (nowDay === 6) { targetPulangStr = '13:00'; targetShiftMinutes = 330; }
    if (shiftSchedEl) {
        shiftSchedEl.innerHTML = nowDay === 0
            ? '<i class="fa-regular fa-calendar-check mr-1"></i>Hari Minggu / Libur Reguler'
            : `<i class="fa-regular fa-clock mr-1"></i>Standar Shift: 07:30 - ${targetPulangStr} WIB`;
    }

    const masukMin = parseTimeToMinutes(currentTodayMasuk);
    const pulangMin = parseTimeToMinutes(currentTodayPulang);

    if (masukMin === null) {
        dotEl.className = 'w-2 h-2 rounded-full bg-slate-400';
        labelEl.textContent = 'Durasi Kerja Hari Ini';
        valEl.textContent = 'Belum Mulai';
        valEl.className = 'text-xs font-black text-slate-600 font-mono bg-white/90 px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-inner';
        boxEl.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
        if (shiftBarEl) shiftBarEl.style.width = '0%';
        if (shiftPctEl) shiftPctEl.textContent = '0% Shift';
        return;
    }

    if (pulangMin !== null && pulangMin >= masukMin) {
        const diff = pulangMin - masukMin;
        const hrs = String(Math.floor(diff / 60)).padStart(2, '0');
        const mins = String(diff % 60).padStart(2, '0');
        dotEl.className = 'w-2 h-2 rounded-full bg-sky-500';
        labelEl.textContent = 'Total Durasi Hari Ini';
        valEl.textContent = `${hrs}j ${mins}m (Selesai)`;
        valEl.className = 'text-xs font-black text-sky-900 font-mono bg-white/95 px-2.5 py-0.5 rounded-lg border border-sky-200 shadow-inner';
        boxEl.style.background = 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)';
        if (shiftBarEl) shiftBarEl.style.width = '100%';
        if (shiftPctEl) shiftPctEl.textContent = '100% Selesai ✓';
        return;
    }

    // Sedang bertugas (live)
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const diff = Math.max(0, nowMin - masukMin);
    const hrs = String(Math.floor(diff / 60)).padStart(2, '0');
    const mins = String(diff % 60).padStart(2, '0');
    const pctShift = Math.min(100, Math.round((diff / targetShiftMinutes) * 100));
    dotEl.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-ping';
    labelEl.textContent = 'Sedang Bertugas (Live)';
    valEl.textContent = `⏱️ ${hrs}j ${mins}m`;
    valEl.className = 'text-xs font-black text-emerald-900 font-mono bg-white/95 px-2.5 py-0.5 rounded-lg border border-emerald-300 shadow-inner';
    boxEl.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #ccfbf1 100%)';
    if (shiftBarEl) shiftBarEl.style.width = pctShift + '%';
    if (shiftPctEl) {
        const targetPulangMin = parseTimeToMinutes(targetPulangStr) || 840;
        if (nowMin < targetPulangMin) {
            const sisaM = targetPulangMin - nowMin;
            const sJ = Math.floor(sisaM / 60);
            const sM = sisaM % 60;
            const cdTxt = (sJ > 0 ? sJ + 'j ' : '') + sM + 'm lagi pulang';
            shiftPctEl.innerHTML = '<span class="text-amber-800 font-bold bg-amber-100/90 px-1.5 py-0.5 rounded-md"><i class="fa-solid fa-hourglass-half mr-1 text-amber-600"></i>' + cdTxt + '</span> <span class="ml-1 text-teal-950 font-mono">' + pctShift + '%</span>';
        } else {
            shiftPctEl.innerHTML = '<span class="text-emerald-800 font-bold bg-emerald-100 px-1.5 py-0.5 rounded-md"><i class="fa-solid fa-circle-check mr-1 text-emerald-600"></i>Waktunya Pulang!</span> <span class="ml-1 text-teal-950 font-mono">' + pctShift + '%</span>';
        }
    }
}

async function refreshTodayData() {
    const icon = document.getElementById('icon-refresh-today');
    if (icon) icon.classList.add('fa-spin');
    const session = localStorage.getItem('pegawai_session');
    if (session) {
        const user = JSON.parse(session);
        await loadDashboardData(user.id_karyawan);
    }
    setTimeout(() => {
        if (icon) icon.classList.remove('fa-spin');
    }, 500);
}

async function loadDashboardData(idKaryawan) {
    toggleSkeleton(true);
    try {
        const res = await fetch(`${API_BASE}/pegawai/dashboard/today/${idKaryawan}?_t=${Date.now()}`, { headers: getAuthHeader() });
        const result = await res.json();
        const syncEl = document.getElementById('today-sync-time');
        if (syncEl) {
            const nowT = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            syncEl.innerHTML = `<i class="fa-solid fa-circle-check text-teal-500 text-[8px]"></i> Sinkron: ${nowT} WIB`;
        }
        if(result.success && result.data) {
            toggleSkeleton(false);
            const elMasuk = document.getElementById('today-masuk');
            const elStatus = document.getElementById('today-status');
            currentTodayMasuk = result.data.jam_masuk ? result.data.jam_masuk.slice(0, 5) : null;
            currentTodayPulang = result.data.jam_keluar ? result.data.jam_keluar.slice(0, 5) : null;
            elMasuk.textContent = currentTodayMasuk || '--:--';
            document.getElementById('today-pulang').textContent = currentTodayPulang || '--:--';
            elStatus.textContent = result.data.status || 'Hadir';
            
            // Kalau telat, buat merah menyala; kalau tepat waktu, hijau zamrud
            if (result.data.status && result.data.status.toLowerCase().includes('telat')) {
                elMasuk.classList.add('text-rose-600', 'font-black');
                elStatus.style.background = 'linear-gradient(135deg, #ffe4e6, #fecdd3)';
                elStatus.className = 'mt-3 text-center text-xs font-black text-rose-800 py-3 rounded-xl shadow-sm uppercase tracking-widest transition-all duration-300 border border-rose-300 relative z-10';
            } else {
                elMasuk.classList.remove('text-rose-600', 'font-black');
                elStatus.style.background = 'linear-gradient(135deg, #d1fae5, #a7f3d0)';
                elStatus.className = 'mt-3 text-center text-xs font-black text-emerald-900 py-3 rounded-xl shadow-sm uppercase tracking-widest transition-all duration-300 border border-emerald-300 relative z-10';
            }
        } else {
            currentTodayMasuk = null;
            currentTodayPulang = null;
        }
        updateLiveWorkDuration();
        if (liveDurationTimer) clearInterval(liveDurationTimer);
        liveDurationTimer = setInterval(updateLiveWorkDuration, 30000);
    } catch(e) {}

    // Load Rekap Bulanan dari API yang sudah ada
    try {
        const res = await fetch(`${API_BASE}/rekap/bulanan?_t=${Date.now()}`, { headers: getAuthHeader() });
        const result = await res.json();
        if(result.success) {
            const myData = result.data.find(d => String(d.id_karyawan).trim().toLowerCase() === String(idKaryawan).trim().toLowerCase());
            if (myData) {
                const hadirCount = parseInt(myData.total_masuk) || 0;
                const alpaCount = parseInt(myData.alpa) || 0;
                const dlCount = parseInt(myData.total_dl) || 0;
                const iscCount = (parseInt(myData.total_izin)||0) + (parseInt(myData.total_sakit)||0) + (parseInt(myData.total_cuti)||0);
                document.getElementById('rekap-hadir').textContent = hadirCount;
                document.getElementById('rekap-alpa').textContent = alpaCount;
                const badgeAlpaInfo = document.getElementById('badge-alpa-info');
                if (badgeAlpaInfo) {
                    if (alpaCount === 0) {
                        badgeAlpaInfo.textContent = 'Bebas Alpa ✓';
                        badgeAlpaInfo.className = 'text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider';
                    } else {
                        badgeAlpaInfo.textContent = alpaCount + ' Hari Alpa';
                        badgeAlpaInfo.className = 'text-[8px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 uppercase tracking-wider';
                    }
                }

                // Hitung total hari kerja (Senin-Sabtu) dalam bulan berjalan
                const nowDate = new Date();
                const totalDaysMonth = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate();
                let targetHariKerja = 0;
                for (let dIdx = 1; dIdx <= totalDaysMonth; dIdx++) {
                    if (new Date(nowDate.getFullYear(), nowDate.getMonth(), dIdx).getDay() !== 0) targetHariKerja++;
                }
                const efektifHadir = hadirCount + dlCount;
                const pctCapaian = targetHariKerja > 0 ? Math.min(100, Math.round((efektifHadir / targetHariKerja) * 100)) : 0;
                const elPct = document.getElementById('rekap-hadir-pct');
                const elRasio = document.getElementById('rekap-hadir-rasio');
                const elBar = document.getElementById('rekap-hadir-bar');
                if (elPct) elPct.textContent = pctCapaian + '%';
                if (elRasio) elRasio.textContent = efektifHadir + ' / ' + targetHariKerja + ' Hari Kerja';
                if (elBar) setTimeout(() => { elBar.style.width = pctCapaian + '%'; }, 100);

                // Proyeksi & Target Akhir Bulan (Sen-Sab)
                try {
                    const todayDow = nowDate.getDay();
                    const todayNum = nowDate.getDate();
                    let sisaKerja = 0;
                    for (let dIdx = todayNum + 1; dIdx <= totalDaysMonth; dIdx++) {
                        if (new Date(nowDate.getFullYear(), nowDate.getMonth(), dIdx).getDay() !== 0) sisaKerja++;
                    }
                    const belumMasukHariIni = (typeof currentTodayMasuk === 'undefined' || !currentTodayMasuk || currentTodayMasuk === '-' || currentTodayMasuk === '--:--');
                    if (todayDow !== 0 && belumMasukHariIni) sisaKerja++;
                    const lewatKerja = Math.max(0, targetHariKerja - sisaKerja);
                    const rate = lewatKerja > 0 ? Math.min(1, efektifHadir / lewatKerja) : 1;
                    const proyeksiHari = Math.min(targetHariKerja, Math.round(efektifHadir + rate * sisaKerja));
                    const proyeksiPct = targetHariKerja > 0 ? Math.round((proyeksiHari / targetHariKerja) * 100) : 0;
                    const butuh = Math.max(0, Math.ceil(targetHariKerja * 0.9) - efektifHadir);
                    const elSisa = document.getElementById('proy-sisa');
                    const elAkhir = document.getElementById('proy-akhir');
                    const elTarget = document.getElementById('proy-target');
                    if (elSisa) elSisa.textContent = sisaKerja + ' Hari';
                    if (elAkhir) elAkhir.textContent = proyeksiPct + '%';
                    if (elTarget) {
                        if (butuh === 0) { elTarget.textContent = 'Tercapai ✓'; elTarget.style.color = '#6ee7b7'; }
                        else if (butuh > sisaKerja) { elTarget.textContent = 'Terlewati'; elTarget.style.color = '#fda4af'; }
                        else { elTarget.textContent = '+' + butuh + ' Hari'; elTarget.style.color = '#fde68a'; }
                    }
                } catch (e) { /* proyeksi bersifat tambahan, abaikan jika gagal */ }
                document.getElementById('rekap-telat').textContent = myData.telat_kali || 0;
                
                const izinCutiOnly = (parseInt(myData.total_izin) || 0) + (parseInt(myData.total_cuti) || 0);
                const sakitOnly = parseInt(myData.total_sakit) || 0;
                const dlOnly = parseInt(myData.total_dl) || 0;
                document.getElementById('rekap-isc').textContent = izinCutiOnly;
                if (document.getElementById('rekap-sakit')) {
                    document.getElementById('rekap-sakit').textContent = sakitOnly;
                }
                if (document.getElementById('rekap-dl')) {
                    document.getElementById('rekap-dl').textContent = dlOnly;
                }
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
        const res = await fetch(`${API_BASE}/absensi/bulanan/matrix?periode=${periode}&_t=${Date.now()}`, { cache: 'no-store', headers: getAuthHeader() });
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

            // Hitung Rata-Rata Jam Masuk & Jam Pulang serta Total Footer Bulan Ini
            let sumMasukMin = 0, cntMasuk = 0;
            let sumPulangMin = 0, cntPulang = 0;
            let sumPswMenit = 0, sumTelatMenit = 0;
            Object.values(historyMap).forEach(rec => {
                if (!rec) return;
                const mMin = parseTimeToMinutes(rec.jam_masuk ? rec.jam_masuk.slice(0, 5) : null);
                const pMin = parseTimeToMinutes(rec.jam_keluar ? rec.jam_keluar.slice(0, 5) : null);
                if (mMin !== null) { sumMasukMin += mMin; cntMasuk++; }
                if (pMin !== null && !(rec.keterangan && rec.keterangan.includes('Otomatis'))) { sumPulangMin += pMin; cntPulang++; }
                sumPswMenit += Number(rec.psw_menit || 0);
                sumTelatMenit += Number(rec.telat_menit || 0);
            });
            const elTfootHadir = document.getElementById('tfoot-total-hadir');
            const elTfootPsw = document.getElementById('tfoot-total-psw');
            const elTfootTelat = document.getElementById('tfoot-total-telat');
            if (elTfootHadir) elTfootHadir.textContent = cntMasuk + ' Hari Hadir';
            if (elTfootPsw) elTfootPsw.textContent = sumPswMenit + 'm';
            if (elTfootTelat) elTfootTelat.textContent = sumTelatMenit + 'm';
            const fmtMin = (totalM, count) => {
                if (!count) return '--:--';
                const avg = Math.round(totalM / count);
                return String(Math.floor(avg / 60)).padStart(2, '0') + ':' + String(avg % 60).padStart(2, '0') + ' WIB';
            };
            const elAvgMasuk = document.getElementById('avg-jam-masuk');
            const elAvgPulang = document.getElementById('avg-jam-pulang');
            if (elAvgMasuk) elAvgMasuk.textContent = fmtMin(sumMasukMin, cntMasuk);
            if (elAvgPulang) elAvgPulang.textContent = fmtMin(sumPulangMin, cntPulang);

            const namaHariList = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
            const isCurrentMonth = (parseInt(year) === now.getFullYear()) && (parseInt(month) === (now.getMonth() + 1));

            // Render Strip Jejak Presensi Pekan Ini (Senin - Sabtu) jika sedang memuat bulan berjalan
            if (isCurrentMonth) {
                const streakGrid = document.getElementById('weekly-streak-grid');
                const streakBadge = document.getElementById('weekly-streak-badge');
                if (streakGrid) {
                    const todayDow = now.getDay(); // 0=Min, 1=Sen, ...
                    const diffToMonday = todayDow === 0 ? -6 : (1 - todayDow);
                    const mondayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
                    let streakHtml = '';
                    let hadirPekanIni = 0;
                    const labelHari6 = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
                    for (let w = 0; w < 6; w++) {
                        const dCheck = new Date(mondayDate.getFullYear(), mondayDate.getMonth(), mondayDate.getDate() + w);
                        const dNum = dCheck.getDate();
                        const isSameMonth = dCheck.getMonth() === now.getMonth();
                        const isTodayW = isSameMonth && dNum === now.getDate();
                        const recW = isSameMonth ? historyMap[dNum] : null;
                        let boxCls = 'bg-slate-50 border-slate-200 text-slate-400';
                        let iconHtml = '<i class="fa-solid fa-minus text-[8px]"></i>';
                        if (recW) {
                            if (recW.status === 'IZIN' || recW.status === 'SAKIT' || recW.status === 'CUTI' || recW.status === 'DL' || recW.status === 'DINAS_LUAR') {
                                boxCls = 'bg-sky-50 border-sky-200 text-sky-700';
                                iconHtml = '<i class="fa-solid fa-suitcase-medical text-[9px]"></i>';
                                hadirPekanIni++;
                            } else if (recW.jam_masuk && recW.jam_masuk !== '-') {
                                hadirPekanIni++;
                                const telatW = (recW.telat_menit && recW.telat_menit > 0) || (recW.status && recW.status.toLowerCase().includes('telat'));
                                if (telatW) {
                                    boxCls = 'bg-amber-50 border-amber-300 text-amber-800';
                                    iconHtml = '<i class="fa-solid fa-clock text-[9px] text-amber-600"></i>';
                                } else {
                                    boxCls = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                                    iconHtml = '<i class="fa-solid fa-circle-check text-[9px] text-emerald-600"></i>';
                                }
                            }
                        } else if (isSameMonth && alpaDates.has(dNum)) {
                            boxCls = 'bg-rose-50 border-rose-200 text-rose-700';
                            iconHtml = '<i class="fa-solid fa-circle-xmark text-[9px] text-rose-500"></i>';
                        }
                        const ringToday = isTodayW ? 'ring-2 ring-teal-500 shadow-sm' : '';
                        streakHtml += `
                            <div class="rounded-xl p-1.5 border ${boxCls} ${ringToday} flex flex-col items-center justify-center gap-0.5 transition-all">
                                <span class="text-[8px] font-black uppercase tracking-wider">${labelHari6[w]}</span>
                                ${iconHtml}
                                <span class="text-[8px] font-mono font-bold opacity-80">${String(dNum).padStart(2, '0')}</span>
                            </div>`;
                    }
                    streakGrid.innerHTML = streakHtml;
                    if (streakBadge) streakBadge.textContent = hadirPekanIni + ' / 6 Hari Aktif';
                }
            }

            for (let i = 1; i <= 31; i++) {
                if (i > daysInMonth) {
                    continue;
                }

                const dateObj = new Date(year, targetDate.getMonth(), i);
                const dayOfWeek = dateObj.getDay();
                const namaHari = namaHariList[dayOfWeek];
                const isSunday = dayOfWeek === 0;
                const isToday = isCurrentMonth && (i === now.getDate());
                const rowIdAttr = isToday ? 'id="daily-row-today"' : '';
                const todayRowCls = isToday
                    ? 'bg-gradient-to-r from-emerald-50 via-teal-50/95 to-sky-50 ring-2 ring-inset ring-teal-500/80 shadow-sm relative z-10'
                    : 'hover:bg-teal-50/40 transition-colors even:bg-slate-50/60';
                const dayNameCls = isSunday
                    ? 'text-rose-600 bg-rose-100/80 border-rose-200'
                    : (isToday ? 'text-teal-900 bg-amber-200/90 border-amber-300' : 'text-teal-700 bg-teal-50 border-teal-200/60');
                const todayBadge = isToday
                    ? '<span class="block mt-0.5 px-1.5 py-0.2 rounded bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[7px] font-black uppercase tracking-wider shadow-sm">Hari Ini</span>'
                    : '';
                const tglCellHtml = `
                    <div class="flex flex-col items-center justify-center leading-tight">
                        <div class="flex items-center gap-1">
                            <span class="text-xs font-black ${isSunday ? 'text-rose-600' : 'text-teal-950'}">${String(i).padStart(2, '0')}</span>
                            <span class="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded border ${dayNameCls}">${namaHari}</span>
                        </div>
                        ${todayBadge}
                    </div>`;

                const d = historyMap[i];
                if (d) {
                    if (d.status === 'IZIN' || d.status === 'SAKIT' || d.status === 'CUTI' || d.status === 'DL' || d.status === 'DINAS_LUAR') {
                        const badgeMap = {
                            'IZIN': 'bg-amber-50 text-amber-700 border-amber-200',
                            'CUTI': 'bg-amber-50 text-amber-700 border-amber-200',
                            'SAKIT': 'bg-sky-50 text-sky-700 border-sky-200',
                            'DL': 'bg-violet-50 text-violet-700 border-violet-200',
                            'DINAS_LUAR': 'bg-violet-50 text-violet-700 border-violet-200'
                        };
                        const badgeCls = badgeMap[d.status] || 'bg-teal-50 text-teal-700 border-teal-200';
                        let specificTag = 'ISC';
                        if (d.status === 'DL' || d.status === 'DINAS_LUAR') specificTag = 'DL ISC';
                        else if (d.status === 'SAKIT') specificTag = 'SAKIT ISC';
                        else if (d.status === 'IZIN' || d.status === 'CUTI') specificTag = 'IZIN_CUTI ISC';
                        html += `
                            <tr ${rowIdAttr} data-row-tags="${specificTag}" class="daily-metric-row border-b border-teal-100/60 ${todayRowCls}">
                                <td class="p-2 border-r border-teal-100/60 text-center bg-teal-50/30">${tglCellHtml}</td>
                                <td class="p-2 border-r border-teal-100/60 text-center" colspan="2"><span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider border ${badgeCls}">${d.status}</span></td>
                                <td class="p-2 border-r border-teal-100/60 text-center text-slate-300">-</td>
                                <td class="p-2 text-center text-slate-300">-</td>
                            </tr>
                        `;
                        continue;
                    }

                    const masuk = d.jam_masuk && d.jam_masuk !== '-' ? d.jam_masuk.slice(0, 5) : '-';
                    let pulang = d.jam_keluar && d.jam_keluar !== '-' ? d.jam_keluar.slice(0, 5) : '-';
                    
                    if ((masuk !== '-' && pulang === '-') || (d.keterangan && (d.keterangan.includes('Otomatis') || d.keterangan.includes('Tanpa Absen Pulang')))) {
                        pulang = '<span class="bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider border border-rose-200 shadow-sm">TAP</span>';
                    } else if (pulang !== '-') {
                        pulang = `<span class="bg-sky-50 text-sky-700 px-2 py-0.5 rounded-md font-bold text-[11px] border border-sky-200/80">${pulang}</span>`;
                    }

                    const psw = (d.psw_menit && d.psw_menit > 0) ? `<span class="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded font-bold text-[10px] border border-purple-200/70">P:${d.psw_menit}m</span>` : `<span class="text-slate-300">-</span>`;
                    const telat = (d.telat_menit && d.telat_menit > 0) ? `<span class="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold text-[10px] border border-amber-200/70">T:${d.telat_menit}m</span>` : `<span class="text-slate-300">-</span>`;
                    
                    const isTelat = d.status && d.status.toLowerCase().includes('telat');
                    const masukHTML = masuk === '-' ? '<span class="text-slate-300">-</span>' : (isTelat ? `<span class="bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md font-bold text-[11px] border border-rose-200/80">${masuk}</span>` : `<span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold text-[11px] border border-emerald-200/80">${masuk}</span>`);
                    const rowTags = ['HADIR'];
                    if (isTelat || (d.telat_menit && d.telat_menit > 0)) rowTags.push('TELAT');
                    if (d.psw_menit && d.psw_menit > 0) rowTags.push('PSW');
                    if ((masuk !== '-' && (d.jam_keluar === '-' || !d.jam_keluar)) || (d.keterangan && (d.keterangan.includes('Otomatis') || d.keterangan.includes('Tanpa Absen Pulang')))) rowTags.push('TAP');
                    
                    html += `
                        <tr ${rowIdAttr} data-row-tags="${rowTags.join(' ')}" class="daily-metric-row border-b border-teal-100/60 ${todayRowCls}">
                            <td class="p-2 border-r border-teal-100/60 text-center bg-teal-50/35">${tglCellHtml}</td>
                            <td class="p-2 border-r border-teal-100/60 text-center">${masukHTML}</td>
                            <td class="p-2 border-r border-teal-100/60 text-center font-medium">${pulang}</td>
                            <td class="p-2 border-r border-teal-100/60 text-center">${psw}</td>
                            <td class="p-2 text-center">${telat}</td>
                        </tr>
                    `;
                } else {
                    const isFuture = dateObj > now && !isToday;
                    
                    let bg = isToday ? todayRowCls : '';
                    let info = '<span class="text-slate-300">-</span>';
                    
                    if (isToday) {
                        info = '<span class="bg-teal-100/80 text-teal-800 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border border-teal-300">BELUM PRESENSI</span>';
                    } else if (isFuture) {
                        bg = 'bg-slate-50/40';
                    } else if (isSunday) {
                        bg = 'bg-rose-50/35';
                        info = '<span class="bg-rose-50 text-rose-500 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-widest border border-rose-200/70">MINGGU / LIBUR</span>';
                    } else if (INDONESIA_HOLIDAYS[`${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`]) {
                        const holName = INDONESIA_HOLIDAYS[`${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`];
                        bg = 'bg-rose-50/40';
                        info = `<span class="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border border-rose-200 shadow-sm"><i class="fa-solid fa-flag mr-1 text-rose-500"></i>${holName}</span>`;
                    } else if (alpaDates.has(i)) {
                        info = '<span class="bg-rose-100 text-rose-600 px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-widest border border-rose-200 shadow-sm">ALPA</span>';
                    }

                    const emptyTag = alpaDates.has(i) ? 'ALPA' : 'NONE';
                    html += `
                        <tr ${rowIdAttr} data-row-tags="${emptyTag}" class="daily-metric-row border-b border-slate-200/80 ${bg} even:bg-slate-50/50">
                            <td class="p-2 border-r border-slate-200/80 text-center">${tglCellHtml}</td>
                            <td class="p-2 text-center" colspan="4">${info}</td>
                        </tr>
                    `;
                }
            }
            // Render Kalender Visual Interaktif (Heatmap Bulanan)
            const calGrid = document.getElementById('daily-calendar-grid');
            if (calGrid) {
                const firstDow = new Date(year, targetDate.getMonth(), 1).getDay(); // 0=Min, 1=Sen...
                const leadEmpty = firstDow === 0 ? 6 : (firstDow - 1); // Senin sebagai kolom pertama
                let calHtml = '';
                for (let eIdx = 0; eIdx < leadEmpty; eIdx++) {
                    calHtml += `<div class="cal-day-cell bg-slate-50/50 border border-dashed border-slate-200/70"></div>`;
                }
                for (let dIdx = 1; dIdx <= daysInMonth; dIdx++) {
                    const dObj = new Date(year, targetDate.getMonth(), dIdx);
                    const dow = dObj.getDay();
                    const isSun = dow === 0;
                    const isTod = isCurrentMonth && (dIdx === now.getDate());
                    const isFut = dObj > now && !isTod;
                    const recD = historyMap[dIdx];
                    const namaH = namaHariList[dow];
                    const tglLabel = `${namaH}, ${String(dIdx).padStart(2, '0')}-${month}-${year}`;

                    let cellBg = 'bg-slate-50 border-slate-200 text-slate-500';
                    let subTxt = '-';
                    let detailMasuk = '--:--';
                    let detailPulang = '--:--';
                    let detailStatus = 'Belum Ada Data';

                    if (recD) {
                        detailMasuk = recD.jam_masuk && recD.jam_masuk !== '-' ? recD.jam_masuk.slice(0, 5) : '--:--';
                        detailPulang = recD.jam_keluar && recD.jam_keluar !== '-' ? recD.jam_keluar.slice(0, 5) : '--:--';
                        if (recD.status === 'IZIN' || recD.status === 'SAKIT' || recD.status === 'CUTI' || recD.status === 'DL' || recD.status === 'DINAS_LUAR') {
                            cellBg = 'bg-sky-50 border-sky-300 text-sky-900';
                            subTxt = recD.status === 'DINAS_LUAR' ? 'DL' : recD.status;
                            detailStatus = `Status: ${recD.status}`;
                        } else if (detailMasuk !== '--:--') {
                            const isT = (recD.telat_menit && recD.telat_menit > 0) || (recD.status && recD.status.toLowerCase().includes('telat'));
                            if (isT) {
                                cellBg = 'bg-amber-50 border-amber-300 text-amber-900';
                                subTxt = detailMasuk;
                                detailStatus = `Hadir (Telat ${recD.telat_menit || 0}m)`;
                            } else {
                                cellBg = 'bg-emerald-50 border-emerald-300 text-emerald-900';
                                subTxt = detailMasuk;
                                detailStatus = 'Hadir Tepat Waktu ✓';
                            }
                        }
                    } else if (isTod) {
                        cellBg = 'bg-teal-50 border-teal-400 text-teal-900';
                        subTxt = 'Hari Ini';
                        detailStatus = 'Hari Ini (Belum Scan)';
                    } else if (!isFut && INDONESIA_HOLIDAYS[`${String(month).padStart(2, '0')}-${String(dIdx).padStart(2, '0')}`] && (!recD || detailMasuk === '--:--')) {
                        const hName = INDONESIA_HOLIDAYS[`${String(month).padStart(2, '0')}-${String(dIdx).padStart(2, '0')}`];
                        cellBg = 'bg-rose-50 border-rose-300 text-rose-800';
                        subTxt = 'Libur';
                        detailStatus = 'Libur Nasional: ' + hName;
                    } else if (!isFut && isSun) {
                        cellBg = 'bg-rose-50/70 border-rose-200 text-rose-600';
                        subTxt = 'Libur';
                        detailStatus = 'Minggu / Libur Reguler';
                    } else if (!isFut && alpaDates.has(dIdx)) {
                        cellBg = 'bg-rose-100 border-rose-300 text-rose-800';
                        subTxt = 'ALPA';
                        detailStatus = 'Tanpa Keterangan (Alpa)';
                    }

                    const todayRing = isTod ? 'ring-2 ring-teal-600 shadow-sm' : '';
                    const safeTitle = tglLabel.replace(/'/g, '');
                    const safeStat = detailStatus.replace(/'/g, '');
                    calHtml += `
                        <button type="button" onclick="showCalendarDayDetail('${safeTitle}', '${detailMasuk}', '${detailPulang}', '${safeStat}')" class="cal-day-cell p-1 border ${cellBg} ${todayRing} flex flex-col items-center justify-between text-center cursor-pointer">
                            <span class="text-[10px] font-black ${isSun ? 'text-rose-600' : ''}">${String(dIdx).padStart(2, '0')}</span>
                            <span class="text-[8px] font-mono font-extrabold tracking-tighter truncate w-full px-0.5 rounded bg-white/70">${subTxt}</span>
                        </button>
                    `;
                }
                calGrid.innerHTML = calHtml;
            }
        } else {
            html = `<tr><td colspan="5" class="text-center p-4 text-slate-400">Gagal memuat data</td></tr>`;
        }
        tbody.innerHTML = html;
        
    } catch (e) {
        console.error("Error daily metrics:", e);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-4 text-rose-500 text-xs">Koneksi Error</td></tr>`;
    }
}

function switchDailyViewMode(mode) {
    const tblCard = document.getElementById('daily-table-card');
    const calCard = document.getElementById('daily-calendar-card');
    const btnTbl = document.getElementById('btn-view-table');
    const btnCal = document.getElementById('btn-view-calendar');
    if (!tblCard || !calCard || !btnTbl || !btnCal) return;

    const activeStyle = 'background: linear-gradient(135deg, #047857, #0d9488);';
    const activeCls = 'py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-white shadow-sm flex items-center justify-center gap-1.5';
    const inactiveCls = 'py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all text-teal-800 hover:bg-teal-50 flex items-center justify-center gap-1.5';

    if (mode === 'calendar') {
        tblCard.classList.add('hidden');
        calCard.classList.remove('hidden');
        btnCal.className = activeCls;
        btnCal.setAttribute('style', activeStyle);
        btnTbl.className = inactiveCls;
        btnTbl.removeAttribute('style');
    } else {
        calCard.classList.add('hidden');
        tblCard.classList.remove('hidden');
        btnTbl.className = activeCls;
        btnTbl.setAttribute('style', activeStyle);
        btnCal.className = inactiveCls;
        btnCal.removeAttribute('style');
    }
}

function showCalendarDayDetail(title, masuk, pulang, statusText) {
    const tEl = document.getElementById('cal-detail-title');
    const sEl = document.getElementById('cal-detail-sub');
    const bEl = document.getElementById('cal-detail-badge');
    if (tEl) tEl.textContent = title;
    if (sEl) sEl.textContent = `${statusText} • Masuk: ${masuk} | Pulang: ${pulang}`;
    if (bEl) bEl.textContent = `${masuk} - ${pulang}`;
}

function copyBiometricId() {
    const idVal = document.getElementById('profil-id')?.textContent || document.getElementById('user-id')?.textContent || '';
    if (!idVal || idVal === 'ID') return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(idVal).then(() => {
            showPortalToast(`ID Biometrik (${idVal}) berhasil disalin ke papan klip.`, 'success', 'ID Disalin');
        }).catch(() => {
            showPortalToast(`ID Biometrik Anda: ${idVal}`, 'info', 'ID Biometrik');
        });
    } else {
        showPortalToast(`ID Biometrik Anda: ${idVal}`, 'info', 'ID Biometrik');
    }
}

function toggleEidFlip() {
    const front = document.getElementById('eid-front');
    const back = document.getElementById('eid-back');
    const lbl = document.getElementById('eid-flip-label');
    const qrBox = document.getElementById('eid-qr-svg');
    if (!front || !back) return;
    if (qrBox && !qrBox.innerHTML) {
        const uid = document.getElementById('profil-id')?.textContent || 'BIO';
        const unama = document.getElementById('profil-nama')?.textContent || 'PEGAWAI';
        qrBox.innerHTML = generateDeterministicQrSvg(`EID-${uid}-${unama}`);
    }
    if (back.classList.contains('hidden')) {
        front.classList.add('hidden');
        back.classList.remove('hidden');
        if (lbl) lbl.textContent = 'Tampak Depan';
    } else {
        back.classList.add('hidden');
        front.classList.remove('hidden');
        if (lbl) lbl.textContent = 'Balik Kartu';
    }
}

function openSlipModalForMonth(periodeStr) {
    if (!periodeStr) return openSlipModal();
    const match = (cachedRiwayatData || []).find(it => it.periode === periodeStr);
    if (!match) return openSlipModal();

    const modal = document.getElementById('slip-modal');
    const content = document.getElementById('slip-modal-content');
    if (!modal || !content) return;

    const session = localStorage.getItem('pegawai_session');
    const user = session ? JSON.parse(session) : {};
    const [y, m] = periodeStr.split('-');
    const bulanStr = new Date(y, m - 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('slip-periode', 'Periode: ' + bulanStr);
    setTxt('slip-nama', user.nama || document.getElementById('user-nama')?.textContent || '-');
    setTxt('slip-id', user.id_karyawan || document.getElementById('user-id')?.textContent || '-');
    setTxt('slip-jabatan', user.jabatan || document.getElementById('user-jabatan')?.textContent || 'Pegawai');
    setTxt('slip-pangkat', document.getElementById('beranda-pangkat-text')?.textContent || 'Pegawai Aktif');

    setTxt('slip-hadir', (match.total_masuk || 0) + ' Hari');
    setTxt('slip-dl', (match.total_dl || 0) + ' Hari');
    const izinCuti = (parseInt(match.total_izin) || 0) + (parseInt(match.total_cuti) || 0);
    setTxt('slip-isc', izinCuti + ' Hari');
    setTxt('slip-sakit', (match.total_sakit || 0) + ' Hari');
    setTxt('slip-alpa', (match.alpa || 0) + ' Hari');
    setTxt('slip-telat', `${match.telat_kali || 0}x (${match.telat_menit || 0} Menit)`);
    setTxt('slip-psw', `${match.psw_kali || 0}x (${match.psw_menit || 0} Menit)`);
    setTxt('slip-tap', (match.tanpa_absen_pulang || 0) + ' Kali');
    setTxt('slip-jam', match.total_jam_kerja || '00:00:00');

    const qrSlip = document.getElementById('slip-qr-svg');
    if (qrSlip) qrSlip.innerHTML = generateDeterministicQrSvg(`SLIP-${user.id_karyawan || 'ID'}-${periodeStr}`);

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

function openSlipModal() {
    const modal = document.getElementById('slip-modal');
    const content = document.getElementById('slip-modal-content');
    if (!modal || !content) return;

    const session = localStorage.getItem('pegawai_session');
    const user = session ? JSON.parse(session) : {};
    const now = new Date();
    const bulanStr = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setTxt('slip-periode', 'Periode: ' + bulanStr);
    setTxt('slip-nama', user.nama || document.getElementById('user-nama')?.textContent || '-');
    setTxt('slip-id', user.id_karyawan || document.getElementById('user-id')?.textContent || '-');
    setTxt('slip-jabatan', user.jabatan || document.getElementById('user-jabatan')?.textContent || 'Pegawai');
    setTxt('slip-pangkat', document.getElementById('beranda-pangkat-text')?.textContent || 'Pegawai Aktif');

    setTxt('slip-hadir', (document.getElementById('rekap-hadir')?.textContent || '0') + ' Hari');
    setTxt('slip-dl', (document.getElementById('rekap-dl')?.textContent || '0') + ' Hari');
    const izinCuti = parseInt(document.getElementById('rekap-isc')?.textContent) || 0;
    const sakitOnly = parseInt(document.getElementById('rekap-sakit')?.textContent) || 0;
    setTxt('slip-isc', izinCuti + ' Hari');
    setTxt('slip-sakit', sakitOnly + ' Hari');
    setTxt('slip-alpa', (document.getElementById('rekap-alpa')?.textContent || '0') + ' Hari');
    setTxt('slip-telat', `${document.getElementById('rekap-telat')?.textContent || '0'}x (${document.getElementById('rekap-telat-menit')?.textContent || '0'} Menit)`);
    setTxt('slip-psw', `${document.getElementById('rekap-psw-kali')?.textContent || '0'}x (${document.getElementById('rekap-psw-menit')?.textContent || '0'} Menit)`);
    setTxt('slip-tap', (document.getElementById('rekap-tap')?.textContent || '0') + ' Kali');
    setTxt('slip-jam', document.getElementById('rekap-jam-kerja')?.textContent || '00:00:00');

    const qrSlip = document.getElementById('slip-qr-svg');
    if (qrSlip) qrSlip.innerHTML = generateDeterministicQrSvg(`SLIP-${user.id_karyawan || 'ID'}-${bulanStr}`);

    modal.classList.remove('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

function closeSlipModal() {
    const modal = document.getElementById('slip-modal');
    const content = document.getElementById('slip-modal-content');
    if (!modal || !content) return;
    modal.classList.add('opacity-0', 'pointer-events-none');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');
}

function filterDailyTableByStatus(tag) {
    const rows = document.querySelectorAll('.daily-metric-row');
    const banner = document.getElementById('daily-filter-banner');
    const label = document.getElementById('daily-filter-label');
    const tableCard = document.getElementById('daily-table-card');
    if (!rows.length) return;

    const labelMap = {
        'HADIR': 'Hari Kehadiran (Hadir)',
        'ALPA': 'Hari Tanpa Keterangan (Alpa)',
        'IZIN_CUTI': 'Hari Izin / Cuti',
        'SAKIT': 'Hari Sakit',
        'DL': 'Hari Dinas Luar (DL)',
        'ISC': 'Izin / Sakit / Cuti / Dinas Luar',
        'TELAT': 'Hari Terlambat (Telat)',
        'PSW': 'Pulang Sebelum Waktu (PSW)',
        'TAP': 'Tanpa Absen Pulang (TAP)'
    };

    switchDailyViewMode('table');
    if (!tag || tag === 'ALL') {
        rows.forEach(r => r.classList.remove('hidden'));
        if (banner) banner.classList.add('hidden');
        return;
    }

    rows.forEach(r => {
        const tags = (r.getAttribute('data-row-tags') || '').split(' ');
        if (tags.includes(tag)) {
            r.classList.remove('hidden');
        } else {
            r.classList.add('hidden');
        }
    });

    if (banner && label) {
        label.textContent = labelMap[tag] || tag;
        banner.classList.remove('hidden');
    }
    if (tableCard) {
        tableCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function openPhotoZoomModal() {
    const modal = document.getElementById('photo-zoom-modal');
    const imgEl = document.getElementById('zoom-foto-img');
    const namaEl = document.getElementById('zoom-foto-nama');
    const jabEl = document.getElementById('zoom-foto-jabatan');
    const idEl = document.getElementById('zoom-foto-id');
    if (!modal || !imgEl) return;

    const userFoto = document.getElementById('user-foto');
    const hasCustomFoto = userFoto && !userFoto.classList.contains('hidden') && userFoto.src;
    imgEl.src = hasCustomFoto ? userFoto.src : '/anime.png';
    if (namaEl) namaEl.textContent = document.getElementById('user-nama')?.textContent || 'Pegawai';
    if (jabEl) jabEl.textContent = document.getElementById('user-jabatan')?.textContent || 'Pegawai';
    if (idEl) idEl.textContent = 'ID: ' + (document.getElementById('user-id')?.textContent || '-');

    modal.classList.remove('opacity-0', 'pointer-events-none');
}

function closePhotoZoomModal() {
    const modal = document.getElementById('photo-zoom-modal');
    if (modal) modal.classList.add('opacity-0', 'pointer-events-none');
}

function scrollToTodayMetric() {
    const rowToday = document.getElementById('daily-row-today');
    const scrollContainer = document.getElementById('daily-metrics-scroll');
    if (rowToday && scrollContainer) {
        const topOffset = rowToday.offsetTop - 48;
        scrollContainer.scrollTo({ top: Math.max(0, topOffset), behavior: 'smooth' });
        rowToday.classList.add('animate-pulse');
        setTimeout(() => rowToday.classList.remove('animate-pulse'), 1500);
    } else {
        // Jika sedang memilih bulan lain, kembalikan ke bulan ini
        const now = new Date();
        const curPeriode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const filterInput = document.getElementById('filter-bulan');
        if (filterInput && filterInput.value !== curPeriode) {
            filterInput.value = curPeriode;
            onMonthFilterChange(curPeriode);
        }
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


function shareSlipWhatsApp() {
    const periode = document.getElementById('slip-periode')?.textContent || '';
    const nama = document.getElementById('slip-nama')?.textContent || '';
    const id = document.getElementById('slip-id')?.textContent || '';
    const hadir = document.getElementById('slip-hadir')?.textContent || '0';
    const dl = document.getElementById('slip-dl')?.textContent || '0';
    const isc = document.getElementById('slip-isc')?.textContent || '0';
    const sakit = document.getElementById('slip-sakit')?.textContent || '0';
    const alpa = document.getElementById('slip-alpa')?.textContent || '0';
    const telat = document.getElementById('slip-telat')?.textContent || '0';
    const psw = document.getElementById('slip-psw')?.textContent || '0';
    const tap = document.getElementById('slip-tap')?.textContent || '0';
    const jam = document.getElementById('slip-jam')?.textContent || '00:00:00';
    const instansi = document.querySelector('.dynamic-instansi-nama')?.textContent || 'Puskesmas Wana';

    const text = '*SLIP REKAPITULASI PRESENSI RESMI*\n' +
        '*' + instansi.toUpperCase() + '*\n' +
        '----------------------------------------\n' +
        '👤 *Nama:* ' + nama + '\n' +
        '🆔 *ID Pegawai:* ' + id + '\n' +
        '📅 *' + periode + '*\n' +
        '----------------------------------------\n' +
        '✅ *Hadir:* ' + hadir + '\n' +
        '🚗 *Dinas Luar (DL):* ' + dl + '\n' +
        '📋 *Izin / Cuti:* ' + isc + '\n' +
        '🏥 *Sakit:* ' + sakit + '\n' +
        '❌ *Alpa:* ' + alpa + '\n' +
        '⏰ *Keterlambatan:* ' + telat + '\n' +
        '🏃 *PSW:* ' + psw + '\n' +
        '🚪 *TAP:* ' + tap + '\n' +
        '⏳ *Total Jam Kerja:* ' + jam + '\n' +
        '----------------------------------------\n' +
        '_Dokumen Sah Terverifikasi Portal Biometrik_';

    const adminPhone = '6281991591834';
    window.open('https://wa.me/' + adminPhone + '?text=' + encodeURIComponent(text), '_blank');
}

function hubungiAdminWhatsApp() {
    const nama = document.getElementById('user-nama')?.textContent || 'Pegawai';
    const id = document.getElementById('user-id')?.textContent || '-';
    const instansi = document.querySelector('.dynamic-instansi-nama')?.textContent || 'Puskesmas Wana';
    const text = 'Halo Admin Kepegawaian ' + instansi + ',\n\nSaya ingin konfirmasi kendala presensi biometrik:\n👤 Nama: ' + nama + '\n🆔 ID Pegawai: ' + id + '\n\nKendala / Catatan:\n';
    window.open('https://api.whatsapp.com/send?text=' + encodeURIComponent(text), '_blank');
}
