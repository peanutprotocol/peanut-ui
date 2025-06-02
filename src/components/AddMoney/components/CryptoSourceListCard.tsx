'use client'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import Image, { StaticImageData } from 'next/image'
import { twMerge } from 'tailwind-merge'
import { CryptoSource } from '../consts'

interface CryptoSourceListCardProps {
    sources: CryptoSource[]
    onItemClick: (source: CryptoSource) => void
}

const GenericIcon = ({ type }: { type: 'exchange' | 'wallet' }) => (
    <AvatarWithBadge
        className="bg-yellow-1"
        icon={type === 'exchange' ? 'exchange-arrows' : 'wallet-outline'}
        size="extra-small"
    />
)

export const CryptoSourceListCard = ({ sources, onItemClick }: CryptoSourceListCardProps) => {
    return (
        <div className="flex flex-col">
            {sources.map((source, index) => (
                <SearchResultCard
                    key={source.id}
                    title={source.name}
                    className="px-4 py-3"
                    leftIcon={
                        source.icon ? (
                            <Image
                                src={source.icon as StaticImageData}
                                alt={`${source.name} logo`}
                                width={32}
                                height={32}
                                className={twMerge(
                                    'rounded-full object-contain',
                                    source.type === 'wallet' && 'rounded-none'
                                )}
                            />
                        ) : source.isGeneric ? (
                            <GenericIcon type={source.type} />
                        ) : (
                            <AvatarWithBadge icon="wallet-outline" size="extra-small" className="bg-yellow-1" />
                        )
                    }
                    onClick={() => onItemClick(source)}
                    position={
                        sources.length === 1
                            ? 'single'
                            : index === 0
                              ? 'first'
                              : index === sources.length - 1
                                ? 'last'
                                : 'middle'
                    }
                />
            ))}
        </div>
    )
}
