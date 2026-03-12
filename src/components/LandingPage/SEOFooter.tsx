import Link from 'next/link'

// Curated "seed list" for Google crawl discovery. Renders below the main footer
// on non-marketing pages (homepage, /exchange, /lp, etc.). Marketing pages don't
// need this — they already have RelatedPages + CountryGrid linking to sibling content.
//
// This list is intentionally static and small. New countries/exchanges/competitors
// are discovered by Google via in-page links on the pages listed here. Only update
// this when a new content *category* is added or top markets shift significantly.
//
// Data is inlined (not imported from @/data/seo) to avoid pulling in fs-dependent
// modules that can't be bundled for the client.

const TOP_COUNTRIES: Array<{ slug: string; name: string }> = [
    { slug: 'argentina', name: 'Argentina' },
    { slug: 'brazil', name: 'Brazil' },
    { slug: 'mexico', name: 'Mexico' },
    { slug: 'colombia', name: 'Colombia' },
    { slug: 'philippines', name: 'Philippines' },
    { slug: 'nigeria', name: 'Nigeria' },
    { slug: 'india', name: 'India' },
    { slug: 'chile', name: 'Chile' },
]

const COMPETITORS: Array<{ slug: string; name: string }> = [
    { slug: 'wise', name: 'Wise' },
    { slug: 'western-union', name: 'Western Union' },
    { slug: 'paypal', name: 'PayPal' },
    { slug: 'revolut', name: 'Revolut' },
    { slug: 'binance-p2p', name: 'Binance P2P' },
]

const EXCHANGES: Array<{ slug: string; name: string }> = [
    { slug: 'binance', name: 'Binance' },
    { slug: 'coinbase', name: 'Coinbase' },
    { slug: 'bybit', name: 'Bybit' },
    { slug: 'kraken', name: 'Kraken' },
]

export function SEOFooter() {
    return (
        <nav aria-label="Site directory" className="bg-black px-8 py-8 md:px-20">
            <div className="flex flex-wrap justify-between gap-y-8">
                <div>
                    <h3 className="mb-3 text-xs font-bold text-white">Send Money</h3>
                    <ul className="space-y-1">
                        {TOP_COUNTRIES.map(({ slug, name }) => (
                            <li key={slug}>
                                <Link
                                    href={`/en/send-money-to/${slug}`}
                                    className="text-xs text-white underline hover:text-white/70"
                                >
                                    Send to {name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h3 className="mb-3 text-xs font-bold text-white">Countries</h3>
                    <ul className="space-y-1">
                        {TOP_COUNTRIES.map(({ slug, name }) => (
                            <li key={slug}>
                                <Link href={`/en/${slug}`} className="text-xs text-white underline hover:text-white/70">
                                    Peanut in {name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h3 className="mb-3 text-xs font-bold text-white">Compare</h3>
                    <ul className="space-y-1">
                        {COMPETITORS.map(({ slug, name }) => (
                            <li key={slug}>
                                <Link
                                    href={`/en/compare/peanut-vs-${slug}`}
                                    className="text-xs text-white underline hover:text-white/70"
                                >
                                    Peanut vs {name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h3 className="mb-3 text-xs font-bold text-white">Resources</h3>
                    <ul className="space-y-1">
                        <li>
                            <Link href="/en/help" className="text-xs text-white underline hover:text-white/70">
                                Help Center
                            </Link>
                        </li>
                        {EXCHANGES.map(({ slug, name }) => (
                            <li key={slug}>
                                <Link
                                    href={`/en/deposit/from-${slug}`}
                                    className="text-xs text-white underline hover:text-white/70"
                                >
                                    Deposit from {name}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </nav>
    )
}
