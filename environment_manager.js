/**
 * environment_manager.js - Modul Pengelolaan Environment (.env) Dashboard
 * Fitur:
 * - Menampilkan seluruh variabel .env dalam tabel interaktif enterprise
 * - Pengelompokan kategori (Database Lokal, Cloud, Jam Absensi, AI Biometrik, API, Kredensial)
 * - Input khusus (Password Toggle, Dropdown Boolean, Time Picker, Number Step)
 * - Pencarian variabel instan & Filter kategori
 * - Editor Teks Mentah (Raw Mode)
 * - Simpan perubahan dengan backup otomatis (.env.backup)
 * - Fitur Pulihkan Cadangan (Restore Backup)
 * - Fitur Restart Server Node.js aman dari browser dengan auto-reconnect ping
 */

(function () {
    let envItems = [];
    let envRawText = '';
    let originalEnvMap = {};
    let currentCategory = 'ALL';
    let searchQuery = '';
    let currentViewMode = 'table'; // 'table' | 'raw'
    let isSaving = false;
    let allSecretsRevealed = false;

    // Inisialisasi saat DOM siap
    document.addEventListener('DOMContentLoaded', () => {
        // Cek jika tab dibuka
        const navBtn = document.getElementById('nav-environment');
        if (navBtn) {
            navBtn.addEventListener('click', () => {
                loadEnvData();
            });
        }
    });

    // Ekspos ke global window
    window.loadEnvData = loadEnvData;
    window.renderEnvTable = renderEnvTable;
    window.filterEnvCategory = filterEnvCategory;
    window.filterEnvSearch = filterEnvSearch;
    window.toggleEnvViewMode = toggleEnvViewMode;
    window.toggleSecretVisibility = toggleSecretVisibility;
    window.toggleAllSecretsVisibility = toggleAllSecretsVisibility;
    window.resetRowEnvValue = resetRowEnvValue;
    window.saveEnvChanges = saveEnvChanges;
    window.restoreEnvBackup = restoreEnvBackup;
    window.restartNodeServer = restartNodeServer;
    window.openAddEnvModal = openAddEnvModal;
    window.closeAddEnvModal = closeAddEnvModal;
    window.submitNewEnvVariable = submitNewEnvVariable;
    window.onEnvInputChange = onEnvInputChange;

    /**
     * Memuat data .env dari server
     */
    async function loadEnvData() {
        const loadingEl = document.getElementById('env-loading-state');
        const contentEl = document.getElementById('env-content-container');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (contentEl) contentEl.classList.add('hidden');

        try {
            const res = await fetch('/api/env');
            if (res.status === 401 || res.status === 403) {
                showEnvToast('Sesi login telah habis. Silakan login kembali.', 'error');
                return;
            }

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || 'Gagal memuat konfigurasi .env');
            }

            envItems = data.items || [];
            envRawText = data.raw || '';
            originalEnvMap = {};
            envItems.forEach(item => {
                originalEnvMap[item.key] = item.value;
            });

            // Update statistik
            updateEnvStats(data);

            // Set isi textarea raw
            const textarea = document.getElementById('env-raw-textarea');
            if (textarea) textarea.value = envRawText;

            // Render tabel
            renderEnvTable();

            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');

            const tableEl = document.getElementById('env-table-container');
            if (tableEl) {
                tableEl.scrollLeft = 0;
                tableEl.scrollTop = 0;
            }

        } catch (err) {
            console.error('Error loadEnvData:', err);
            if (loadingEl) {
                loadingEl.innerHTML = `
                    <div class="p-6 text-center text-rose-600 bg-rose-50 rounded-xl border border-rose-200">
                        <i class="fa-solid fa-triangle-exclamation text-3xl mb-2"></i>
                        <p class="font-bold">Gagal Memuat Konfigurasi .env</p>
                        <p class="text-xs text-rose-500 mt-1">${err.message}</p>
                        <button onclick="loadEnvData()" class="mt-4 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors">
                            <i class="fa-solid fa-rotate-right mr-1"></i> Coba Lagi
                        </button>
                    </div>
                `;
            }
        }
    }

    /**
     * Update metrik KPI banner
     */
    function updateEnvStats(data) {
        const statTotal = document.getElementById('env-stat-total');
        const statModified = document.getElementById('env-stat-modified');
        const statBackup = document.getElementById('env-stat-backup');
        const statDb = document.getElementById('env-stat-db');

        if (statTotal) statTotal.textContent = `${envItems.length} Variabel`;

        if (statModified && data.lastModified) {
            const d = new Date(data.lastModified);
            statModified.textContent = d.toLocaleDateString('id-ID', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }

        if (statBackup) {
            if (data.hasBackup) {
                statBackup.innerHTML = '<span class="inline-flex items-center gap-1 text-emerald-400 font-bold"><i class="fa-solid fa-shield-check"></i> Cadangan Siap</span>';
            } else {
                statBackup.innerHTML = '<span class="inline-flex items-center gap-1 text-slate-400 font-medium"><i class="fa-solid fa-clock-rotate-left"></i> Belum ada cadangan</span>';
            }
        }

        if (statDb) {
            const dbHost = originalEnvMap['DB_HOST'] || '127.0.0.1';
            const cloudHost = originalEnvMap['CLOUD_DB_HOST'] ? 'Aiven Cloud' : 'Lokal';
            statDb.textContent = `${dbHost} (${cloudHost})`;
        }

        // Update hitungan badge pada tombol filter kategori
        const counts = { 'ALL': envItems.length };
        envItems.forEach(it => {
            const cKey = (it.category === 'AI Biometrik' || it.category === 'Threshold') ? 'Threshold' : it.category;
            counts[cKey] = (counts[cKey] || 0) + 1;
        });
        document.querySelectorAll('.btn-env-cat').forEach(btn => {
            const cat = btn.getAttribute('data-cat');
            const cKey = (cat === 'AI Biometrik' || cat === 'Threshold') ? 'Threshold' : cat;
            const cnt = counts[cKey] || counts[cat] || 0;
            const labels = {
                'ALL': 'Semua',
                'Database Lokal': 'Database Lokal',
                'Database Cloud': 'Database Cloud',
                'Jam Operasional': 'Jam Operasional',
                'Threshold': 'Threshold',
                'AI Biometrik': 'Threshold',
                'API Eksternal': 'API & TTS',
                'Kredensial & Instansi': 'Kredensial'
            };
            const lbl = labels[cat] || cat;
            btn.innerHTML = `${lbl} <span class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${currentCategory === cat || ((currentCategory === 'Threshold' || currentCategory === 'AI Biometrik') && (cat === 'Threshold' || cat === 'AI Biometrik')) ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-600'}">${cnt}</span>`;
        });
    }

    /**
     * Render Tabel Variabel .env
     */
    function renderEnvTable() {
        const tbody = document.getElementById('env-table-body');
        const emptyState = document.getElementById('env-empty-state');
        if (!tbody) return;

        // Filter data
        let filtered = envItems.filter(item => {
            const matchCat = currentCategory === 'ALL' || item.category === currentCategory || 
                ((currentCategory === 'Threshold' || currentCategory === 'AI Biometrik') && (item.category === 'Threshold' || item.category === 'AI Biometrik'));
            const q = searchQuery.toLowerCase().trim();
            const matchSearch = !q || 
                item.key.toLowerCase().includes(q) || 
                (item.label && item.label.toLowerCase().includes(q)) ||
                (item.desc && item.desc.toLowerCase().includes(q)) ||
                String(item.value).toLowerCase().includes(q);
            return matchCat && matchSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '';
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        let html = '';
        filtered.forEach((item, idx) => {
            const isModified = String(item.value) !== String(originalEnvMap[item.key]);
            const badgeCat = getCategoryBadge(item.category);
            let labelText = item.label || item.key;
            if (item.key === 'ANTISPOOF_THRESHOLD') {
                labelText = 'Anti-Spoofing';
            } else {
                labelText = labelText.replace(/\s*\bAI\b/gi, '').trim();
            }

            html += `
                <tr id="env-row-${item.key}" class="transition-colors hover:bg-slate-50/80 ${isModified ? 'bg-amber-50/40' : ''} border-b border-slate-100">
                    <!-- No -->
                    <td class="px-3 py-2 text-center text-xs font-mono text-slate-400" style="width: 45px; min-width: 40px;">
                        ${idx + 1}
                    </td>

                    <!-- Kategori & Key -->
                    <td class="px-4 py-2" style="width: 250px; min-width: 210px;">
                        <div class="flex flex-col gap-0.5">
                            <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="font-mono text-xs font-bold text-slate-900 tracking-wide select-all bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200" title="Klik ganda untuk salin">
                                    ${escapeHtml(item.key)}
                                </span>
                                ${badgeCat}
                                ${isModified ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-700 border border-amber-300 animate-pulse">Diubah</span>' : ''}
                            </div>
                            <span class="text-[11px] font-medium text-slate-500">
                                ${escapeHtml(labelText)}
                            </span>
                        </div>
                    </td>

                    <!-- Input Nilai (Value) -->
                    <td class="px-4 py-2" style="width: 260px; min-width: 210px;">
                        ${renderInputField(item, isModified)}
                    </td>

                    <!-- Deskripsi & Keterangan -->
                    <td class="px-4 py-2 text-xs text-slate-600" style="min-width: 220px;">
                        <p class="leading-relaxed break-words">${escapeHtml(item.desc || '-')}</p>
                    </td>

                    <!-- Aksi -->
                    <td class="px-3 py-2 text-center" style="width: 65px; min-width: 55px;">
                        <div class="flex items-center justify-center gap-1">
                            <button onclick="resetRowEnvValue('${item.key}')" 
                                    class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                    title="Kembalikan ke nilai awal semula">
                                <i class="fa-solid fa-rotate-left text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
        updateSaveButtonState();
        if (typeof initDragScroll === 'function') initDragScroll('env-table-container');
    }

    /**
     * Render komponen input sesuai tipe data
     */
    function renderInputField(item, isModified) {
        const borderClass = isModified ? 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-300' : 'border-slate-300 bg-white';

        // 1. Tipe Boolean (Dropdown True / False)
        if (item.type === 'boolean') {
            const isTrue = String(item.value).toLowerCase() === 'true';
            return `
                <select id="env-input-${item.key}" onchange="onEnvInputChange('${item.key}', this.value)"
                        class="w-full text-xs font-semibold px-2.5 py-1.5 rounded-lg border shadow-sm outline-none transition-all ${borderClass} focus:border-teal-500 focus:ring-2 focus:ring-teal-200">
                    <option value="true" ${isTrue ? 'selected' : ''}>true (Aktif / Blokir)</option>
                    <option value="false" ${!isTrue ? 'selected' : ''}>false (Nonaktif / Hanya Log)</option>
                </select>
            `;
        }

        // 2. Tipe Rahasia / Password (dengan tombol intip)
        if (item.isSecret) {
            const inputType = allSecretsRevealed ? 'text' : 'password';
            return `
                <div class="relative flex items-center">
                    <input type="${inputType}" id="env-input-${item.key}" value="${escapeAttr(item.value)}"
                           oninput="onEnvInputChange('${item.key}', this.value)"
                           placeholder="(Kosong / Tanpa Password)"
                           class="w-full text-xs font-mono px-2.5 py-1.5 pr-8 rounded-lg border shadow-sm outline-none transition-all ${borderClass} focus:border-teal-500 focus:ring-2 focus:ring-teal-200">
                    <button type="button" onclick="toggleSecretVisibility('${item.key}')"
                            class="absolute right-2 text-slate-400 hover:text-slate-600 p-1" title="Tampilkan / Sembunyikan">
                        <i id="env-eye-${item.key}" class="fa-solid ${allSecretsRevealed ? 'fa-eye-slash text-amber-600' : 'fa-eye'} text-xs"></i>
                    </button>
                </div>
            `;
        }

        // 3. Tipe Waktu (HH:MM:SS)
        if (item.type === 'time') {
            return `
                <div class="relative flex items-center">
                    <input type="text" id="env-input-${item.key}" value="${escapeAttr(item.value)}"
                           oninput="onEnvInputChange('${item.key}', this.value)"
                           placeholder="HH:MM:SS" pattern="^\\d{2}:\\d{2}(:\\d{2})?$"
                           class="w-full text-xs font-mono font-bold px-2.5 py-1.5 pl-7 rounded-lg border shadow-sm outline-none transition-all ${borderClass} focus:border-teal-500 focus:ring-2 focus:ring-teal-200">
                    <i class="fa-solid fa-clock absolute left-2.5 text-slate-400 text-[11px]"></i>
                </div>
            `;
        }

        // 4. Tipe Angka / Threshold (Number)
        if (item.type === 'number') {
            const step = item.key.includes('THRESHOLD') ? '0.01' : '1';
            return `
                <input type="number" step="${step}" id="env-input-${item.key}" value="${escapeAttr(item.value)}"
                       oninput="onEnvInputChange('${item.key}', this.value)"
                       class="w-full text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border shadow-sm outline-none transition-all ${borderClass} focus:border-teal-500 focus:ring-2 focus:ring-teal-200">
            `;
        }

        // 5. Tipe Teks Default
        return `
            <input type="text" id="env-input-${item.key}" value="${escapeAttr(item.value)}"
                   oninput="onEnvInputChange('${item.key}', this.value)"
                   class="w-full text-xs font-medium px-2.5 py-1.5 rounded-lg border shadow-sm outline-none transition-all ${borderClass} focus:border-teal-500 focus:ring-2 focus:ring-teal-200">
        `;
    }

    /**
     * Handler saat input tabel diubah
     */
    function onEnvInputChange(key, val) {
        const item = envItems.find(it => it.key === key);
        if (item) {
            item.value = val;
        }

        // Beri highlight baris jika ada perbedaan
        const row = document.getElementById(`env-row-${key}`);
        const input = document.getElementById(`env-input-${key}`);
        const isModified = String(val) !== String(originalEnvMap[key]);

        if (row) {
            if (isModified) {
                row.classList.add('bg-amber-50/40');
            } else {
                row.classList.remove('bg-amber-50/40');
            }
        }

        if (input) {
            if (isModified) {
                input.className = input.className.replace('border-slate-300 bg-white', 'border-amber-400 bg-amber-50/30 ring-1 ring-amber-300');
            } else {
                input.className = input.className.replace('border-amber-400 bg-amber-50/30 ring-1 ring-amber-300', 'border-slate-300 bg-white');
            }
        }

        updateSaveButtonState();
    }

    /**
     * Hitung berapa perubahan dan update tombol Simpan
     */
    function updateSaveButtonState() {
        let diffCount = 0;
        envItems.forEach(item => {
            if (String(item.value) !== String(originalEnvMap[item.key])) {
                diffCount++;
            }
        });

        const btnSave = document.getElementById('btn-env-save');
        const badgeDiff = document.getElementById('env-diff-count-badge');

        if (badgeDiff) {
            if (diffCount > 0) {
                badgeDiff.textContent = `${diffCount} Diubah`;
                badgeDiff.classList.remove('hidden');
            } else {
                badgeDiff.classList.add('hidden');
            }
        }

        if (btnSave) {
            if (diffCount > 0) {
                btnSave.classList.remove('opacity-70');
                btnSave.classList.add('animate-pulse');
            } else {
                btnSave.classList.add('opacity-70');
                btnSave.classList.remove('animate-pulse');
            }
        }
    }

    /**
     * Reset nilai satu baris ke semula
     */
    function resetRowEnvValue(key) {
        if (!originalEnvMap.hasOwnProperty(key)) return;
        const origVal = originalEnvMap[key];
        const item = envItems.find(it => it.key === key);
        if (item) {
            item.value = origVal;
        }

        const input = document.getElementById(`env-input-${key}`);
        if (input) {
            input.value = origVal;
            onEnvInputChange(key, origVal);
        }
        renderEnvTable();
    }

    /**
     * Toggle sembunyikan / tampilkan password
     */
    function toggleSecretVisibility(key) {
        const input = document.getElementById(`env-input-${key}`);
        const icon = document.getElementById(`env-eye-${key}`);
        if (!input || !icon) return;

        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
            icon.classList.add('text-amber-600');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.remove('text-amber-600');
            icon.classList.add('fa-eye');
        }
    }

    /**
     * Toggle Intip Semua Nilai Rahasia / Password Sekaligus
     */
    function toggleAllSecretsVisibility() {
        allSecretsRevealed = !allSecretsRevealed;
        const icon = document.getElementById('icon-toggle-all-secrets');
        const text = document.getElementById('text-toggle-all-secrets');
        const btn = document.getElementById('btn-toggle-all-secrets');

        if (icon) {
            icon.className = allSecretsRevealed ? 'fa-solid fa-eye-slash text-amber-600' : 'fa-solid fa-eye text-teal-600';
        }
        if (text) {
            text.textContent = allSecretsRevealed ? 'Tutup Nilai' : 'Intip Nilai';
        }
        if (btn) {
            if (allSecretsRevealed) {
                btn.classList.add('bg-amber-50', 'border-amber-300', 'text-amber-800');
            } else {
                btn.classList.remove('bg-amber-50', 'border-amber-300', 'text-amber-800');
            }
        }

        envItems.forEach(item => {
            if (item.isSecret) {
                const input = document.getElementById(`env-input-${item.key}`);
                const eye = document.getElementById(`env-eye-${item.key}`);
                if (input) {
                    input.type = allSecretsRevealed ? 'text' : 'password';
                }
                if (eye) {
                    eye.className = allSecretsRevealed ? 'fa-solid fa-eye-slash text-amber-600 text-xs' : 'fa-solid fa-eye text-xs text-slate-400';
                }
            }
        });
    }

    /**
     * Badge visual per kategori
     */
    function getCategoryBadge(category) {
        switch (category) {
            case 'Database Lokal':
                return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200"><i class="fa-solid fa-server mr-1"></i>Lokal DB</span>';
            case 'Database Cloud':
                return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-200"><i class="fa-solid fa-cloud mr-1"></i>Cloud DB</span>';
            case 'Jam Operasional':
                return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"><i class="fa-solid fa-clock mr-1"></i>Jam Kerja</span>';
            case 'Threshold':
            case 'AI Biometrik':
                return '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200" title="Threshold"><i class="fa-solid fa-brain"></i></span>';
            case 'API Eksternal':
                return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"><i class="fa-solid fa-wave-square mr-1"></i>API & TTS</span>';
            case 'Kredensial & Instansi':
                return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200"><i class="fa-solid fa-key mr-1"></i>Keamanan</span>';
            default:
                return '<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Kustom</span>';
        }
    }

    /**
     * Filter Kategori
     */
    function filterEnvCategory(cat) {
        currentCategory = cat;
        // Update styling tombol tab kategori
        document.querySelectorAll('.btn-env-cat').forEach(btn => {
            const btnCat = btn.getAttribute('data-cat');
            const isCat = btnCat === cat || ((cat === 'Threshold' || cat === 'AI Biometrik') && (btnCat === 'Threshold' || btnCat === 'AI Biometrik'));
            if (isCat) {
                btn.className = 'btn-env-cat px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-600 text-white shadow-sm transition-all';
            } else {
                btn.className = 'btn-env-cat px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all';
            }
            const badge = btn.querySelector('span');
            if (badge) {
                badge.className = `ml-1 px-1.5 py-0.2 rounded-full text-[10px] ${isCat ? 'bg-teal-800 text-teal-100' : 'bg-slate-200 text-slate-600'}`;
            }
        });
        renderEnvTable();
        // Reset scroll tabel ke paling atas dan kiri agar variabel awal langsung terlihat
        const el = document.getElementById('env-table-container');
        if (el) {
            el.scrollTop = 0;
            el.scrollLeft = 0;
        }
    }

    /**
     * Filter Pencarian
     */
    function filterEnvSearch(q) {
        searchQuery = q;
        renderEnvTable();
    }

    /**
     * Toggle View Mode (Table vs Raw)
     */
    function toggleEnvViewMode(mode) {
        currentViewMode = mode;
        const tableView = document.getElementById('env-table-container');
        const rawView = document.getElementById('env-raw-container');
        const btnTable = document.getElementById('btn-env-mode-table');
        const btnRaw = document.getElementById('btn-env-mode-raw');

        if (mode === 'raw') {
            if (tableView) tableView.classList.add('hidden');
            if (rawView) rawView.classList.remove('hidden');
            if (btnRaw) {
                btnRaw.className = 'px-3 py-1.5 text-xs font-bold rounded-md bg-teal-600 text-white shadow-sm';
            }
            if (btnTable) {
                btnTable.className = 'px-3 py-1.5 text-xs font-semibold rounded-md bg-transparent text-slate-600 hover:text-slate-900';
            }
        } else {
            if (rawView) rawView.classList.add('hidden');
            if (tableView) tableView.classList.remove('hidden');
            if (btnTable) {
                btnTable.className = 'px-3 py-1.5 text-xs font-bold rounded-md bg-teal-600 text-white shadow-sm';
            }
            if (btnRaw) {
                btnRaw.className = 'px-3 py-1.5 text-xs font-semibold rounded-md bg-transparent text-slate-600 hover:text-slate-900';
            }
        }
    }

    /**
     * Simpan Perubahan .env ke Server
     */
    async function saveEnvChanges() {
        if (isSaving) return;

        const btnSave = document.getElementById('btn-env-save');
        const originalText = btnSave ? btnSave.innerHTML : 'Simpan';

        try {
            isSaving = true;
            if (btnSave) {
                btnSave.disabled = true;
                btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i> Menyimpan...';
            }

            let payload = {};

            if (currentViewMode === 'raw') {
                const textarea = document.getElementById('env-raw-textarea');
                payload = { raw: textarea ? textarea.value : '' };
            } else {
                const updates = {};
                envItems.forEach(it => {
                    updates[it.key] = it.value;
                });
                payload = { updates };
            }

            const res = await fetch('/api/env', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            if (!result.success) {
                throw new Error(result.message || 'Gagal menyimpan perubahan');
            }

            showEnvToast('Berhasil! File .env telah diperbarui & dicadangkan.', 'success');

            // Refresh data
            await loadEnvData();

            // Tampilkan modal saran restart jika mengubah variabel inti
            promptRestartAfterSave();

        } catch (err) {
            console.error('Error saving .env:', err);
            showEnvToast(`Gagal menyimpan: ${err.message}`, 'error');
        } finally {
            isSaving = false;
            if (btnSave) {
                btnSave.disabled = false;
                btnSave.innerHTML = originalText;
            }
        }
    }

    /**
     * Notifikasi / Konfirmasi Restart Server setelah Simpan
     */
    function promptRestartAfterSave() {
        const modal = document.getElementById('modal-env-restart-prompt');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    /**
     * Pulihkan Cadangan .env.backup
     */
    async function restoreEnvBackup() {
        if (!confirm('Apakah Anda yakin ingin memulihkan konfigurasi dari file cadangan terakhir (.env.backup)? Perubahan yang belum disimpan akan tertimpa.')) {
            return;
        }

        try {
            const res = await fetch('/api/env/restore-backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            const result = await res.json();
            if (!result.success) {
                throw new Error(result.message || 'Gagal memulihkan cadangan');
            }

            showEnvToast('Cadangan .env.backup berhasil dipulihkan!', 'success');
            await loadEnvData();
        } catch (err) {
            console.error('Error restore backup:', err);
            showEnvToast(`Gagal: ${err.message}`, 'error');
        }
    }

    /**
     * Restart Server Node.js dengan aman dan auto-ping reconnect
     */
    async function restartNodeServer() {
        const modalPrompt = document.getElementById('modal-env-restart-prompt');
        if (modalPrompt) modalPrompt.classList.add('hidden');

        const overlay = document.getElementById('env-restarting-overlay');
        if (overlay) overlay.classList.remove('hidden');

        try {
            // Kirim sinyal restart
            await fetch('/api/env/restart-server', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            // Sinyal restart mungkin memutus koneksi socket seketika, ini normal
        }

        // Mulai polling reconnect ke server
        let retryCount = 0;
        const maxRetries = 25;
        const statusText = document.getElementById('env-restarting-status-text');

        const timer = setInterval(async () => {
            retryCount++;
            if (statusText) {
                statusText.textContent = `Menghubungkan kembali ke server... (${retryCount}/${maxRetries})`;
            }

            try {
                const ping = await fetch('/api/config?_=' + Date.now());
                if (ping.ok) {
                    clearInterval(timer);
                    if (statusText) statusText.textContent = 'Server aktif! Memuat ulang sistem...';
                    setTimeout(() => {
                        window.location.reload();
                    }, 800);
                }
            } catch (pingErr) {
                // Masih restart, lanjut tunggu
            }

            if (retryCount >= maxRetries) {
                clearInterval(timer);
                if (statusText) {
                    statusText.innerHTML = `
                        <span class="text-rose-400">Server membutuhkan waktu lebih lama. Silakan muat ulang halaman secara manual.</span>
                        <br><button onclick="window.location.reload()" class="mt-3 px-4 py-1.5 bg-white text-slate-800 rounded font-bold text-xs">Muat Ulang Sekarang</button>
                    `;
                }
            }
        }, 1200);
    }

    /**
     * Modal Tambah Variabel Custom
     */
    function openAddEnvModal() {
        const modal = document.getElementById('modal-add-env-variable');
        if (modal) modal.classList.remove('hidden');
        const keyInput = document.getElementById('new-env-key');
        if (keyInput) {
            keyInput.value = '';
            keyInput.focus();
        }
    }

    function closeAddEnvModal() {
        const modal = document.getElementById('modal-add-env-variable');
        if (modal) modal.classList.add('hidden');
    }

    function submitNewEnvVariable() {
        const keyInput = document.getElementById('new-env-key');
        const valInput = document.getElementById('new-env-val');
        const descInput = document.getElementById('new-env-desc');

        if (!keyInput || !keyInput.value.trim()) {
            alert('Nama variabel (Key) wajib diisi.');
            return;
        }

        const rawKey = keyInput.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
        const rawVal = valInput ? valInput.value.trim() : '';
        const rawDesc = descInput ? descInput.value.trim() : 'Variabel kustom tambahan';

        // Cek apakah sudah ada
        const existing = envItems.find(it => it.key === rawKey);
        if (existing) {
            alert(`Variabel ${rawKey} sudah ada di dalam tabel. Silakan ubah nilainya langsung pada tabel.`);
            return;
        }

        envItems.push({
            key: rawKey,
            value: rawVal,
            label: rawKey,
            category: 'Kustom / Tambahan',
            type: 'text',
            isSecret: /pass|secret|key|token/i.test(rawKey),
            desc: rawDesc,
            lineNum: envItems.length + 1
        });

        closeAddEnvModal();
        renderEnvTable();
        showEnvToast(`Variabel ${rawKey} ditambahkan. Jangan lupa klik "Simpan Perubahan"!`, 'info');
    }

    /**
     * Toast Notifikasi Ringan
     */
    function showEnvToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
            return;
        }

        const container = document.getElementById('toast-container');
        if (!container) {
            alert(message);
            return;
        }

        const colors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-rose-600 text-white',
            info: 'bg-teal-700 text-white',
            warning: 'bg-amber-600 text-white'
        };

        const toast = document.createElement('div');
        toast.className = `px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 text-xs font-bold transition-all transform duration-300 opacity-0 translate-y-2 ${colors[type] || colors.info}`;
        toast.innerHTML = `
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info')}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('opacity-0', 'translate-y-2');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function escapeAttr(text) {
        if (!text) return '';
        return String(text).replace(/"/g, '&quot;');
    }

})();

    // Helper Navigasi Scroll Cepat (Kiri, Kanan, Atas, Bawah)
    window.scrollEnvTable = function(direction) {
        const el = document.getElementById('env-table-container');
        if (!el) return;
        if (direction === 'left') el.scrollBy({ left: -380, behavior: 'smooth' });
        else if (direction === 'right') el.scrollBy({ left: 380, behavior: 'smooth' });
        else if (direction === 'up') el.scrollBy({ top: -280, behavior: 'smooth' });
        else if (direction === 'down') el.scrollBy({ top: 280, behavior: 'smooth' });
    };
