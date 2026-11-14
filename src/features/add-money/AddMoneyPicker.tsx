'use client'

import PIX from '@/assets/payment-apps/pix.svg'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { useAddMoneyReadiness } from './useAddMoneyReadiness'
import { withReturnTo } from '@/utils/return-to.utils'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { trackAddMoney } from './analytics'
import { useEffect, useRef } from 'react'

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
    const rows = [
        ...(readiness.pickerMethods.includes('account')
            ? [
                  {
                      key: 'account',
                      title: t('openAccount'),
                      description: t('accountDetails'),
                      icon: <IconBubble {...CONCEPT_ICONS.bankAccount} size="s" />,
                  },
              ]
            : []),
        {
            key: 'transfer',
            title: t('oneTimeTransfer'),
            description: t('oneTimeDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.bank} size="s" />,
        },
        {
            key: 'pix',
            title: t('payPix'),
            description: t('pixDetails'),
            icon: <Image src={PIX} alt="" width={32} height={32} />,
        },
        {
            key: 'crypto',
            title: t('crypto'),
            description: t('cryptoDetails'),
            icon: <IconBubble {...CONCEPT_ICONS.crypto} size="s" />,
        },
    ]
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
                                withReturnTo(
                                    row.key === 'crypto' ? '/add-money/crypto' : `/add-money/options?method=${row.key}`,
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
