import { MiniHeader } from '@/components/0_Bruddle/MiniHeader'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useTranslations } from 'next-intl'
import ChainChip from '@/components/AddMoney/components/ChainChip'
import EvmChainChips from '@/components/AddMoney/components/EvmChainChips'
import { getSupportedTokens, RHINO_SUPPORTED_OTHER_CHAINS, RHINO_SUPPORTED_TOKENS } from '@/constants/rhino.consts'
import type { RhinoChainType } from '@/services/services.types'

// SOLANA and TRON are the non-EVM deposit chains. Rhino takes fewer tokens on
// them than the flat list below advertises — TRON is USDT-only — so each is
// labelled with what it actually accepts, the way EvmChainChips labels its own
// exceptions. A token sent to an address the chain does not accept is lost:
// no config, so no webhook and no intent.
const NON_EVM_NETWORK: Record<string, RhinoChainType> = { SOLANA: 'SOL', TRON: 'TRON' }

export default function TokenAndNetworkConfirmationDrawer({
    onClose,
    onAccept,
    isVisible = true,
}: {
    onClose: () => void
    onAccept: () => void
    isVisible?: boolean
}) {
    const t = useTranslations('global')
    const tAddMoney = useTranslations('addMoney')
    return (
        <Drawer
            open={isVisible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('tokenAndNetworkConfirmationModal.title')}</DrawerTitle>
                            <DrawerDescription>{t('tokenAndNetworkConfirmationModal.warning')}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {/* EvmChainChips, not a raw map of the chain list: it is
                            rollout-gated and annotates the USDT-only chains. Naming
                            PLASMA or KAIA beside a flat USDT/USDC/ETH list on the
                            screen that warns about permanent loss would promise a
                            USDC deposit those chains cannot take. */}
                        <div className="flex w-full flex-col items-center gap-2">
                            <MiniHeader>{t('tokenAndNetworkConfirmationModal.supportedNetworks')}</MiniHeader>

                            <div className="flex flex-wrap justify-center gap-2">
                                {RHINO_SUPPORTED_OTHER_CHAINS.map((chain) => {
                                    const network = NON_EVM_NETWORK[chain.name]
                                    const tokens = network ? getSupportedTokens(network).map((token) => token.name) : []
                                    const label = tokens.length
                                        ? tAddMoney('chainTokenOnly', { chain: chain.name, tokens: tokens.join('/') })
                                        : chain.name
                                    return <ChainChip key={chain.name} chainName={label} chainSymbol={chain.logoUrl} />
                                })}
                                <EvmChainChips />
                            </div>
                        </div>

                        <div className="flex w-full flex-col items-center gap-2">
                            <MiniHeader>{t('tokenAndNetworkConfirmationModal.supportedTokens')}</MiniHeader>

                            <div className="flex flex-wrap justify-center gap-2">
                                {RHINO_SUPPORTED_TOKENS.map((token) => (
                                    <ChainChip key={token.name} chainName={token.name} chainSymbol={token.logoUrl} />
                                ))}
                            </div>
                        </div>

                        {/* data-vaul-no-drag: the horizontal slide gesture must not start a drawer drag */}
                        <div className="w-full" data-vaul-no-drag>
                            <SlideToConfirm
                                onConfirm={onAccept}
                                label={t('tokenAndNetworkConfirmationModal.slideToProceed')}
                            />
                        </div>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
