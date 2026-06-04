import re

file_path = "c:\\Users\\hi\\Desktop\\biometrik\\scan.js"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = re.compile(r"if \(result\.result_code === 'ALREADY_CHECKED_IN'\) \{.*?\} else if \(result\.result_code === 'OUT_OF_TIME_IN'\)", re.DOTALL)

replacement = """if (result.result_code === 'ALREADY_CHECKED_IN') {
                // [UPDATE] Logika Dinamis sebelum dan sesudah jam 11:00
                const currentHour = new Date().getHours();
                let jamMasukPendek = result.jam_masuk ? result.jam_masuk.substring(0, 5) : '';
                
                if (!jamMasukPendek && result.message) {
                    const match = result.message.match(/pukul\\s+([0-9:]+)/);
                    if (match) jamMasukPendek = match[1].substring(0, 5);
                }

                if (currentHour < 11) {
                    // Skenario 1: Sebelum jam 11:00
                    if (jamMasukPendek) {
                        warningSpeakText = `Maaf ${display_name}, Anda sudah absen masuk pada jam ${jamMasukPendek}.`;
                    } else {
                        warningSpeakText = `Maaf ${display_name}, Anda sudah absen masuk.`;
                    }
                } else {
                    // Skenario 2: Lewat jam 11:00
                    if (result.batas_min_pulang) {
                        let jamPulangBuka = result.batas_min_pulang.substring(0, 5);
                        warningSpeakText = `Maaf ${display_name}, absen pulang cepat dibuka jam ${jamPulangBuka}. Anda sudah masuk jam ${jamMasukPendek}.`;
                    } else if (jamMasukPendek) {
                        warningSpeakText = `Maaf ${display_name}, Anda sudah absen masuk pada jam ${jamMasukPendek}.`;
                    } else {
                        warningSpeakText = `${display_name}, Anda sudah absen masuk.`;
                    }
                }
            } else if (result.result_code === 'OUT_OF_TIME_IN')"""

if pattern.search(content):
    content = pattern.sub(replacement, content)
    print("Found and replaced ALREADY_CHECKED_IN logic.")
else:
    print("Could not find ALREADY_CHECKED_IN logic.")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
