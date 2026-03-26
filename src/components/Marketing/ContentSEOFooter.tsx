import fs from 'fs'
import path from 'path'
import Link from 'next/link'

interface ManifestEntry {
    slug: string
    name: string
    href: string
    external?: boolean
}

interface FooterManifest {
    sendMoney: { to: ManifestEntry[]; from: ManifestEntry[] }
    compare: ManifestEntry[]
    articles: ManifestEntry[]
    resources: ManifestEntry[]
}

function loadManifest(): FooterManifest | null {
    try {
        const manifestPath = path.join(process.cwd(), 'src/content/generated/footer-manifest.json')
        const raw = fs.readFileSync(manifestPath, 'utf8')
        return JSON.parse(raw) as FooterManifest
    } catch {
        return null
    }
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

export function ContentSEOFooter({ locale }: { locale: string }) {
    const manifest = loadManifest()
    if (!manifest) return null

    return (
        <nav aria-label="Site directory" className="bg-black px-8 py-8 md:px-20">
            <div className="flex flex-wrap justify-between gap-y-8">
                {manifest.sendMoney.to.length > 0 && (
                    <FooterSection title="Send To">
                        {manifest.sendMoney.to.map((entry) => (
                            <FooterLink key={entry.slug} href={localizeHref(entry.href, locale)}>
                                Send to {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {manifest.sendMoney.from.length > 0 && (
                    <FooterSection title="Send From">
                        {manifest.sendMoney.from.map((entry) => (
                            <FooterLink key={entry.slug} href={localizeHref(entry.href, locale)}>
                                Send from {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {manifest.compare.length > 0 && (
                    <FooterSection title="Compare">
                        {manifest.compare.map((entry) => (
                            <FooterLink key={entry.slug} href={localizeHref(entry.href, locale)}>
                                Peanut vs {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {manifest.articles.length > 0 && (
                    <FooterSection title="Learn More">
                        {manifest.articles.map((entry) => (
                            <FooterLink key={entry.slug} href={localizeHref(entry.href, locale)}>
                                {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}

                {manifest.resources.length > 0 && (
                    <FooterSection title="Resources">
                        {manifest.resources.map((entry) => (
                            <FooterLink
                                key={entry.slug}
                                href={entry.external ? entry.href : localizeHref(entry.href, locale)}
                                external={entry.external}
                            >
                                {entry.name}
                            </FooterLink>
                        ))}
                    </FooterSection>
                )}
            </div>
        </nav>
    )
}
