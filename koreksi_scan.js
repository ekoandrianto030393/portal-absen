/**
 * koreksi_scan.js
 * Modul Permintaan Koreksi Lupa Scan Masuk / Pulang dari Portal Online
 * Terhubung dua arah antara portal-online dan dashboard.html (biometrik).
 */

let globalKoreksiScanList = [];
let ksStatusFilter = 'ALL';
let ksJenisFilter = 'ALL';
window.activeKoreksiScanKode = null;

function ksFormatTanggalIndo(dateStr) {
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

function ksFormatTglKirimIndo(dtStr) {
    if (!dtStr) return { hari: '', tanggal: '-', jam: '' };
    const raw = String(dtStr).replace('T', ' ').slice(0, 19);
    const [datePart, timePart] = raw.split(' ');
    const dParts = (datePart || '').split('-').map(Number);
    if (dParts.length !== 3 || dParts.some(isNaN)) return { hari: '', tanggal: raw, jam: '' };
    const [y, m, d] = dParts;
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

function updateKoreksiScanBadges(pendingCount) {
    const cnt = Number(pendingCount || 0);
    const ids = ['sidebar-koreksi-scan-badge', 'overview-ks-badge', 'sidebar-parent-ks-badge'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        if (cnt > 0) {
            el.textContent = cnt;
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });
}

async function refreshKoreksiScanBadge() {
    try {
        const res = await fetch(`${API_BASE}/koreksi-scan/permintaan?_t=${Date.now()}`);
        const json = await res.json();
        if (json && json.success && Array.isArray(json.data)) {
            const pendingCount = json.data.filter(r => r.status === 'pending').length;
            updateKoreksiScanBadges(pendingCount);
        }
    } catch (e) {
        // Silent background fail
    }
}

async function loadKoreksiScanRequests(silent = false) {
    const tbody = document.getElementById('table-koreksi-scan-body');
    if (tbody && !silent) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="p-10 text-center text-slate-400">
                    <i class="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600 mb-2"></i>
                    <div class="text-xs font-bold">Menyinkronkan pengajuan koreksi lupa scan...</div>
                </td>
            </tr>
        `;
    }

    try {
        const res = await fetch(`${API_BASE}/koreksi-scan/permintaan?_t=${Date.now()}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.message || 'Gagal memuat daftar koreksi lupa scan.');

        globalKoreksiScanList = Array.isArray(json.data) ? json.data : [];
        updateKoreksiScanStats(globalKoreksiScanList);
        renderKoreksiScanTable();

        const syncEl = document.getElementById('ks-last-sync');
        if (syncEl) {
            const nowStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            syncEl.textContent = `Sinkron terakhir: ${nowStr} WIB`;
        }
    } catch (e) {
        console.error('Error loadKoreksiScanRequests:', e);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-rose-600 font-bold"><i class="fa-solid fa-triangle-exclamation mr-2"></i>${escapeHtml(e.message)}</td></tr>`;
        }
    }
}

function updateKoreksiScanStats(list) {
    const pending = list.filter(r => r.status === 'pending').length;
    const lupaPulang = list.filter(r => String(r.jenis_lupa).toUpperCase() === 'LUPA_PULANG').length;
    const lupaMasuk = list.filter(r => ['LUPA_MASUK', 'LUPA_KEDUANYA'].includes(String(r.jenis_lupa).toUpperCase())).length;
    const approved = list.filter(r => r.status === 'approved').length;

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setVal('ks-stat-pending', `${pending} Permintaan`);
    setVal('ks-stat-pulang', `${lupaPulang} Pengajuan`);
    setVal('ks-stat-masuk', `${lupaMasuk} Pengajuan`);
    setVal('ks-stat-approved', `${approved} Disetujui`);
    updateKoreksiScanBadges(pending);
}

function setKoreksiScanStatusFilter(statusVal) {
    ksStatusFilter = statusVal;
    document.querySelectorAll('.ks-status-btn').forEach(btn => {
        const val = btn.getAttribute('data-status');
        if (val === statusVal) {
            btn.className = 'ks-status-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white shadow-sm transition-all';
        } else {
            btn.className = 'ks-status-btn px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-emerald-50 transition-all';
        }
    });
    renderKoreksiScanTable();
}

function setKoreksiScanJenisFilter(jenisVal) {
    ksJenisFilter = jenisVal;
    renderKoreksiScanTable();
}

function renderKoreksiScanTable() {
    const tbody = document.getElementById('table-koreksi-scan-body');
    if (!tbody) return;

    const searchQ = (document.getElementById('search-koreksi-scan')?.value || '').trim().toLowerCase();

    const rows = globalKoreksiScanList.filter(r => {
        if (ksStatusFilter !== 'ALL' && r.status !== ksStatusFilter) return false;
        if (ksJenisFilter !== 'ALL' && String(r.jenis_lupa).toUpperCase() !== ksJenisFilter) return false;
        if (searchQ) {
            const hay = `${r.id_karyawan || ''} ${r.nama || ''} ${r.jabatan || ''} ${r.alasan || ''} ${r.tanggal_absen || ''} ${r.hari_absen || ''}`.toLowerCase();
            if (!hay.includes(searchQ)) return false;
        }
        return true;
    });

    const rankOrder = { 'pending': 0, 'approved': 1, 'rejected': 2 };
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
                    <i class="fa-solid fa-fingerprint text-4xl text-slate-300 mb-3 block"></i>
                    <p class="font-bold text-sm text-slate-500">Belum Ada Pengajuan Koreksi Lupa Scan</p>
                    <p class="text-xs text-slate-400 mt-1">Pengajuan koreksi lupa scan masuk/pulang dari Portal Online akan otomatis tampil di sini.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = rows.map((r, idx) => {
        const jenis = String(r.jenis_lupa || 'LUPA_PULANG').toUpperCase();
        const isPending = r.status === 'pending';
        const isApproved = r.status === 'approved';

        let jenisBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300"><i class="fa-solid fa-right-from-bracket"></i> Lupa Scan Pulang</span>`;
        if (jenis === 'LUPA_MASUK') {
            jenisBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-violet-100 text-violet-800 border border-violet-300"><i class="fa-solid fa-right-to-bracket"></i> Lupa Scan Masuk</span>`;
        } else if (jenis === 'LUPA_KEDUANYA') {
            jenisBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300"><i class="fa-solid fa-triangle-exclamation"></i> Lupa Masuk &amp; Pulang</span>`;
        }

        const tglFormatted = ksFormatTanggalIndo(r.tanggal_absen);
        const curMasuk = r.absen_jam_masuk ? String(r.absen_jam_masuk).slice(0, 5) : (r.jam_masuk_lama ? String(r.jam_masuk_lama).slice(0, 5) : '--:--');
        const curPulang = r.absen_jam_keluar ? String(r.absen_jam_keluar).slice(0, 5) : (r.jam_pulang_lama ? String(r.jam_pulang_lama).slice(0, 5) : '--:--');
        const ajMasuk = r.jam_masuk_ajuan ? String(r.jam_masuk_ajuan).slice(0, 5) : curMasuk;
        const ajPulang = r.jam_pulang_ajuan ? String(r.jam_pulang_ajuan).slice(0, 5) : curPulang;

        const jamCompareHtml = `
            <div class="space-y-1">
                <div class="text-[10px] font-mono text-slate-500">
                    Mesin: <span class="font-bold text-slate-700">${escapeHtml(curMasuk)}</span> - <span class="font-bold text-slate-700">${escapeHtml(curPulang)}</span>
                </div>
                <div class="text-[11px] font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5 inline-block">
                    Ajuan: ${escapeHtml(ajMasuk)} - ${escapeHtml(ajPulang)} WIB
                </div>
            </div>
        `;

        const kirimInfo = ksFormatTglKirimIndo(r.tanggal_kirim);
        const kirimHtml = `
            <div class="text-[11px] font-bold text-slate-700">${escapeHtml(kirimInfo.tanggal || '-')}</div>
            <div class="text-[10px] text-slate-500 font-mono">${escapeHtml(kirimInfo.hari)}${kirimInfo.jam ? ' • ' + escapeHtml(kirimInfo.jam) : ''}</div>
        `;

        let statusBadge = '';
        if (isPending) {
            statusBadge = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Menunggu Admin</span>`;
        } else if (isApproved) {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300"><i class="fa-solid fa-circle-check"></i>Disetujui</span>`;
        } else {
            statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-700 border border-rose-300"><i class="fa-solid fa-circle-xmark"></i>Ditolak</span>`;
        }

        const noteHtml = r.catatan_admin
            ? `<div class="mt-1 text-[10px] font-bold text-rose-600">Catatan: ${escapeHtml(r.catatan_admin)}</div>`
            : '';

        const rowHighlight = isPending
            ? 'bg-amber-50/35 hover:bg-emerald-50/70'
            : 'bg-white hover:bg-slate-50';

        const actionBtns = `
            <div class="flex items-center justify-center gap-1.5 flex-wrap">
                ${isPending ? `
                    <button type="button" onclick="approveKoreksiScanRequest(event, '${escapeHtml(r.kode_koreksi)}', '${escapeHtml(r.nama || r.id_karyawan)}')"
                        class="px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white transition-all flex items-center gap-1"
                        title="Setujui & Otomatis Perbarui Data Absensi">
                        <i class="fa-solid fa-check"></i> Setujui
                    </button>
                ` : ''}
                <button type="button" onclick="event.stopPropagation(); openManualFromKoreksiScan('${escapeHtml(r.kode_koreksi)}')"
                    class="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 transition-all flex items-center gap-1"
                    title="Buka di Modal Input Manual untuk Edit Jam Sebelum Simpan">
                    <i class="fa-solid fa-pen-to-square"></i> Manual
                </button>
                ${isPending ? `
                    <button type="button" onclick="rejectKoreksiScanRequest(event, '${escapeHtml(r.kode_koreksi)}', '${escapeHtml(r.nama || r.id_karyawan)}')"
                        class="px-2 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 text-[11px] font-bold transition-all"
                        title="Tolak Pengajuan Koreksi">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                ` : ''}
                <button type="button" onclick="deleteKoreksiScanRequest(event, '${escapeHtml(r.kode_koreksi)}', '${escapeHtml(r.nama || r.id_karyawan)}')"
                    class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-600 text-slate-500 hover:text-white text-[11px] font-bold transition-all"
                    title="Hapus Riwayat Pengajuan">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;

        return `
            <tr onclick="openManualFromKoreksiScan('${escapeHtml(r.kode_koreksi)}')"
                class="${rowHighlight} cursor-pointer transition-colors group border-b border-slate-100"
                title="Klik baris ini untuk edit/simpan lewat Input Manual">
                <td class="px-3 py-2.5 text-center font-bold text-slate-500">${idx + 1}</td>
                <td class="px-3 py-2.5 font-mono font-black text-teal-800">${escapeHtml(r.id_karyawan)}</td>
                <td class="px-4 py-2.5">
                    <div class="font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">${escapeHtml(r.nama || r.id_karyawan)}</div>
                    <div class="text-[9px] text-emerald-600 font-bold opacity-80"><i class="fa-solid fa-hand-pointer mr-1"></i>Klik baris untuk Input Manual</div>
                </td>
                <td class="px-3 py-2.5 font-semibold text-slate-600 uppercase text-[11px]">${escapeHtml(r.jabatan || 'Staf')}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">${jenisBadge}</td>
                <td class="px-4 py-2.5 whitespace-nowrap">
                    <div class="font-black text-slate-900 text-xs">${escapeHtml(tglFormatted)}</div>
                    <div class="text-[10px] font-bold text-slate-400">Tahun: ${escapeHtml(String(r.tahun_absen || String(r.tanggal_absen || '').slice(0, 4)))}</div>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap">${jamCompareHtml}</td>
                <td class="px-3 py-2.5 max-w-[220px]">
                    <span class="text-xs text-slate-700 font-medium break-words">${escapeHtml(r.alasan || '-')}</span>
                    ${noteHtml}
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap">${kirimHtml}</td>
                <td class="px-3 py-2.5 text-center whitespace-nowrap">
                    <div class="space-y-1.5">
                        <div>${statusBadge}</div>
                        ${actionBtns}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

async function approveKoreksiScanRequest(event, kodeKoreksi, nama) {
    if (event) event.stopPropagation();
    const req = globalKoreksiScanList.find(r => r.kode_koreksi === kodeKoreksi);
    if (!req) return;
    const tglStr = ksFormatTanggalIndo(req.tanggal_absen);
    if (!confirm(`Setujui koreksi lupa scan untuk "${nama}" pada ${tglStr} dan perbarui data absensi otomatis?`)) return;

    try {
        const res = await fetch(`${API_BASE}/koreksi-scan/permintaan/${encodeURIComponent(kodeKoreksi)}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
            throw new Error(json.message || 'Gagal menyetujui koreksi scan.');
        }

        showToast(json.message || `Koreksi scan ${nama} disetujui & absensi diperbarui!`, 'success');
        await loadKoreksiScanRequests(true);
        if (typeof loadDailyData === 'function') loadDailyData(true);
        if (typeof loadOverviewData === 'function') loadOverviewData(true);
        if (typeof loadEnterpriseBroadcast === 'function') loadEnterpriseBroadcast();
    } catch (e) {
        showToast('Gagal menyetujui: ' + e.message, 'error');
    }
}

async function openManualFromKoreksiScan(kodeKoreksi) {
    const req = globalKoreksiScanList.find(r => r.kode_koreksi === kodeKoreksi);
    if (!req) return;

    if (typeof openManualModal === 'function') {
        await openManualModal();
    }

    window.activeKoreksiScanKode = req.kode_koreksi;

    const ctxEl = document.getElementById('manual-jadwal-context');
    if (ctxEl) {
        const kirimInfo = ksFormatTglKirimIndo(req.tanggal_kirim);
        const jenisLabel = req.jenis_lupa === 'LUPA_MASUK'
            ? 'Koreksi Lupa Scan Masuk'
            : (req.jenis_lupa === 'LUPA_KEDUANYA' ? 'Koreksi Lupa Scan Masuk & Pulang' : 'Koreksi Lupa Scan Pulang');
        ctxEl.innerHTML = `
            <div class="flex items-start gap-2">
                <i class="fa-solid fa-fingerprint text-emerald-600 mt-0.5 text-sm"></i>
                <div class="text-[11px] leading-snug">
                    <div class="font-black text-emerald-950 uppercase tracking-wide">${escapeHtml(jenisLabel)} (Portal Online)</div>
                    <div class="font-semibold text-emerald-800 mt-0.5">${escapeHtml(req.nama || req.id_karyawan)} • ${escapeHtml(ksFormatTanggalIndo(req.tanggal_absen))}</div>
                    <div class="text-[10px] text-emerald-700 mt-0.5">Dikirim: ${escapeHtml(kirimInfo.tanggal)} ${kirimInfo.jam ? '• ' + escapeHtml(kirimInfo.jam) : ''}</div>
                </div>
            </div>
        `;
        ctxEl.classList.remove('hidden');
    }

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

    const typeSelect = document.getElementById('manual-type');
    if (typeSelect) {
        typeSelect.value = 'HADIR_MANUAL';
        if (typeof typeSelect.onchange === 'function') typeSelect.onchange();
    }

    const dateInput = document.getElementById('manual-date');
    if (dateInput && req.tanggal_absen) {
        dateInput.value = String(req.tanggal_absen).slice(0, 10);
    }

    const curMasuk = req.absen_jam_masuk || req.jam_masuk_lama || '';
    const curPulang = req.absen_jam_keluar || req.jam_pulang_lama || '';
    const finalMasuk = req.jam_masuk_ajuan || curMasuk || '07:30';
    const finalPulang = req.jam_pulang_ajuan || curPulang || '';

    const jmEl = document.getElementById('manual-jam-masuk');
    const jkEl = document.getElementById('manual-jam-keluar');
    if (jmEl) jmEl.value = finalMasuk ? String(finalMasuk).slice(0, 5) : '07:30';
    if (jkEl) jkEl.value = finalPulang ? String(finalPulang).slice(0, 5) : '';

    const descEl = document.getElementById('manual-desc');
    if (descEl) {
        descEl.value = req.alasan && req.alasan.trim()
            ? `Koreksi Lupa Scan: ${req.alasan.trim()}`
            : 'Koreksi Lupa Scan (Permintaan Portal Online)';
    }
}

window.markKoreksiScanProcessed = async function(kodeKoreksi) {
    if (!kodeKoreksi) return;
    try {
        await fetch(`${API_BASE}/koreksi-scan/permintaan/${encodeURIComponent(kodeKoreksi)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'approved' })
        });
    } catch (e) {
        console.error('Gagal update status koreksi scan:', e);
    }
};

async function rejectKoreksiScanRequest(event, kodeKoreksi, nama) {
    if (event) event.stopPropagation();
    const alasanAdmin = prompt(`Alasan penolakan koreksi lupa scan untuk "${nama}" (opsional):`, 'Data tidak sesuai catatan tugas');
    if (alasanAdmin === null) return;

    try {
        const res = await fetch(`${API_BASE}/koreksi-scan/permintaan/${encodeURIComponent(kodeKoreksi)}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'rejected', catatan_admin: alasanAdmin.trim() || null })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Pengajuan koreksi dari ${nama} ditolak.`, 'info');
            await loadKoreksiScanRequests(true);
        } else {
            showToast(json.message || 'Gagal menolak pengajuan.', 'error');
        }
    } catch (e) {
        showToast('Gagal menghubungi server: ' + e.message, 'error');
    }
}

async function deleteKoreksiScanRequest(event, kodeKoreksi, nama) {
    if (event) event.stopPropagation();
    if (!confirm(`Hapus riwayat koreksi lupa scan dari "${nama}" dari tabel?`)) return;

    try {
        const res = await fetch(`${API_BASE}/koreksi-scan/permintaan/${encodeURIComponent(kodeKoreksi)}`, {
            method: 'DELETE'
        });
        const json = await res.json();
        if (json.success) {
            showToast('Riwayat koreksi lupa scan dihapus.', 'success');
            await loadKoreksiScanRequests(true);
        } else {
            showToast(json.message || 'Gagal menghapus.', 'error');
        }
    } catch (e) {
        showToast('Gagal menghubungi server: ' + e.message, 'error');
    }
}
