import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { getCardPosition } from '@/components/Global/Card'
import NavHeader from '@/components/Global/NavHeader'
import { SearchResultCard } from '@/components/SearchUsers/SearchResultCard'
import { PEANUT_WALLET_TOKEN_SYMBOL } from '@/constants'
import Image from 'next/image'
import React from 'react'
import { type CryptoToken, DEPOSIT_CRYPTO_TOKENS } from '../consts'

interface TokenSelectionViewProps {
    headerTitle?: string
    onTokenSelect: (token: CryptoToken) => void
    onBack: () => void
}

const TokenSelectionView: React.FC<TokenSelectionViewProps> = ({ headerTitle, onTokenSelect, onBack }) => {
    return (
        <div className="w-full space-y-8 self-start">
            <NavHeader title={headerTitle ?? 'Add Money'} onPrev={onBack} />
            <div className="flex h-full w-full flex-col justify-start gap-2 self-start pb-5 md:pb-0">
                <h2 className="text-base font-bold">Choose a token</h2>
                <div className="">
                    {DEPOSIT_CRYPTO_TOKENS.map((token, index) => {
                        const position = getCardPosition(index, DEPOSIT_CRYPTO_TOKENS.length)
                        const isDisabled = token.symbol.toLowerCase() !== PEANUT_WALLET_TOKEN_SYMBOL.toLowerCase()

                        return (
                            <SearchResultCard
                                isDisabled={isDisabled}
                                key={token.id}
                                title={token.symbol}
                                leftIcon={
                                    <Image
                                        src={token.icon as string}
                                        alt={token.name}
                                        width={32}
                                        height={32}
                                        loading="lazy"
                                    />
                                }
                                className="px-4 py-3.5"
                                rightContent={isDisabled && <StatusBadge status="soon" />}
                                onClick={() => onTokenSelect(token)}
                                position={position}
                            />
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default TokenSelectionView
