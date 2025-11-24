import subprocess
import json
import sys

def wake_bot():
    app_name = "xivdyetools-bot"
    print(f"☀️ Waking up {app_name}...")

    try:
        # Get list of machines
        print("🔍 Checking machine status...")
        result = subprocess.run(
            ["fly", "machines", "list", "-a", app_name, "--json"],
            capture_output=True,
            text=True,
            shell=True
        )
        
        if result.returncode != 0:
            print("❌ Failed to list machines.")
            print(f"Error: {result.stderr}")
            return

        try:
            machines = json.loads(result.stdout)
        except json.JSONDecodeError:
            print("❌ Failed to parse machine list.")
            print(f"Output: {result.stdout}")
            return

        stopped_machines = [m for m in machines if m['state'] == 'stopped']

        if not stopped_machines:
            print(f"✨ All {len(machines)} machines are already running!")
            return

        print(f"Found {len(stopped_machines)} stopped machine(s). Starting them...")

        for machine in stopped_machines:
            mid = machine['id']
            print(f"🚀 Starting machine {mid}...")
            start_result = subprocess.run(
                ["fly", "machine", "start", mid, "-a", app_name],
                capture_output=True,
                text=True,
                shell=True
            )
            
            if start_result.returncode == 0:
                print(f"   ✅ Machine {mid} started")
            else:
                print(f"   ❌ Failed to start {mid}: {start_result.stderr.strip()}")
        
        print("\n✅ Wake up sequence complete!")

    except FileNotFoundError:
        print("❌ 'fly' command not found. Please ensure flyctl is installed.")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")

if __name__ == "__main__":
    wake_bot()
