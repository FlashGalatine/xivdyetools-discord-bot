import subprocess
import sys
import time

def restart_bot():
    app_name = "xivdyetools-bot"
    print(f"🔄 Restarting {app_name}...")
    
    try:
        # Run the fly restart command
        result = subprocess.run(
            ["fly", "apps", "restart", app_name],
            capture_output=True,
            text=True,
            shell=True # Required for Windows to find fly command sometimes if not in direct path
        )
        
        if result.returncode == 0:
            print("✅ Restart command sent successfully!")
            print(result.stdout)
            print("⏳ It may take a minute for the bot to come back online.")
        else:
            print("❌ Failed to restart bot.")
            print(f"Error: {result.stderr}")
            
    except FileNotFoundError:
        print("❌ 'fly' command not found. Please ensure flyctl is installed and in your PATH.")
    except Exception as e:
        print(f"❌ An unexpected error occurred: {e}")

if __name__ == "__main__":
    restart_bot()
