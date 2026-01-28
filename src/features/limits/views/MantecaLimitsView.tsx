'use client'

import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { useLimits } from '@/hooks/useLimits'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PeriodToggle from '../components/PeriodToggle'
import LimitsProgressBar from '../components/LimitsProgressBar'
import Image from 'next/image'
import PeanutLoading from '@/components/Global/PeanutLoading'
import {
    getLimitData,
    getLimitColorClass,
    formatAmountWithCurrency,
    getFlagUrlForCurrency,
    type LimitsPeriod,
} from '../utils'
import IncreaseLimitsButton from '../components/IncreaseLimitsButton'
import LimitsError from '../components/LimitsError'
import LimitsDocsLink from '../components/LimitsDocsLink'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'

/**
 * displays manteca limits for latam users
 * shows monthly/yearly limits per currency with remaining amounts
 */
const MantecaLimitsView = () => {
    const router = useRouter()
    const { mantecaLimits, isLoading, error } = useLimits()
    const [period, setPeriod] = useState<LimitsPeriod>('monthly')

    return (
        <div className="flex min-h-[inherit] flex-col space-y-6">
            <NavHeader title="Limits" onPrev={() => router.back()} titleClassName="text-xl md:text-2xl" />

            {isLoading && <PeanutLoading coverFullScreen />}

            {error && <LimitsError />}

            {!isLoading && !error && mantecaLimits && mantecaLimits.length > 0 && (
                <>
                    {/* limit cards per currency */}
                    <div className="space-y-4">
                        {mantecaLimits.map((limit) => {
                            const limitData = getLimitData(limit, period)
                            // use centralized flag url utility
                            const flagUrl = getFlagUrlForCurrency(limit.asset)

                            // calculate remaining percentage for text color
                            const remainingPercent =
                                limitData.limit > 0 ? (limitData.remaining / limitData.limit) * 100 : 0

                            return (
                                <Card key={limit.asset} position="single" className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {flagUrl && (
                                                <Image
                                                    src={flagUrl}
                                                    alt={limit.asset}
                                                    width={24}
                                                    height={24}
                                                    className="size-5 rounded-full object-cover"
                                                />
                                            )}
                                            <span className="text-xs text-grey-1">{limit.asset} total allowed</span>
                                        </div>
                                        <PeriodToggle value={period} onChange={setPeriod} />
                                    </div>

                                    <div className="text-2xl font-bold">
                                        {formatAmountWithCurrency(limitData.limit, limit.asset)}
                                    </div>

                                    <LimitsProgressBar total={limitData.limit} remaining={limitData.remaining} />

                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-grey-1">
                                            Remaining this {period === 'monthly' ? 'month' : 'year'}
                                        </span>
                                        <span className={`font-medium ${getLimitColorClass(remainingPercent, 'text')}`}>
                                            {formatAmountWithCurrency(limitData.remaining, limit.asset)}
                                        </span>
                                    </div>
                                </Card>
                            )
                        })}
                        {/* info text */}
                        <div className="flex items-center justify-center gap-2 text-xs text-grey-1">
                            <Icon name="info" size={16} />
                            <p>Applies to adding money, withdraws and QR payments</p>
                        </div>
                    </div>

                    <IncreaseLimitsButton />

                    <LimitsDocsLink />
                </>
            )}

            {!isLoading && !error && (!mantecaLimits || mantecaLimits.length === 0) && (
                <EmptyState title="Limits data not available" icon="meter" />
            )}
        </div>
    )
}

export default MantecaLimitsView
