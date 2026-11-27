'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'
import { addMoneyMethodHref, isAddMoneyRowMethod, useAddMoneyMethodRows } from './useAddMoneyMethodRows'
import { withReturnTo } from '@/utils/return-to.utils'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { trackAddMoney } from './analytics'
import { useEffect, useRef } from 'react'

export function AddMoneyPicker({ onBack, origin }: { onBack: () => void; origin: string | null }) {
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
    const rowFor = useAddMoneyMethodRows()
    const rows = readiness.pickerMethods.flatMap((key) => (isAddMoneyRowMethod(key) ? [{ key, ...rowFor[key] }] : []))
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
                        onClick={() => router.push(addMoneyMethodHref(row.key, picker, origin))}
                    />
                ))}
            </ListGroup>
        </PageStack>
    )
}
