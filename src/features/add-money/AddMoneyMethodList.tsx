'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'
import type { AddMoneyPickerMethod } from './addMoneyMethods'
import { PIX_ADD_MONEY_PATH } from '@/features/pix/pix.routes'
import { ARS_ADD_MONEY_PATH, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

const ARS_RAIL = DEPOSIT_RAILS.BANK_TRANSFER_AR
/** the bank hub: its country list routes to the reusable account or the one-time transfer (`useDepositCountryRouting`) */
const BANK_HUB_PATH = '/add-money?method=bank'

/**
 * The Add picker's rows, in the order the methods resolve: ARS leads for a resident of Argentina, and Pix
 * where the route offers it on Avenia. The card's funding step shows the same rows, so a user who needs a
 * balance there gets the same ways in (TASK-25444).
 */
export function AddMoneyMethodList({
    returnTo,
    bankReturnTo = returnTo,
    onSelect,
}: {
    /** where the deposit a row opens goes back to */
    returnTo: string
    /** the bank hub's own origin; the picker passes its origin, because the hub shares the picker's path */
    bankReturnTo?: string | null
    onSelect?: (method: AddMoneyPickerMethod) => void
}) {
    const t = useTranslations('addMoney.methods')
    const router = useRouter()
    const { pickerMethods } = useAddMoneyReadiness(false)
    const rowFor: Record<AddMoneyPickerMethod, { title: string; description: string; icon: ReactNode; href: string }> =
        {
            ars: {
                title: ARS_RAIL.currency,
                description: t('arsDetails'),
                icon: <CorridorFlag iso2={ARS_RAIL.flagIso2} />,
                href: withReturnTo(rewriteMethodPath(ARS_ADD_MONEY_PATH), returnTo),
            },
            bank: {
                title: t('bankTransfer'),
                description: t('bankDetails'),
                icon: <IconBubble {...CONCEPT_ICONS.bank} size="s" />,
                href: bankReturnTo ? withReturnTo(BANK_HUB_PATH, bankReturnTo) : BANK_HUB_PATH,
            },
            // Pix and ARS have one currency each, so they open the deposit, not a chooser of one row
            pix: {
                title: t('pix'),
                description: t('pixDetails'),
                icon: <IconBubble {...CONCEPT_ICONS.pix} size="s" />,
                href: withReturnTo(PIX_ADD_MONEY_PATH, returnTo),
            },
            crypto: {
                title: t('crypto'),
                description: t('cryptoDetails'),
                icon: <IconBubble {...CONCEPT_ICONS.crypto} size="s" />,
                href: withReturnTo('/add-money/crypto', returnTo),
            },
        }
    return (
        <ListGroup>
            {pickerMethods.map((key) => {
                const row = rowFor[key]
                return (
                    <ListItem
                        key={key}
                        title={row.title}
                        body={row.description}
                        bodyWrap
                        leading={row.icon}
                        chevron
                        data-testid={`add-money-method-${key}`}
                        onClick={() => {
                            onSelect?.(key)
                            router.push(row.href)
                        }}
                    />
                )
            })}
        </ListGroup>
    )
}
