'use client'

import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'
import { PIX_ADD_MONEY_PATH } from '@/features/pix/pix.routes'
import { ARS_ADD_MONEY_PATH, DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import { CorridorFlag } from '@/features/deposit-accounts/components/CorridorFlag'
import { rewriteMethodPath } from '@/utils/native-routes'
import { withReturnTo } from '@/utils/return-to.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { trackAddMoney } from './analytics'
import { useEffect, useRef, type ReactNode } from 'react'

const ARS_RAIL = DEPOSIT_RAILS.BANK_TRANSFER_AR
/** the bank hub: its country list routes to the reusable account or the one-time transfer (`useDepositCountryRouting`) */
const BANK_HUB_PATH = '/add-money?method=bank'

export function AddMoneyPicker({ onBack, origin }: { onBack: () => void; origin: string | null }) {
    const t = useTranslations('addMoney.methods')
    const title = useTranslations('navigation')
    const router = useRouter()
    const readiness = useAddMoneyReadiness(false)
    const picker = origin ? withReturnTo('/add-money', origin) : '/add-money'
    const viewed = useRef(false)
    useEffect(() => {
        if (viewed.current) return
        viewed.current = true
        trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_VIEWED)
    }, [])
    // the rows in the order the methods resolve: ARS leads for a resident of Argentina, and Pix where the
    // route offers it on Avenia
    const rowFor: Record<string, { title: string; description: string; icon: ReactNode }> = {
        ars: {
            title: ARS_RAIL.currency,
            description: t('arsDetails'),
            icon: <CorridorFlag iso2={ARS_RAIL.flagIso2} />,
        },
        bank: {
            title: t('bankTransfer'),
            description: t('bankDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.bank} size="s" />,
        },
        pix: {
            title: t('pix'),
            description: t('pixDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.pix} size="s" />,
        },
        crypto: {
            title: t('crypto'),
            description: t('cryptoDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.crypto} size="s" />,
        },
    }
    const rows = readiness.pickerMethods.flatMap((key) => (rowFor[key] ? [{ key, ...rowFor[key] }] : []))
    return (
        <PageStack>
            <NavHeader
                title={title('add')}
                onPrev={() => {
                    trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_BACK_TAPPED, { country_list_source: 'none' })
                    onBack()
                }}
            />
            <ListGroup>
                {rows.map((row) => (
                    <ListItem
                        key={row.key}
                        title={row.title}
                        body={row.description}
                        bodyWrap
                        leading={row.icon}
                        chevron
                        data-testid={`add-money-method-${row.key}`}
                        onClick={() =>
                            router.push(
                                row.key === 'bank'
                                    ? // the bank hub shares this page's path, so it cannot return to the picker;
                                      // it returns where the picker would
                                      origin
                                        ? withReturnTo(BANK_HUB_PATH, origin)
                                        : BANK_HUB_PATH
                                    : withReturnTo(
                                          // Pix and ARS have one currency each, so they open the deposit, not a
                                          // chooser of one row
                                          row.key === 'crypto'
                                              ? '/add-money/crypto'
                                              : row.key === 'pix'
                                                ? PIX_ADD_MONEY_PATH
                                                : rewriteMethodPath(ARS_ADD_MONEY_PATH),
                                          picker
                                      )
                            )
                        }
                    />
                ))}
            </ListGroup>
        </PageStack>
    )
}
