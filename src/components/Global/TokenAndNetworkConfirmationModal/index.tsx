import ActionModal from '@/components/Global/ActionModal'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { useTranslations } from 'next-intl'
import ChainChip from '@/components/AddMoney/components/ChainChip'
import EvmChainChips from '@/components/AddMoney/components/EvmChainChips'
import { RHINO_SUPPORTED_OTHER_CHAINS, RHINO_SUPPORTED_TOKENS } from '@/constants/rhino.consts'

// grey uppercase mini-header, the same shape the account-ready screen uses
const MINI_HEADER = 'text-label-m uppercase tracking-wide text-foreground-secondary'

export default function TokenAndNetworkConfirmationModal({
    onClose,
    onAccept,
    isVisible = true,
}: {
    onClose: () => void
    onAccept: () => void
    isVisible?: boolean
}) {
    const t = useTranslations('global')
    return (
        <ActionModal
            visible={isVisible}
            onClose={onClose}
            icon={'alert'}
            iconContainerClassName="bg-background-icon-bubble-yellow"
            modalClassName="z-[9999]"
            title={t('tokenAndNetworkConfirmationModal.title')}
            description={
                <div className="flex flex-col items-center gap-2">
                    <span className="text-body-s">{t('tokenAndNetworkConfirmationModal.warning')}</span>

                    {/* EvmChainChips, not a raw map of the chain list: it is
                        rollout-gated and annotates the USDT-only chains. Naming
                        PLASMA or KAIA beside a flat USDT/USDC/ETH list on the
                        screen that warns about permanent loss would promise a
                        USDC deposit those chains cannot take. */}
                    <div className="mt-2 flex w-full flex-col items-center gap-2">
                        <h2 className={MINI_HEADER}>{t('tokenAndNetworkConfirmationModal.supportedNetworks')}</h2>

                        <div className="flex flex-wrap justify-center gap-2">
                            {RHINO_SUPPORTED_OTHER_CHAINS.map((chain) => (
                                <ChainChip key={chain.name} chainName={chain.name} chainSymbol={chain.logoUrl} />
                            ))}
                            <EvmChainChips />
                        </div>
                    </div>

                    <div className="mt-2 flex w-full flex-col items-center gap-2">
                        <h2 className={MINI_HEADER}>{t('tokenAndNetworkConfirmationModal.supportedTokens')}</h2>

                        <div className="flex flex-wrap justify-center gap-2">
                            {RHINO_SUPPORTED_TOKENS.map((token) => (
                                <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                            ))}
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="w-full">
                    <SlideToConfirm onConfirm={onAccept} label={t('tokenAndNetworkConfirmationModal.slideToProceed')} />
                </div>
            }
            ctas={[]}
            modalPanelClassName="max-w-sm"
        />
    )
}
