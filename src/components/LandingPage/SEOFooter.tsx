import Link from 'next/link'
import manifest from '@/content/generated/footer-manifest.json'

// SEO footer driven by the content manifest (peanut-content/generated/footer-manifest.json).
// Data is imported as a JSON module — works in both client and server components
// without fs. The manifest is bundled at build time by webpack.

interface ManifestEntry {
    slug: string
    name: string
    href: string
    external?: boolean
}

function FooterLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
    if (external) {
        return (
            <li>
                <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-white underline hover:text-white/70"
                >
                    {children}
                </a>
            </li>
        )
    }
    return (
        <li>
            <Link href={href} className="text-xs text-white underline hover:text-white/70">
                {children}
            </Link>
        </li>
    )
}

export function SEOFooter() {
    const sendTo = (manifest.sendMoney?.to ?? []) as ManifestEntry[]
    const sendFrom = (manifest.sendMoney?.from ?? []) as ManifestEntry[]
    const compare = (manifest.compare ?? []) as ManifestEntry[]
    const articles = ((manifest as Record<string, unknown>).articles ?? []) as ManifestEntry[]
    const resources = (manifest.resources ?? []) as ManifestEntry[]

    return (
        <nav aria-label="Site directory" className="bg-black px-8 py-8 md:px-20">
            <div className="flex flex-wrap justify-between gap-y-8">
                {sendTo.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-xs font-bold text-white">Send To</h3>
                        <ul className="space-y-1">
                            {sendTo.map((entry) => (
                                <FooterLink key={entry.slug} href={entry.href}>
                                    Send to {entry.name}
                                </FooterLink>
                            ))}
                        </ul>
                    </div>
                )}

                {sendFrom.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-xs font-bold text-white">Send From</h3>
                        <ul className="space-y-1">
                            {sendFrom.map((entry) => (
                                <FooterLink key={entry.slug} href={entry.href}>
                                    Send from {entry.name}
                                </FooterLink>
                            ))}
                        </ul>
                    </div>
                )}

                {compare.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-xs font-bold text-white">Compare</h3>
                        <ul className="space-y-1">
                            {compare.map((entry) => (
                                <FooterLink key={entry.slug} href={entry.href}>
                                    Peanut vs {entry.name}
                                </FooterLink>
                            ))}
                        </ul>
                    </div>
                )}

                {articles.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-xs font-bold text-white">Learn More</h3>
                        <ul className="space-y-1">
                            {articles.map((entry) => (
                                <FooterLink key={entry.slug} href={entry.href}>
                                    {entry.name}
                                </FooterLink>
                            ))}
                        </ul>
                    </div>
                )}

                {resources.length > 0 && (
                    <div>
                        <h3 className="mb-3 text-xs font-bold text-white">Resources</h3>
                        <ul className="space-y-1">
                            {resources.map((entry) => (
                                <FooterLink
                                    key={entry.slug}
                                    href={entry.href}
                                    external={entry.external}
                                >
                                    {entry.name}
                                </FooterLink>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </nav>
    )
}
