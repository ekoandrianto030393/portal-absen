import os
import shutil

src_dir = r"C:\Users\hi\Desktop\biometrik"
dest_dir = r"C:\Users\hi\Desktop\portal-online"

# Create destination directory if it doesn't exist
if not os.path.exists(dest_dir):
    os.makedirs(dest_dir)

# List of exact files to copy
files_to_copy = [
    "server.js",
    "package.json",
    "package-lock.json",
    "portal.html",
    "portal.js",
    "admin.html",
    "admin.js",
    "sw.js",
    "manifest.json",
    "icon-192.png",
    "logo.jpg",
    "logo.jpg.jpg",
    "pkm.jpg",
    "medis.jpg"
]

# We also need any css or other html?
# Let's add them just in case
extra_files = [f for f in os.listdir(src_dir) if f.endswith(('.html', '.js', '.css', '.png', '.jpg'))]

# But exclude heavy scan stuff and python scripts!
exclude = [
    "scan.html", "scan.js", "scan_gold_backup.js", "mobile-scan.html", "mobile-scan.js",
    "setup_db.js", "migrate_db.js", "sync_service.js", "test-db.js", "test-login.js", "App.js"
]

files_to_copy.extend([f for f in extra_files if f not in exclude and f not in files_to_copy])

for f in set(files_to_copy):
    src_file = os.path.join(src_dir, f)
    dest_file = os.path.join(dest_dir, f)
    if os.path.exists(src_file):
        shutil.copy2(src_file, dest_file)
        print(f"Copied: {f}")
    else:
        print(f"Skipped (Not Found): {f}")

print("\nPackaging Complete! The folder is at C:\\Users\\hi\\Desktop\\portal-online")
