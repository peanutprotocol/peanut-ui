'use client'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

/** A rail unlocked by identity verification, as a region → rail DataRow. */
type UnlockItem = {
    id: string
    label: string
    value: string
    /** `bank` = shown when bank rails are enabled (US/EU/MX users). `qr` = shown
     * when QR-pay is enabled (LATAM users). A rail listed in both shows once. */
    channels: Array<'bank' | 'qr'>
}

const WelcomeUnlockModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const t = useTranslations('home.welcomeUnlock')
    const [approvedCountryData, setApprovedCountryData] = useState<CountryData | null>(null)

    // Provider-blind: the celebration modal splits its rows by what CHANNEL the
    // user just unlocked, not which provider's rail enabled. Bank-channel = the
    // "transfers" rows; qr-only OR a Manteca rail's `pay` op = the "QR" rows.
    // (Manteca's pool tier shows up via canDo('pay') without naming the provider.)
    const { canDo, rails, bankRails, channelOf } = useCapabilities()
    const hasBankUnlock = bankRails().some((rail) => rail.status === 'enabled')
    const hasQrUnlock = canDo('pay')

    const hasTrackedShow = useRef(false)
    useEffect(() => {
        if (isOpen && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.KYC_COMPLETED })
        }
    }, [isOpen])

    // Pick which rails to show based on the channels the user unlocked.
    // 'all' = bank + qr; 'bank' = bank only (US/EU/MX user); 'qr' = qr-only
    // (LATAM pool-tier user). Drives the rows shown by `items` below.
    const unlockedChannels: 'all' | 'bank' | 'qr' | 'none' = useMemo(() => {
        if (hasBankUnlock && hasQrUnlock) return 'all'
        if (hasQrUnlock) return 'qr'
        if (hasBankUnlock) return 'bank'
        return 'none'
    }, [hasBankUnlock, hasQrUnlock])

    /**
     * Unlocked rails, as region → rail rows. The verified-ID country personalizes
     * the LATAM bank-transfer row — the user's verified ID country, not their selected
     * country. Example: user picks Argentina but has Brazil ID → they get QR in
     * Argentina but bank transfers only work in Brazil (their verified country).
     */
    const items = useMemo(
        (): UnlockItem[] => [
            { id: 'qr', label: t('items.qr.label'), value: t('items.qr.value'), channels: ['bank', 'qr'] },
            { id: 'us', label: t('items.us.label'), value: t('items.us.value'), channels: ['bank'] },
            { id: 'europe', label: t('items.europe.label'), value: t('items.europe.value'), channels: ['bank'] },
            { id: 'mexico', label: t('items.mexico.label'), value: t('items.mexico.value'), channels: ['bank'] },
            {
                id: 'ownCountry',
                label: approvedCountryData?.title || t('yourCountry'),
                value: t('items.ownCountry.value'),
                channels: ['qr'],
            },
        ],
        [t, approvedCountryData?.title]
    )

    // Personalize the "Bank transfers to your own accounts" row's country label
    // off the user's first enabled qr-only-or-pay-capable LATAM rail. Provider-
    // blind via the channel classifier — the qr-only channel today is exactly
    // the set that drives this row ("approved in country X for QR + bank
    // transfers"). NOTE: if multiple enabled qr-pay rails exist, this picks the
    // last (matches the old forEach behavior).
    const qrCapableRails = useMemo(
        () => rails.filter((rail) => rail.status === 'enabled' && channelOf(rail) === 'qr-only'),
        [rails, channelOf]
    )
    useEffect(() => {
        if (!hasQrUnlock) return
        let approvedCountry: string | undefined | null
        qrCapableRails.forEach((rail) => {
            if (isMantecaSupportedCountryCode(rail.country)) {
                approvedCountry = rail.country
            }
        })
        if (approvedCountry) {
            const _approvedCountryData = countryData.find(
                (c) => c.iso2?.toUpperCase() === approvedCountry?.toUpperCase()
            )
            setApprovedCountryData(_approvedCountryData || null)
        }
    }, [hasQrUnlock, qrCapableRails])

    return (
        <ActionModal
            visible={isOpen}
            onClose={onClose}
            icon={'globe-lock' as IconName}
            iconContainerClassName="bg-action-primary text-black"
            title={t('title')}
            ctas={[
                {
                    text: t('cta'),
                    onClick: () => {
                        posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                            modal_type: MODAL_TYPES.KYC_COMPLETED,
                            cta: 'start_sending',
                        })
                        onClose()
                    },
                    variant: 'purple',
                    className: 'w-full',
                    shadowSize: '4',
                },
            ]}
            content={
                <div className="flex w-full flex-col items-start gap-2 text-left">
                    <p className="text-body-s text-foreground-secondary">{t('youCanNow')}</p>
                    <Card position="single" className="divide-y divide-dashed divide-border-default px-4 py-0">
                        {items
                            .filter(
                                (item) =>
                                    unlockedChannels === 'all' ||
                                    item.channels.includes(unlockedChannels as 'bank' | 'qr')
                            )
                            .map((item) => (
                                <DataRow key={item.id} label={item.label} value={item.value} />
                            ))}
                    </Card>
                </div>
            }
        />
    )
}

export default WelcomeUnlockModal
