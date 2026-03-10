import Link from 'next/link'
import {
    COUNTRIES_SEO,
    COMPETITORS as COMPETITORS_SEO,
    EXCHANGES as EXCHANGES_SEO,
} from '@/data/seo'

// Curated "seed list" for Google crawl discovery. Renders below the main footer
// on non-marketing pages (homepage, /exchange, /lp, etc.). Marketing pages don't
// need this — they already have RelatedPages + CountryGrid linking to sibling content.
//
// The lists below define PRIORITY ORDER only. Each is filtered at render time
// against the actual SEO data (@/data/seo) so we never link to a country,
// competitor, or exchange that doesn't have published content.
//
// This is a server component, so importing the fs-dependent @/data/seo modules
// is safe. Only update the priority lists when top markets shift significantly.

const TOP_COUNTRIES_PRIORITY: Array<{ slug: string; name: string }> = [
    { slug: 'argentina', name: 'Argentina' },
    { slug: 'brazil', name: 'Brazil' },
    { slug: 'mexico', name: 'Mexico' },
    { slug: 'colombia', name: 'Colombia' },
    { slug: 'philippines', name: 'Philippines' },
    { slug: 'nigeria', name: 'Nigeria' },
    { slug: 'india', name: 'India' },
    { slug: 'chile', name: 'Chile' },
]

const COMPETITORS_PRIORITY: Array<{ slug: string; name: string }> = [
    { slug: 'wise', name: 'Wise' },
    { slug: 'western-union', name: 'Western Union' },
    { slug: 'paypal', name: 'PayPal' },
    { slug: 'revolut', name: 'Revolut' },
    { slug: 'binance-p2p', name: 'Binance P2P' },
]

const EXCHANGES_PRIORITY: Array<{ slug: string; name: string }> = [
    { slug: 'binance', name: 'Binance' },
    { slug: 'coinbase', name: 'Coinbase' },
    { slug: 'bybit', name: 'Bybit' },
    { slug: 'kraken', name: 'Kraken' },
]

// Filter to only entries with published content
const TOP_COUNTRIES = TOP_COUNTRIES_PRIORITY.filter(({ slug }) => slug in COUNTRIES_SEO)
const COMPETITORS = COMPETITORS_PRIORITY.filter(({ slug }) => slug in COMPETITORS_SEO)
const EXCHANGES = EXCHANGES_PRIORITY.filter(({ slug }) => slug in EXCHANGES_SEO)

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
