#!/usr/bin/env bash
# Notify search engines of sitemap update after deploy.
# Usage: Run as a post-deploy step or manually after content changes.

SITEMAP_URL="https://peanut.me/sitemap.xml"

echo "Pinging Google..."
curl -s -o /dev/null -w "  HTTP %{http_code}\n" "https://www.google.com/ping?sitemap=${SITEMAP_URL}"

echo "Pinging Bing..."
curl -s -o /dev/null -w "  HTTP %{http_code}\n" "https://www.bing.com/ping?sitemap=${SITEMAP_URL}"

echo "Done."
