'use client'

import { supportedPeanutChains } from '@/constants'
import { tokenSelectorContext } from '@/context'
import { useWallet } from '@/hooks/wallet/useWallet'
import { IPeanutChainDetails } from '@/interfaces'
import { calculateValuePerChain, formatTokenAmount } from '@/utils'
import { Menu, Transition } from '@headlessui/react'
import { useContext, useMemo, useState } from 'react'
import Icon from '../Icon'
import Search from '../Search'

type Chain = {
    name: string
    icon: {
        url: string
        format: string
    }
    mainnet: boolean
}

interface IChainSelectorProps {
    chainsToDisplay?: IPeanutChainDetails[]
    onChange?: (chainId: string) => void
}

const ChainSelector = ({ chainsToDisplay, onChange }: IChainSelectorProps) => {
    const [, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')
    const { selectedWallet } = useWallet()

    const { selectedChainID, setSelectedChainID } = useContext(tokenSelectorContext)

    const valuePerChain = useMemo(
        () => calculateValuePerChain(selectedWallet?.balances ?? []),
        [selectedWallet?.balances]
    )

    const _chainsToDisplay = useMemo(() => {
        let chains
        if (chainsToDisplay) {
            chains = chainsToDisplay
        } else {
            chains = supportedPeanutChains
        }
        if (valuePerChain.length > 0) {
            // Sort the chains based on the value
            chains = chains.sort((a, b) => {
                const aValue = valuePerChain.find((value) => value.chainId === a.chainId)?.valuePerChain || 0
                const bValue = valuePerChain.find((value) => value.chainId === b.chainId)?.valuePerChain || 0
                return bValue - aValue
            })
        }
        if (filterValue) {
            chains = chains.filter(
                (chain) =>
                    chain.name.toLowerCase().includes(filterValue.toLowerCase()) ||
                    chain.shortName.toLowerCase().includes(filterValue.toLowerCase())
            )
        }
        return chains
    }, [filterValue, valuePerChain, chainsToDisplay])

    function setChain(chainId: string): void {
        setSelectedChainID(chainId)
        setVisible(false)
        onChange?.(chainId)
    }

    return (
        <Menu className="relative" as="div">
            {({ open }) => (
                <>
                    <Menu.Button className="btn-xl-fixed flex flex-row items-center justify-center gap-2">
                        <img
                            src={_chainsToDisplay.find((chain) => chain.chainId === selectedChainID)?.icon.url}
                            alt={''}
                            className="h-6 w-6"
                        />
                        <Icon
                            name={'arrow-bottom'}
                            className={`transition-transform dark:fill-white ${open ? 'rotate-180' : ''}`}
                        />
                    </Menu.Button>

                    <div className="absolute right-0 top-full z-30">
                        <Transition
                            enter="transition duration-100 ease-out"
                            enterFrom="transform scale-95 opacity-0"
                            enterTo="transform scale-100 opacity-100"
                            leave="transition duration-75 ease-out"
                            leaveFrom="transform scale-100 opacity-100"
                            leaveTo="transform scale-95 opacity-0"
                        >
                            <Menu.Items className="shadow-primary-4 mt-2.5 max-h-64 w-[14.69rem] divide-y divide-black overflow-auto rounded-lg bg-white dark:divide-white dark:bg-n-1">
                                <div className="sticky top-0 bg-white p-2 dark:bg-n-1">
                                    <Search
                                        className="px-1"
                                        placeholder="Search by chain name"
                                        value={filterValue}
                                        onChange={(e: any) => setFilterValue(e.target.value)}
                                        onSubmit={() => {}}
                                        medium
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto">
                                    {_chainsToDisplay.map(
                                        (chain) =>
                                            chain.mainnet &&
                                            chainItem({
                                                chain,
                                                setChain: () => setChain(chain.chainId),
                                                valuePerChain: !chainsToDisplay
                                                    ? valuePerChain.find((value) => value.chainId === chain.chainId)
                                                          ?.valuePerChain
                                                    : undefined,
                                            })
                                    )}
                                </div>
                            </Menu.Items>
                        </Transition>
                    </div>
                </>
            )}
        </Menu>
    )
}

const chainItem = ({
    chain,
    setChain,
    valuePerChain,
}: {
    chain: Chain
    setChain: () => void
    valuePerChain?: number
}) => {
    return (
        <Menu.Item
            as="button"
            onClick={setChain}
            className="flex h-12 w-full items-center justify-between gap-2 px-4 text-sm font-bold transition-colors last:mb-0 hover:bg-grey-1/10 dark:hover:bg-white/20"
            key={chain.name}
        >
            <div className="flex w-max flex-row items-center justify-center gap-2">
                <img src={chain.icon.url} alt={chain.name} className="h-6 w-6" />
                <div className="text-h8">{chain.name}</div>
            </div>
            {valuePerChain && <div className="text-h9 text-grey-1">${formatTokenAmount(valuePerChain, 2)}</div>}
        </Menu.Item>
    )
}

export default ChainSelector
