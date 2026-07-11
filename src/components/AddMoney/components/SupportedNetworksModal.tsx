'use client'

import Modal from '@/components/Global/Modal'
import InfoCard from '@/components/Global/InfoCard'
import ChainChip from './ChainChip'
import { SUPPORTED_EVM_CHAINS, CHAIN_LOGOS, EVM_DEPOSIT_TOKEN_EXCEPTIONS } from '@/constants/rhino.consts'
import { useChainRollout } from '@/hooks/useChainRollout'

interface SupportedNetworksModalProps {
    visible: boolean
    onClose: () => void
}

const SupportedNetworksModal = ({ visible, onClose }: SupportedNetworksModalProps) => {
    const isChainRolledOut = useChainRollout()
    return (
        <Modal
            visible={visible}
            onClose={onClose}
            classWrap="sm:m-auto sm:self-center self-center m-4 bg-background rounded-sm"
        >
            <div className="flex flex-col gap-4 p-5">
                <h3 className={'text-start text-h6 font-bold text-black'}>Supported Networks</h3>
                <p className="text-sm text-grey-1">
                    One address for all listed below EVM networks - send from any of them and your funds will be routed
                    correctly.
                </p>

                <div className="flex flex-wrap gap-2">
                    {SUPPORTED_EVM_CHAINS.filter(isChainRolledOut).map((chain) => {
                        const tokenException = EVM_DEPOSIT_TOKEN_EXCEPTIONS[chain]
                        const label = tokenException ? `${chain} · ${tokenException.join('/')} only` : chain
                        return <ChainChip key={chain} chainName={label} chainSymbol={CHAIN_LOGOS[chain]} />
                    })}
                </div>

                <InfoCard
                    variant="warning"
                    icon="alert"
                    title="Sending to the wrong network or token will result in permanent loss."
                />
            </div>
        </Modal>
    )
}

export default SupportedNetworksModal
