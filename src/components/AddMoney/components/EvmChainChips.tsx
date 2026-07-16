import ChainChip from './ChainChip'
import { SUPPORTED_EVM_CHAINS, CHAIN_LOGOS, EVM_DEPOSIT_TOKEN_EXCEPTIONS } from '@/constants/rhino.consts'
import { useChainRollout } from '@/hooks/useChainRollout'
import { useTranslations } from 'next-intl'

/**
 * The rollout-gated EVM deposit chain chips, annotated with per-chain token
 * exceptions (USDT-only chains) — a USDC deposit on a chain where Rhino only
 * accepts USDT has no webhook, so the annotation is a funds-safety surface,
 * not decoration. Shared by ChooseNetworkDrawer and SupportedNetworksModal.
 */
const EvmChainChips = () => {
    const isChainRolledOut = useChainRollout()
    const t = useTranslations('addMoney')
    return (
        <>
            {SUPPORTED_EVM_CHAINS.filter(isChainRolledOut).map((chain) => {
                const tokenException = EVM_DEPOSIT_TOKEN_EXCEPTIONS[chain]
                const label = tokenException ? t('chainTokenOnly', { chain, tokens: tokenException.join('/') }) : chain
                return <ChainChip key={chain} chainName={label} chainSymbol={CHAIN_LOGOS[chain]} />
            })}
        </>
    )
}

export default EvmChainChips
