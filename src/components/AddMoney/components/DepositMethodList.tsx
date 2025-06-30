'use client'
import { CardPosition } from '@/components/Global/Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { IconName } from '@/components/Global/Icons/Icon'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { countryCodeMap } from '../consts'

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
                    determinedPosition = 'single'
                } else if (isFirstOverall) {
                    determinedPosition = 'first'
                } else if (isCryptoAtSlot0 && isCurrentMethodCountry && index === 1 && isAllMethodsView) {
                    // if crypto card is at methods[0], and this is the country card at methods[1],
                    // treat this country card as 'first' in its own group.
                    determinedPosition = 'first'
                } else if (isLastOverall) {
                    determinedPosition = 'last'
                } else {
                    determinedPosition = 'middle'
                }

                const classNames = []
                if (method.type === 'crypto' && isAllMethodsView) {
                    classNames.push('mb-2')
                }

                const threeLetterCountryCode = (method.id ?? '').toUpperCase()
                const twoLetterCountryCode = countryCodeMap[threeLetterCountryCode] ?? threeLetterCountryCode

                const countryCodeForFlag = twoLetterCountryCode.toLowerCase() ?? ''

                return (
                    <SearchResultCard
                        key={`${method.type}-${method.id}`}
                        title={method.title}
                        description={method.description || method.currency}
                        leftIcon={
                            method.type === 'crypto' ? (
                                <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />
                            ) : method.id === 'bank-transfer-add' ? (
                                <AvatarWithBadge
                                    icon="bank"
                                    size="extra-small"
                                    className="bg-yellow-1"
                                    inlineStyle={{ color: 'black' }}
                                />
                            ) : method.type === 'country' ? (
                                <Image
                                    src={`https://flagcdn.com/w160/${countryCodeForFlag.toLowerCase()}.png`}
                                    alt={`${method.title} flag`}
                                    width={80}
                                    height={80}
                                    className="h-8 w-8 rounded-full object-fill object-center shadow-sm"
                                    loading="lazy"
                                />
                            ) : (
                                <AvatarWithBadge name={method.title} size="extra-small" className="bg-yellow-1" />
                            )
                        }
                        onClick={() => onItemClick(method)}
                        position={determinedPosition}
                        className={twMerge(classNames.join(' '))}
                        descriptionClassName="text-xs"
                    />
                )
            })}
        </div>
    )
}
