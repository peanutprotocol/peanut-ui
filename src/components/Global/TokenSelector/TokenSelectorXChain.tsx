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
    tokenSymbol,
    chainName,
    tokenLogoUrl,
    chainLogoUrl,
    tokenAmount,
    isLoading,
    routeError,
    routeFound,
    onReset,
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
            <div>
                <button
                    className={` flex h-12 w-72 max-w-96  cursor-pointer  flex-row items-center justify-between border border-n-1 px-4 py-2 hover:bg-n-3/10 disabled:cursor-not-allowed disabled:hover:bg-white dark:border-white  ${classNameButton} ${routeError ? 'border-red' : 'border-n-1'}`}
                    onClick={() => {
                        !routeFound && setVisible(true)
                    }}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <div className={'flex flex-row items-center justify-center gap-4'}>
                            <div className="relative h-6 w-6">
                                <div className="absolute left-0 top-0 h-6 w-6 animate-colorPulse rounded-full bg-slate-700" />
                                <div className="absolute -top-1 left-3 h-4 w-4 animate-colorPulse rounded-full rounded-full bg-slate-700" />
                            </div>
                            <div className="h-3 w-52 animate-colorPulse rounded-full bg-slate-700"></div>
                        </div>
                    ) : (
                        <>
                            <div className={'flex flex-row items-center justify-center gap-4'}>
                                <div className="relative h-6 w-6">
                                    <img
                                        src={tokenLogoUrl}
                                        className="absolute left-0 top-0 h-6 w-6 rounded-full"
                                        alt="logo"
                                    />
                                    <img
                                        src={chainLogoUrl}
                                        className="absolute -top-1 left-3 h-4 w-4  rounded-full"
                                        alt="logo"
                                    />
                                </div>
                                <div className="flex flex-col items-start justify-center gap-1">
                                    <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                                        {tokenAmount && tokenAmount} {tokenSymbol} on {chainName}
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-row items-center justify-center gap-2">
                                {!routeFound ? (
                                    <div className="block">
                                        <Icon
                                            name={'arrow-bottom'}
                                            className={`h-8 w-8 transition-transform dark:fill-white ${visible ? 'rotate-180 ' : ''}`}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="block"
                                        onClick={() => {
                                            onReset && onReset()
                                        }}
                                    >
                                        <Icon
                                            name={'close'}
                                            className={`h-8 w-8 transition-transform dark:fill-white`}
                                        />
                                    </div>
                                )}
                            </div>{' '}
                        </>
                    )}
                </button>
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
                            onSubmit={() => {}}
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
