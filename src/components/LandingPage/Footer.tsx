import GITHUB_WHITE_ICON from '@/assets/icons/github-white.png'
import PEANUT_LOGO from '@/assets/logos/peanut-logo.svg'
import TELEGRAM_ICON from '@/assets/icons/telegram-white.svg'
import X_ICON from '@/assets/icons/x-logo.svg'
import Image from 'next/image'
import Link from 'next/link'
import handThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import handWaving from '@/assets/illustrations/hand-waving.svg'
import handPeace from '@/assets/illustrations/hand-peace.svg'
import handMiddleFinger from '@/assets/illustrations/hand-middle-finger.svg'
import { SEOFooter } from './SEOFooter'
import { LocaleSwitcher } from '@/components/Marketing/LocaleSwitcher'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'

const NAV_LINK = 'text-xl font-bold text-white'

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
            {/* Two rows rather than one: the nav labels change width per locale,
                so a single row overflowed once the copy was translated. */}
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

                    <div className="flex items-center gap-6">
                        <LocaleSwitcher locale={locale} label={i18n.footerLanguage} />
                        <section className="flex gap-3">
                            <a
                                href="https://youtube.com/shorts/qd2FbzLS380?si=T5xk7xrTGYiIiWFu"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Watch Peanut teaser on YouTube (opens in a new tab)"
                            >
                                <Image src={handPeace} alt="" width={20} height={20} />
                            </a>
                            <Image src={handThumbsUp.src} alt="Hand thumbs up" width={20} height={20} />
                            <a
                                href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Never gonna give you up (opens in a new tab)"
                            >
                                <Image src={handMiddleFinger.src} alt="Hand Middle finger" width={20} height={20} />
                            </a>
                            <Image src={handWaving.src} alt="Hand waving" width={25} height={25} />
                        </section>
                    </div>
                </div>

                <nav className="mt-8 flex flex-wrap items-center justify-center gap-6">
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

                    {/* Reads as the next nav item, set off by double the nav gap. */}
                    <div className="flex w-full items-center justify-center gap-4 md:ml-12 md:w-auto">
                        <a
                            href="https://t.me/clubpeanut"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Join us on Telegram"
                        >
                            <Image src={TELEGRAM_ICON} alt="Telegram" width={20} height={20} />
                        </a>
                        <a
                            href="https://x.com/joinpeanut"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Follow us on X"
                        >
                            <Image src={X_ICON} alt="X" width={20} height={20} />
                        </a>
                        <a
                            href="https://github.com/peanutprotocol"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="View our GitHub"
                        >
                            <Image src={GITHUB_WHITE_ICON} alt="GitHub" width={20} height={20} />
                        </a>
                    </div>
                </nav>
            </footer>
            {showSiteDirectory && <SEOFooter locale={locale} />}
        </>
    )
}

export default Footer
