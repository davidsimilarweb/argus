#!/bin/bash

# Restart Caddy by unloading and loading the LaunchDaemon
# This script requires sudo privileges

echo "Stopping Caddy..."
sudo launchctl unload /Library/LaunchDaemons/com.argus.caddy.plist

echo "Starting Caddy..."
sudo launchctl load /Library/LaunchDaemons/com.argus.caddy.plist

echo "Caddy restarted successfully!"
