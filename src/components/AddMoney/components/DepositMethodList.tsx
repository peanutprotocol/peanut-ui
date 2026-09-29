'use client'
import { type CardPosition } from '@/components/Global/Card/card.utils'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import Image from 'next/image'
import { twMerge } from '@/utils/tw'
import { ALL_COUNTRIES_ALPHA3_TO_ALPHA2 } from '../consts'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { ListItem } from '@/components/0_Bruddle/ListItem'

export interface DepositMethod {
    type: 'crypto' | 'country'
    id: string
    title: string
    description?: string
    iconUrl?: string
    currency?: string
    path: string
}

interface DepositMethodListProps {
    methods: DepositMethod[]
    onItemClick: (method: DepositMethod) => void
    isAllMethodsView?: boolean
}

export const DepositMethodList = ({ methods, onItemClick, isAllMethodsView = false }: DepositMethodListProps) => {
    return (
        <div className="flex flex-col">
            {methods.map((method, index) => {
                let determinedPosition: CardPosition
                const isFirstOverall = index === 0
                const isLastOverall = index === methods.length - 1
                const isSingleOverall = methods.length === 1

                const isCryptoAtSlot0 = methods[0]?.type === 'crypto'
                const isCurrentMethodCountry = method.type === 'country'

                if (isSingleOverall) {
                    determinedPosition = 'solo'
                } else if (isFirstOverall) {
                    determinedPosition = isCryptoAtSlot0 && isAllMethodsView ? 'solo' : 'top'
                } else if (isCryptoAtSlot0 && isCurrentMethodCountry && index === 1 && isAllMethodsView) {
                    // if crypto card is at methods[0], and this is the country card at methods[1],
                    // treat this country card as 'first' in its own group.
                    determinedPosition = 'top'
                } else if (isLastOverall) {
                    determinedPosition = 'bottom'
                } else {
                    determinedPosition = 'middle'
                }

                const classNames = []
                if (method.type === 'crypto' && isAllMethodsView) {
                    classNames.push('mb-2')
                }

                const threeLetterCountryCode = (method.id ?? '').toUpperCase()
                const twoLetterCountryCode =
                    ALL_COUNTRIES_ALPHA3_TO_ALPHA2[threeLetterCountryCode] ?? threeLetterCountryCode

                const countryCodeForFlag = twoLetterCountryCode.toLowerCase() ?? ''

                return (
                    <ListItem
                        key={`${method.type}-${method.id}`}
                        title={method.title}
                        body={<div className="text-body-xs">{method.description || method.currency}</div>}
                        leading={
                            method.type === 'crypto' ? (
                                <IconBubble {...CONCEPT_ICONS.crypto} size="s" />
                            ) : method.id === 'bank-transfer-add' ? (
                                <IconBubble {...CONCEPT_ICONS.bank} size="s" />
                            ) : method.type === 'country' ? (
                                <Image
                                    src={getFlagUrl(countryCodeForFlag)}
                                    alt={`${method.title} flag`}
                                    width={80}
                                    height={80}
                                    className="h-8 w-8 rounded-full object-fill object-center shadow-sm"
                                    loading="lazy"
                                />
                            ) : (
                                <IconBubble {...CONCEPT_ICONS.bank} size="s" />
                            )
                        }
                        onClick={() => onItemClick(method)}
                        position={determinedPosition}
                        className={twMerge(classNames.join(' '))}
                        chevron
                    />
                )
            })}
        </div>
    )
}
