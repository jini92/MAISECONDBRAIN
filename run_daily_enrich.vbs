Set WshShell = CreateObject("WScript.Shell")
WshShell.Environment("Process").Item("MNEMO_VAULT_PATH") = "C:\Users\jini9\OneDrive\Documents\JINI_SYNC"
WshShell.Environment("Process").Item("MNEMO_MEMORY_PATH") = "C:\MAIBOT\memory"
WshShell.Environment("Process").Item("MNEMO_API_URL") = "https://mnemo-api-production-5e7a.up.railway.app"
WshShell.Environment("Process").Item("PYTHONIOENCODING") = "utf-8"
WshShell.CurrentDirectory = "C:\TEST\MAISECONDBRAIN"
WshShell.Run "python scripts\daily_enrich.py", 0, True
