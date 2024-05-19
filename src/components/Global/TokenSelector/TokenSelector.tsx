'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../Modal'
import Search from '../Search'
import ChainSelector from '../ChainSelector'
import { useBalance } from '@/hooks/useBalance'
import { peanutTokenDetails, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import * as utils from '@/utils'
import * as components from './Components'
import * as _consts from './TokenSelector.consts'

const TokenSelector = ({ classNameButton, simpleButton = false }: _consts.TokenSelectorProps) => {
    const [visible, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')
    const focusButtonRef = useRef<HTMLButtonElement>(null)

    const { balances } = useBalance()
    const { selectedChainID, selectedTokenAddress, setSelectedTokenAddress } = useContext(context.tokenSelectorContext)

    const _tokensToDisplay = useMemo(() => {
        let _tokens

        _tokens = peanutTokenDetails.find((detail) => detail.chainId === selectedChainID)?.tokens || []

        // Add all tokens the user has balances on (per chain)
        if (balances.length > 0) {
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
        if (filterValue && filterValue.length > 0) {
            _tokens = _tokens.filter(
                (token) =>
                    token.name.toLowerCase().includes(filterValue.toLowerCase()) ||
                    token.symbol.toLowerCase().includes(filterValue.toLowerCase())
            )
        }

        return _tokens
    }, [filterValue, selectedChainID])

    function setToken(address: string): void {
        setSelectedTokenAddress(address)
        setTimeout(() => {
            setFilterValue('')
        }, 1000)
        setVisible(false)
    }

    useEffect(() => {
        if (focusButtonRef.current) {
            focusButtonRef.current.focus()
        }
    }, [visible])

    return (
        <>
            {simpleButton ? (
                <components.SimpleTokenSelectorButton
                    onClick={() => {
                        setVisible(!visible)
                    }}
                    isVisible={visible}
                />
            ) : (
                <components.AdvancedTokenSelectorButton
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
                        supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.icon.url ?? ''
                    }
                    chainName={supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.name ?? ''}
                    classNameButton={classNameButton}
                />
            )}
            <Modal
                visible={visible}
                onClose={() => {
                    setVisible(false)
                }}
                title={'Select Token'}
                classNameWrapperDiv="px-5 pb-7 pt-8"
            >
                <div className="flex h-full w-full flex-col gap-4">
                    <div className="flex w-full flex-row gap-4">
                        <button className="sr-only" autoFocus ref={focusButtonRef} />
                        <Search
                            className="w-full"
                            placeholder="Search by token name"
                            value={filterValue}
                            onChange={(e: any) => setFilterValue(e.target.value)}
                            onSubmit={() => console.log('Submit')}
                            medium
                            border
                        />
                        <ChainSelector />
                    </div>

                    {filterValue.length > 0
                        ? components.tokenDisplay(_tokensToDisplay, setToken, balances, selectedChainID)
                        : components.simpleTokenDisplay(_tokensToDisplay, setToken)}
                </div>
            </Modal>
        </>
    )
}

export default TokenSelector
