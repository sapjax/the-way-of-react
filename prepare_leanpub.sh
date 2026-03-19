#!/bin/bash

# Configuration
SOURCE_DIR="chapters/en"
TARGET_DIR="$HOME/Desktop/leanpub"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DIR"

echo "Exporting chapters to $TARGET_DIR..."

# Iterate over all markdown files in the English chapters directory
for file in "$SOURCE_DIR"/*.md; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo "Processing $filename..."
    
    # Perform replacements and save to target directory
    # 1. ../images -> images
    # 2. 🧙‍♂️ -> 🐢
    # Note: We use a multi-byte character for the wizard to ensure compatibility.
    sed -e 's|\.\./\.\./website/public/images|images|g' \
        -e 's|🧙‍♂️|🐢|g' \
        "$file" > "$TARGET_DIR/$filename"
  fi
done

echo "Done! All chapters exported to $TARGET_DIR."
