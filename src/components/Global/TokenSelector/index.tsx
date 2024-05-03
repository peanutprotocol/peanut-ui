'use client'

import { useContext, useEffect, useMemo, useState } from 'react'
import Modal from '../Modal'
import Icon from '../Icon'
import Search from '../Search'
import ChainSelector from '../ChainSelector'
import { useBalance } from '@/hooks/useBalance'
import { peanutTokenDetails, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import * as interfaces from '@/interfaces'
import * as utils from '@/utils'
import SimpleTokenSelectorButton from './SimpleButton'
import { AdvancedTokenSelectorButton } from './AdvancedButton'

interface CombinedType extends interfaces.IPeanutChainDetails {
    tokens: interfaces.IToken[]
}

interface TokenSelectorProps {
    classNameButton?: string
    simpleButton?: boolean
    data?: CombinedType[]
    type?: 'send' | 'xchain'
    xchainTokenAmount?: string
    xchainTokenPrice?: number
}

const TokenSelector = ({
    classNameButton,
    simpleButton = false,
    data,
    type = 'send',
    xchainTokenAmount,
    xchainTokenPrice,
}: TokenSelectorProps) => {
    const [visible, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')

    const { balances } = useBalance()
    const { selectedChainID, selectedTokenAddress, setSelectedTokenAddress, setSelectedChainID } = useContext(
        context.tokenSelectorContext
    )

    const _tokensToDisplay = useMemo(() => {
        let _tokens
        if (data) {
            _tokens = data.find((detail) => detail.chainId === selectedChainID)?.tokens || []
        } else {
            _tokens = peanutTokenDetails.find((detail) => detail.chainId === selectedChainID)?.tokens || []
        }

        // Add all tokens the user has balances on (per chain)
        if (type === 'send' && balances.length > 0) {
            balances.forEach((balance) => {
                if (balance.chainId === selectedChainID) {
                    _tokens.push({
                        address: balance.address,
                        logoURI: balance.logoURI,
                        symbol: balance.symbol,
                        name: balance.name,
                        decimals: balance.decimals,
                        chainId: balance.chainId,
                    })
                }
            })

            // remove duplicates
            _tokens = _tokens.filter(
                (token, index, self) => index === self.findIndex((t) => t.address === token.address)
            )
        }

        //Filtering on name and symbol
        if (filterValue && filterValue.length > 2) {
            _tokens = _tokens.filter(
                (token) =>
                    token.name.toLowerCase().includes(filterValue.toLowerCase()) ||
                    token.symbol.toLowerCase().includes(filterValue.toLowerCase())
            )
            return _tokens
        }

        //only return the first 6 tokens if not filtering
        return _tokens // TODO: fix styling to be three three and bigger (same size no matter of symbol)
    }, [filterValue, selectedChainID])

    function setToken(address: string): void {
        setSelectedTokenAddress(address)
        setTimeout(() => {
            setFilterValue('')
        }, 1000)
        setVisible(false)
    }

    return (
        <>
            {simpleButton ? (
                <SimpleTokenSelectorButton
                    onClick={() => {
                        setVisible(!visible)
                    }}
                    isVisible={visible}
                />
            ) : (
                <AdvancedTokenSelectorButton
                    onClick={() => {
                        setVisible(!visible)
                    }}
                    isVisible={visible}
                    tokenLogoUri={
                        _tokensToDisplay.find((token) =>
                            utils.compareTokenAddresses(token.address, selectedTokenAddress)
                        )?.logoURI ?? ''
                    }
                    tokenSymbol={
                        _tokensToDisplay.find((token) =>
                            utils.compareTokenAddresses(token.address, selectedTokenAddress)
                        )?.symbol ?? ''
                    }
                    tokenBalance={
                        balances.find(
                            (balance) =>
                                utils.compareTokenAddresses(balance.address, selectedTokenAddress) &&
                                balance.chainId === selectedChainID
                        )?.amount ?? 0
                    }
                    chainIconUri={
                        data
                            ? data.find((detail) => detail.chainId === selectedChainID)?.icon.url ?? ''
                            : supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.icon.url ?? ''
                    }
                    chainName={
                        data
                            ? data.find((detail) => detail.chainId === selectedChainID)?.name ?? ''
                            : supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.name ?? ''
                    }
                    classNameButton={classNameButton}
                    tokenAmount={xchainTokenAmount}
                    tokenPrice={xchainTokenPrice}
                    type={type}
                />
            )}
            <Modal
                visible={visible}
                onClose={() => {
                    setVisible(false)
                }}
                title={'Select Token'}
            >
                <div className="flex h-full w-full flex-col gap-4">
                    <div className="flex w-full flex-row gap-4">
                        <Search
                            className="w-full"
                            placeholder="Search by token name"
                            value={filterValue}
                            onChange={(e: any) => setFilterValue(e.target.value)}
                            onSubmit={() => console.log('Submit')}
                            medium
                            border
                        />
                        <ChainSelector chainsToDisplay={data} />
                    </div>

                    {filterValue.length > 2
                        ? tokenDisplay(_tokensToDisplay, setToken, balances, selectedChainID, type)
                        : simpleTokenDisplay(_tokensToDisplay, setToken)}
                </div>
            </Modal>
        </>
    )
}

export const simpleTokenDisplay = (tokens: interfaces.IToken[], setToken: (symbol: string) => void) => {
    return (
        <div className="flex flex-wrap gap-4">
            {tokens.slice(0, 6).map((token) => (
                <div
                    key={token.address + Math.random()}
                    className="flex w-max cursor-pointer flex-row items-center justify-center gap-1 border border-n-1 px-2 py-1 hover:bg-n-1/10 dark:border-white"
                    onClick={() => setToken(token.address)}
                >
                    <img src={token.logoURI} alt={token.symbol} className="h-6 w-6" />
                    <div className="text-h8">{token.symbol}</div>
                </div>
            ))}
        </div>
    )
}

export const tokenDisplay = (
    tokens: interfaces.IToken[],
    setToken: (symbol: string) => void,
    balances: interfaces.IUserBalance[],
    selectedChainID: string,
    type: 'send' | 'xchain' = 'send'
) => {
    return (
        <ul
            role="list"
            className="max-h-52 divide-y divide-black overflow-auto border border-black dark:divide-white dark:border-white"
        >
            {tokens.map((token) => (
                <li
                    key={token.address + Math.random()}
                    className="flex items-center justify-between gap-x-6 px-4 py-2 hover:bg-n-1/10"
                    onClick={() => {
                        setToken(token.address)
                    }}
                >
                    <div className="flex items-center justify-start gap-x-4">
                        <img className="h-6 w-6" src={token.logoURI} alt="" />
                        <div className="text-h8">{token.name}</div>
                    </div>
                    {type === 'send' && (
                        <p className="text-xs text-gray-1 ">
                            {utils.formatTokenAmount(
                                balances.find(
                                    (balance) =>
                                        balance.address === token.address && balance.chainId === selectedChainID
                                )?.amount,
                                4
                            )}
                        </p>
                    )}
                </li>
            ))}
        </ul>
    )
}

export default TokenSelector
