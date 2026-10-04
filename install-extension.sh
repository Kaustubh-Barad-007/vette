#!/usr/bin/env bash
# Vette Universal IDE Extension Installer for macOS & Linux
# Supports: VS Code, Cursor, Windsurf, VSCodium
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install-extension.sh | bash

set -e

echo -e "\n\033[1;36m[VETTE] Universal IDE Extension Installer\033[0m"
echo -e "\033[0;90mDetecting installed AI coding environments...\033[0m\n"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"
LOCAL_VSIX="$SCRIPT_DIR/extension/vette-vscode-0.1.0.vsix"
TEMP_VSIX="/tmp/vette-vscode.vsix"
TARGET_VSIX=""

if [ -n "$SCRIPT_DIR" ] && [ -f "$LOCAL_VSIX" ]; then
    TARGET_VSIX="$LOCAL_VSIX"
else
    echo -e "\033[1;33m[*] Downloading latest Vette extension from GitHub...\033[0m"
    URL="https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/extension/vette-vscode-0.1.0.vsix"
    curl -fsSL "$URL" -o "$TEMP_VSIX"
    TARGET_VSIX="$TEMP_VSIX"
fi

if [ ! -f "$TARGET_VSIX" ]; then
    echo -e "\033[1;31m[!] Could not download Vette extension VSIX.\033[0m"
    exit 1
fi

COMMANDS=("code" "cursor" "windsurf" "codium")
INSTALLED_COUNT=0

for cmd in "${COMMANDS[@]}"; do
    if command -v "$cmd" >/dev/null 2>&1; then
        echo -n "Installing into $cmd... "
        "$cmd" --install-extension "$TARGET_VSIX" --force >/dev/null 2>&1 || true
        echo -e "\033[1;32m[SUCCESS]\033[0m"
        INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
    fi
done

if [ "$INSTALLED_COUNT" -gt 0 ]; then
    echo -e "\n\033[1;32m[OK] Vette extension installed successfully into $INSTALLED_COUNT editor(s)!\033[0m"
    echo -e "Open any package.json or requirements.txt to see real-time AI slopsquat protection active.\n"
else
    echo -e "\033[1;33mNo IDE CLI command found on PATH.\033[0m"
    echo -e "You can manually install by running:"
    echo -e "\033[1;36mcode --install-extension $TARGET_VSIX\033[0m\n"
fi
