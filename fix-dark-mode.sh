#!/bin/bash

# Script to replace hardcoded Tailwind colors with CSS variables for dark mode support
# Usage: ./fix-dark-mode.sh

cd /Users/nolimits/Projects/showshowshow/frontend/src

# Find all TSX files and replace hardcoded colors
find pages components -name "*.tsx" -type f | while read file; do
  echo "Processing: $file"

  # Background colors
  sed -i '' 's/className="\([^"]*\)bg-white\([^"]*\)"/className="\1bg-[rgb(var(--color-bg-surface))]\2"/g' "$file"
  sed -i '' 's/className="\([^"]*\)bg-gray-50\([^"]*\)"/className="\1bg-[rgb(var(--color-bg-page))]\2"/g' "$file"
  sed -i '' 's/className="\([^"]*\)bg-gray-100\([^"]*\)"/className="\1bg-[rgb(var(--color-bg-elevated))]\2"/g' "$file"

  # Text colors
  sed -i '' 's/className="\([^"]*\)text-gray-900\([^"]*\)"/className="\1text-[rgb(var(--color-text-primary))]\2"/g' "$file"
  sed -i '' 's/className="\([^"]*\)text-gray-600\([^"]*\)"/className="\1text-[rgb(var(--color-text-secondary))]\2"/g' "$file"
  sed -i '' 's/className="\([^"]*\)text-gray-500\([^"]*\)"/className="\1text-[rgb(var(--color-text-tertiary))]\2"/g' "$file"

  # Border colors
  sed -i '' 's/className="\([^"]*\)border-gray-300\([^"]*\)"/className="\1border-[rgb(var(--color-border-default))]\2"/g' "$file"
  sed -i '' 's/className="\([^"]*\)border-gray-200\([^"]*\)"/className="\1border-[rgb(var(--color-border-subtle))]\2"/g' "$file"
done

echo "✅ Dark mode color replacement complete!"
echo "Files processed. Please review the changes."
