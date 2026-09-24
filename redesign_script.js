const fs = require('fs');
const newHTML = `<!-- HALAMAN DASHBOARD -->
    <div id="dashboard-page" class="hidden min-h-screen pb-24 bg-slate-50">
        
        <!-- Minimalist Premium Header -->
        <div class="pt-12 pb-24 px-6 rounded-b-[2rem] bg-white border-b border-slate-200 shadow-[0_10px_30px_rgba(0,0,0,0.03)] relative overflow-hidden">
            <div class="relative z-10">
                <!-- Top Centered Badge -->
                <div class="flex justify-center mb-6">
                    <div class="flex items-center gap-2 pr-4 pl-1.5 py-1.5 rounded-full border border-slate-200 bg-slate-50 shadow-sm">
                        <div class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] shadow-sm"><i class="fa-solid fa-hospital"></i></div>
                        <span class="text-slate-700 text-[11px] font-black uppercase tracking-[0.2em] pl-1">Puskesmas Wana</span>
                    </div>
                </div>

                <!-- Real-time Clock -->
                <div class="flex items-center gap-2 mt-3 mb-2">
                    <span id="greeting-text" class="text-slate-500 text-xs font-semibold uppercase tracking-wider">Selamat Pagi,</span>
                    <span id="realtime-clock" class="text-slate-700 text-sm font-mono font-bold px-2.5 py-0.5 rounded-lg border border-slate-200 bg-slate-50 shadow-sm">00:00:00</span>
                </div>

                <div class="flex justify-between items-start">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center text-2xl font-bold text-slate-300 shadow-sm overflow-hidden relative group">
                            <img id="user-foto" src="" class="absolute inset-0 w-full h-full object-cover hidden z-10 transition-transform duration-500 group-hover:scale-105" alt="Foto Pegawai">
                            <i id="user-foto-icon" class="fa-regular fa-user relative z-0"></i>
                        </div>
                        <div>
                            <p class="text-slate-500 text-[10px] font-semibold mb-0.5 uppercase tracking-widest">Selamat datang,</p>
                            <h2 id="user-nama" class="font-bold text-2xl leading-tight text-slate-900 tracking-tight">Nama Pegawai</h2>
                            <div class="flex items-center gap-2 mt-2">
                                <span id="user-jabatan" class="text-[9px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md font-bold border border-blue-100 uppercase tracking-widest">Jabatan</span>
                                <span id="user-id" class="text-[9px] bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-mono font-bold border border-slate-200 tracking-widest">ID</span>
                            </div>
                        </div>
                    </div>
                    <button onclick="logout()" class="w-10 h-10 hover:bg-red-50 hover:text-red-600 border border-slate-200 hover:border-red-200 rounded-full flex items-center justify-center text-slate-400 transition-all duration-300 shadow-sm bg-white">
                        <i class="fa-solid fa-power-off"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Dashboard Content -->
        <div class="px-5 -mt-14 relative z-20 space-y-5">
            
            <!-- Running Text Announcement -->
            <div class="rounded-2xl overflow-hidden flex items-stretch p-1 shadow-sm border border-slate-200 bg-white">
                <div class="px-4 py-2.5 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                    <i class="fa-solid fa-bullhorn animate-pulse"></i>
                </div>
                <div class="overflow-hidden flex-1 relative flex items-center ml-2">
                    <div class="animate-marquee">
                        <span class="text-[11px] font-semibold text-slate-600 uppercase tracking-widest">
                            🌟 Semangat Melayani Sepenuh Hati! Pastikan Anda melakukan presensi tepat waktu. 🏥 Kesehatan Pasien adalah Prioritas Utama Kita. 🌟
                        </span>
                    </div>
                </div>
            </div>

            <!-- Card Hari Ini -->
            <div class="rounded-2xl p-6 shadow-sm border border-slate-200 bg-white relative overflow-hidden">
                <div class="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                    <h3 class="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center"><i class="fa-solid fa-calendar-day text-blue-600 text-xs"></i></div> Hari Ini
                    </h3>
                    <span id="today-date" class="text-[10px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 px-3 py-1 rounded-full tracking-wider"></span>
                </div>
                
                <div class="flex justify-between items-center relative py-2">
                    <!-- Garis Penghubung -->
                    <div class="absolute left-1/2 top-1/2 -translate-y-1/2 -translate-x-1/2 w-1/3 h-0.5 bg-transparent border-t-2 border-dashed border-slate-200"></div>
                    
                    <div class="text-center w-1/2 relative z-10 bg-white">
                        <div class="w-14 h-14 text-emerald-600 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-100 transform hover:-translate-y-1 transition-transform duration-300">
                            <i class="fa-solid fa-arrow-right-to-bracket text-xl"></i>
                        </div>
                        <p class="text-[11px] text-slate-500 font-semibold mb-1 uppercase tracking-widest">Jam Masuk</p>
                        <p id="today-masuk" class="text-3xl font-black text-slate-800 tracking-tight">--:--</p>
                    </div>
                    
                    <div class="text-center w-1/2 relative z-10 bg-white">
                        <div class="w-14 h-14 text-rose-600 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-rose-100 transform hover:-translate-y-1 transition-transform duration-300">
                            <i class="fa-solid fa-arrow-right-from-bracket text-xl"></i>
                        </div>
                        <p class="text-[11px] text-slate-500 font-semibold mb-1 uppercase tracking-widest">Jam Pulang</p>
                        <p id="today-pulang" class="text-3xl font-black text-slate-800 tracking-tight">--:--</p>
                    </div>
                </div>
                
                <div id="today-status" class="mt-6 text-center text-sm font-bold text-slate-600 py-3 rounded-xl bg-slate-50 uppercase tracking-widest border border-slate-100">
                    Menunggu Data
                </div>
            </div>

            <!-- Header Rekap -->
            <div class="flex justify-between items-center px-1 pt-2">
                <h3 class="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><i class="fa-solid fa-chart-pie text-slate-600 text-xs"></i></div> Rekap Bulan Ini
                </h3>
                <span onclick="toggleDetailModal()" class="text-[10px] font-bold text-slate-600 px-3 py-1.5 rounded-full border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition active:scale-95 shadow-sm uppercase tracking-wider">Lihat Detail</span>
            </div>

            <!-- Grid Rekap (Minimalist) -->
            <div class="bento-grid pb-2">
                <!-- Card Hadir (Wide) -->
                <div class="bento-item bento-item-wide p-4 flex flex-row items-center justify-between rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 text-emerald-600 bg-emerald-50 rounded-2xl flex items-center justify-center border border-emerald-100">
                            <i class="fa-solid fa-check-double text-xl"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-tight mb-0.5">Kehadiran</p>
                            <p class="text-3xl font-black text-slate-800 tracking-tight leading-none" id="rekap-hadir">0</p>
                        </div>
                    </div>
                    <div class="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                        <i class="fa-solid fa-award text-lg"></i>
                    </div>
                </div>

                <!-- Card Alpa -->
                <div class="bento-item p-4 flex flex-col items-start rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="w-10 h-10 text-rose-600 bg-rose-50 rounded-xl flex items-center justify-center mb-3 border border-rose-100"><i class="fa-solid fa-triangle-exclamation text-sm"></i></div>
                    <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Alpa</p>
                    <p class="text-2xl font-black text-slate-800 tracking-tight" id="rekap-alpa">0</p>
                </div>

                <!-- Card Izin/Cuti -->
                <div class="bento-item p-4 flex flex-col items-start rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="w-10 h-10 text-indigo-600 bg-indigo-50 rounded-xl flex items-center justify-center mb-3 border border-indigo-100"><i class="fa-solid fa-suitcase-medical text-sm"></i></div>
                    <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Izin/Cuti</p>
                    <p class="text-2xl font-black text-slate-800 tracking-tight" id="rekap-isc">0</p>
                </div>

                <!-- Card Sakit -->
                <div class="bento-item p-4 flex flex-col items-start rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="w-10 h-10 text-teal-600 bg-teal-50 rounded-xl flex items-center justify-center mb-3 border border-teal-100"><i class="fa-solid fa-bed-pulse text-sm"></i></div>
                    <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Sakit</p>
                    <p class="text-2xl font-black text-slate-800 tracking-tight" id="rekap-sakit">0</p>
                </div>

                <!-- Card DL -->
                <div class="bento-item p-4 flex flex-col items-start rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="w-10 h-10 text-sky-600 bg-sky-50 rounded-xl flex items-center justify-center mb-3 border border-sky-100"><i class="fa-solid fa-car-side text-sm"></i></div>
                    <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Dinas Luar</p>
                    <p class="text-2xl font-black text-slate-800 tracking-tight" id="rekap-dl">0</p>
                </div>

                <!-- Card Telat -->
                <div class="bento-item p-4 flex flex-col items-start rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="w-10 h-10 text-amber-600 bg-amber-50 rounded-xl flex items-center justify-center mb-3 border border-amber-100"><i class="fa-solid fa-clock-rotate-left text-sm"></i></div>
                    <div class="flex justify-between w-full">
                        <div>
                            <p class="text-[9px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Telat (x)</p>
                            <p class="text-xl font-black text-slate-800 tracking-tight" id="rekap-telat">0</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[9px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Menit</p>
                            <p class="text-xl font-black text-slate-800 tracking-tight" id="rekap-telat-menit">0</p>
                        </div>
                    </div>
                </div>

                <!-- Card PSW -->
                <div class="bento-item p-4 flex flex-col items-start rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="w-10 h-10 text-violet-600 bg-violet-50 rounded-xl flex items-center justify-center mb-3 border border-violet-100"><i class="fa-solid fa-person-running text-sm"></i></div>
                    <div class="flex justify-between w-full">
                        <div>
                            <p class="text-[9px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">PSW (x)</p>
                            <p class="text-xl font-black text-slate-800 tracking-tight" id="rekap-psw-kali">0</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[9px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Menit</p>
                            <p class="text-xl font-black text-slate-800 tracking-tight" id="rekap-psw-menit">0</p>
                        </div>
                    </div>
                </div>

                <!-- Card TAP (Wide) -->
                <div class="bento-item bento-item-wide p-4 flex flex-row items-center justify-between rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 text-red-600 bg-red-50 rounded-xl flex items-center justify-center border border-red-100"><i class="fa-solid fa-door-open text-sm"></i></div>
                        <div class="text-left">
                            <p class="text-[10px] font-semibold text-slate-500 uppercase tracking-widest leading-tight">Tanpa Absen Pulang (TAP)</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-black text-slate-800 tracking-tight leading-none" id="rekap-tap">0</p>
                    </div>
                </div>

                <!-- Card Total Jam Kerja (Wide) -->
                <div class="bento-item bento-item-wide p-4 flex flex-row items-center justify-between rounded-2xl shadow-sm border border-slate-200 bg-white hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
                    <div class="flex items-center gap-4">
                        <div class="w-12 h-12 text-slate-700 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                            <i class="fa-solid fa-business-time text-xl"></i>
                        </div>
                        <div class="text-left">
                            <p class="text-[11px] font-semibold text-slate-500 uppercase tracking-widest leading-tight mb-0.5">Total Jam Kerja</p>
                            <p class="text-2xl font-black text-slate-800 tracking-tight leading-none font-mono" id="rekap-jam-kerja">00:00:00</p>
                        </div>
                    </div>
                    <div class="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                        <i class="fa-solid fa-clock text-lg"></i>
                    </div>
                </div>

            </div>

            <!-- Header Tabel Harian -->
            <div class="flex justify-between items-center px-1 pt-4 mt-2">
                <h3 class="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-2">
                    <div class="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><i class="fa-solid fa-calendar-days text-slate-600 text-xs"></i></div> Metrik Harian
                </h3>
                <input type="month" id="filter-bulan" class="text-xs border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700 bg-white focus:outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 font-bold shadow-sm" onchange="onMonthFilterChange(this.value)">
            </div>
            
            <!-- Tabel Harian -->
            <div class="rounded-2xl shadow-sm border border-slate-200 mt-2 bg-white relative overflow-hidden">
                <div class="overflow-x-auto overflow-y-auto max-h-[55vh] relative scrollbar-hide">
                    <table class="w-full text-left border-collapse text-xs">
                        <thead class="sticky top-0 z-20">
                            <tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
                                <th class="p-3.5 font-bold uppercase tracking-wider text-center w-10 bg-slate-50">Tgl</th>
                                <th class="p-3.5 font-bold uppercase tracking-wider text-center whitespace-nowrap bg-slate-50">Masuk</th>
                                <th class="p-3.5 font-bold uppercase tracking-wider text-center whitespace-nowrap bg-slate-50">Pulang</th>
                                <th class="p-3.5 font-bold uppercase tracking-wider text-center w-12 bg-slate-50" title="PSW (Menit)">P</th>
                                <th class="p-3.5 font-bold uppercase tracking-wider text-center w-12 bg-slate-50" title="Telat (Menit)">T</th>
                            </tr>
                        </thead>
                        <tbody id="daily-metrics-tbody" class="text-slate-700 font-medium divide-y divide-slate-100">
                            <tr><td colspan="5" class="text-center p-8 text-slate-400">Memuat data...</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Bottom spacing -->
            <div class="h-6"></div>
        </div>
    </div>`;

let content = fs.readFileSync('portal.html', 'utf8');
const startTag = '<!-- HALAMAN DASHBOARD -->';
const endTag = '<!-- HALAMAN RIWAYAT -->';
const start = content.indexOf(startTag);
const end = content.indexOf(endTag);

if(start !== -1 && end !== -1) {
    const updatedContent = content.substring(0, start) + newHTML + '\n    ' + content.substring(end);
    fs.writeFileSync('portal.html', updatedContent, 'utf8');
    console.log('Successfully updated portal.html');
} else {
    console.log('Tags not found.');
}
