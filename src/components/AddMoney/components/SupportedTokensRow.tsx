import ChainChip from './ChainChip'
import { getSupportedTokens } from '@/constants/rhino.consts'
import type { RhinoChainType } from '@/services/services.types'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'

/** "Supported tokens:" and a chip per token the network's deposit address takes. */
const SupportedTokensRow = ({ network, className }: { network: RhinoChainType; className?: string }) => {
    const t = useTranslations('addMoney.crypto')
    return (
        <div className={twMerge('flex items-center gap-2', className)}>
            <p>{t('supportedTokensInline')}</p>
            {getSupportedTokens(network).map((token) => (
                <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
            ))}
        </div>
    )
}

export default SupportedTokensRow
