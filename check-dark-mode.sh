#!/bin/bash

# Dark Mode Verification Script
# Checks for hardcoded colors that might break dark mode

echo "🔍 Checking for Dark Mode Issues..."
echo "=================================="
echo ""

cd /Users/nolimits/Projects/showshowshow/frontend/src

# Check for hardcoded className colors (excluding already fixed ones with rgb(var))
echo "📌 Hardcoded className colors:"
grep -rn "className.*\(bg-white\|bg-gray-\|text-gray-\|border-gray-\)" pages/ components/ | grep -v "rgb(var" | grep -v "gray-800\|gray-700\|gray-400" | wc -l

# Check for inline style colors
echo "📌 Inline style hardcoded colors:"
grep -rn "backgroundColor.*['\"]white\|backgroundColor.*['\"]gray\|color.*['\"]gray" pages/ components/ | grep -v "rgb(var" | wc -l

# Check for hardcoded hex colors in styles
echo "📌 Hardcoded hex colors in inline styles:"
grep -rn "backgroundColor.*#\|borderColor.*#\|color.*#[0-9a-f]" pages/ components/ | grep -v "#646cff\|#14b8a6" | wc -l

# List specific problem files
echo ""
echo "🔥 Problem Files (if any):"
echo "=================================="

echo ""
echo "Hardcoded className colors:"
grep -rn "className.*\(bg-white\|bg-gray-\|text-gray-\|border-gray-\)" pages/ components/ | grep -v "rgb(var" | grep -v "gray-800\|gray-700\|gray-400" | cut -d: -f1 | sort -u || echo "✅ None found!"

echo ""
echo "Inline style colors:"
grep -rn "backgroundColor.*['\"]white\|backgroundColor.*['\"]gray" pages/ components/ | grep -v "rgb(var" | cut -d: -f1 | sort -u || echo "✅ None found!"

echo ""
echo "Hex colors in styles:"
grep -rn "backgroundColor.*#\|borderColor.*#" pages/ components/ | grep -v "#646cff\|#14b8a6\|rgb(var" | cut -d: -f1 | sort -u || echo "✅ None found!"

echo ""
echo "=================================="
echo "✅ Dark Mode Check Complete!"
