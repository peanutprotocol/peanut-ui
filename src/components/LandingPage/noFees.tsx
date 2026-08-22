'use client'

import noHiddenFees from '@/assets/illustrations/no-hidden-fees.svg'
import Star from '@/assets/illustrations/star.svg'
import Image from 'next/image'
import ExchangeRateWidget from '../Global/ExchangeRateWidget'
import { useRouter } from 'next/navigation'
import { printableUsdc } from '@/utils/balance.utils'
import { getExchangeRateWidgetRedirectRoute } from '@/utils/exchangeRateWidget.utils'
import { AccountType } from '@/interfaces/interfaces'
import type { Address } from 'viem'
import { useAuth } from '@/context/authContext'
import { twMerge } from 'tailwind-merge'
import { ContextualLinks } from './ContextualLinks'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import { CloudsCss } from './CloudsCss'
import type { LandingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'

export function NoFees({
    className,
    locale,
    strings,
}: {
    className?: string
    locale: Locale
    strings: LandingStrings
}) {
    const router = useRouter()
    const { user } = useAuth()
    const walletAddress = user?.accounts.find((account) => account.type === AccountType.PEANUT_WALLET)?.identifier

    /*
     * The balance is only consulted for a signed-in user, and only to decide
     * add-money vs withdraw. Reading it at click time keeps `useBalance` — and
     * through it viem's chain registry — out of the landing page's bundle.
     */
    const handleCtaAction = async (sourceCurrency: string, destinationCurrency: string) => {
        if (!user) {
            router.push('/setup')
            return
        }

        let formattedBalance = 0
        if (walletAddress) {
            try {
                const { smartUsdcBalanceQueryOptions } = await import('@/hooks/wallet/useBalance')
                const balance = await smartUsdcBalanceQueryOptions(walletAddress as Address).queryFn()
                formattedBalance = parseFloat(printableUsdc(balance))
            } catch {
                // Treat an unreadable balance as zero — routes to add-money,
                // which is the safe destination either way.
            }
        }

        router.push(getExchangeRateWidgetRedirectRoute(sourceCurrency, destinationCurrency, formattedBalance))
    }

    return (
        <section
            id="no-fees"
            className={twMerge('relative overflow-hidden bg-secondary-3 px-4 py-24 md:py-14', className)}
        >
            {/* CSS keyframes rather than framer-motion: these loop forever, and a
                perpetual rAF loop on the main thread was the landing page's single
                largest blocking cost. transform animations run on the compositor. */}
            <CloudsCss
                clouds={[
                    { top: '20%', width: 200, speed: '37s', direction: 'ltr' },
                    { top: '60%', width: 220, speed: '33s', direction: 'rtl' },
                ]}
            />

            <div className="relative mx-auto w-full max-w-3xl text-center">
                {/* Animated stars */}
                <AnimateOnView className="absolute -right-36 -top-12" y="20px" x="5px" rotate="22deg" delay="0.2s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -right-58 top-30" y="28px" x="-5px" rotate="-17deg" delay="0.4s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView
                    className="absolute -right-0 -top-16 md:top-58"
                    y="20px"
                    x="5px"
                    rotate="22deg"
                    delay="0.6s"
                >
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -left-36 -top-20" y="15px" x="-5px" rotate="-7deg" delay="0.8s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -bottom-6 -left-10" y="25px" x="-5px" rotate="-5deg" delay="1.0s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>

                <h1 className="font-roboto-flex-extrabold text-heading text-black md:text-headingMedium">
                    {strings.zeroFees}
                </h1>

                {/* No hidden fees SVG */}
                <div className="mb-1">
                    <Image
                        src={noHiddenFees}
                        alt="Really, we mean zero. No hidden fees"
                        width={600}
                        height={150}
                        className="mx-auto h-auto w-full max-w-xs md:max-w-md"
                    />
                </div>

                <ExchangeRateWidget
                    ctaIcon="arrow-up-right"
                    ctaLabel={strings.sendMoney}
                    ctaAction={handleCtaAction}
                    labels={strings.exchange}
                />

                <ContextualLinks
                    className="mt-6"
                    label={strings.seeMarkupOn}
                    links={[
                        // the route is `peanut-vs-<slug>` — generateStaticParams builds
                        // no bare-slug page, so the short form 404s
                        { label: 'Wise', href: `/${locale}/compare/peanut-vs-wise` },
                        { label: 'PayPal', href: `/${locale}/compare/peanut-vs-paypal` },
                        { label: 'Western Union', href: `/${locale}/compare/peanut-vs-western-union` },
                    ]}
                />
            </div>
        </section>
    )
}
