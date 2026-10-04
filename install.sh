#!/usr/bin/env bash
# Vette One-Click Installer for macOS and Linux
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Kaustubh-Barad-007/vette/main/install.sh | bash
# Or locally:
#   ./install.sh

set -e

echo -e "\033[1;36m[VETTE] Terminal Pre-Install Guard Installer\033[0m"
echo -e "\033[0;90mDefending against AI Slopsquatting & Zero-Day Poisoning...\033[0m\n"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
    echo -e "\033[1;31m[ERROR] Node.js is required but not installed. Please install Node.js (v18+) first: https://nodejs.org\033[0m"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd || echo "")"

if [ -n "$SCRIPT_DIR" ] && [ -f "$SCRIPT_DIR/package.json" ]; then
    echo -e "\033[1;33m[*] Installing from local repository ($SCRIPT_DIR)...\033[0m"
    if [ ! -f "$SCRIPT_DIR/dist/cli.cjs" ]; then
        (cd "$SCRIPT_DIR" && npm run build)
    fi
    (cd "$SCRIPT_DIR" && npm link)
    TARGET_CMD="node \"$SCRIPT_DIR/dist/cli.cjs\""
else
    echo -e "\033[1;33m[*] Installing Vette globally via npm...\033[0m"
    npm install -g vette
    TARGET_CMD="vette"
fi

# Detect shell rc file
SHELL_RC="$HOME/.bashrc"
if [ -n "$ZSH_VERSION" ] || [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
    SHELL_RC="$HOME/.zshrc"
fi

SHIM="
# --- Vette Pre-Install Guard ---
npm() { $TARGET_CMD npm \"\$@\"; }
pip() { $TARGET_CMD pip \"\$@\"; }
# --- End Vette Guard ---
"

if ! grep -q "Vette Pre-Install Guard" "$SHELL_RC" 2>/dev/null; then
    echo "$SHIM" >> "$SHELL_RC"
    echo -e "\033[1;32m[OK] Added Vette interceptor shims to $SHELL_RC\033[0m"
else
    echo -e "\033[1;32m[OK] Vette shims already active in $SHELL_RC\033[0m"
fi

echo -e "\n\033[1;32m[SUCCESS] Vette terminal protection is active!\033[0m"
echo -e "Restart your terminal or run: \033[1;33msource $SHELL_RC\033[0m"
echo -e "Try it now: \033[1;36mvette vet react\033[0m\n"
