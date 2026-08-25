'use client'

import NavHeader from '@/components/Global/NavHeader'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, getSupportedTokens } from '@/constants/rhino.consts'
import { useChainRollout } from '@/hooks/useChainRollout'
import type { RhinoChainType } from '@/services/services.types'
import Image from 'next/image'
import { useTranslations } from 'next-intl'

interface ChooseNetworkViewProps {
    onSelect: (network: RhinoChainType) => void
    onBack: () => void
}

/**
 * network selection page per the Add/Crypto board (17830:78020): "Add crypto"
 * title, "Choose network" heading, one row per chain family.
 */
const ChooseNetworkView = ({ onSelect, onBack }: ChooseNetworkViewProps) => {
    const t = useTranslations('addMoney')
    const isChainRolledOut = useChainRollout()
    const evmChainCount = SUPPORTED_EVM_CHAINS.filter(isChainRolledOut).length

    const networks: Array<{ network: RhinoChainType; title: string; body: string; logo: string }> = [
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
        <PageStack>
            <NavHeader title={t('addCryptoTitle')} onPrev={onBack} />
            <div className="flex flex-col gap-4">
                <h2 className="text-heading-card text-foreground-primary">{t('networkDrawer.title')}</h2>
                <div className="flex flex-col gap-2">
                    {networks.map(({ network, title, body, logo }) => (
                        <ListItem
                            key={network}
                            position="single"
                            leading={<Image src={logo} alt={title} width={32} height={32} className="rounded-round" />}
                            title={title}
                            body={body}
                            chevron
                            onClick={() => onSelect(network)}
                            data-testid={`choose-network-${network.toLowerCase()}`}
                        />
                    ))}
                </div>
            </div>
        </PageStack>
    )
}

export default ChooseNetworkView
