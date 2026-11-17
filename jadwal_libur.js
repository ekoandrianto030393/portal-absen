/**
 * jadwal_libur.js
 * Modul Permintaan Jadwal Libur & Dinas Luar (DL) dari Portal Online
 * Terhubung dua arah antara portal-online dan dashboard.html (biometrik).
 */

let globalJadwalLiburList = [];
let jlStatusFilter = 'ALL';
let jlJenisFilter = 'ALL';
window.activeJadwalLiburKode = null;

function formatTanggalIndoCompact(dateStr) {
    if (!dateStr) return '-';
    const clean = String(dateStr).slice(0, 10);
    const parts = clean.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return clean;
    const [y, m, d] = parts;
    const hariList = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const blnList = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dt = new Date(y, m - 1, d);
    const hari = hariList[dt.getDay()] || '';
    return `${hari}, ${String(d).padStart(2, '0')} ${blnList[m - 1] || ''} ${y}`;
}

function formatTglKirimIndo(dtStr) {
    if (!dtStr) return '-';
    const raw = String(dtStr).replace('T', ' ').slice(0, 19);
    const [datePart, timePart] = raw.split(' ');
    const dParts = (datePart || '').split('-').map(Number);
    if (dParts.length !== 3 || dParts.some(isNaN)) return raw;
    const [y, m, d] = dParts;
    const hariList = ['Min', 'Sen', 'Sel', 'Kam', 'Jum', 'Sab']; // fallback unused
    const fullHari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const blnList = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dt = new Date(y, m - 1, d);
    const jam = timePart ? timePart.slice(0, 5) : '';
    return {
        hari: fullHari[dt.getDay()] || '',
        tanggal: `${String(d).padStart(2, '0')} ${blnList[m - 1] || ''} ${y}`,
        jam: jam ? `${jam} WIB` : ''
    };
}

function updateJadwalLiburBadges(pendingCount) {
    const sideBadge = document.getElementById('sidebar-jadwal-libur-badge');
    const ovBadge = document.getElementById('overview-jl-badge');
    const cnt = Number(pendingCount || 0);
    if (sideBadge) {
        if (cnt > 0) {
            sideBadge.textContent = cnt;
            sideBadge.classList.remove('hidden');
        } else {
            sideBadge.classList.add('hidden');
        }
    }
    if (ovBadge) {
        if (cnt > 0) {
            ovBadge.textContent = cnt;
            ovBadge.classList.remove('hidden');
        } else {
            ovBadge.classList.add('hidden');
        }
    }
}

async function refreshJadwalLiburBadge() {
    try {
        const res = await fetch(`${API_BASE}/jadwal-libur/permintaan?_t=${Date.now()}`);
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data)) {
            const pendingCount = json.data.filter(r => r.status === 'pending').length;
            updateJadwalLiburBadges(pendingCount);
        }
    } catch (e) {
        // Silent fail untuk polling latar belakang
    }
}

async function loadJadwalLiburRequests(silent = false) {
    const tbody = document.getElementById('table-jadwal-libur-body');
    if (tbody && !silent) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="p-10 text-center text-slate-400">
                    <i class="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600 mb-2"></i>
                    <div class="text-xs font-bold">Menyinkronkan permintaan dari Portal Online...</div>
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch(`${API_BASE}/jadwal-libur/permintaan?_t=${Date.now()}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Gagal memuat daftar permintaan jadwal libur.');

        globalJadwalLiburList = Array.isArray(json.data) ? json.data : [];
        updateJadwalLiburStats(globalJadwalLiburList);
        renderJadwalLiburTable();

        const syncTimeEl = document.getElementById('jl-last-sync');
        if (syncTimeEl) {
            const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            syncTimeEl.textContent = `Sinkron terakhir: ${nowStr} WIB`;
        }
    } catch (e) {
        console.error('Error loadJadwalLiburRequests:', e);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-rose-600 font-bold"><i class="fa-solid fa-triangle-exclamation mr-2"></i>${escapeHtml(e.message)}</td></tr>`;
        }
    }
}

function updateJadwalLiburStats(list) {
    const pending = list.filter(r => r.status === 'pending').length;
    const libur = list.filter(r => String(r.jenis_pengajuan).toUpperCase() === 'LIBUR').length;
    const dl = list.filter(r => String(r.jenis_pengajuan).toUpperCase() === 'DL').length;
    const processed = list.filter(r => r.status === 'processed').length;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('jl-stat-pending', `${pending} Permintaan`);
    setVal('jl-stat-libur', `${libur} Pengajuan`);
    setVal('jl-stat-dl', `${dl} Pengajuan`);
    setVal('jl-stat-processed', `${processed} Selesai`);
    updateJadwalLiburBadges(pending);
}

function setJadwalLiburStatusFilter(statusVal) {
    jlStatusFilter = statusVal;
    document.querySelectorAll('.jl-status-btn').forEach(btn => {
        const val = btn.getAttribute('data-status');
        if (val === statusVal) {
            btn.className = 'jl-status-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all';
        } else {
            btn.className = 'jl-status-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-emerald-50 transition-all';
        }
    });
    renderJadwalLiburTable();
}

function setJadwalLiburJenisFilter(jenisVal) {
    jlJenisFilter = jenisVal;
    renderJadwalLiburTable();
}

function renderJadwalLiburTable() {
    const tbody = document.getElementById('table-jadwal-libur-body');
    if (!tbody) return;

    const searchQ = (document.getElementById('search-jadwal-libur')?.value || '').trim().toLowerCase();

    let rows = globalJadwalLiburList.filter(r => {
        if (jlStatusFilter !== 'ALL' && r.status !== jlStatusFilter) return false;
        if (jlJenisFilter !== 'ALL' && String(r.jenis_pengajuan).toUpperCase() !== jlJenisFilter) return false;
        if (searchQ) {
            const hay = `${r.id_karyawan || ''} ${r.nama || ''} ${r.jabatan || ''} ${r.keterangan || ''} ${r.hari_diajukan || ''} ${r.tanggal_diajukan || ''}`.toLowerCase();
            if (!hay.includes(searchQ)) return false;
        }
        return true;
    });

    // Urutkan pending di atas, lalu tanggal kirim terbaru
    const rankOrder = { 'pending': 0, 'processed': 1, 'rejected': 2 };
    rows.sort((a, b) => {
        const ra = rankOrder[a.status] ?? 9;
        const rb = rankOrder[b.status] ?? 9;
        if (ra !== rb) return ra - rb;
        return String(b.tanggal_kirim || '').localeCompare(String(a.tanggal_kirim || ''));
    });

    if (rows.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="p-14 text-center text-slate-400 bg-slate-50/40">
                    <i class="fa-regular fa-calendar-xmark text-4xl text-slate-300 mb-3 block"></i>
                    <p class="font-bold text-sm text-slate-500">Belum Ada Permintaan Jadwal Libur / DL</p>
                    <p class="text-xs text-slate-400 mt-1">Permintaan yang dikirim pegawai dari Portal Online akan otomatis muncul di sini.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => {
        const isDL = String(r.jenis_pengajuan).toUpperCase() === 'DL';
        const isPending = r.status === 'pending';
        const isProcessed = r.status === 'processed';

        const jenisBadge = isDL
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-sky-100 text-sky-800 border border-sky-300 shadow-xs"><i class="fa-solid fa-car-side"></i> Dinas Luar (DL)</span>`
            : `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-cyan-100 text-cyan-800 border border-cyan-300 shadow-xs"><i class="fa-solid fa-mug-hot"></i> Jadwal Libur</span>`;

        const tglFormatted = formatTanggalIndoCompact(r.tanggal_diajukan);
        const jamSub = (isDL && (r.jam_masuk || r.jam_pulang))
            ? `<div class="text-[10px] font-mono font-bold text-sky-700 mt-0.5"><i class="fa-regular fa-clock mr-1"></i>${escapeHtml(r.jam_masuk || '07:30')} - ${escapeHtml(r.jam_pulang || '14:00')} WIB</div>`
            : '';

        const kirimInfo = formatTglKirimIndo(r.tanggal_kirim);
        const kirimHtml = `
            <div class="text-[11px] font-bold text-slate-700">${escapeHtml(kirimInfo.tanggal || '-')}</div>
            <div class="text-[10px] text-slate-500 font-mono">${escapeHtml(kirimInfo.hari)}${kirimInfo.jam ? ' • ' + escapeHtml(kirimInfo.jam) : ''}</div>
        `;

        let statusBadge = '';
        if (isPending) {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Menunggu Input</span>`;
        } else if (isProcessed) {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check"></i>Sudah Diinput</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-300"><i class="fa-solid fa-circle-xmark"></i>Ditolak</span>`;
        }

        const absenNowPill = r.absen_status_di_tanggal
            ? `<div class="mt-0.5 text-[9px] font-bold text-teal-700"><i class="fa-solid fa-database mr-1"></i>Absensi saat ini: ${escapeHtml(r.absen_status_di_tanggal)}</div>`
            : '';

        const rowHighlight = isPending
            ? 'bg-amber-50/35 hover:bg-emerald-50/70'
            : 'bg-white hover:bg-slate-50';

        const actionBtns = `
            <div class="flex items-center justify-center gap-1.5">
                <button type="button" onclick="event.stopPropagation(); openManualFromJadwalRequest('${escapeHtml(r.kode_permintaan)}')"
                    class="px-3 py-1.5 rounded-lg text-[11px] font-extrabold shadow-sm transition-all hover:-translate-y-0.5 flex items-center gap-1 ${isPending ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'}"
                    title="Buka Modal Input Manual untuk Pengajuan Ini">
                    <i class="fa-solid fa-pen-to-square"></i> ${isPending ? 'Input Manual' : 'Input Ulang'}
                </button>
                ${isPending ? `
                    <button type="button" onclick="rejectJadwalLiburRequest(event, '${escapeHtml(r.kode_permintaan)}', '${escapeHtml(r.nama || r.id_karyawan)}')"
                        class="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-[11px] font-bold transition-all"
                        title="Tolak Permintaan">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                ` : ''}
                <button type="button" onclick="deleteJadwalLiburRequest(event, '${escapeHtml(r.kode_permintaan)}', '${escapeHtml(r.nama || r.id_karyawan)}')"
                    class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-500 hover:text-white text-[11px] font-bold transition-all"
                    title="Hapus Riwayat Permintaan">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        return `
            <tr onclick="openManualFromJadwalRequest('${escapeHtml(r.kode_permintaan)}')"
                class="${rowHighlight} cursor-pointer transition-colors group border-b border-slate-100"
                title="Klik baris ini untuk langsung membuka Input Manual">
                <td class="px-3 py-3 text-center font-bold text-slate-500">${idx + 1}</td>
                <td class="px-3 py-3 font-mono font-black text-teal-800">${escapeHtml(r.id_karyawan)}</td>
                <td class="px-4 py-3">
                    <div class="font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">${escapeHtml(r.nama || r.id_karyawan)}</div>
                    <div class="text-[9px] text-emerald-600 font-bold opacity-80"><i class="fa-solid fa-hand-pointer mr-1"></i>Klik untuk Input Manual</div>
                </td>
                <td class="px-3 py-3 font-semibold text-slate-600 uppercase text-[11px]">${escapeHtml(r.jabatan || 'Staf')}</td>
                <td class="px-3 py-3 whitespace-nowrap">${jenisBadge}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="font-black text-slate-900 text-xs">${escapeHtml(tglFormatted)}</div>
                    <div class="text-[10px] font-bold text-slate-400">Tahun: ${escapeHtml(String(r.tahun_diajukan || String(r.tanggal_diajukan || '').slice(0, 4)))}</div>
                    ${jamSub}
                    ${absenNowPill}
                </td>
                <td class="px-3 py-3 max-w-[210px]"><span class="text-xs text-slate-700 font-medium break-words">${escapeHtml(r.keterangan || '-')}</span></td>
                <td class="px-3 py-3 whitespace-nowrap">${kirimHtml}</td>
                <td class="px-3 py-3 text-center whitespace-nowrap">${statusBadge}</td>
                <td class="px-3 py-3 text-center whitespace-nowrap">${actionBtns}</td>
            </tr>
        `;
    }).join('');
}

async function openManualFromJadwalRequest(kodePermintaan) {
    const req = globalJadwalLiburList.find(r => r.kode_permintaan === kodePermintaan);
    if (!req) return;

    // 1. Buka modal Input Manual bawaan dashboard
    if (typeof openManualModal === 'function') {
        await openManualModal();
    }

    // 2. Simpan kode permintaan agar saat Simpan diklik, otomatis status jadi 'processed'
    window.activeJadwalLiburKode = req.kode_permintaan;

    // 3. Tampilkan banner info konteks permintaan di atas modal Input Manual
    const ctxEl = document.getElementById('manual-jadwal-context');
    if (ctxEl) {
        const kirimInfo = formatTglKirimIndo(req.tanggal_kirim);
        const jenisLabel = String(req.jenis_pengajuan).toUpperCase() === 'DL' ? 'Dinas Luar (DL)' : 'Jadwal Libur';
        ctxEl.innerHTML = `
            <div class="flex items-start gap-2">
                <i class="fa-solid fa-calendar-check text-emerald-600 mt-0.5 text-sm"></i>
                <div class="text-[11px] leading-snug">
                    <div class="font-black text-emerald-950 uppercase tracking-wide">Permintaan dari Portal Online: ${escapeHtml(jenisLabel)}</div>
                    <div class="font-semibold text-emerald-800 mt-0.5">${escapeHtml(req.nama || req.id_karyawan)} • ${escapeHtml(formatTanggalIndoCompact(req.tanggal_diajukan))}</div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">Dikirim: ${escapeHtml(kirimInfo.tanggal)} ${kirimInfo.jam ? '• ' + escapeHtml(kirimInfo.jam) : ''}</div>
                </div>
            </div>
        `;
        ctxEl.classList.remove('hidden');
    }

    // 4. Pilih Pegawai secara otomatis (case-insensitive)
    const select = document.getElementById('manual-emp-select');
    if (select) {
        const targetOpt = Array.from(select.options).find(o => String(o.value).trim().toLowerCase() === String(req.id_karyawan).trim().toLowerCase());
        if (targetOpt) {
            select.value = targetOpt.value;
        } else {
            const opt = document.createElement('option');
            opt.value = req.id_karyawan;
            opt.text = `${req.nama || req.id_karyawan} (${req.jabatan || '-'})`;
            select.appendChild(opt);
            select.value = req.id_karyawan;
        }
    }

    // 5. Pilih Jenis Status ('LIBUR' atau 'DL') & tampilkan/sembunyikan input jam
    const typeSelect = document.getElementById('manual-type');
    const isDL = String(req.jenis_pengajuan).toUpperCase() === 'DL';
    if (typeSelect) {
        typeSelect.value = isDL ? 'DL' : 'LIBUR';
        if (typeof typeSelect.onchange === 'function') typeSelect.onchange();
    }

    // 6. Isi Tanggal Diajukan (YYYY-MM-DD)
    const dateInput = document.getElementById('manual-date');
    if (dateInput && req.tanggal_diajukan) {
        dateInput.value = String(req.tanggal_diajukan).slice(0, 10);
    }

    // 7. Isi Jam Kerja jika DL
    if (isDL) {
        const jmEl = document.getElementById('manual-jam-masuk');
        const jkEl = document.getElementById('manual-jam-keluar');
        let defaultPulang = '14:00';
        if (req.tanggal_diajukan) {
            const [y, m, d] = String(req.tanggal_diajukan).slice(0, 10).split('-').map(Number);
            const dow = new Date(y, m - 1, d).getDay();
            if (dow === 5) defaultPulang = '11:30';
            else if (dow === 6) defaultPulang = '13:00';
        }
        if (jmEl) jmEl.value = (req.jam_masuk && String(req.jam_masuk).slice(0, 5)) || '07:30';
        if (jkEl) jkEl.value = (req.jam_pulang && String(req.jam_pulang).slice(0, 5)) || defaultPulang;
    }

    // 8. Isi Keterangan
    const descEl = document.getElementById('manual-desc');
    if (descEl) {
        const defaultKet = isDL ? 'Dinas Luar (Permintaan Portal Online)' : 'Jadwal Libur (Permintaan Portal Online)';
        descEl.value = req.keterangan && req.keterangan.trim() ? req.keterangan.trim() : defaultKet;
    }
}

window.markJadwalLiburProcessed = async function(kodePermintaan) {
    if (!kodePermintaan) return;
    try {
        await fetch(`${API_BASE}/jadwal-libur/permintaan/${encodeURIComponent(kodePermintaan)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'processed' })
        });
    } catch (e) {
        console.error('Gagal update status permintaan jadwal libur:', e);
    }
};

async function rejectJadwalLiburRequest(event, kodePermintaan, nama) {
    if (event) event.stopPropagation();
    if (!confirm(`Tolak permintaan jadwal libur / DL dari "${nama}"?`)) return;

    try {
        const res = await fetch(`${API_BASE}/jadwal-libur/permintaan/${encodeURIComponent(kodePermintaan)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected' })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Permintaan dari ${nama} ditandai ditolak.`, 'info');
            await loadJadwalLiburRequests(true);
        } else {
            showToast(json.message || 'Gagal menolak permintaan.', 'error');
        }
    } catch (e) {
        showToast('Gagal menghubungi server: ' + e.message, 'error');
    }
}

async function deleteJadwalLiburRequest(event, kodePermintaan, nama) {
    if (event) event.stopPropagation();
    if (!confirm(`Hapus riwayat permintaan dari "${nama}" dari tabel?`)) return;

    try {
        const res = await fetch(`${API_BASE}/jadwal-libur/permintaan/${encodeURIComponent(kodePermintaan)}`, {
            method: 'DELETE'
        });
        const json = await res.json();
        if (json.success) {
            showToast('Riwayat permintaan berhasil dihapus.', 'success');
            await loadJadwalLiburRequests(true);
        } else {
            showToast(json.message || 'Gagal menghapus.', 'error');
        }
    } catch (e) {
        showToast('Gagal menghubungi server: ' + e.message, 'error');
    }
}
