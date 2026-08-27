'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import EvmChainChips from './EvmChainChips'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, getSupportedTokens } from '@/constants/rhino.consts'
import { useChainRollout } from '@/hooks/useChainRollout'
import type { RhinoChainType } from '@/services/services.types'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

interface NetworkListProps {
    onSelect: (network: RhinoChainType) => void
    /** drawer shell renders the expanded EVM chain chips under the EVM row */
    showEvmChips?: boolean
}

/**
 * The one network chooser list (Add/Crypto board 17830:78020) — consumed by
 * both the /add-money drawer and the /add-money/crypto page so the copy,
 * icons and testids cannot drift apart again (F-22; the two hand-rolled
 * copies had already diverged). Copy is the board-backed page wording:
 * "{tokens} supported tokens on {networks} networks".
 */
const NetworkList = ({ onSelect, showEvmChips = false }: NetworkListProps) => {
    const t = useTranslations('addMoney')
    // count only rolled-out chains — the chips are gated the same way, and a
    // higher number above fewer visible chips would be a lie
    const isChainRolledOut = useChainRollout()
    const evmChainCount = SUPPORTED_EVM_CHAINS.filter(isChainRolledOut).length

    const rows: Array<{ network: RhinoChainType; title: string; body: string; logo: string }> = [
        {
            network: 'EVM',
            title: 'EVM',
            body: t('networkDrawer.evmTokensOnNetworks', {
                tokens: getSupportedTokens('EVM').length,
                networks: evmChainCount,
            }),
            logo: CHAIN_LOGOS.ETHEREUM,
        },
        {
            network: 'SOL',
            title: 'Solana',
            body: t('networkDrawer.supportedTokens', { count: getSupportedTokens('SOL').length }),
            logo: CHAIN_LOGOS.SOLANA,
        },
        {
            network: 'TRON',
            title: 'Tron',
            body: t('networkDrawer.supportedTokens', { count: getSupportedTokens('TRON').length }),
            logo: CHAIN_LOGOS.TRON,
        },
    ]

    return (
        <div className="flex flex-col gap-2">
            {rows.map(({ network, title, body, logo }) => {
                const item = (
                    <ListItem
                        key={network}
                        position="single"
                        leading={<Image src={logo} alt={title} width={32} height={32} className="rounded-round" />}
                        title={title}
                        body={body}
                        chevron
                        onClick={() => onSelect(network)}
                        data-testid={`choose-network-${network.toLowerCase()}`}
                        className={network === 'EVM' && showEvmChips ? 'border-0' : undefined}
                    />
                )
                if (network === 'EVM' && showEvmChips) {
                    return (
                        <div
                            key={network}
                            className="overflow-hidden rounded-sm border border-border-default bg-background-default"
                        >
                            {item}
                            <div
                                onClick={() => onSelect('EVM')}
                                className="mx-4 border-t border-dashed border-border-default py-3"
                            >
                                <div className="flex flex-wrap gap-2">
                                    <EvmChainChips />
                                </div>
                            </div>
                        </div>
                    )
                }
                return item
            })}
        </div>
    )
}

export default NetworkList
