Set WshShell = CreateObject("WScript.Shell")
strPath = Wscript.ScriptFullName
Set objFSO = CreateObject("Scripting.FileSystemObject")
strDir = objFSO.GetParentFolderName(strPath)

' Jalankan Node.js secara tersembunyi (angka 0 artinya Hidden)
WshShell.Run "cmd.exe /c cd /d """ & strDir & """ && npm start", 0, False

' Beri jeda 2 detik
WScript.Sleep 2000

' Jalankan Python secara tersembunyi (angka 0 artinya Hidden)
WshShell.Run "cmd.exe /c cd /d """ & strDir & """ && python python_server.py", 0, False

MsgBox "Semua Server Biometrik (Node.js & Python) telah berhasil dinyalakan di latar belakang secara aman!" & vbCrLf & vbCrLf & "Silakan buka localhost:3000 di browser Chrome Anda." & vbCrLf & vbCrLf & "Untuk MEMATIKAN server nanti, silakan jalankan file STOP_SERVER.bat", 64, "Server Berjalan"
