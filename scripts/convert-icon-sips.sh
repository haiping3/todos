#!/bin/bash
# Convert source icon to Chrome extension sizes using macOS sips
# @author haiping.yu@zoom.us
#
# Usage:
#   1. Save your icon as: public/icons/icon-source.png
#   2. Run: bash scripts/convert-icon-sips.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICONS_DIR="$SCRIPT_DIR/../public/icons"
SOURCE="$ICONS_DIR/icon-source.png"

if [ ! -f "$SOURCE" ]; then
    echo "❌ Error: Source icon not found!"
    echo "Please save your icon as: public/icons/icon-source.png"
    exit 1
fi

echo "Converting icon to Chrome extension sizes..."
echo ""

for SIZE in 16 32 48 128; do
    OUTPUT="$ICONS_DIR/icon${SIZE}.png"
    cp "$SOURCE" "$OUTPUT"
    sips -z $SIZE $SIZE "$OUTPUT" --out "$OUTPUT" > /dev/null 2>&1
    echo "✓ Generated icon${SIZE}.png (${SIZE}x${SIZE})"
done

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Run 'pnpm build' to rebuild the extension with new icons."

