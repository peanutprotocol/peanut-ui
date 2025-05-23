'use client'
import { CardPosition } from '@/components/Global/Card'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

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
}

export const DepositMethodList = ({ methods, onItemClick }: DepositMethodListProps) => {
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
                } else if (isCryptoAtSlot0 && isCurrentMethodCountry && index === 1) {
                    // if crypto card is at methods[0], and this is the country card at methods[1],
                    // treat this country card as 'first' in its own group.
                    determinedPosition = 'first'
                } else if (isLastOverall) {
                    determinedPosition = 'last'
                } else {
                    determinedPosition = 'middle'
                }

                const classNames = []
                if (method.type === 'crypto') {
                    classNames.push('mb-2')
                }

                return (
                    <SearchResultCard
                        key={`${method.type}-${method.id}`}
                        title={method.title}
                        description={method.description || method.currency}
                        leftIcon={
                            method.type === 'crypto' ? (
                                <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />
                            ) : method.type === 'country' ? (
                                <Image
                                    src={`https://flagcdn.com/w320/${method.id.toLowerCase()}.png`}
                                    alt={`${method.title} flag`}
                                    width={32}
                                    height={32}
                                    className="min-h-8 min-w-8 rounded-full object-fill object-center shadow-sm"
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
