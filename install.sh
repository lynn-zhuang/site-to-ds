#!/bin/bash
# Site-to-DS — Install Script
# Copies the skill to your Claude Code skills directory

set -e

SKILL_DIR="$HOME/.claude/skills/site-to-ds"

echo ""
echo "  Site-to-DS Installer"
echo "  Website → Design System for Claude Code"
echo ""

# Create skills directory if needed
mkdir -p "$HOME/.claude/skills"

# Copy files
if [ -d "$SKILL_DIR" ]; then
  echo "  Updating existing installation..."
  rm -rf "$SKILL_DIR"
fi

# Get script directory (works even if called from elsewhere)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cp -r "$SCRIPT_DIR" "$SKILL_DIR"

# Clean up non-skill files from the installed copy
rm -f "$SKILL_DIR/install.sh"
rm -f "$SKILL_DIR/README.md"
rm -f "$SKILL_DIR/LICENSE"
rm -rf "$SKILL_DIR/.git"
rm -f "$SKILL_DIR/.gitignore"

echo "  Installed to: $SKILL_DIR"
echo ""
echo "  Done! Open Claude Code and say:"
echo "  \"Extract the design system from https://example.com\""
echo ""
