'use client'

import NavHeader from '@/components/Global/NavHeader'
import Card from '@/components/Global/Card'
import { useLimits } from '@/hooks/useLimits'
import { useSafeBack } from '@/hooks/useSafeBack'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useCapabilities } from '@/hooks/useCapabilities'
import { findPixRoute } from '@/features/pix/pixRoute.utils'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Tabs } from '@/components/0_Bruddle/Tabs'
import ProgressBar from '@/components/0_Bruddle/ProgressBar'
import Image from 'next/image'
import Loading from '@/components/Global/Loading'
import {
    getLimitData,
    getLimitColorClass,
    formatAmountWithCurrency,
    getFlagUrlForCurrency,
    aveniaServesBrl,
    type LimitsPeriod,
} from '../utils'
import MonthlyRoomCard from '../components/MonthlyRoomCard'
import { AttentionSlot } from '@/features/attention/AttentionSlot'
import IncreaseLimitsButton from '../components/IncreaseLimitsButton'
import { CapNudgeCtaContext } from '../cap-nudge-cta-context'
import LimitsError from '../components/LimitsError'
import LimitsDocsLink from '../components/LimitsDocsLink'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'

/**
 * displays the limits of latam users
 * shows manteca's monthly/yearly limits per currency with remaining amounts; BRL shows the limits of
 * the provider the user's Pix routes name, so Avenia's monthly room replaces Manteca's BRL card
 */
const MantecaLimitsView = () => {
    const t = useTranslations('limits.provider')
    const tPeriod = useTranslations('limits.period')
    const onBack = useSafeBack('/limits')
    const { mantecaLimits: allMantecaLimits, aveniaLimits, isLoading, error, refetch, isRefetching } = useLimits()
    const { capabilities } = useCapabilities()
    const brlOnAvenia = aveniaServesBrl(capabilities.routes)
    const mantecaLimits = brlOnAvenia ? allMantecaLimits?.filter((limit) => limit.asset !== 'BRL') : allMantecaLimits
    const aveniaRoom = brlOnAvenia ? aveniaLimits : null
    const aveniaDeposits = findPixRoute(capabilities.routes, 'deposit')?.provider === 'avenia'
    const hasLimits = (mantecaLimits?.length ?? 0) > 0 || !!aveniaRoom
    const [period, setPeriod] = useState<LimitsPeriod>('monthly')
    const [capNudgeCtaShown, setCapNudgeCtaShown] = useState(false)

    return (
        <PageStack gap="6">
            <NavHeader title={t('title')} onPrev={onBack} />

            {isLoading && <Loading variant="mascot" coverFullScreen />}

            {error && <LimitsError onRetry={() => refetch()} isRetrying={isRefetching} />}

            {!isLoading && !error && hasLimits && (
                <>
                    {/* limit cards per currency */}
                    <div className="space-y-4">
                        {aveniaRoom && (
                            <MonthlyRoomCard
                                currency={aveniaRoom.currency}
                                deposit={aveniaDeposits ? aveniaRoom.deposit : undefined}
                                payout={aveniaRoom.payout}
                            />
                        )}
                        {(mantecaLimits ?? []).map((limit) => {
                            const limitData = getLimitData(limit, period)
                            // use centralized flag url utility
                            const flagUrl = getFlagUrlForCurrency(limit.asset)

                            // calculate remaining percentage for text color
                            const remainingPercent =
                                limitData.limit > 0 ? (limitData.remaining / limitData.limit) * 100 : 0

                            return (
                                <Card key={limit.asset} position="solo" className="space-y-3">
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
                                            <span className="text-body-xs text-foreground-secondary">
                                                {t('totalAllowed', { asset: limit.asset })}
                                            </span>
                                        </div>
                                        <Tabs
                                            size="sm"
                                            tabs={[
                                                { value: 'monthly', label: tPeriod('monthly') },
                                                { value: 'yearly', label: tPeriod('yearly') },
                                            ]}
                                            value={period}
                                            onValueChange={(v) => setPeriod(v as LimitsPeriod)}
                                            aria-label={tPeriod('selectAriaLabel')}
                                        />
                                    </div>

                                    <div className="text-heading-s text-foreground-primary">
                                        {formatAmountWithCurrency(limitData.limit, limit.asset)}
                                    </div>

                                    <ProgressBar
                                        value={remainingPercent}
                                        fillClassName={getLimitColorClass(remainingPercent, 'bg')}
                                    />

                                    <div className="flex items-center justify-between text-body-s">
                                        <span className="text-foreground-secondary">{t('remaining', { period })}</span>
                                        <span className={`font-medium ${getLimitColorClass(remainingPercent, 'text')}`}>
                                            {formatAmountWithCurrency(limitData.remaining, limit.asset)}
                                        </span>
                                    </div>
                                </Card>
                            )
                        })}
                        {/* info text */}
                        <div className="flex items-center justify-center gap-2 text-body-xs text-foreground-secondary">
                            <p>{t('appliesTo')}</p>
                        </div>
                    </div>

                    <CapNudgeCtaContext.Provider value={setCapNudgeCtaShown}>
                        <AttentionSlot id="limits" />
                    </CapNudgeCtaContext.Provider>

                    <IncreaseLimitsButton variant={capNudgeCtaShown ? 'secondary' : 'primary'} />

                    <LimitsDocsLink />
                </>
            )}

            {!isLoading && !error && !hasLimits && <EmptyState title={t('noData')} icon="meter" />}
        </PageStack>
    )
}

export default MantecaLimitsView
