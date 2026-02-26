# Help Center — Future Improvements

## When article count > 25

- **Full-text body search**: Current search only matches title + description + category.
  Index article body text server-side and pass keyword arrays to HelpLanding,
  or use a lightweight client-side lib like Fuse.js for fuzzy matching.

- **Category filter chips/tabs**: Add clickable category chips at the top of the
  landing page so users can filter without scrolling. Alternative: make category
  sections collapsible (accordion).

- **Category landing pages**: At 50+ articles, consider dedicated pages at
  `/help/category/payments` etc. with their own SEO value.

## Nice-to-haves (not blocking)

- **Search analytics**: Track what users search for (via GA4 event) to identify
  content gaps and missing articles.

- **"Was this helpful?" feedback**: Add thumbs up/down at the bottom of each
  article. Store in analytics, no backend needed.

- **Article-level table of contents**: For longer articles, generate a sticky
  sidebar TOC from h2/h3 headings. Only relevant once articles get longer.

- **Localized landing page Hero**: Hero title/subtitle already use i18n keys.
  Consider locale-specific subtitles that highlight region-relevant features.
