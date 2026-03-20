import Link from 'next/link'
import footerManifest from '@/content/generated/footer-manifest.json'

// SEO footer driven by peanut-content's generated/footer-manifest.json.
// To update: add `featured: true` to content frontmatter, run
// `node scripts/generate-footer-manifest.js` in peanut-content, and deploy.
//
// JSON import is webpack-safe for client bundles (no fs dependency).

interface FooterLink {
    slug: string
    name: string
    href: string
    external?: boolean
}

const linkClass = 'text-xs text-white underline hover:text-white/70'

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <h3 className="mb-3 text-xs font-bold text-white">{title}</h3>
            <ul className="space-y-1">{children}</ul>
        </div>
    )
}

function FooterLink({ link, prefix }: { link: FooterLink; prefix?: string }) {
    const label = prefix ? `${prefix} ${link.name}` : link.name

    if (link.external) {
        return (
            <li>
                <a href={link.href} className={linkClass} target="_blank" rel="noopener noreferrer">
                    {label}
                </a>
            </li>
        )
    }

    return (
        <li>
            <Link href={link.href} className={linkClass}>
                {label}
            </Link>
        </li>
    )
}

export function SEOFooter() {
    const { sendMoney, compare, articles, resources } = footerManifest

    return (
        <nav aria-label="Site directory" className="bg-black px-8 py-8 md:px-20">
            <div className="flex flex-wrap justify-between gap-y-8">
                <FooterColumn title="Send Money">
                    {(sendMoney.to as FooterLink[]).map((link) => (
                        <FooterLink key={link.slug} link={link} prefix="Send to" />
                    ))}
                    {(sendMoney.from as FooterLink[]).map((link) => (
                        <FooterLink key={link.slug} link={link} prefix="Send from" />
                    ))}
                </FooterColumn>

                <FooterColumn title="Compare">
                    {(compare as FooterLink[]).map((link) => (
                        <FooterLink key={link.slug} link={link} prefix="Peanut vs" />
                    ))}
                </FooterColumn>

                <FooterColumn title="Articles">
                    {(articles as FooterLink[]).map((link) => (
                        <FooterLink key={link.slug} link={link} />
                    ))}
                </FooterColumn>

                <FooterColumn title="Resources">
                    {(resources as FooterLink[]).map((link) => (
                        <FooterLink key={link.slug} link={link} />
                    ))}
                </FooterColumn>
            </div>
        </nav>
    )
}
