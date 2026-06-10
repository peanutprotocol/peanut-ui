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

function localizeHref(href: string, locale: string): string {
    if (href.startsWith('/en/')) return `/${locale}/${href.slice(4)}`
    return href
}

function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-3 text-xs font-bold text-white">{title}</h3>
            <ul className="space-y-1">{children}</ul>
        </div>
    )
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

export function SEOFooter({ locale = 'en' }: { locale?: string } = {}) {
    const sendTo = (manifest.sendMoney?.to ?? []) as ManifestEntry[]
    const sendFrom = (manifest.sendMoney?.from ?? []) as ManifestEntry[]
    const compare = (manifest.compare ?? []) as ManifestEntry[]
    const articles = ((manifest as Record<string, unknown>).articles ?? []) as ManifestEntry[]
    const resources = (manifest.resources ?? []) as ManifestEntry[]
    const hasSendMoney = sendTo.length > 0 || sendFrom.length > 0

    const link = (entry: ManifestEntry) => (entry.external ? entry.href : localizeHref(entry.href, locale))

    return (
        <nav aria-label="Site directory" className="bg-black px-8 py-8 md:px-20">
            <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
                {hasSendMoney && (
                    <FooterSection title="Send Money">
                        {sendTo.map((entry) => (
                            <FooterLink key={`to-${entry.slug}`} href={link(entry)}>
                                Send to {entry.name}
                            </FooterLink>
                        ))}
                        {sendFrom.map((entry) => (
                            <FooterLink key={`from-${entry.slug}`} href={link(entry)}>
                                Send from {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {compare.length > 0 && (
                    <FooterSection title="Compare">
                        {compare.map((entry) => (
                            <FooterLink key={entry.slug} href={link(entry)}>
                                Peanut vs {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {articles.length > 0 && (
                    <FooterSection title="Learn More">
                        {articles.map((entry) => (
                            <FooterLink key={entry.slug} href={link(entry)}>
                                {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {resources.length > 0 && (
                    <FooterSection title="Resources">
                        {resources.map((entry) => (
                            <FooterLink key={entry.slug} href={link(entry)} external={entry.external}>
                                {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}
            </div>
        </nav>
    )
}
