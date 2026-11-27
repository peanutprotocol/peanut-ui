'use client'

import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { AddMoneyMethodList } from './AddMoneyMethodList'
import { withReturnTo } from '@/utils/return-to.utils'
import { useTranslations } from 'next-intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { trackAddMoney } from './analytics'
import { useEffect, useRef } from 'react'

export function AddMoneyPicker({ onBack, origin }: { onBack: () => void; origin: string | null }) {
    const title = useTranslations('navigation')
    const picker = origin ? withReturnTo('/add-money', origin) : '/add-money'
    const viewed = useRef(false)
    useEffect(() => {
        if (viewed.current) return
        viewed.current = true
        trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_VIEWED)
    }, [])
    return (
        <PageStack>
            <NavHeader
                title={title('add')}
                onPrev={() => {
                    trackAddMoney(ANALYTICS_EVENTS.ADD_MONEY_BACK_TAPPED, { country_list_source: 'none' })
                    onBack()
                }}
            />
            {/* the bank hub shares this page's path, so it cannot return to the picker; it returns where the
                picker would */}
            <AddMoneyMethodList returnTo={picker} bankReturnTo={origin} />
        </PageStack>
    )
}
