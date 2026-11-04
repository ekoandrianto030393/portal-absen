/**
 * enterprise_features.js - Modul Enterprise & HRIS Terpadu Puskesmas Wana
 * Menambahkan fitur Command Palette (Ctrl+K), Multi-Theme, Analitik & Leaderboard,
 * Manajemen Jadwal Shift, Simulasi Gaji & Tukin, serta Broadcast WA & Audit Sistem.
 */

(function () {
    const ALL_TABS = [
        'overview', 'daily', 'monthly', 'performance', 'employees', 'scan-portal',
        'view-db', 'view-db-monthly', 'req-password', 'settings',
        'analytics', 'shifts', 'payroll', 'broadcast', 'environment'
    ];

    const TAB_TITLES = {
        'overview': 'Dashboard Overview',
        'daily': 'Laporan Absensi Harian',
        'monthly': 'Rekapitulasi Bulanan',
        'performance': 'Monitoring Kinerja Pegawai',
        'employees': 'Direktori Data Pegawai',
        'scan-portal': 'Tabel Kontrol Scan.html Portal Online (Jadwal Libur)',
        'view-db': 'Data View Absensi Harian',
        'view-db-monthly': 'Data View Absensi Bulanan',
        'req-password': 'Permintaan Ubah Password',
        'settings': 'Pengaturan Sistem',
        'analytics': 'Analitik & Peringkat Kedisiplinan',
        'shifts': 'Manajemen Jadwal & Shift Kerja',
        'payroll': 'Simulasi Gaji, Tukin & Slip Pegawai',
        'broadcast': 'Pusat Pengumuman & Audit Sistem',
        'environment': 'Manajemen Environment & Variabel Sistem (.env)'
    };

    let cachedDailyData = [];
    let cachedEmployees = [];
    let cachedPayrollRows = [];
    let auditLogs = [];

    function logAuditEvent(action, detail, badgeColor = 'emerald') {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        auditLogs.unshift({ time: timeStr, action, detail, badgeColor });
        if (auditLogs.length > 30) auditLogs.pop();
        renderAuditLog();
    }

    // --- 1. OVERRIDE & EXTEND SWITCHTAB ---
    const origSwitchTab = window.switchTab;
    window.switchTab = function (tabName) {
        ALL_TABS.forEach(id => {
            const viewEl = document.getElementById(`view-${id}`);
            if (viewEl) {
                viewEl.classList.add('hidden');
                viewEl.style.display = '';
                viewEl.classList.remove('animate-fade-in-up');
            }
            const navEl = document.getElementById(`nav-${id}`);
            if (navEl) navEl.classList.remove('active');
        });

        const targetView = document.getElementById(`view-${tabName}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.style.display = '';
            void targetView.offsetWidth;
            targetView.classList.add('animate-fade-in-up');
        }
        const targetNav = document.getElementById(`nav-${tabName}`);
        if (targetNav) targetNav.classList.add('active');

        const titleEl = document.getElementById('page-title');
        if (titleEl && TAB_TITLES[tabName]) {
            titleEl.textContent = TAB_TITLES[tabName];
        }

        // Jalankan loader bawaan atau loader enterprise baru
        if (tabName === 'overview' && typeof loadOverviewData === 'function') loadOverviewData();
        if (tabName === 'daily' && typeof loadDailyData === 'function') loadDailyData();
        if (tabName === 'monthly' && typeof loadMonthlyRecap === 'function') loadMonthlyRecap();
        if (tabName === 'performance' && typeof loadPerformanceData === 'function') loadPerformanceData();
        if (tabName === 'employees' && typeof loadEmployees === 'function') loadEmployees();
        if (tabName === 'scan-portal' && typeof loadScanPortalAccessTable === 'function') loadScanPortalAccessTable();
        if (tabName === 'view-db' && typeof loadViewDbData === 'function') loadViewDbData();
        if (tabName === 'view-db-monthly' && typeof loadViewDbMonthlyData === 'function') loadViewDbMonthlyData();
        if (tabName === 'req-password' && typeof loadReqPassword === 'function') loadReqPassword();
        if (tabName === 'analytics') loadEnterpriseAnalytics();
        if (tabName === 'shifts') loadEnterpriseShifts();
        if (tabName === 'payroll') loadEnterprisePayroll();
        if (tabName === 'broadcast') loadEnterpriseBroadcast();
        if (tabName === 'environment' && typeof window.loadEnvData === 'function') window.loadEnvData();

        logAuditEvent('Navigasi Menu', `Membuka halaman ${TAB_TITLES[tabName] || tabName}`, 'blue');
    };

    // --- 2. MULTI-THEME COLOR ENGINE ---
    window.setEnterpriseTheme = function (themeName) {
        if (themeName === 'emerald') {
            document.body.removeAttribute('data-theme');
        } else {
            document.body.setAttribute('data-theme', themeName);
        }
        localStorage.setItem('pkm_enterprise_theme', themeName);
        const names = {
            emerald: 'Emerald Royal (Default)',
            sapphire: 'Sapphire Cyber (Biru Eksekutif)',
            amethyst: 'Amethyst Luxury (Ungu Modern)',
            sunset: 'Sunset Amber (Oranye Hangat)',
            midnight: 'Midnight Command (Gelap)'
        };
        if (typeof showToast === 'function') {
            showToast(`Tema diubah ke: ${names[themeName] || themeName}`, 'success');
        }
        logAuditEvent('Ubah Tema UI', `Mengaktifkan tema ${names[themeName] || themeName}`, 'purple');
    };

    // --- 3. ENHANCED OVERVIEW WIDGETS & SECONDARY KPIS ---
    async function refreshEnterpriseOverviewExtras() {
        try {
            const [resDailyRaw, resEmpRaw] = await Promise.all([
                fetch(`/api/absensi/harian?_t=${Date.now()}`),
                fetch(`/api/karyawan/descriptors?_t=${Date.now()}`)
            ]);
            const jsonDaily = await resDailyRaw.json();
            const jsonEmp = await resEmpRaw.json();

            cachedDailyData = Array.isArray(jsonDaily.data) ? jsonDaily.data : [];
            cachedEmployees = Array.isArray(jsonEmp.descriptors) ? jsonEmp.descriptors : [];

            const totalEmp = cachedEmployees.length;
            const activePresent = cachedDailyData.filter(d => !['IZIN', 'SAKIT', 'CUTI', 'DL', 'DINAS_LUAR', 'LIBUR', 'ALPA'].includes(d.status));
            const dlCount = cachedDailyData.filter(d => ['DL', 'DINAS_LUAR'].includes(d.status)).length;
            const izinSakitCount = cachedDailyData.filter(d => ['IZIN', 'SAKIT'].includes(d.status)).length;
            const cutiCount = cachedDailyData.filter(d => d.status === 'CUTI').length;

            // 1. Persentase Kehadiran
            const rate = totalEmp > 0 ? Math.round(((activePresent.length + dlCount) / totalEmp) * 100) : 0;
            const rateEl = document.getElementById('stat-rate-percent');
            const rateBar = document.getElementById('stat-rate-bar');
            const tickerRate = document.getElementById('ticker-attendance-rate');
            if (rateEl) rateEl.textContent = `${rate}%`;
            if (rateBar) rateBar.style.width = `${Math.min(100, rate)}%`;
            if (tickerRate) tickerRate.textContent = `${activePresent.length}/${totalEmp} Pegawai (${rate}%)`;

            // 2. Breakdown DL / Izin / Sakit / Cuti
            const totalLeave = dlCount + izinSakitCount + cutiCount;
            const leaveTotalEl = document.getElementById('stat-leave-total');
            const leaveBreakEl = document.getElementById('stat-leave-breakdown');
            if (leaveTotalEl) leaveTotalEl.textContent = `${totalLeave} Pegawai`;
            if (leaveBreakEl) {
                leaveBreakEl.innerHTML = `
                    <span class="px-2 py-0.5 rounded bg-white/20">DL: ${dlCount}</span>
                    <span class="px-2 py-0.5 rounded bg-white/20">Izin/Sakit: ${izinSakitCount}</span>
                    <span class="px-2 py-0.5 rounded bg-white/20">Cuti: ${cutiCount}</span>
                `;
            }

            // 3. Rata-rata Jam Masuk & Pegawai Terpagi
            const validCheckins = activePresent.filter(d => d.jam_masuk && /^\d{2}:\d{2}/.test(d.jam_masuk));
            const avgEl = document.getElementById('stat-avg-checkin');
            const earliestEl = document.getElementById('stat-earliest-emp');

            if (validCheckins.length > 0) {
                let totalMins = 0;
                validCheckins.forEach(d => {
                    const parts = d.jam_masuk.split(':');
                    totalMins += parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
                });
                const avgMins = Math.round(totalMins / validCheckins.length);
                const avgH = String(Math.floor(avgMins / 60)).padStart(2, '0');
                const avgM = String(avgMins % 60).padStart(2, '0');
                if (avgEl) avgEl.textContent = `${avgH}:${avgM}`;

                const sortedEarly = [...validCheckins].sort((a, b) => a.jam_masuk.localeCompare(b.jam_masuk));
                const firstEmp = sortedEarly[0];
                if (earliestEl && firstEmp) {
                    earliestEl.innerHTML = `<i class="fa-solid fa-medal text-amber-300 mr-1"></i>Terpagi: <strong>${escapeHtml(firstEmp.nama_karyawan)}</strong> (${firstEmp.jam_masuk.substring(0, 5)})`;
                }
                renderOverviewTopEarly(sortedEarly.slice(0, 5));
            } else {
                if (avgEl) avgEl.textContent = '--:--';
                if (earliestEl) earliestEl.innerHTML = `<i class="fa-solid fa-clock mr-1"></i>Belum ada data jam masuk hari ini`;
                renderOverviewTopEarly([]);
            }

            // 4. Status Akun Portal Online Pegawai
            const portalAccountCount = cachedEmployees.filter(e => !!e.username).length;
            const bioEl = document.getElementById('stat-biometric-ready');
            if (bioEl) bioEl.textContent = `${portalAccountCount} Terdaftar`;

            // 5. Render Distribusi Jabatan
            renderOverviewJabatanDistribution(cachedEmployees, cachedDailyData);

            // 6. Update Shift Aktif di Ticker
            updateActiveShiftTicker();
        } catch (err) {
            console.error('Enterprise overview extras error:', err);
        }
    }

    function updateActiveShiftTicker() {
        const tickerShift = document.getElementById('ticker-active-shift');
        if (!tickerShift) return;
        const now = new Date();
        const hour = now.getHours();
        const day = now.getDay();
        if (day === 5 && hour >= 7 && hour < 12) {
            tickerShift.textContent = 'Shift Reguler Jumat (07:30 - 11:30)';
        } else if (day === 6 && hour >= 7 && hour < 14) {
            tickerShift.textContent = 'Shift Piket Sabtu (07:30 - 13:00)';
        } else if (hour >= 7 && hour < 14) {
            tickerShift.textContent = 'Shift Pagi Reguler (07:30 - 14:00)';
        } else if (hour >= 14 && hour < 20) {
            tickerShift.textContent = 'Shift Sore UGD/PONED (14:00 - 20:00)';
        } else {
            tickerShift.textContent = 'Shift Malam Jaga UGD (20:00 - 07:30)';
        }
    }

    function renderOverviewTopEarly(topList) {
        const container = document.getElementById('overview-top-early-list');
        if (!container) return;
        if (!topList || topList.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200"><i class="fa-solid fa-sun text-2xl text-amber-300 mb-2"></i><p class="text-xs font-medium">Belum ada data kehadiran pagi hari ini.</p></div>`;
            return;
        }
        const medals = [
            'bg-gradient-to-br from-amber-400 to-yellow-600 text-white shadow-amber-400/30',
            'bg-gradient-to-br from-slate-300 to-slate-500 text-white shadow-slate-400/30',
            'bg-gradient-to-br from-amber-600 to-orange-800 text-white shadow-orange-500/30',
            'bg-emerald-100 text-emerald-700',
            'bg-emerald-100 text-emerald-700'
        ];
        container.innerHTML = topList.map((item, idx) => {
            const isLate = item.telat_menit > 0;
            return `
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/70 transition-all">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-lg ${medals[idx] || medals[3]} font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                            #${idx + 1}
                        </div>
                        <div class="min-w-0">
                            <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.nama_karyawan)}</p>
                            <p class="text-[10px] font-semibold text-slate-400 uppercase truncate">${escapeHtml(item.jabatan || 'Staf Puskesmas')}</p>
                        </div>
                    </div>
                    <div class="text-right shrink-0">
                        <span class="px-2.5 py-1 rounded-lg font-mono text-xs font-black ${isLate ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">${item.jam_masuk.substring(0, 5)}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderOverviewJabatanDistribution(employees, dailyData) {
        const container = document.getElementById('overview-jabatan-list');
        if (!container) return;
        if (!employees || employees.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Data pegawai belum tersedia.</div>`;
            return;
        }

        const groups = {};
        employees.forEach(emp => {
            const jab = (emp.jabatan || 'Staf Umum').trim().toUpperCase();
            if (!groups[jab]) groups[jab] = { total: 0, present: 0 };
            groups[jab].total++;
        });

        dailyData.forEach(d => {
            const jab = (d.jabatan || 'Staf Umum').trim().toUpperCase();
            if (!groups[jab]) groups[jab] = { total: 1, present: 0 };
            if (d.status !== 'ALPA') groups[jab].present++;
        });

        const sortedGroups = Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
        const barColors = [
            'from-emerald-500 to-teal-600',
            'from-blue-500 to-indigo-600',
            'from-violet-500 to-purple-600',
            'from-amber-500 to-orange-600',
            'from-rose-500 to-pink-600',
            'from-cyan-500 to-sky-600'
        ];

        container.innerHTML = sortedGroups.map(([jab, info], idx) => {
            const pct = info.total > 0 ? Math.min(100, Math.round((info.present / info.total) * 100)) : 0;
            const grad = barColors[idx % barColors.length];
            return `
                <div class="p-2.5 rounded-xl bg-slate-50/70 border border-slate-200/60">
                    <div class="flex justify-between items-center text-xs mb-1.5">
                        <span class="font-bold text-slate-700 truncate">${escapeHtml(jab)}</span>
                        <span class="font-mono text-[11px] font-bold text-slate-600">${info.present}/${info.total} Hadir (${pct}%)</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div class="h-full bg-gradient-to-r ${grad} rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- 4. ANALITIK & PERINGKAT KEDISIPLINAN (#view-analytics) ---
    window.loadEnterpriseAnalytics = async function () {
        const monthInput = document.getElementById('analytics-month');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const periode = monthInput ? monthInput.value : '';
        const topContainer = document.getElementById('analytics-top-list');
        const bottomContainer = document.getElementById('analytics-bottom-list');
        if (topContainer) topContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Menghitung skor kedisiplinan...</div>`;
        if (bottomContainer) bottomContainer.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">Menganalisis data keterlambatan...</div>`;

        try {
            const res = await fetch(`/api/absensi/bulanan?periode=${periode}&_t=${Date.now()}`);
            const result = await res.json();
            const rows = Array.isArray(result.data) ? result.data : [];

            if (rows.length === 0) {
                if (topContainer) topContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Belum ada data pada periode ${periode}</div>`;
                if (bottomContainer) bottomContainer.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Belum ada data pada periode ${periode}</div>`;
                return;
            }

            let totalScore = 0;
            let zeroAlpaCount = 0;
            let totalLateMinutesAll = 0;

            const scored = rows.map(r => {
                const hadir = parseInt(r.total_hadir || 0, 10);
                const telat = parseInt(r.total_telat || 0, 10);
                const alpa = parseInt(r.total_alpa || 0, 10);
                const menitTelat = parseInt(r.total_menit_telat || 0, 10);
                totalLateMinutesAll += menitTelat;
                if (alpa === 0) zeroAlpaCount++;

                // Rumus Skor Disiplin (Max 100)
                let score = 100 - (alpa * 10) - (telat * 2) - Math.floor(menitTelat / 30);
                if (hadir === 0 && alpa > 0) score = Math.max(10, score);
                score = Math.max(0, Math.min(100, score));
                totalScore += score;

                return { ...r, hadir, telat, alpa, menitTelat, score };
            });

            const sortedBest = [...scored].sort((a, b) => b.score - a.score || b.hadir - a.hadir || a.menitTelat - b.menitTelat);
            const sortedWorst = [...scored].sort((a, b) => a.score - b.score || b.alpa - a.alpa || b.menitTelat - a.menitTelat);

            const top1 = sortedBest[0];
            if (top1) {
                document.getElementById('analytic-top1-name').textContent = top1.nama_karyawan || top1.nama || '-';
                document.getElementById('analytic-top1-score').innerHTML = `<i class="fa-solid fa-star mr-1"></i>Skor ${top1.score}/100 (${top1.hadir} Hadir)`;
            }
            document.getElementById('analytic-avg-score').textContent = `${Math.round(totalScore / scored.length)} / 100`;
            document.getElementById('analytic-zero-alpa').textContent = `${zeroAlpaCount} Pegawai`;
            document.getElementById('analytic-total-late-min').textContent = `${totalLateMinutesAll.toLocaleString('id-ID')} Menit`;

            if (topContainer) {
                topContainer.innerHTML = sortedBest.slice(0, 10).map((item, idx) => `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-emerald-50/40 hover:bg-emerald-50 border border-emerald-200/60 transition-all">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="w-7 h-7 rounded-lg ${idx < 3 ? 'bg-amber-500 text-white' : 'bg-emerald-200 text-emerald-800'} font-black text-xs flex items-center justify-center shrink-0">#${idx + 1}</span>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.nama_karyawan || item.nama)}</p>
                                <p class="text-[10px] text-slate-500 uppercase truncate">${escapeHtml(item.jabatan || '-')} • Hadir: ${item.hadir}x</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-600 text-white">${item.score} Pts</span>
                        </div>
                    </div>
                `).join('');
            }

            if (bottomContainer) {
                bottomContainer.innerHTML = sortedWorst.slice(0, 10).map((item, idx) => `
                    <div class="flex items-center justify-between p-3 rounded-xl bg-rose-50/40 hover:bg-rose-50 border border-rose-200/60 transition-all">
                        <div class="flex items-center gap-3 min-w-0">
                            <span class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0">${idx + 1}</span>
                            <div class="min-w-0">
                                <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(item.nama_karyawan || item.nama)}</p>
                                <p class="text-[10px] text-rose-600 font-semibold truncate">Alpa: ${item.alpa}x • Telat: ${item.telat}x (${item.menitTelat}m)</p>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">Skor ${item.score}</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (err) {
            console.error('Analytics error:', err);
        }
    };

    // --- 5. MANAJEMEN JADWAL & SHIFT KERJA (#view-shifts) ---
    function getSavedShifts() {
        try {
            return JSON.parse(localStorage.getItem('pkm_wana_shifts') || '{}');
        } catch (e) {
            return {};
        }
    }

    window.loadEnterpriseShifts = async function () {
        if (cachedEmployees.length === 0) {
            try {
                const res = await fetch(`/api/karyawan/descriptors?_t=${Date.now()}`);
                const json = await res.json();
                cachedEmployees = Array.isArray(json.descriptors) ? json.descriptors : [];
            } catch (e) {
                console.error(e);
            }
        }
        renderShiftTable();
    };

    window.updateEmployeeShift = function (idKaryawan, shiftCode) {
        const shifts = getSavedShifts();
        shifts[idKaryawan] = shiftCode;
        localStorage.setItem('pkm_wana_shifts', JSON.stringify(shifts));
        renderShiftTable();
        if (typeof showToast === 'function') {
            showToast(`Shift pegawai #${idKaryawan} diubah ke Shift ${shiftCode}`, 'success');
        }
        logAuditEvent('Ubah Shift Kerja', `ID ${idKaryawan} -> Shift ${shiftCode}`, 'purple');
    };

    window.renderShiftTable = function () {
        const tbody = document.getElementById('table-shifts-body');
        if (!tbody) return;
        const filterShift = (document.getElementById('filter-shift-select')?.value || 'ALL').toUpperCase();
        const searchQ = (document.getElementById('search-shift-emp')?.value || '').toLowerCase();
        const savedShifts = getSavedShifts();

        let countPagi = 0, countSore = 0, countMalam = 0;

        const rowsHtml = [];
        cachedEmployees.forEach((emp, idx) => {
            const shift = savedShifts[emp.id_karyawan] || 'PAGI';
            if (shift === 'PAGI') countPagi++;
            else if (shift === 'SORE') countSore++;
            else if (shift === 'MALAM') countMalam++;

            if (filterShift !== 'ALL' && shift !== filterShift) return;
            const matchText = `${emp.nama} ${emp.id_karyawan} ${emp.jabatan || ''}`.toLowerCase();
            if (searchQ && !matchText.includes(searchQ)) return;

            const badgeMap = {
                'PAGI': '<span class="badge-pro-emerald"><i class="fa-solid fa-sun text-amber-400 mr-1"></i>Shift Pagi</span>',
                'SORE': '<span class="badge-pro-blue"><i class="fa-solid fa-cloud-sun text-blue-400 mr-1"></i>Shift Sore</span>',
                'MALAM': '<span class="badge-pro-purple"><i class="fa-solid fa-moon text-purple-400 mr-1"></i>Shift Malam</span>'
            };
            const jamMap = {
                'PAGI': '07:30 - 14:00 WIB',
                'SORE': '14:00 - 20:00 WIB',
                'MALAM': '20:00 - 07:30 WIB'
            };

            rowsHtml.push(`
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 font-mono text-slate-500">${idx + 1}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-700">${escapeHtml(emp.id_karyawan)}</td>
                    <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(emp.nama)}</td>
                    <td class="px-4 py-3 text-slate-600 uppercase font-semibold">${escapeHtml(emp.jabatan || 'Staf')}</td>
                    <td class="px-4 py-3">${badgeMap[shift] || badgeMap.PAGI}</td>
                    <td class="px-4 py-3 font-mono font-bold text-slate-600">${jamMap[shift] || jamMap.PAGI}</td>
                    <td class="px-4 py-3 text-center">
                        <div class="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100">
                            <button onclick="updateEmployeeShift('${escapeHtml(emp.id_karyawan)}', 'PAGI')" class="px-2.5 py-1 rounded-md text-[10px] font-bold ${shift === 'PAGI' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-emerald-700'}">Pagi</button>
                            <button onclick="updateEmployeeShift('${escapeHtml(emp.id_karyawan)}', 'SORE')" class="px-2.5 py-1 rounded-md text-[10px] font-bold ${shift === 'SORE' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-blue-700'}">Sore</button>
                            <button onclick="updateEmployeeShift('${escapeHtml(emp.id_karyawan)}', 'MALAM')" class="px-2.5 py-1 rounded-md text-[10px] font-bold ${shift === 'MALAM' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-purple-700'}">Malam</button>
                        </div>
                    </td>
                </tr>
            `);
        });

        const elPagi = document.getElementById('shift-count-pagi');
        const elSore = document.getElementById('shift-count-sore');
        const elMalam = document.getElementById('shift-count-malam');
        if (elPagi) elPagi.textContent = `${countPagi} Pegawai`;
        if (elSore) elSore.textContent = `${countSore} Pegawai`;
        if (elMalam) elMalam.textContent = `${countMalam} Pegawai`;

        tbody.innerHTML = rowsHtml.length > 0 ? rowsHtml.join('') : `<tr><td colspan="7" class="p-8 text-center text-slate-400">Tidak ada pegawai yang sesuai filter.</td></tr>`;
    };

    window.exportShiftScheduleCSV = function () {
        const savedShifts = getSavedShifts();
        let csv = 'No,ID Karyawan,Nama Pegawai,Jabatan,Shift Aktif,Jam Kerja\n';
        cachedEmployees.forEach((emp, i) => {
            const sh = savedShifts[emp.id_karyawan] || 'PAGI';
            const jam = sh === 'SORE' ? '14:00-20:00' : (sh === 'MALAM' ? '20:00-07:30' : '07:30-14:00');
            csv += `${i + 1},"${emp.id_karyawan}","${emp.nama}","${emp.jabatan || ''}","SHIFT ${sh}","${jam}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Jadwal_Shift_Puskesmas_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        if (typeof showToast === 'function') showToast('Jadwal Shift berhasil diexport ke CSV!', 'success');
    };

    // --- 6. SIMULASI GAJI & TUKIN (#view-payroll) ---
    function formatRupiah(num) {
        return 'Rp ' + Math.round(num || 0).toLocaleString('id-ID');
    }

    function getPayrollParameters() {
        const saved = JSON.parse(localStorage.getItem('pkm_wana_sig_config') || '{}');
        const gajiPokok = parseFloat(document.getElementById('conf-gaji-pokok')?.value || saved.gajiPokok || 3500000);
        const tunjangan = parseFloat(document.getElementById('conf-tunjangan-jabatan')?.value || saved.tunjanganJabatan || 1000000);
        const dendaTelat = parseFloat(document.getElementById('conf-denda-telat')?.value || saved.dendaTelat || 25000);
        const dendaAlpa = parseFloat(document.getElementById('conf-denda-alpa')?.value || saved.dendaAlpa || 100000);
        const rawOverride = document.getElementById('conf-gaji-jabatan')?.value || saved.gajiJabatan || '';
        const overrides = {};
        rawOverride.split('\n').forEach(line => {
            const [k, v] = line.split('=');
            if (k && v && !isNaN(parseFloat(v))) {
                overrides[k.trim().toLowerCase()] = parseFloat(v.trim());
            }
        });
        return { gajiPokok, tunjangan, dendaTelat, dendaAlpa, overrides };
    }

    window.loadEnterprisePayroll = async function () {
        const monthInput = document.getElementById('payroll-month');
        if (monthInput && !monthInput.value) {
            const now = new Date();
            monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const periode = monthInput ? monthInput.value : '';
        const tbody = document.getElementById('table-payroll-body');
        if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">Menghitung simulasi gaji & potongan disiplin...</td></tr>`;

        try {
            const res = await fetch(`/api/absensi/bulanan?periode=${periode}&_t=${Date.now()}`);
            const result = await res.json();
            const rows = Array.isArray(result.data) ? result.data : [];
            const params = getPayrollParameters();

            let sumBase = 0, sumAllow = 0, sumDeduct = 0, sumNet = 0;
            cachedPayrollRows = [];

            if (rows.length === 0) {
                if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="p-8 text-center text-slate-400">Belum ada data rekap bulanan pada periode ${periode}.</td></tr>`;
                return;
            }

            tbody.innerHTML = rows.map((r, i) => {
                const nama = r.nama_karyawan || r.nama || '-';
                const jab = r.jabatan || 'Staf';
                const hadir = parseInt(r.total_hadir || 0, 10);
                const telat = parseInt(r.total_telat || 0, 10);
                const alpa = parseInt(r.total_alpa || 0, 10);

                let baseSalary = params.gajiPokok;
                const jabKey = jab.toLowerCase();
                Object.keys(params.overrides).forEach(k => {
                    if (jabKey.includes(k)) baseSalary = params.overrides[k];
                });

                const allowance = params.tunjangan;
                const deduction = (telat * params.dendaTelat) + (alpa * params.dendaAlpa);
                const netPay = Math.max(0, baseSalary + allowance - deduction);

                sumBase += baseSalary;
                sumAllow += allowance;
                sumDeduct += deduction;
                sumNet += netPay;

                cachedPayrollRows.push({
                    no: i + 1,
                    id_karyawan: r.id_karyawan,
                    nama,
                    jabatan: jab,
                    hadir,
                    telat,
                    alpa,
                    baseSalary,
                    allowance,
                    deduction,
                    netPay
                });

                return `
                    <tr class="hover:bg-emerald-50/30 transition-colors">
                        <td class="px-4 py-3 font-mono text-slate-400">${i + 1}</td>
                        <td class="px-4 py-3 font-bold text-slate-800">${escapeHtml(nama)}</td>
                        <td class="px-4 py-3 text-slate-600 uppercase font-semibold">${escapeHtml(jab)}</td>
                        <td class="px-4 py-3 text-center font-mono space-x-1">
                            <span class="badge-pro-emerald">${hadir}H</span>
                            <span class="badge-pro-amber">${telat}T</span>
                            <span class="badge-pro-rose">${alpa}A</span>
                        </td>
                        <td class="px-4 py-3 text-right font-mono text-slate-700">${formatRupiah(baseSalary)}</td>
                        <td class="px-4 py-3 text-right font-mono text-blue-700">${formatRupiah(allowance)}</td>
                        <td class="px-4 py-3 text-right font-mono text-rose-600 font-bold">-${formatRupiah(deduction)}</td>
                        <td class="px-4 py-3 text-right font-mono font-black text-emerald-700">${formatRupiah(netPay)}</td>
                        <td class="px-4 py-3 text-center">
                            <button onclick="if(typeof printSalarySlip==='function'){printSalarySlip('${escapeHtml(r.id_karyawan)}')}else{window.print()}" class="px-2.5 py-1 bg-slate-800 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors shadow-sm">
                                <i class="fa-solid fa-print mr-1"></i>Slip
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            document.getElementById('payroll-total-base').textContent = formatRupiah(sumBase);
            document.getElementById('payroll-total-allowance').textContent = formatRupiah(sumAllow);
            document.getElementById('payroll-total-deduction').textContent = formatRupiah(sumDeduct);
            document.getElementById('payroll-total-net').textContent = formatRupiah(sumNet);
        } catch (err) {
            console.error('Payroll error:', err);
        }
    };

    window.exportPayrollCSV = function () {
        if (!cachedPayrollRows || cachedPayrollRows.length === 0) {
            if (typeof showToast === 'function') showToast('Muat data gaji terlebih dahulu', 'error');
            return;
        }
        let csv = 'No,Nama Pegawai,Jabatan,Hadir,Telat,Alpa,Gaji Pokok,Tunjangan,Potongan,Take Home Pay\n';
        cachedPayrollRows.forEach(r => {
            csv += `${r.no},"${r.nama}","${r.jabatan}",${r.hadir},${r.telat},${r.alpa},${r.baseSalary},${r.allowance},${r.deduction},${r.netPay}\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Rekap_Gaji_Tukin_${document.getElementById('payroll-month')?.value || 'Bulanan'}.csv`;
        a.click();
        if (typeof showToast === 'function') showToast('Data Gaji & Tukin berhasil diexport ke CSV!', 'success');
    };

    // --- 7. BROADCAST PENGUMUMAN & GENERATOR WHATSAPP (#view-broadcast) ---
    function getSavedBroadcasts() {
        try {
            return JSON.parse(localStorage.getItem('pkm_wana_broadcasts') || '[]');
        } catch (e) {
            return [];
        }
    }

    window.loadEnterpriseBroadcast = function () {
        renderBroadcastHistory();
        renderAuditLog();
    };

    window.publishBroadcast = function () {
        const cat = document.getElementById('broadcast-category')?.value || 'INFO';
        const msg = document.getElementById('broadcast-message')?.value.trim();
        if (!msg) {
            if (typeof showToast === 'function') showToast('Tulis isi pengumuman terlebih dahulu!', 'error');
            return;
        }
        const list = getSavedBroadcasts();
        const item = {
            id: Date.now(),
            category: cat,
            message: msg,
            time: new Date().toLocaleString('id-ID')
        };
        list.unshift(item);
        localStorage.setItem('pkm_wana_broadcasts', JSON.stringify(list.slice(0, 15)));

        const tickerText = document.getElementById('ticker-announcement-text');
        if (tickerText) tickerText.textContent = `[${cat}] ${msg}`;

        renderBroadcastHistory();
        logAuditEvent('Broadcast Baru', `${cat}: ${msg.substring(0, 45)}...`, 'rose');
        if (typeof showToast === 'function') showToast('Pengumuman berhasil ditampilkan di Ticker Dashboard!', 'success');
    };

    window.generateWhatsAppReport = function () {
        const now = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const total = document.getElementById('stat-total-emp')?.textContent || '0';
        const hadir = document.getElementById('stat-present')?.textContent || '0';
        const telat = document.getElementById('stat-late')?.textContent || '0';
        const alpa = document.getElementById('stat-absent')?.textContent || '0';
        const rate = document.getElementById('stat-rate-percent')?.textContent || '0%';

        const waText = `*LAPORAN HARIAN KEHADIRAN BIOMETRIK*\n*UPTD PUSKESMAS WANA*\n📅 Tanggal: ${now}\n----------------------------------------\n👥 Total Pegawai: ${total}\n✅ Hadir Hari Ini: ${hadir}\n⏰ Terlambat: ${telat}\n❌ Belum Hadir/Alpa: ${alpa}\n📊 Persentase Kehadiran: *${rate}*\n----------------------------------------\n_Pesan otomatis dari Sistem Command Center Biometrik Puskesmas Wana._`;
        const box = document.getElementById('broadcast-message');
        if (box) box.value = waText;
        if (typeof showToast === 'function') showToast('Format laporan WhatsApp hari ini berhasil dibuat!', 'success');
    };

    window.copyBroadcastToClipboard = function () {
        const box = document.getElementById('broadcast-message');
        if (!box || !box.value) return;
        navigator.clipboard.writeText(box.value);
        if (typeof showToast === 'function') showToast('Teks berhasil disalin ke Clipboard! Siap ditempel di WhatsApp.', 'success');
    };

    function renderBroadcastHistory() {
        const container = document.getElementById('broadcast-history-list');
        if (!container) return;
        const list = getSavedBroadcasts();
        if (list.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs bg-slate-50 rounded-xl">Belum ada riwayat pengumuman.</div>`;
            return;
        }
        container.innerHTML = list.map(item => `
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex justify-between items-start gap-2">
                <div class="min-w-0">
                    <span class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-black text-[9px] uppercase">${escapeHtml(item.category)}</span>
                    <p class="text-xs text-slate-700 font-medium mt-1 break-words">${escapeHtml(item.message)}</p>
                    <p class="text-[10px] text-slate-400 mt-1">${escapeHtml(item.time)}</p>
                </div>
            </div>
        `).join('');
    }

    function renderAuditLog() {
        const container = document.getElementById('enterprise-audit-log');
        if (!container) return;
        if (auditLogs.length === 0) {
            container.innerHTML = `<div class="p-4 text-center text-slate-400">Belum ada aktivitas terekam.</div>`;
            return;
        }
        container.innerHTML = auditLogs.map(log => `
            <div class="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/70">
                <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <div class="min-w-0">
                        <p class="text-xs font-bold text-slate-800 truncate">${escapeHtml(log.action)}</p>
                        <p class="text-[10px] text-slate-500 truncate">${escapeHtml(log.detail)}</p>
                    </div>
                </div>
                <span class="font-mono text-[10px] font-bold text-slate-400 shrink-0">${log.time}</span>
            </div>
        `).join('');
    }

    // --- 8. GLOBAL COMMAND PALETTE (Ctrl+K) ---
    const COMMAND_ITEMS = [
        { label: 'Buka Panel Registrasi Biometrik Wajah (admin.html)', category: 'Aksi Cepat', icon: 'fa-face-viewfinder', action: () => window.open('admin.html', '_blank') },
        { label: 'Buka Layar Monitor Display Kehadiran (display.html)', category: 'Aksi Cepat', icon: 'fa-tv', action: () => window.open('display.html', '_blank') },
        { label: 'Buka Dashboard Overview', category: 'Menu Navigasi', icon: 'fa-chart-pie', action: () => switchTab('overview') },
        { label: 'Buka Laporan Absensi Harian', category: 'Menu Navigasi', icon: 'fa-calendar-day', action: () => switchTab('daily') },
        { label: 'Buka Rekapitulasi Bulanan & Export PDF', category: 'Menu Navigasi', icon: 'fa-table', action: () => switchTab('monthly') },
        { label: 'Buka Analitik & Peringkat Kedisiplinan (PRO)', category: 'Fitur Enterprise', icon: 'fa-trophy', action: () => switchTab('analytics') },
        { label: 'Buka Manajemen Jadwal & Shift Kerja (HRIS)', category: 'Fitur Enterprise', icon: 'fa-business-time', action: () => switchTab('shifts') },
        { label: 'Buka Kalkulator Gaji, Tukin & Slip Gaji', category: 'Fitur Enterprise', icon: 'fa-money-check-dollar', action: () => switchTab('payroll') },
        { label: 'Buka Broadcast WA & Audit Sistem', category: 'Fitur Enterprise', icon: 'fa-bullhorn', action: () => switchTab('broadcast') },
        { label: 'Buka Direktori Data Pegawai', category: 'Manajemen Data', icon: 'fa-users', action: () => switchTab('employees') },
        { label: 'Buka Tabel Akun Portal & Biometrik', category: 'Manajemen Data', icon: 'fa-id-card-clip', action: () => { switchTab('employees'); if (typeof switchEmployeeView === 'function') switchEmployeeView('table'); } },
        { label: 'Input Absensi Manual / Izin / Dinas Luar', category: 'Aksi Cepat', icon: 'fa-user-plus', action: () => { if (typeof openManualModal === 'function') openManualModal(); } },
        { label: 'Tema Warna: Sapphire Cyber (Biru Eksekutif)', category: 'Tema Visual', icon: 'fa-palette', action: () => setEnterpriseTheme('sapphire') },
        { label: 'Tema Warna: Amethyst Luxury (Ungu Modern)', category: 'Tema Visual', icon: 'fa-palette', action: () => setEnterpriseTheme('amethyst') },
        { label: 'Tema Warna: Sunset Amber (Oranye)', category: 'Tema Visual', icon: 'fa-palette', action: () => setEnterpriseTheme('sunset') },
        { label: 'Tema Warna: Emerald Royal (Hijau Puskesmas)', category: 'Tema Visual', icon: 'fa-palette', action: () => setEnterpriseTheme('emerald') },
        { label: 'Buka Tabel Konfigurasi Environment (.env)', category: 'Pengaturan Sistem', icon: 'fa-sliders', action: () => switchTab('environment') },
        { label: 'Tema Warna: Midnight Dark (Gelap)', category: 'Tema Visual', icon: 'fa-moon', action: () => setEnterpriseTheme('midnight') }
    ];

    window.openCommandPalette = function () {
        const modal = document.getElementById('modal-command-palette');
        const input = document.getElementById('command-palette-input');
        if (!modal) return;
        modal.classList.remove('hidden');
        if (input) {
            input.value = '';
            input.focus();
        }
        filterCommandPalette('');
    };

    window.closeCommandPalette = function () {
        const modal = document.getElementById('modal-command-palette');
        if (modal) modal.classList.add('hidden');
    };

    window.filterCommandPalette = function (query) {
        const container = document.getElementById('command-palette-results');
        if (!container) return;
        const q = (query || '').toLowerCase().trim();

        let matches = COMMAND_ITEMS.filter(item =>
            item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
        );

        // Tambahkan pencarian pegawai langsung dari Command Palette
        const empMatches = (cachedEmployees || []).filter(emp =>
            `${emp.nama} ${emp.id_karyawan} ${emp.jabatan || ''}`.toLowerCase().includes(q)
        ).slice(0, 5).map(emp => ({
            label: `Pegawai: ${emp.nama} (${emp.jabatan || 'Staf'})`,
            category: `ID: ${emp.id_karyawan}`,
            icon: 'fa-user-doctor',
            action: () => {
                if (typeof openModal === 'function') openModal(emp.id_karyawan);
            }
        }));

        const allResults = [...matches, ...empMatches];
        if (allResults.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">Tidak ditemukan hasil untuk "${escapeHtml(query)}"</div>`;
            return;
        }

        window._cmdActions = allResults.map(r => r.action);
        container.innerHTML = allResults.map((item, idx) => `
            <button onclick="window._cmdActions[${idx}](); closeCommandPalette();" class="w-full flex items-center justify-between p-3 rounded-xl hover:bg-emerald-50 text-left transition-colors group">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 flex items-center justify-center transition-colors shrink-0">
                        <i class="fa-solid ${item.icon} text-xs"></i>
                    </div>
                    <span class="text-xs font-bold text-slate-800 group-hover:text-emerald-800 truncate">${escapeHtml(item.label)}</span>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">${escapeHtml(item.category)}</span>
            </button>
        `).join('');
    };

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openCommandPalette();
        } else if (e.key === 'Escape') {
            closeCommandPalette();
        }
    });

    // --- INISIALISASI SAAT HALAMAN DIMUAT ---
    document.addEventListener('DOMContentLoaded', () => {
        const savedTheme = localStorage.getItem('pkm_enterprise_theme');
        if (savedTheme && savedTheme !== 'emerald') {
            document.body.setAttribute('data-theme', savedTheme);
        }

        const savedBroadcasts = getSavedBroadcasts();
        if (savedBroadcasts.length > 0) {
            const tickerText = document.getElementById('ticker-announcement-text');
            if (tickerText) {
                tickerText.textContent = `[${savedBroadcasts[0].category}] ${savedBroadcasts[0].message}`;
            }
        }

        logAuditEvent('Sistem Aktif', 'Enterprise Suite v4.5.2 berhasil dimuat', 'emerald');
        setTimeout(refreshEnterpriseOverviewExtras, 800);
        setInterval(refreshEnterpriseOverviewExtras, 60000);
    });
})();
