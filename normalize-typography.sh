#!/bin/bash

# Script to normalize typography across all pages
# Removes brutalist elements: font-black, font-mono, uppercase, tracking-wider/widest

cd /Users/nolimits/Projects/showshowshow/frontend/src

echo "🔤 Normalizing Typography..."
echo "=================================="

find pages components -name "*.tsx" -type f | while read file; do
  echo "Processing: $file"

  # Replace font-black with font-bold or font-semibold
  # For h1, h2 -> font-bold
  sed -i '' 's/\(h1.*\)font-black/\1font-bold/g' "$file"
  sed -i '' 's/\(h2.*\)font-black/\1font-bold/g' "$file"
  # For other elements -> font-semibold
  sed -i '' 's/font-black/font-semibold/g' "$file"

  # Remove font-mono
  sed -i '' 's/font-mono //g' "$file"
  sed -i '' 's/ font-mono//g' "$file"

  # Remove uppercase
  sed -i '' 's/uppercase //g' "$file"
  sed -i '' 's/ uppercase//g' "$file"

  # Replace tracking-wider/widest with tracking-tight for headings or remove
  sed -i '' 's/tracking-widest/tracking-tight/g' "$file"
  sed -i '' 's/tracking-wider/tracking-tight/g' "$file"
  # Clean up extra tracking-tight if not needed
  sed -i '' 's/\(text-sm.*\)tracking-tight //g' "$file"
  sed -i '' 's/\(text-xs.*\)tracking-tight //g' "$file"
done

echo ""
echo "✅ Typography normalization complete!"
echo "Removed: font-black, font-mono, uppercase, tracking-wider/widest"
echo "Replaced with: font-bold, font-semibold, tracking-tight (where appropriate)"
