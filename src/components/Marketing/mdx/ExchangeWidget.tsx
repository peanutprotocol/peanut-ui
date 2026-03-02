'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import { Star } from '@/assets'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'

const widgetClouds = [
    { top: '10%', width: 140, speed: '38s', direction: 'ltr' as const },
    { top: '75%', width: 120, speed: '44s', direction: 'rtl' as const, delay: '5s' },
]

interface ExchangeWidgetProps {
    /** ISO 4217 destination currency code, e.g. "ARS", "BRL" */
    destinationCurrency?: string
    /** ISO 4217 source currency code. Defaults to "USD". */
    sourceCurrency?: string
}

function ExchangeWidgetInner({ destinationCurrency, sourceCurrency = 'USD' }: ExchangeWidgetProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Set initial currencies in URL if not already set
    useEffect(() => {
        if (destinationCurrency && !searchParams.get('to')) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('to', destinationCurrency)
            if (!params.get('from')) params.set('from', sourceCurrency)
            router.replace(`?${params.toString()}`, { scroll: false })
        }
    }, [destinationCurrency, sourceCurrency, searchParams, router])

    return (
        <section className="relative my-8 w-full pb-14 pt-10 md:pb-18 md:pt-14" style={{ backgroundColor: '#90A8ED' }}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <CloudsCss clouds={widgetClouds} />
                <img
                    src={Star.src}
                    alt=""
                    width={36}
                    height={36}
                    className="absolute left-[8%] top-6 md:left-[12%] md:top-8"
                />
                <img
                    src={Star.src}
                    alt=""
                    width={28}
                    height={28}
                    className="absolute bottom-8 right-[10%] md:bottom-10 md:right-[14%]"
                />
            </div>
            <div className="relative z-10 mx-auto max-w-[640px] px-6 md:px-4">
                <ExchangeRateWidget
                    ctaLabel="Send Money"
                    ctaIcon="arrow-up-right"
                    ctaAction={(from, to) => {
                        router.push(`/send?from=${from}&to=${to}`)
                    }}
                />
            </div>
        </section>
    )
}

/**
 * Embeddable exchange rate calculator for MDX content pages.
 *
 * Usage in MDX:
 *   <ExchangeWidget destinationCurrency="ARS" />
 *   <ExchangeWidget destinationCurrency="BRL" sourceCurrency="EUR" />
 */
export function ExchangeWidget({ destinationCurrency, sourceCurrency }: ExchangeWidgetProps) {
    return (
        <Suspense
            fallback={
                <section
                    className="relative my-8 w-full overflow-hidden pb-14 pt-10 md:pb-18 md:pt-14"
                    style={{ backgroundColor: '#90A8ED' }}
                >
                    <div className="mx-auto flex max-w-[640px] justify-center px-6 md:px-4">
                        <div className="btn btn-shadow-primary-4 h-[300px] w-full animate-pulse bg-white md:w-[420px]" />
                    </div>
                </section>
            }
        >
            <ExchangeWidgetInner destinationCurrency={destinationCurrency} sourceCurrency={sourceCurrency} />
        </Suspense>
    )
}
