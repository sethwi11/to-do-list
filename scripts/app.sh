#!/bin/bash
# The always-on app: a LaunchAgent that starts the server at login (serving the built app and sending pop-ups) and restarts it if it stops.
# Usage: npm run app:install | app:restart | app:uninstall | app:logs
set -euo pipefail

LABEL="com.planner.app"
PORT=3030
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGS="$HOME/Library/Logs/Planner"
DOMAIN="gui/$(id -u)"

# It runs your real database, so only from the main folder on the main branch.
check_main() {
  local branch
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)"
  if [[ "$branch" != "main" && "${FORCE:-}" != "1" ]]; then
    echo "This folder is on '$branch'. Run this from the main folder on main (or FORCE=1 to override)." >&2
    exit 1
  fi
}

build() {
  echo "Building the app..."
  (cd "$ROOT" && npm run build -w client >/dev/null)
}

case "${1:-}" in
  install)
    check_main
    build
    mkdir -p "$LOGS" "$(dirname "$PLIST")"
    cat >"$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$(command -v node)</string>
    <string>$ROOT/node_modules/tsx/dist/cli.mjs</string>
    <string>src/index.ts</string>
  </array>
  <key>WorkingDirectory</key><string>$ROOT/server</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>API_PORT</key><string>$PORT</string>
    <key>POPUPS</key><string>on</string>
    <key>SERVE_CLIENT</key><string>1</string>
    <key>APP_URL</key><string>http://127.0.0.1:$PORT</string>
    <key>PATH</key><string>$(dirname "$(command -v node)"):/usr/bin:/bin</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGS/server.log</string>
  <key>StandardErrorPath</key><string>$LOGS/server.log</string>
</dict>
</plist>
PLIST
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    launchctl bootstrap "$DOMAIN" "$PLIST"
    echo "Planner is running at http://127.0.0.1:$PORT and will start at login. Logs: $LOGS/server.log"
    ;;
  restart)
    check_main
    build
    launchctl kickstart -k "$DOMAIN/$LABEL"
    echo "Restarted: http://127.0.0.1:$PORT"
    ;;
  uninstall)
    launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Removed. Your data and logs are untouched."
    ;;
  logs)
    tail -n 50 "$LOGS/server.log"
    ;;
  *)
    echo "Usage: npm run app:install | app:restart | app:uninstall | app:logs" >&2
    exit 1
    ;;
esac
