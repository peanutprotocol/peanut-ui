// /{locale}/content is the hub's former address and keeps serving the same page
// as /{locale}/blog. Canonical, hreflang, sitemap and internal links all name
// /blog, so this route stays reachable without competing for the index.
export { default, generateMetadata, generateStaticParams } from '../blog/page'
// Segment config must be declared in the route file itself; Next cannot read a re-export.
export const dynamicParams = false
