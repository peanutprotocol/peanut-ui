'use client'

import { Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import ExchangeRateWidget, { type ExchangeRateWidgetLabels } from '@/components/Global/ExchangeRateWidget'
import Star from '@/assets/illustrations/star.svg'
import Image from 'next/image'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { Card } from '@/components/0_Bruddle/Card'

const widgetClouds = [
    { top: '10%', width: 140, speed: '38s', direction: 'ltr' as const },
    { top: '75%', width: 120, speed: '44s', direction: 'rtl' as const, delay: '5s' },
]

interface ExchangeWidgetProps {
    /** ISO 4217 destination currency code, e.g. "ARS", "BRL" */
    destinationCurrency?: string
    /** ISO 4217 source currency code. Defaults to "USD". */
    sourceCurrency?: string
    /** Bound to the page's locale by createMdxComponents; English defaults otherwise. */
    labels?: Partial<ExchangeRateWidgetLabels>
}

function ExchangeWidgetInner({ destinationCurrency, sourceCurrency = 'USD', labels }: ExchangeWidgetProps) {
    const router = useRouter()
    const [{ from, to }, setQuery] = useQueryStates(
        { from: parseAsString, to: parseAsString },
        { shallow: true, history: 'replace', scroll: false }
    )

    // Seed the URL with the page's default destination currency on first mount.
    useEffect(() => {
        if (destinationCurrency && !to) {
            setQuery({ to: destinationCurrency, from: from ?? sourceCurrency })
        }
    }, [destinationCurrency, sourceCurrency, to, from, setQuery])

    // bg-blue-300 is the marketing sky fill (landing page, AppShell banner and
    // migration hero all use it). No semantic token names it — flagged, not
    // swapped: the only token carrying that hex is avatar-blue-border.
    return (
        <section className="relative my-8 w-full bg-blue-300 pt-10 pb-14 md:pt-14 md:pb-16">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <CloudsCss clouds={widgetClouds} />
                <Image
                    src={Star}
                    alt=""
                    width={36}
                    height={36}
                    className="absolute top-6 left-[8%] md:top-8 md:left-[12%]"
                />
                <Image
                    src={Star}
                    alt=""
                    width={28}
                    height={28}
                    className="absolute right-[10%] bottom-8 md:right-[14%] md:bottom-10"
                />
            </div>
            <div className="relative z-10 mx-auto max-w-[640px] px-6 md:px-4">
                <ExchangeRateWidget
                    ctaLabel="Send Money"
                    ctaIcon="arrow-up-right"
                    ctaAction={(from, to) => {
                        router.push(`/send?from=${from}&to=${to}`)
                    }}
                    labels={labels}
                />
            </div>
        </section>
    )
}

// label + bordered amount row — the shape ExchangeRateWidget renders twice
const amountFieldSkeleton = (
    <div className="w-full">
        <div className="h-5 w-24 animate-pulse rounded bg-foreground-primary/10" />
        <div className="mt-2 flex w-full items-center gap-4 rounded-sm border border-border-default p-4">
            <div className="h-5 w-40 animate-pulse rounded-full bg-foreground-primary/10" />
            <div className="ml-auto h-5 w-20 animate-pulse rounded-full bg-foreground-primary/10" />
        </div>
    </div>
)

/**
 * Embeddable exchange rate calculator for MDX content pages.
 *
 * Usage in MDX:
 *   <ExchangeWidget destinationCurrency="ARS" />
 *   <ExchangeWidget destinationCurrency="BRL" sourceCurrency="EUR" />
 */
export function ExchangeWidget({ destinationCurrency, sourceCurrency, labels }: ExchangeWidgetProps) {
    return (
        <Suspense
            fallback={
                <section className="relative my-8 w-full overflow-hidden bg-blue-300 pt-10 pb-14 md:pt-14 md:pb-16">
                    <div className="relative z-10 mx-auto max-w-[640px] px-6 md:px-4">
                        {/* same Card, same slots, same sizes as the loaded
                            widget, so the swap does not jump */}
                        <Card
                            shadowSize="4"
                            className="mx-auto mt-12 h-fit w-full items-center justify-center gap-4 p-6 md:w-[420px]"
                        >
                            {amountFieldSkeleton}
                            <div className="size-8 animate-pulse rounded-full bg-foreground-primary/10" />
                            {amountFieldSkeleton}
                            <div className="h-5 w-32 animate-pulse rounded-full bg-foreground-primary/10" />
                            <div className="min-h-17 w-full rounded-sm border border-border-default" />
                            <div className="h-11 w-full animate-pulse rounded-full bg-foreground-primary/10" />
                            <div className="min-h-4 w-full" />
                        </Card>
                    </div>
                </section>
            }
        >
            <ExchangeWidgetInner
                destinationCurrency={destinationCurrency}
                sourceCurrency={sourceCurrency}
                labels={labels}
            />
        </Suspense>
    )
}
