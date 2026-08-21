// Build-time gate for the /dev/devices viewport harness. Next.js inlines
// `process.env.NEXT_PUBLIC_*` at compile time, so a production build folds this
// to `false` and the harness never ships. Preview builds keep it, so a PR can
// be reviewed across device widths on its own vercel URL.
//
// Both the page and the in-pane agent read this constant. They must agree — a
// page that renders without an agent in the panes is a dead harness.
export const DEV_TOOLS_ENABLED =
    process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview'
