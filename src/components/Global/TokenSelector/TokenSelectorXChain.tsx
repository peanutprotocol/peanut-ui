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
import * as consts from '@/constants'
import Icon from '../Icon'

const TokenSelectorXChain = ({
    classNameButton,
    data,
    xchainTokenAmount,
    xchainTokenPrice,
    staticData,
}: _consts.TokenSelectorXChainProps) => {
    const [visible, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')
    const focusButtonRef = useRef<HTMLButtonElement>(null)

    const { balances } = useBalance()
    const { selectedChainID, selectedTokenAddress, setSelectedTokenAddress, setRefetchXchainRoute } = useContext(
        context.tokenSelectorContext
    )

    const _tokensToDisplay = useMemo(() => {
        let _tokens
        if (data) {
            _tokens = data.find((detail) => detail.chainId === selectedChainID)?.tokens || []
        } else {
            _tokens = peanutTokenDetails.find((detail) => detail.chainId === selectedChainID)?.tokens || []
        }

        //Filtering on name and symbol
        if (filterValue && filterValue.length > 0) {
            _tokens = _tokens.filter(
                (token) =>
                    token.name.toLowerCase().includes(filterValue.toLowerCase()) ||
                    token.symbol.toLowerCase().includes(filterValue.toLowerCase())
            )
            return _tokens
        }

        console.log(_tokens)
        console.log(selectedTokenAddress)

        //only return the first 6 tokens if not filtering
        return _tokens // TODO: fix styling to be three three and bigger (same size no matter of symbol)
    }, [filterValue, selectedChainID])

    function setToken(address: string): void {
        setRefetchXchainRoute(true)
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
            <div
                className={`flex h-14 w-full max-w-96  cursor-pointer flex-row items-center justify-between border border-n-1 px-4 py-2 dark:border-white  ${classNameButton}`}
                onClick={() => {
                    setVisible(!visible)
                }}
            >
                <div className={'flex flex-row items-center justify-center gap-2'}>
                    <img
                        src={
                            staticData
                                ? consts.peanutTokenDetails
                                      .find((detail) => detail.chainId === staticData.chainId)
                                      ?.tokens.find((token) =>
                                          utils.compareTokenAddresses(token.address, staticData.tokenAddress)
                                      )?.logoURI ??
                                  _tokensToDisplay.find((token) =>
                                      utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                  )?.logoURI ??
                                  ''
                                : _tokensToDisplay.find((token) =>
                                      utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                  )?.logoURI ?? ''
                        }
                        alt={''}
                        className="h-6 w-6"
                    />
                    <div className="flex flex-col items-start justify-center gap-1">
                        <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                            {staticData
                                ? staticData.tokenAmount
                                : xchainTokenAmount && utils.formatTokenAmount(Number(xchainTokenAmount) ?? 0)}{' '}
                            {staticData
                                ? staticData.tokenSymbol
                                : _tokensToDisplay.find((token) =>
                                      utils.compareTokenAddresses(token.address, selectedTokenAddress)
                                  )?.symbol ?? ''}
                        </div>
                        {!staticData && (
                            <p className="text-xs text-gray-1">
                                ${utils.formatTokenAmount(Number(xchainTokenAmount ?? 0) * (xchainTokenPrice ?? 0), 4)}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex flex-row items-center justify-center gap-2">
                    <div className="text-h8 text-gray-1 ">
                        {staticData
                            ? supportedPeanutChains.find((chain) => chain.chainId === staticData.chainId)?.name ??
                              data?.find((chain) => chain.chainId === selectedChainID)?.name ??
                              ''
                            : supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.name ?? ''}
                    </div>
                    <img
                        src={
                            staticData
                                ? supportedPeanutChains.find((chain) => chain.chainId === staticData.chainId)?.icon
                                      .url ??
                                  data?.find((chain) => chain.chainId === selectedChainID)?.icon.url ??
                                  ''
                                : supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.icon.url ??
                                  ''
                        }
                        alt={''}
                        className="h-6 w-6"
                    />
                    <div className="hidden sm:block">
                        <Icon
                            name={'arrow-bottom'}
                            className={`transition-transform dark:fill-white ${visible ? 'rotate-180 ' : ''}`}
                        />
                    </div>
                </div>
            </div>
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
                        <ChainSelector chainsToDisplay={data} />
                    </div>

                    {filterValue.length > 0
                        ? components.tokenDisplay(_tokensToDisplay, setToken, balances, selectedChainID)
                        : components.simpleTokenDisplay(_tokensToDisplay, setToken)}
                </div>
            </Modal>
        </>
    )
}

export default TokenSelectorXChain
