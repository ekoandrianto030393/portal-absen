/**
 * catatan_kehadiran.js
 * Modul Pencatatan & Monitoring Mobilitas Kehadiran Pegawai
 * Khusus memantau pegawai yang:
 * 1. Presensi masuk lalu pulang (standar)
 * 2. Presensi masuk, di jam tertentu pulang/keluar lalu kembali lagi untuk presensi pulang
 */

let daftarSemuaCatatan = [];
let editCatatanId = null;

// Helper: Nama Hari Bahasa Indonesia
function getNamaHariIndo(dateStr) {
    if (!dateStr) return '';
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const d = new Date(dateStr + 'T00:00:00');
    return hari[d.getDay()] || '';
}

// Helper: Format Tanggal Cantik (e.g., Sabtu, 07 Nov 2026)
function formatTanggalIndoLengkap(dateStr) {
    if (!dateStr) return '-';
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const d = new Date(dateStr + 'T00:00:00');
    const namaHari = getNamaHariIndo(dateStr);
    const tgl = String(d.getDate()).padStart(2, '0');
    const bln = bulan[d.getMonth()];
    const thn = d.getFullYear();
    return `${namaHari}, ${tgl} ${bln} ${thn}`;
}

// Inisialisasi awal saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
    initCatatanKehadiran();
});

function initCatatanKehadiran() {
    const filterTgl = document.getElementById('filter-catatan-tanggal');
    if (!filterTgl) return;

    // Set default tanggal hari ini
    const today = new Date().toISOString().split('T')[0];
    if (!filterTgl.value) {
        filterTgl.value = today;
    }
    updateHariBadge(filterTgl.value);

    // Muat daftar pegawai ke dropdown filter dan modal
    populateCatatanPegawaiDropdowns();
}

function updateHariBadge(tgl) {
    const hariLabel = document.getElementById('catatan-hari-label');
    const badgeHari = document.getElementById('catatan-badge-hari');
    const namaHari = getNamaHariIndo(tgl);
    const teksLengkap = formatTanggalIndoLengkap(tgl);

    if (hariLabel) hariLabel.textContent = namaHari || 'Pilih Tanggal';
    if (badgeHari) badgeHari.textContent = teksLengkap;
}

function setCatatanTanggalHariIni() {
    const today = new Date().toISOString().split('T')[0];
    const filterTgl = document.getElementById('filter-catatan-tanggal');
    if (filterTgl) {
        filterTgl.value = today;
        updateHariBadge(today);
        loadCatatanData();
    }
}

function setCatatanTanggalKemarin() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const kemarin = d.toISOString().split('T')[0];
    const filterTgl = document.getElementById('filter-catatan-tanggal');
    if (filterTgl) {
        filterTgl.value = kemarin;
        updateHariBadge(kemarin);
        loadCatatanData();
    }
}

// Mengisi dropdown pilihan pegawai
async function populateCatatanPegawaiDropdowns() {
    try {
        const res = await fetch(`${API_BASE}/karyawan/descriptors?_t=${Date.now()}`);
        const json = await res.json();
        const emps = json.descriptors || [];

        const selFilter = document.getElementById('filter-catatan-pegawai');
        const selModal = document.getElementById('catatan-modal-karyawan');

        if (selFilter) {
            selFilter.innerHTML = '<option value="">Semua Pegawai</option>';
            emps.forEach(e => {
                selFilter.innerHTML += `<option value="${e.id_karyawan}">${e.nama} (${e.id_karyawan})</option>`;
            });
        }

        if (selModal) {
            selModal.innerHTML = '<option value="">-- Pilih Pegawai --</option>';
            emps.forEach(e => {
                selModal.innerHTML += `<option value="${e.id_karyawan}" data-nama="${e.nama}" data-jabatan="${e.jabatan || ''}">${e.nama} - ${e.jabatan || 'Staf'}</option>`;
            });
        }
    } catch (err) {
        console.error('Gagal memuat list pegawai untuk catatan:', err);
    }
}

// Memuat data catatan dari server
async function loadCatatanData() {
    const tglInput = document.getElementById('filter-catatan-tanggal');
    const pegInput = document.getElementById('filter-catatan-pegawai');
    const polaInput = document.getElementById('filter-catatan-pola');
    const tbody = document.getElementById('table-catatan-body');

    if (!tbody) return;

    const tanggal = tglInput ? tglInput.value : '';
    const id_karyawan = pegInput ? pegInput.value : '';
    const tipe_pola = polaInput ? polaInput.value : '';

    updateHariBadge(tanggal);

    tbody.innerHTML = `
        <tr>
            <td colspan="10" class="text-center py-8 text-slate-400">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-teal-600 mb-2"></i>
                <div class="text-xs font-semibold">Memuat data catatan kehadiran...</div>
            </td>
        </tr>
    `;

    try {
        let url = `${API_BASE}/catatan-kehadiran?_t=${Date.now()}`;
        if (tanggal) url += `&tanggal=${encodeURIComponent(tanggal)}`;
        if (id_karyawan) url += `&id_karyawan=${encodeURIComponent(id_karyawan)}`;
        if (tipe_pola) url += `&tipe_pola=${encodeURIComponent(tipe_pola)}`;

        const response = await fetch(url);
        const result = await response.json();

        if (result.success) {
            daftarSemuaCatatan = result.data || [];
            updateCatatanStatistik(daftarSemuaCatatan);
            renderCatatanTable(daftarSemuaCatatan);
        } else {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-center py-6 text-rose-500 font-semibold">
                        Gagal mengambil data: ${result.message}
                    </td>
                </tr>
            `;
        }
    } catch (err) {
        console.error('Error loadCatatanData:', err);
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-6 text-rose-500 font-semibold">
                    Terjadi kesalahan koneksi server saat memuat catatan.
                </td>
            </tr>
        `;
    }
}

// Update 4 kartu statistik ringkasan
function updateCatatanStatistik(data) {
    const totalEl = document.getElementById('catatan-stat-total');
    const masukPulangEl = document.getElementById('catatan-stat-masuk-pulang');
    const keluarKembaliEl = document.getElementById('catatan-stat-keluar-kembali');
    const lainnyaEl = document.getElementById('catatan-stat-lainnya');
    const countInfo = document.getElementById('catatan-info-count');

    let masukPulang = 0;
    let keluarKembali = 0;
    let lainnya = 0;

    data.forEach(item => {
        if (item.tipe_pola === 'masuk_pulang') masukPulang++;
        else if (item.tipe_pola === 'keluar_kembali') keluarKembali++;
        else lainnya++;
    });

    if (totalEl) totalEl.textContent = data.length;
    if (masukPulangEl) masukPulangEl.textContent = masukPulang;
    if (keluarKembaliEl) keluarKembaliEl.textContent = keluarKembali;
    if (lainnyaEl) lainnyaEl.textContent = lainnya;
    if (countInfo) countInfo.textContent = `Menampilkan ${data.length} catatan kehadiran`;
}

// Render data ke tabel
function renderCatatanTable(data) {
    const tbody = document.getElementById('table-catatan-body');
    if (!tbody) return;

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="text-center py-12 text-slate-400">
                    <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400 text-2xl">
                        <i class="fa-solid fa-clipboard"></i>
                    </div>
                    <div class="text-sm font-bold text-slate-600">Belum Ada Catatan Kehadiran</div>
                    <div class="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Belum ada pegawai yang dicatat untuk tanggal atau filter ini. Klik tombol <strong>+ Tambah Catatan Baru</strong> di atas untuk mencatat.
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    let html = '';
    data.forEach((row, index) => {
        const tglIndo = formatTanggalIndoLengkap(row.tanggal);

        // Badge Pola Kehadiran
        let badgePola = '';
        if (row.tipe_pola === 'masuk_pulang') {
            badgePola = `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs">
                    <i class="fa-solid fa-arrow-right-to-bracket text-emerald-600"></i> Masuk ➔ Pulang
                </span>
            `;
        } else if (row.tipe_pola === 'keluar_kembali') {
            badgePola = `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-xs">
                    <i class="fa-solid fa-clock-rotate-left text-amber-600"></i> Pulang & Kembali
                </span>
            `;
        } else {
            badgePola = `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
                    <i class="fa-solid fa-note-sticky text-blue-600"></i> Catatan Khusus
                </span>
            `;
        }

        const jamMasuk = row.jam_masuk ? `<span class="font-bold text-slate-800 font-mono">${row.jam_masuk}</span>` : '<span class="text-slate-300">-</span>';
        const jamKeluarSmt = row.jam_keluar_sementara ? `<span class="font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200">${row.jam_keluar_sementara}</span>` : '<span class="text-slate-300">-</span>';
        const jamKembali = row.jam_kembali ? `<span class="font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">${row.jam_kembali}</span>` : '<span class="text-slate-300">-</span>';
        const jamPulang = row.jam_pulang ? `<span class="font-bold text-emerald-700 font-mono">${row.jam_pulang}</span>` : '<span class="text-slate-300">-</span>';

        const fotoSrc = row.has_foto ? `${API_BASE}/karyawan/${encodeURIComponent(row.id_karyawan)}/photo?_t=${Date.now()}` : '';

        const avatar = fotoSrc 
            ? `<img src="${fotoSrc}" class="w-8 h-8 rounded-full object-cover border border-slate-300 shadow-2xs" onerror="this.onerror=null; this.src=''; this.parentNode.innerHTML='<div class=\\'w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs\\'>${(row.nama || '?').charAt(0)}</div>';">`
            : `<div class="w-8 h-8 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center text-xs shadow-2xs">${(row.nama || '?').charAt(0)}</div>`;

        html += `
            <tr class="hover:bg-teal-50/50 transition-colors">
                <td class="px-4 py-3 text-center font-bold text-slate-400 text-xs">${index + 1}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <div class="font-bold text-slate-800 text-xs">${tglIndo}</div>
                    <div class="text-[10px] text-slate-400 font-mono">${row.tanggal}</div>
                </td>
                <td class="px-4 py-3">
                    <div class="flex items-center gap-2.5">
                        ${avatar}
                        <div>
                            <div class="font-bold text-slate-800 text-xs">${row.nama || 'Pegawai #' + row.id_karyawan}</div>
                            <div class="text-[11px] text-slate-500 flex items-center gap-1.5">
                                <span class="text-slate-400 font-mono">${row.id_karyawan}</span>
                                <span>•</span>
                                <span class="text-teal-700 font-semibold">${row.jabatan || 'Staf'}</span>
                            </div>
                        </div>
                    </div>
                </td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${badgePola}</td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${jamMasuk}</td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${jamKeluarSmt}</td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${jamKembali}</td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${jamPulang}</td>
                <td class="px-4 py-3">
                    <div class="text-xs text-slate-700 max-w-xs leading-relaxed">${row.keterangan || '<span class="text-slate-300 italic">Tidak ada catatan</span>'}</div>
                    <div class="text-[10px] text-slate-400 mt-0.5"><i class="fa-solid fa-user-pen mr-1"></i>${row.dicatat_oleh || 'Admin'}</div>
                </td>
                <td class="px-4 py-3 text-center whitespace-nowrap">
                    <div class="flex items-center justify-center gap-1.5">
                        <button onclick="bukaModalEditCatatan(${row.id_catatan})" class="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-all" title="Edit Catatan">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="hapusCatatanKehadiran(${row.id_catatan}, '${encodeURIComponent(row.nama || row.id_karyawan)}')" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all" title="Hapus Catatan">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// Live search box client-side
function cariCatatanLocal() {
    const query = (document.getElementById('search-catatan')?.value || '').toLowerCase().trim();
    if (!query) {
        renderCatatanTable(daftarSemuaCatatan);
        return;
    }

    const filtered = daftarSemuaCatatan.filter(item => {
        const nama = (item.nama || '').toLowerCase();
        const id = (item.id_karyawan || '').toLowerCase();
        const jabatan = (item.jabatan || '').toLowerCase();
        const ket = (item.keterangan || '').toLowerCase();
        const tgl = (item.tanggal || '').toLowerCase();
        const hari = getNamaHariIndo(item.tanggal).toLowerCase();

        return nama.includes(query) || id.includes(query) || jabatan.includes(query) || ket.includes(query) || tgl.includes(query) || hari.includes(query);
    });

    renderCatatanTable(filtered);
}

// Buka Modal Tambah Catatan
function bukaModalCatatan() {
    editCatatanId = null;
    const modal = document.getElementById('modal-catatan');
    const modalTitle = document.getElementById('catatan-modal-title');
    const filterTgl = document.getElementById('filter-catatan-tanggal');

    if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-clipboard-plus text-teal-600 mr-2"></i> Tambah Catatan Kehadiran Pegawai';

    // Reset Form
    document.getElementById('catatan-modal-id')?.setAttribute('value', '');
    const selKaryawan = document.getElementById('catatan-modal-karyawan');
    if (selKaryawan) {
        selKaryawan.disabled = false;
        selKaryawan.value = '';
    }

    const tglModal = document.getElementById('catatan-modal-tanggal');
    if (tglModal) {
        tglModal.value = filterTgl?.value || new Date().toISOString().split('T')[0];
    }

    // Default Pola: masuk_pulang
    const radioMasukPulang = document.getElementById('pola-masuk-pulang');
    if (radioMasukPulang) {
        radioMasukPulang.checked = true;
        togglePolaFields('masuk_pulang');
    }

    document.getElementById('catatan-modal-jam-masuk').value = '';
    document.getElementById('catatan-modal-jam-keluar-smt').value = '';
    document.getElementById('catatan-modal-jam-kembali').value = '';
    document.getElementById('catatan-modal-jam-pulang').value = '';
    document.getElementById('catatan-modal-keterangan').value = '';

    const autoBox = document.getElementById('catatan-auto-info-box');
    if (autoBox) autoBox.classList.add('hidden');

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

// Buka Modal Edit Catatan
function bukaModalEditCatatan(idCatatan) {
    const item = daftarSemuaCatatan.find(c => c.id_catatan == idCatatan);
    if (!item) return;

    editCatatanId = idCatatan;
    const modal = document.getElementById('modal-catatan');
    const modalTitle = document.getElementById('catatan-modal-title');

    if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square text-blue-600 mr-2"></i> Edit Catatan Kehadiran';

    const selKaryawan = document.getElementById('catatan-modal-karyawan');
    if (selKaryawan) {
        selKaryawan.value = item.id_karyawan;
        selKaryawan.disabled = true; // Kunci pegawai saat edit
    }

    const tglModal = document.getElementById('catatan-modal-tanggal');
    if (tglModal) tglModal.value = item.tanggal;

    // Set pola
    if (item.tipe_pola === 'keluar_kembali') {
        const r = document.getElementById('pola-keluar-kembali');
        if (r) r.checked = true;
    } else if (item.tipe_pola === 'lainnya') {
        const r = document.getElementById('pola-lainnya');
        if (r) r.checked = true;
    } else {
        const r = document.getElementById('pola-masuk-pulang');
        if (r) r.checked = true;
    }
    togglePolaFields(item.tipe_pola);

    document.getElementById('catatan-modal-jam-masuk').value = item.jam_masuk || '';
    document.getElementById('catatan-modal-jam-keluar-smt').value = item.jam_keluar_sementara || '';
    document.getElementById('catatan-modal-jam-kembali').value = item.jam_kembali || '';
    document.getElementById('catatan-modal-jam-pulang').value = item.jam_pulang || '';
    document.getElementById('catatan-modal-keterangan').value = item.keterangan || '';

    const autoBox = document.getElementById('catatan-auto-info-box');
    if (autoBox) autoBox.classList.add('hidden');

    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function tutupModalCatatan() {
    const modal = document.getElementById('modal-catatan');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Mengatur visibility field keluar sementara & kembali berdasarkan radio pola terpilih
function togglePolaFields(pola) {
    const container = document.getElementById('catatan-field-keluar-kembali');
    if (!container) return;

    if (pola === 'keluar_kembali') {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

// Ketika pegawai atau tanggal diubah di modal, coba ambil presensi riil hari itu
async function onModalPegawaiOrDateChange() {
    const selKaryawan = document.getElementById('catatan-modal-karyawan');
    const tglModal = document.getElementById('catatan-modal-tanggal');
    const autoBox = document.getElementById('catatan-auto-info-box');

    const idKaryawan = selKaryawan ? selKaryawan.value : '';
    const tanggal = tglModal ? tglModal.value : '';

    if (!idKaryawan || !tanggal) {
        if (autoBox) autoBox.classList.add('hidden');
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/catatan-kehadiran/info-presensi?id_karyawan=${encodeURIComponent(idKaryawan)}&tanggal=${encodeURIComponent(tanggal)}&_t=${Date.now()}`);
        const json = await res.json();

        if (json.success && json.data) {
            const presensi = json.data;
            if (autoBox) {
                autoBox.classList.remove('hidden');
                autoBox.innerHTML = `
                    <div class="flex items-center gap-2 text-xs font-semibold text-teal-800">
                        <i class="fa-solid fa-circle-check text-emerald-500"></i>
                        <span>Data Absensi Ditemukan: Masuk <strong>${presensi.jam_masuk || '-'}</strong> | Pulang <strong>${presensi.jam_keluar || '-'}</strong> (Status: ${presensi.status || 'HADIR'})</span>
                    </div>
                `;
            }

            // Auto-fill jika kolom jam_masuk / jam_pulang masih kosong
            const jm = document.getElementById('catatan-modal-jam-masuk');
            const jp = document.getElementById('catatan-modal-jam-pulang');
            if (jm && !jm.value && presensi.jam_masuk) jm.value = presensi.jam_masuk;
            if (jp && !jp.value && presensi.jam_keluar) jp.value = presensi.jam_keluar;
        } else {
            if (autoBox) {
                autoBox.classList.remove('hidden');
                autoBox.innerHTML = `
                    <div class="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <i class="fa-solid fa-circle-info text-blue-500"></i>
                        <span>Belum ada data scan absensi resmi untuk pegawai ini pada tanggal ${tanggal}. Anda tetap bisa mencatat secara manual.</span>
                    </div>
                `;
            }
        }
    } catch (e) {
        console.warn('Gagal ambil info presensi modal:', e);
    }
}

// Simpan Catatan (Tambah Baru atau Update)
async function simpanCatatanKehadiran() {
    const selKaryawan = document.getElementById('catatan-modal-karyawan');
    const tglModal = document.getElementById('catatan-modal-tanggal');
    const jm = document.getElementById('catatan-modal-jam-masuk')?.value || null;
    const jks = document.getElementById('catatan-modal-jam-keluar-smt')?.value || null;
    const jk = document.getElementById('catatan-modal-jam-kembali')?.value || null;
    const jp = document.getElementById('catatan-modal-jam-pulang')?.value || null;
    const ket = document.getElementById('catatan-modal-keterangan')?.value || '';

    // Ambil radio pola
    let pola = 'masuk_pulang';
    if (document.getElementById('pola-keluar-kembali')?.checked) pola = 'keluar_kembali';
    else if (document.getElementById('pola-lainnya')?.checked) pola = 'lainnya';

    const idKaryawan = selKaryawan?.value;
    const tanggal = tglModal?.value;

    if (!idKaryawan) {
        alert('Silakan pilih nama pegawai terlebih dahulu!');
        return;
    }
    if (!tanggal) {
        alert('Silakan tentukan tanggal catatan!');
        return;
    }

    const payload = {
        id_karyawan: idKaryawan,
        tanggal: tanggal,
        tipe_pola: pola,
        jam_masuk: jm,
        jam_keluar_sementara: jks,
        jam_kembali: jk,
        jam_pulang: jp,
        keterangan: ket,
        dicatat_oleh: 'Admin'
    };

    try {
        let url = `${API_BASE}/catatan-kehadiran`;
        let method = 'POST';

        if (editCatatanId) {
            url += `/${editCatatanId}`;
            method = 'PUT';
        }

        const res = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '')
            },
            body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.success) {
            tutupModalCatatan();
            loadCatatanData();
            // Feedback sukses
            if (typeof showToast === 'function') {
                showToast('Catatan kehadiran berhasil disimpan!', 'success');
            } else {
                alert('Catatan kehadiran berhasil disimpan!');
            }
        } else {
            alert('Gagal menyimpan catatan: ' + json.message);
        }
    } catch (err) {
        console.error('Error simpanCatatanKehadiran:', err);
        alert('Terjadi kesalahan koneksi ke server saat menyimpan catatan.');
    }
}

// Hapus Catatan Kehadiran
async function hapusCatatanKehadiran(idCatatan, encodedNama) {
    const nama = decodeURIComponent(encodedNama || 'Pegawai ini');
    if (!confirm(`Apakah Anda yakin ingin menghapus catatan kehadiran untuk ${nama}?`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/catatan-kehadiran/${idCatatan}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + (localStorage.getItem('admin_token') || '')
            }
        });
        const json = await res.json();
        if (json.success) {
            loadCatatanData();
        } else {
            alert('Gagal menghapus: ' + json.message);
        }
    } catch (err) {
        console.error('Error hapusCatatanKehadiran:', err);
        alert('Terjadi kesalahan saat menghapus catatan.');
    }
}

// Export CSV Catatan
function exportCatatanCSV() {
    if (!daftarSemuaCatatan || daftarSemuaCatatan.length === 0) {
        alert('Tidak ada data catatan untuk diekspor!');
        return;
    }

    const tglFilter = document.getElementById('filter-catatan-tanggal')?.value || 'semua';
    let csv = 'No,Tanggal,Hari,ID Pegawai,Nama Pegawai,Jabatan,Pola Kehadiran,Jam Masuk,Jam Keluar Sementara,Jam Kembali,Jam Presensi Pulang,Catatan/Keterangan,Dicatat Oleh\n';

    daftarSemuaCatatan.forEach((row, i) => {
        const hari = getNamaHariIndo(row.tanggal);
        let polaLabel = 'Masuk lalu Pulang';
        if (row.tipe_pola === 'keluar_kembali') polaLabel = 'Pulang Jam Tertentu & Kembali';
        else if (row.tipe_pola === 'lainnya') polaLabel = 'Catatan Khusus';

        const safeKet = `"${(row.keterangan || '').replace(/"/g, '""')}"`;
        const safeNama = `"${(row.nama || '').replace(/"/g, '""')}"`;

        csv += `${i + 1},${row.tanggal},${hari},${row.id_karyawan},${safeNama},${row.jabatan || ''},"${polaLabel}",${row.jam_masuk || '-'},${row.jam_keluar_sementara || '-'},${row.jam_kembali || '-'},${row.jam_pulang || '-'},${safeKet},${row.dicatat_oleh || 'Admin'}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Catatan_Kehadiran_${tglFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Cetak Catatan Kehadiran Resmi
function cetakCatatanKehadiran() {
    if (!daftarSemuaCatatan || daftarSemuaCatatan.length === 0) {
        alert('Tidak ada data catatan untuk dicetak!');
        return;
    }

    const tglFilter = document.getElementById('filter-catatan-tanggal')?.value || '';
    const namaHari = getNamaHariIndo(tglFilter);
    const tglLengkap = formatTanggalIndoLengkap(tglFilter);

    const win = window.open('', '_blank');
    let rowsHtml = '';

    daftarSemuaCatatan.forEach((row, i) => {
        let polaLabel = 'Masuk ➔ Pulang';
        if (row.tipe_pola === 'keluar_kembali') polaLabel = 'Pulang Tertentu & Kembali';
        else if (row.tipe_pola === 'lainnya') polaLabel = 'Catatan Khusus';

        rowsHtml += `
            <tr>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${i + 1}</td>
                <td style="padding: 6px; border: 1px solid #000;"><strong>${row.nama || '-'}</strong><br><small>${row.id_karyawan} - ${row.jabatan || 'Staf'}</small></td>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${polaLabel}</td>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${row.jam_masuk || '-'}</td>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${row.jam_keluar_sementara || '-'}</td>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${row.jam_kembali || '-'}</td>
                <td style="text-align: center; padding: 6px; border: 1px solid #000;">${row.jam_pulang || '-'}</td>
                <td style="padding: 6px; border: 1px solid #000;">${row.keterangan || '-'}</td>
            </tr>
        `;
    });

    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Laporan Catatan Kehadiran Pegawai - ${tglLengkap}</title>
            <style>
                body { font-family: 'Times New Roman', serif; margin: 20px; color: #000; font-size: 12px; }
                .kop { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 16px; }
                .kop h3 { margin: 2px 0; font-size: 14px; text-transform: uppercase; }
                .kop h2 { margin: 2px 0; font-size: 18px; text-transform: uppercase; font-weight: bold; }
                .kop p { margin: 2px 0; font-size: 11px; font-style: italic; }
                table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
                th { background: #f0f0f0; border: 1px solid #000; padding: 8px 4px; text-transform: uppercase; font-size: 10px; }
                .ttd { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; }
                .ttd div { width: 220px; }
                @media print {
                    @page { margin: 1.5cm; }
                }
            </style>
        </head>
        <body>
            <div class="kop">
                <h3>PEMERINTAH KABUPATEN LAMPUNG TIMUR</h3>
                <h3>DINAS KESEHATAN</h3>
                <h2>UPTD PUSKESMAS WANA</h2>
                <p>Jl. Pengiran Iro Kusumo Wana Kecamatan Melinting</p>
            </div>

            <div style="text-align: center; margin-bottom: 14px;">
                <h3 style="margin: 0; text-transform: uppercase; text-decoration: underline;">LAPORAN CATATAN KEHADIRAN & MOBILITAS PEGAWAI</h3>
                <p style="margin: 4px 0 0 0; font-weight: bold;">Hari/Tanggal: ${tglLengkap}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width: 30px;">No</th>
                        <th>Nama Pegawai & Jabatan</th>
                        <th>Pola Kehadiran</th>
                        <th>Jam Masuk</th>
                        <th>Keluar/Pulang Jam</th>
                        <th>Kembali Jam</th>
                        <th>Presensi Pulang</th>
                        <th>Catatan / Keterangan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>

            <div class="ttd">
                <div>
                    <p>Mengetahui,</p>
                    <p>Kepala Puskesmas Wana</p>
                    <div style="height: 60px;"></div>
                    <p><strong>( ..................................... )</strong></p>
                    <p>NIP. .....................................</p>
                </div>
                <div>
                    <p>Wana, ${tglLengkap}</p>
                    <p>Petugas / Pengelola Absensi</p>
                    <div style="height: 60px;"></div>
                    <p><strong>( ..................................... )</strong></p>
                    <p>NIP. .....................................</p>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                };
            </script>
        </body>
        </html>
    `);
    win.document.close();
}
