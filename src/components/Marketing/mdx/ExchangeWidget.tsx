'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'

interface ExchangeWidgetProps {
    destinationCurrency?: string
}

function ExchangeWidgetInner({ destinationCurrency }: ExchangeWidgetProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Set initial destination currency in URL if not already set
    useEffect(() => {
        if (destinationCurrency && !searchParams.get('to')) {
            const params = new URLSearchParams(searchParams.toString())
            params.set('to', destinationCurrency)
            if (!params.get('from')) params.set('from', 'USD')
            router.replace(`?${params.toString()}`, { scroll: false })
        }
    }, [destinationCurrency, searchParams, router])

    return (
        <section className="px-4 py-10 md:py-14">
            <div className="mx-auto max-w-3xl">
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

/** Embeddable exchange rate calculator for MDX content pages. */
export function ExchangeWidget({ destinationCurrency }: ExchangeWidgetProps) {
    return (
        <Suspense
            fallback={
                <section className="px-4 py-10 md:py-14">
                    <div className="mx-auto flex max-w-3xl justify-center">
                        <div className="btn btn-shadow-primary-4 h-[300px] w-full animate-pulse bg-white md:w-[420px]" />
                    </div>
                </section>
            }
        >
            <ExchangeWidgetInner destinationCurrency={destinationCurrency} />
        </Suspense>
    )
}
