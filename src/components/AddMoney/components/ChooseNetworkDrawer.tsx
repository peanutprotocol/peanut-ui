'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/Global/Drawer'
import { ActionListCard } from '@/components/ActionListCard'
import ChainChip from './ChainChip'
import { CHAIN_LOGOS, SUPPORTED_EVM_CHAINS, getSupportedTokens } from '@/constants/rhino.consts'
import type { RhinoChainType } from '@/services/services.types'
import Image from 'next/image'

interface ChooseNetworkDrawerProps {
    open: boolean
    onClose: () => void
    onSelect: (network: RhinoChainType) => void
}

const ChooseNetworkDrawer = ({ open, onClose, onSelect }: ChooseNetworkDrawerProps) => {
    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DrawerContent className="pt-4">
                <DrawerHeader className="pt-0 text-center">
                    <DrawerTitle className="text-lg font-bold">Choose Network</DrawerTitle>
                    <DrawerDescription>Select Network you want to make deposit from:</DrawerDescription>
                </DrawerHeader>

                <div className="flex flex-col px-4 pb-6">
                    {/* evm - card with expanded networks */}
                    <div className="overflow-hidden rounded-t-sm border border-black bg-white ">
                        <ActionListCard
                            title="EVM"
                            description={`${SUPPORTED_EVM_CHAINS.length} Networks - 1 Address`}
                            position="single"
                            className="border-0"
                            leftIcon={
                                <Image
                                    src={CHAIN_LOGOS.ETHEREUM}
                                    alt="EVM"
                                    width={32}
                                    height={32}
                                    className="rounded-full"
                                />
                            }
                            onClick={() => onSelect('EVM')}
                        />
                        {/* expanded chain list */}
                        <div onClick={() => onSelect('EVM')} className="mx-4 border-t border-dashed border-black py-3">
                            <div className="flex flex-wrap gap-2">
                                {SUPPORTED_EVM_CHAINS.map((chain) => (
                                    <ChainChip key={chain} chainName={chain} chainSymbol={CHAIN_LOGOS[chain]} />
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* solana */}
                    <ActionListCard
                        title="Solana"
                        description={`${getSupportedTokens('SOL').length} Supported token${getSupportedTokens('SOL').length !== 1 ? 's' : ''}`}
                        position="middle"
                        leftIcon={
                            <Image
                                src={CHAIN_LOGOS.SOLANA}
                                alt="Solana"
                                width={32}
                                height={32}
                                className="rounded-full"
                            />
                        }
                        onClick={() => onSelect('SOL')}
                    />

                    {/* tron */}
                    <ActionListCard
                        title="Tron"
                        description={`${getSupportedTokens('TRON').length} Supported token${getSupportedTokens('TRON').length !== 1 ? 's' : ''}`}
                        position="last"
                        leftIcon={
                            <Image src={CHAIN_LOGOS.TRON} alt="Tron" width={32} height={32} className="rounded-full" />
                        }
                        onClick={() => onSelect('TRON')}
                    />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default ChooseNetworkDrawer
