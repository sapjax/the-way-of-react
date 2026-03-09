#!/usr/bin/env bash

# ============================================================
# Build script for "The Way of React" EPUB (KDP-optimized)
# ============================================================
#
# Usage:   ./pandoc.sh
# Output:  The_Way_of_React_<lang>.epub for each language in chapters/
#
# Requirements:
#   - pandoc (>= 3.0)
#   - cover.jpg in project root
# ============================================================

set -euo pipefail

# --- Config ---
COVER_IMAGE="cover.png"
CSS_FILE="epub.css"

echo "🚀 Building EPUBs for all languages..."

# --- Check dependencies ---
if ! command -v pandoc &> /dev/null; then
    echo "❌ Error: pandoc is not installed."
    echo "   Install with: nix-shell -p pandoc  OR  brew install pandoc"
    exit 1
fi

echo "   pandoc version: $(pandoc --version | head -1)"

# --- Check cover image ---
if [ ! -f "$COVER_IMAGE" ]; then
    echo "⚠️  Warning: $COVER_IMAGE not found. EPUBs will be built without covers."
    COVER_FLAG=""
else
    echo "   Cover image: $COVER_IMAGE"
    COVER_FLAG="--epub-cover-image=$COVER_IMAGE"
fi

echo ""

# Iterate over all language directories in chapters/
for lang_dir in chapters/*; do
    if [ ! -d "$lang_dir" ]; then
        continue
    fi
    lang=$(basename "$lang_dir")

    OUTPUT_NAME="The_Way_of_React_${lang}.epub"
    METADATA_FILE="metadata_${lang}.yaml"
    CHAPTERS_DIR="$lang_dir"

    echo "============================================================"
    echo "� Building EPUB for language: $lang"
    echo "============================================================"

    # --- Generate metadata ---
    # Adjust language code for metadata if needed
    if [ "$lang" = "zh" ]; then
        epub_lang="zh-CN"
    else
        epub_lang="en-US"
    fi

    cat <<EOF > "$METADATA_FILE"
---
title: "The Way of React"
subtitle: "Reinventing React From Scratch"
author: "sapjax"
language: "$epub_lang"
publisher: "Self-Published"
rights: "© 2026 sapjax. All rights reserved."
description: |
  A hands-on journey through the evolution of React.
  reinvent React from scratch —
  The entire journey is written as a conversation — Socratic, exploratory, and built on first principles..
cover-image: "$COVER_IMAGE"
---
EOF

    # --- Check chapter files ---
    # Using nullglob to handle the case where no .md files exist
    shopt -s nullglob
    CHAPTER_FILES=("$CHAPTERS_DIR"/*.md)
    shopt -u nullglob

    echo "   Chapters found: ${#CHAPTER_FILES[@]}"

    if [ ${#CHAPTER_FILES[@]} -eq 0 ]; then
        echo "⚠️  Warning: No .md files found in $CHAPTERS_DIR/. Skipping..."
        rm -f "$METADATA_FILE"
        echo ""
        continue
    fi

    # --- Build EPUB ---
    # Key pandoc flags for KDP:
    #   --toc                     Table of contents
    #   --toc-depth=2             TOC includes h1 + h2
    #   --epub-chapter-level=1    Each h1 starts a new EPUB chapter/file
    #   --css                     Custom stylesheet
    #   --highlight-style         Syntax highlighting (tango is e-ink friendly)
    #   --wrap=preserve           Don't re-wrap code lines
    #   --resource-path           Where to find referenced assets

    pandoc "$METADATA_FILE" "${CHAPTER_FILES[@]}" \
        -o "$OUTPUT_NAME" \
        --toc \
        --toc-depth=2 \
        --split-level=1 \
        --css="$CSS_FILE" \
        --highlight-style=tango \
        --wrap=preserve \
        --resource-path=".:$CHAPTERS_DIR" \
        $COVER_FLAG

    # --- Result ---
    if [ $? -eq 0 ]; then
        FILE_SIZE=$(du -h "$OUTPUT_NAME" | cut -f1)
        echo "✅ Build successful for $lang!"
        echo "   Output:  $OUTPUT_NAME ($FILE_SIZE)"
    else
        echo "❌ Build failed for $lang."
        rm -f "$METADATA_FILE"
        exit 1
    fi

    rm -f "$METADATA_FILE"
    echo ""
done

echo "📋 Next steps:"
echo "   1. Preview with Kindle Previewer: https://kdp.amazon.com/en_US/help/topic/G202131170"
echo "   2. Validate with epubcheck:  epubcheck The_Way_of_React_en.epub"
echo "   3. Upload to KDP:  https://kdp.amazon.com"