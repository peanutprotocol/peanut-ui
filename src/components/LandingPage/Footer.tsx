import GITHUB_WHITE_ICON from '@/assets/icons/github-white.png'
import PEANUT_LOGO from '@/assets/logos/peanut-logo.svg'
import TELEGRAM_ICON from '@/assets/icons/telegram-white.svg'
import X_ICON from '@/assets/icons/x-logo.svg'
import Image from 'next/image'
import Link from 'next/link'
import { SEOFooter } from './SEOFooter'
import { LocaleSwitcher } from '@/components/Marketing/LocaleSwitcher'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

const NAV_LINK = 'text-xl font-bold text-white'

const SOCIALS = [
    { href: 'https://t.me/clubpeanut', label: 'Join us on Telegram', icon: TELEGRAM_ICON, alt: 'Telegram' },
    { href: 'https://x.com/joinpeanut', label: 'Follow us on X', icon: X_ICON, alt: 'X' },
    { href: 'https://github.com/peanutprotocol', label: 'View our GitHub', icon: GITHUB_WHITE_ICON, alt: 'GitHub' },
]

const SocialLinks = () => (
    <div className="flex items-center gap-4">
        {SOCIALS.map((social) => (
            <a key={social.href} href={social.href} target="_blank" rel="noopener noreferrer" aria-label={social.label}>
                <Image src={social.icon} alt={social.alt} width={20} height={20} />
            </a>
        ))}
    </div>
)

const Footer = ({
    showSiteDirectory = true,
    locale = DEFAULT_LOCALE,
}: {
    showSiteDirectory?: boolean
    locale?: Locale
}) => {
    const i18n = getTranslations(locale)

    return (
        <>
            {/* Nav on its own row rather than the brand row: the nav labels
                change width per locale, so a single row overflowed once the
                copy was translated. */}
            <footer className="bg-black px-8 py-8 md:px-20">
                <div className="flex flex-wrap items-center justify-between gap-6">
                    <section className="flex flex-col gap-1">
                        {/* /lp, not /: the proxy bounces authenticated users from / into the
                            app at /home, and the logo must keep them on the marketing site
                            (see src/app/lp/page.tsx). Localized landings aren't in the
                            proxy matcher, so /{locale} is already auth-proof. */}
                        <Link href={locale === DEFAULT_LOCALE ? '/lp' : `/${locale}`} className="flex">
                            <Image src={PEANUT_LOGO} alt="Peanut Logo" width={110} height={40} />
                        </Link>
                        <p className="text-xs text-white">
                            {i18n.footerMadeWithLove}{' '}
                            <a className="underline" href="https://squirrellabs.dev/" target="_blank" rel="noreferrer">
                                Squirrel Labs
                            </a>
                        </p>
                        <p className="text-xs text-white/70">{i18n.footerLegalEntity}</p>
                    </section>

                    <div className="hidden md:block">
                        <SocialLinks />
                    </div>
                </div>

                {/* Mobile only: socials and the language switcher share one row.
                    On md+ the socials live in the brand row and the switcher in
                    the nav row. */}
                <div className="mt-6 flex items-center justify-between md:hidden">
                    <SocialLinks />
                    <LocaleSwitcher locale={locale} label={i18n.footerLanguage} />
                </div>

                <nav className="mt-8 flex flex-wrap items-center justify-between gap-6">
                    <div className="flex flex-wrap items-center gap-6">
                        <Link className={NAV_LINK} href="/support">
                            {i18n.footerSupport}
                        </Link>
                        <Link className={NAV_LINK} href={`/${locale}/content`}>
                            {i18n.content}
                        </Link>
                        <Link className={NAV_LINK} href={`/${locale}/help`}>
                            {i18n.footerDocs}
                        </Link>
                        <Link className={NAV_LINK} href={`/${locale}/terms`}>
                            {i18n.footerTerms}
                        </Link>
                        <Link className={NAV_LINK} href={`/${locale}/privacy`}>
                            {i18n.footerPrivacy}
                        </Link>
                        <Link className={NAV_LINK} href={`/${locale}/help/security-disclosure`}>
                            {i18n.footerSecurity}
                        </Link>
                        <a
                            className={NAV_LINK}
                            href="https://peanutprotocol.notion.site/Career-b351de56d92e405e962f0027b3a60f52"
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            {i18n.footerJobs}
                        </a>
                    </div>
                    <div className="hidden md:block">
                        <LocaleSwitcher locale={locale} label={i18n.footerLanguage} />
                    </div>
                </nav>
            </footer>
            {showSiteDirectory && <SEOFooter locale={locale} />}
        </>
    )
}

export default Footer
