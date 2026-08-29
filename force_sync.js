require('dotenv').config();
const mysql = require('mysql2/promise');

async function forceSync() {
    console.log("==================================================");
    console.log("🚀 SINKRONISASI MANUAL & TOTAL (XAMPP -> AIVEN)");
    console.log("==================================================");
    
    let localDb, cloudDb;

    try {
        console.log("⏳ Menghubungkan ke database Lokal (XAMPP)...");
        localDb = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASS || '',
            database: process.env.DB_NAME || 'biometrik_absensi_wajah_db',
            dateStrings: true,
            timezone: '+07:00'
        });
        console.log("✅ Terhubung ke database Lokal.");

        console.log("⏳ Menghubungkan ke database Cloud (Aiven)...");
        cloudDb = await mysql.createConnection({
            host: process.env.CLOUD_DB_HOST,
            port: process.env.CLOUD_DB_PORT,
            user: process.env.CLOUD_DB_USER,
            password: process.env.CLOUD_DB_PASS,
            database: process.env.CLOUD_DB_NAME,
            ssl: { rejectUnauthorized: false },
            dateStrings: true,
            timezone: '+07:00'
        });
        console.log("✅ Terhubung ke database Cloud.");

        // --- 1. SYNC SEMUA KARYAWAN ---
        console.log("\n📦 1. Memulai sinkronisasi SELURUH data Karyawan...");
        const [karyawanList] = await localDb.query("SELECT * FROM karyawan");
        let karyawanSynced = 0;
        for (const k of karyawanList) {
            await cloudDb.query(
                `INSERT INTO karyawan (id_karyawan, nama, jabatan, face_descriptor, foto, tanggal_registrasi) 
                 VALUES (?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 nama = VALUES(nama), jabatan = VALUES(jabatan), face_descriptor = VALUES(face_descriptor), foto = VALUES(foto)`,
                [k.id_karyawan, k.nama, k.jabatan, k.face_descriptor, k.foto, k.tanggal_registrasi]
            );
            karyawanSynced++;
            process.stdout.write(`\r   -> Progress: ${karyawanSynced} / ${karyawanList.length} karyawan`);
        }
        console.log(`\n✅ Selesai: ${karyawanSynced} karyawan tersinkron.`);

        // --- 2. SYNC SEMUA AKUN ---
        console.log("\n📦 2. Memulai sinkronisasi SELURUH data Akun Pegawai...");
        try {
            const [akunList] = await localDb.query("SELECT * FROM akun_pegawai");
            let akunSynced = 0;
            for (const ak of akunList) {
                await cloudDb.query(
                    `INSERT INTO akun_pegawai (id_akun, id_karyawan, username, password, created_at) 
                     VALUES (?, ?, ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE 
                     username = VALUES(username), password = VALUES(password)`,
                    [ak.id_akun, ak.id_karyawan, ak.username, ak.password, ak.created_at]
                );
                akunSynced++;
                process.stdout.write(`\r   -> Progress: ${akunSynced} / ${akunList.length} akun`);
            }
            console.log(`\n✅ Selesai: ${akunSynced} akun tersinkron.`);
        } catch (e) {
            console.log("\n⚠️ Tabel akun_pegawai mungkin belum tersedia atau error: " + e.message);
        }

        // --- 3. SYNC SEMUA ABSENSI (TANPA BATAS WAKTU) ---
        console.log("\n📦 3. Memulai sinkronisasi SELURUH riwayat Absensi (Tanpa Batas Waktu)...");
        console.log("   (Ini mungkin memakan waktu agak lama tergantung jumlah data)");
        const [absensiList] = await localDb.query("SELECT * FROM absensi");
        let absensiSynced = 0;
        
        // Disable foreign key checks temporarily to speed up bulk inserts if needed, 
        // but here we just insert row by row safely.
        for (const a of absensiList) {
            await cloudDb.query(
                `INSERT INTO absensi (id_absensi, id_karyawan, tanggal, jam_masuk, jam_keluar, status, keterangan, telat_menit, psw_menit) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                 ON DUPLICATE KEY UPDATE 
                 jam_masuk = VALUES(jam_masuk), jam_keluar = VALUES(jam_keluar), status = VALUES(status), 
                 keterangan = VALUES(keterangan), telat_menit = VALUES(telat_menit), psw_menit = VALUES(psw_menit)`,
                [a.id_absensi, a.id_karyawan, a.tanggal, a.jam_masuk, a.jam_keluar, a.status, a.keterangan, a.telat_menit, a.psw_menit]
            );
            absensiSynced++;
            if (absensiSynced % 100 === 0) {
                process.stdout.write(`\r   -> Progress: ${absensiSynced} / ${absensiList.length} absensi...`);
            }
        }
        process.stdout.write(`\r   -> Progress: ${absensiSynced} / ${absensiList.length} absensi...`);
        console.log(`\n✅ Selesai: ${absensiSynced} riwayat absensi tersinkron.`);

        console.log("\n🎉 SEMUA PROSES SINKRONISASI MANUAL SELESAI DENGAN SUKSES!");
        console.log("==================================================");

    } catch (error) {
        console.error(`\n❌ TERJADI KESALAHAN SAAT SINKRONISASI:`, error.message);
    } finally {
        // Tutup koneksi
        if (localDb) await localDb.end();
        if (cloudDb) await cloudDb.end();
        process.exit(0);
    }
}

forceSync();
