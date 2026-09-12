#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$DIR/dist"
ZIP_NAME="perplexity-to-gemini-v1.0.0.zip"

echo "🧹 Cleaning previous build..."
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

echo "📦 Packaging extension for Chrome Web Store..."
cd "$DIR"
zip -r "$DIST_DIR/$ZIP_NAME" \
  manifest.json \
  popup.html \
  popup.js \
  extract.html \
  extract.js \
  migrate.html \
  migrate.js \
  jszip.min.js \
  icons \
  -x "*.DS_Store"

echo "✅ Package created successfully: $DIST_DIR/$ZIP_NAME"
echo ""
echo "Contents of zip archive:"
unzip -l "$DIST_DIR/$ZIP_NAME"
