// /{locale}/content is the hub's former address and keeps serving the same page
// as /{locale}/blog. Canonical, hreflang, sitemap and internal links all name
// /blog, so this route stays reachable without competing for the index.
export { default, dynamicParams, generateMetadata, generateStaticParams } from '../blog/page'
