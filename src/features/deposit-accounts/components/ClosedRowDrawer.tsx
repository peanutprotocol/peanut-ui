'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'
import { DRAWER_CLOSE_MS } from '../drawer'
import type { ClosedRow } from '../hubRows'
import { DEPOSIT_RAILS } from '../rails'
import { useDepositAccountCopy } from '../useDepositAccountCopy'

/** the residence-gated corridors' own copy, keyed by corridor */
const RESIDENCE_COPY = {
    PIX_BR: 'corridors.PIX_BR',
    BANK_TRANSFER_AR: 'corridors.BANK_TRANSFER_AR',
} as const

/**
 * Why a row cannot be used, and the one thing that changes it where one exists.
 *
 * No row on the money screens is a dead end (Hugo, 2026-09-24): a rail the user
 * cannot use stays in the list, sorts last, and a tap opens this drawer with the
 * specific reason. Support is offered only where a person can change the answer.
 * It mirrors `CorridorGateDrawer`, which explains the rows that can be unblocked.
 */
export function ClosedRowDrawer({
    closed,
    onClose,
    onChangeResidence,
}: {
    /** the tapped row and why it is closed; null keeps the drawer shut */
    closed: ClosedRow | null
    onClose: () => void
    /** opens the residence change, on this screen or on Accounts and payments */
    onChangeResidence: () => void
}) {
    const { t } = useDepositAccountCopy()
    const tCommon = useTranslations('common')
    const tAccounts = useTranslations('profile.unlockPayments')
    const { openSupportWithMessage } = useModalsContext()

    const content = closed ? drawerContent(closed) : null

    function drawerContent(row: ClosedRow): { title: string; body: string; cta: { label: string; act?: () => void } } {
        switch (row.kind) {
            case 'residence': {
                const base = RESIDENCE_COPY[row.corridor]
                return {
                    title: t(`${base}.residenceTitle`),
                    // paying a QR code or a Pix key needs no residence, so that way stays open
                    body: `${t(`${base}.residenceRequired`)} ${t(`${base}.qrPay`)}`,
                    cta: { label: t('details.residenceCta'), act: onChangeResidence },
                }
            }
            case 'not-offered':
                return {
                    title: t('list.badgeNotOffered'),
                    body: t('list.notOfferedBody', { currency: DEPOSIT_RAILS[row.corridor].currency }),
                    cta: {
                        label: tCommon('contactSupport'),
                        // English on purpose: it is for the support agent, not the user
                        act: () => openSupportWithMessage(`Account not offered: ${row.corridor}`),
                    },
                }
            case 'restricted-country':
                return {
                    title: t('list.badgeNotOffered'),
                    body: tAccounts('bankNotAvailableNote'),
                    cta: { label: tCommon('gotIt') },
                }
            case 'card-restricted':
                return {
                    title: t('list.badgeNotOffered'),
                    body: tAccounts('cardNotAvailableNote'),
                    cta: { label: tCommon('gotIt') },
                }
            // the limit copy the claim step shows, so the two cannot drift
            case 'account-limit':
                return {
                    title: t('gate.limitTitle', { count: row.limit }),
                    body: t('gate.limitBody'),
                    cta: {
                        label: tCommon('contactSupport'),
                        // English on purpose: it is for the support agent, not the user
                        act: () => openSupportWithMessage(`Account limit reached (${row.limit})`),
                    },
                }
            case 'not-offered-residence':
                return {
                    title: t('gate.blockedTitle', { currency: DEPOSIT_RAILS[row.corridor].currency }),
                    body: t('errors.residenceRestricted'),
                    cta: { label: t('details.residenceCta'), act: onChangeResidence },
                }
            case 'residence-missing':
                return {
                    title: tAccounts('residence.unknown'),
                    body: t('list.residenceMissingBody', { currency: DEPOSIT_RAILS[row.corridor].currency }),
                    cta: { label: t('details.residenceCta'), act: onChangeResidence },
                }
            case 'verification-down':
                return {
                    title: tAccounts('degraded.title'),
                    body: tAccounts('degraded.body'),
                    cta: { label: tCommon('gotIt') },
                }
        }
    }

    return (
        <Drawer open={!!closed} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DrawerContent className="pb-4" data-testid="closed-row-drawer">
                {content && (
                    <div className="flex flex-col items-center text-center">
                        <IconBubble icon="globe-lock" color="gray" className="mb-4" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{content.title}</DrawerTitle>
                            <DrawerDescription>{content.body}</DrawerDescription>
                        </DrawerHeader>
                        <Button
                            variant="primary"
                            className="mt-6 w-full"
                            onClick={() => {
                                onClose()
                                // the next sheet opens once this one has slid out
                                if (content.cta.act) setTimeout(content.cta.act, DRAWER_CLOSE_MS)
                            }}
                        >
                            {content.cta.label}
                        </Button>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}
