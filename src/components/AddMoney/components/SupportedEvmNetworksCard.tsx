import ChainChip from './ChainChip'
import Card from '@/components/Global/Card'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS } from '@/constants/rhino.consts'
import { useTranslations } from 'next-intl'

/** The EVM chains one EVM deposit address works on. */
const SupportedEvmNetworksCard = () => {
    const t = useTranslations('addMoney.crypto')
    return (
        <Card className="flex flex-col gap-2 p-4">
            <h3 className="text-label-l text-foreground-primary">{t('supportedEvmNetworks')}</h3>
            <div className="flex flex-wrap gap-2">
                {SUPPORTED_EVM_CHAINS.map((chain) => (
                    <ChainChip key={chain} chainName={chain} chainSymbol={CHAIN_LOGOS[chain]} />
                ))}
            </div>
        </Card>
    )
}

export default SupportedEvmNetworksCard
