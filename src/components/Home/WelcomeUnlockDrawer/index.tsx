'use client'
import React, { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { type IconName } from '@/components/Global/Icons/Icon'
import Card from '@/components/Global/Card'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { countryData, type CountryData } from '@/components/AddMoney/consts'
import { isMantecaSupportedCountryCode } from '@/constants/manteca.consts'
import { useCapabilities } from '@/hooks/useCapabilities'
import type { RailCapability, RailOperation } from '@/types/capabilities'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

/** A rail unlocked by identity verification, as a region → rail DataRow. */
type UnlockItem = {
    id: string
    label: string
    value: string
    /** `bank` = shown when a bank rail grants first-party transfers (US/EU/MX
     * users). `qr` = shown when QR-pay is enabled (LATAM users). Listed in both
     * → shows once. */
    channels: Array<'bank' | 'qr'>
}

/**
 * First-party bank movement, as opposed to paying a merchant. A rail whose
 * top-level status is `enabled` can still have these at `requires-info`:
 * Manteca's pool tier pays QR through `pix_br`, which is channel `bank`, without
 * the per-user account that transfers need. The capability contract says to read
 * the operation and fall back to the rail — `operations?.[op] ?? status`.
 */
const TRANSFER_OPS: RailOperation[] = ['deposit', 'withdraw']

const grantsTransfers = (rail: RailCapability): boolean =>
    TRANSFER_OPS.some((op) => (rail.operations?.[op] ?? rail.status) === 'enabled')

const WelcomeUnlockDrawer = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
    const t = useTranslations('home.welcomeUnlock')

    // Provider-blind: the celebration modal splits its rows by what CHANNEL the
    // user just unlocked, not which provider's rail enabled. Bank-channel = the
    // "transfers" rows; qr-only OR a Manteca rail's `pay` op = the "QR" rows.
    // (Manteca's pool tier shows up via canDo('pay') without naming the provider.)
    const { canDo, bankRails } = useCapabilities()
    const transferRails = useMemo(() => bankRails().filter(grantsTransfers), [bankRails])
    const hasBankUnlock = transferRails.length > 0
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
     * The verified-ID country personalises the own-country transfer row. It
     * resolves only for AR/BR, the two countries with a per-country transfer
     * rail to name — so the row is dropped, not defaulted, everywhere else.
     * Example: user picks Argentina but has Brazil ID → they get QR in
     * Argentina but bank transfers only work in Brazil (their verified country).
     * NOTE: if several qualify, the last wins (matches the old forEach).
     */
    const approvedCountryData: CountryData | null = useMemo(() => {
        const country = transferRails.filter((rail) => isMantecaSupportedCountryCode(rail.country)).at(-1)?.country
        if (!country) return null
        return countryData.find((entry) => entry.iso2?.toUpperCase() === country.toUpperCase()) ?? null
    }, [transferRails])

    const items = useMemo(
        (): UnlockItem[] => [
            { id: 'qr', label: t('items.qr.label'), value: t('items.qr.value'), channels: ['bank', 'qr'] },
            { id: 'us', label: t('items.us.label'), value: t('items.us.value'), channels: ['bank'] },
            { id: 'europe', label: t('items.europe.label'), value: t('items.europe.value'), channels: ['bank'] },
            { id: 'mexico', label: t('items.mexico.label'), value: t('items.mexico.value'), channels: ['bank'] },
            // Only when a country actually resolved. Rendering it unconditionally
            // for the bank cohort labelled it "your country" for every Bridge user
            // — promising own-account transfers in a country with no rail at all.
            ...(approvedCountryData
                ? [
                      {
                          id: 'ownCountry',
                          label: approvedCountryData.title,
                          value: t('items.ownCountry.value'),
                          channels: ['bank'] as UnlockItem['channels'],
                      },
                  ]
                : []),
        ],
        [t, approvedCountryData]
    )

    return (
        <Drawer
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon={'globe-lock' as IconName} className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        <div className="flex w-full flex-col items-start gap-2 text-left">
                            <p className="text-body-s text-foreground-secondary">{t('youCanNow')}</p>
                            <Card
                                position="single"
                                className="w-full divide-y divide-dashed divide-border-default px-4 py-0"
                            >
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
                        <Button
                            variant="purple"
                            shadowSize="4"
                            className="w-full justify-center"
                            onClick={() => {
                                posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                                    modal_type: MODAL_TYPES.KYC_COMPLETED,
                                    cta: 'start_sending',
                                })
                                onClose()
                            }}
                        >
                            {t('cta')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default WelcomeUnlockDrawer
