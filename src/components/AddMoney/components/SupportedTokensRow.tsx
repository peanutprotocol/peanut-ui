import ChainChip from './ChainChip'
import { getSupportedTokens } from '@/constants/rhino.consts'
import type { RhinoChainType } from '@/services/services.types'
import { twMerge } from '@/utils/tw'
import { useTranslations } from 'next-intl'

/**
 * "Supported tokens:" and a chip per token the network's deposit address takes. `stacked` puts the
 * label on its own line, so a narrow container (a callout) never wraps one chip alone.
 */
const SupportedTokensRow = ({
    network,
    className,
    stacked,
}: {
    network: RhinoChainType
    className?: string
    stacked?: boolean
}) => {
    const t = useTranslations('addMoney.crypto')
    const chips = getSupportedTokens(network).map((token) => (
        <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
    ))
    if (stacked)
        return (
            <div className={twMerge('flex flex-col gap-2', className)}>
                <p>{t('supportedTokensInline')}</p>
                <div className="flex flex-wrap items-center gap-2">{chips}</div>
            </div>
        )
    return (
        <div className={twMerge('flex items-center gap-2', className)}>
            <p>{t('supportedTokensInline')}</p>
            {chips}
        </div>
    )
}

export default SupportedTokensRow
