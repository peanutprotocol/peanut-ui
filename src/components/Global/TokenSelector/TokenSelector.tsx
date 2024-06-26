'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../Modal'
import Search from '../Search'
import ChainSelector from '../ChainSelector'
import { useBalance } from '@/hooks/useBalance'
import { peanutTokenDetails, supportedPeanutChains } from '@/constants'
import * as context from '@/context'
import * as utils from '@/utils'
import * as consts from '@/constants'
import * as components from './Components'

import * as _consts from './TokenSelector.consts'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useWalletType } from '@/hooks/useWalletType'

const TokenSelector = ({ classNameButton }: _consts.TokenSelectorProps) => {
    const [visible, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')
    const focusButtonRef = useRef<HTMLButtonElement>(null)
    const [showFallback, setShowFallback] = useState(false)

    const { balances } = useBalance()
    const { selectedChainID, selectedTokenAddress, setSelectedTokenAddress, setSelectedChainID } = useContext(
        context.tokenSelectorContext
    )
    const { isConnected } = useAccount()
    const { open } = useWeb3Modal()
    const { safeInfo } = useWalletType()

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

        if (safeInfo) {
            _tokens = _tokens.filter((token) => token.chainId === safeInfo.chainId)
        }

        return _tokens
    }, [filterValue, selectedChainID, balances])

    function setToken(address: string): void {
        setSelectedTokenAddress(address)
        setTimeout(() => {
            setFilterValue('')
            setShowFallback(false)
        }, 500)
        setVisible(false)
    }

    useEffect(() => {
        if (focusButtonRef.current) {
            focusButtonRef.current.focus()
        }
    }, [visible])

    return (
        <>
            <components.AdvancedTokenSelectorButton
                onClick={() => {
                    setVisible(!visible)
                }}
                isVisible={visible}
                tokenLogoUri={
                    _tokensToDisplay.find((token) => utils.compareTokenAddresses(token.address, selectedTokenAddress))
                        ?.logoURI ?? ''
                }
                tokenSymbol={
                    _tokensToDisplay.find((token) => utils.compareTokenAddresses(token.address, selectedTokenAddress))
                        ?.symbol ?? ''
                }
                tokenBalance={
                    balances.find(
                        (balance) =>
                            utils.compareTokenAddresses(balance.address, selectedTokenAddress) &&
                            balance.chainId === selectedChainID
                    )?.amount ?? 0
                }
                chainIconUri={supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.icon.url ?? ''}
                chainName={supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)?.name ?? ''}
                classNameButton={classNameButton}
            />

            <Modal
                visible={visible}
                onClose={async () => {
                    setVisible(false)
                    await new Promise(() =>
                        setTimeout(() => {
                            setShowFallback(false)
                        }, 1000)
                    )
                }}
                title={'Select Token'}
                classNameWrapperDiv="px-2 pb-7 pt-8"
                classWrap="max-w-[32rem]"
                showPrev={showFallback}
                onPrev={() => {
                    setShowFallback(false)
                }}
            >
                {!isConnected ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-2 ">
                        <label className="text-center text-h5">Connect a wallet to select a token to send.</label>
                        <button
                            className="btn btn-purple btn-xl w-full"
                            onClick={() => {
                                open()
                            }}
                        >
                            Create or Connect wallet
                        </button>
                        <div className="flex w-full flex-col gap-2 text-center text-h8 font-normal">
                            We support 30+ chains and 1000+ tokens.
                            <a
                                href="https://docs.peanut.to/learn/supported-chains-and-tokens"
                                target="_blank"
                                className="underline"
                            >
                                See the full list
                            </a>
                        </div>
                    </div>
                ) : !showFallback ? (
                    <div className="flex h-full w-full flex-col gap-4 px-2">
                        {/* <label className="text-center text-h5">Select a token to send</label> */}
                        <div className="h-full max-h-96 min-h-64 w-full overflow-auto">
                            <table className="w-full divide-y divide-black">
                                <tbody className="divide-y divide-black bg-white">
                                    {balances.length === 0
                                        ? [1, 2, 3, 4].map((_, idx) => (
                                              <tr key={idx}>
                                                  <td className="py-2">
                                                      <div className="h-6 w-6 animate-colorPulse rounded-full bg-slate-700" />
                                                  </td>
                                                  <td className="py-2">
                                                      <div className="h-6 w-22 animate-colorPulse rounded-full bg-slate-700" />
                                                  </td>
                                                  <td className="py-2">
                                                      <div className="h-6 w-18 animate-colorPulse rounded-full bg-slate-700" />
                                                  </td>
                                                  <td className=" py-2">
                                                      <div className="h-6 w-24 animate-colorPulse rounded-full bg-slate-700" />
                                                  </td>
                                              </tr>
                                          ))
                                        : balances.map((balance, idx) => (
                                              <tr
                                                  key={idx}
                                                  className={`h-14 cursor-pointer gap-0 transition-colors hover:bg-n-3/10 ${selectedTokenAddress === balance.address && selectedChainID === balance.chainId && `bg-n-3/10`}`}
                                                  onClick={() => {
                                                      setSelectedChainID(balance.chainId)
                                                      setToken(balance.address)
                                                  }}
                                              >
                                                  <td className="py-2 pr-2">
                                                      <div className="flex flex-row items-center justify-center gap-2 pl-1">
                                                          <div className="relative h-6 w-6">
                                                              <img
                                                                  src={balance.logoURI}
                                                                  className="absolute left-0 top-0 h-6 w-6"
                                                                  alt="logo"
                                                              />
                                                              <img
                                                                  src={
                                                                      consts.supportedPeanutChains.find(
                                                                          (chain) => chain.chainId === balance.chainId
                                                                      )?.icon.url
                                                                  }
                                                                  className="absolute -top-1 left-3 h-4 w-4 rounded-full" // Adjust `left-3` to control the overlap
                                                                  alt="logo"
                                                              />
                                                          </div>
                                                      </div>
                                                  </td>
                                                  <td className="py-2">
                                                      <div className="flex flex-col items-start justify-center gap-1">
                                                          <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                                                              {balance.symbol}
                                                          </div>
                                                          <div className="text-h9 font-normal">
                                                              {utils.formatTokenAmount(balance.amount)}
                                                          </div>
                                                      </div>
                                                  </td>
                                                  <td className="py-2 text-h8">
                                                      ${utils.formatTokenAmount(parseFloat(balance.value), 2)}
                                                  </td>
                                                  <td className="y-2">
                                                      <div className="flex flex-row items-center justify-end gap-2 pr-1">
                                                          <div className="text-h8 text-gray-1 ">
                                                              {consts.supportedPeanutChains.find(
                                                                  (chain) => chain.chainId === balance.chainId
                                                              )?.name ?? ''}
                                                          </div>
                                                      </div>
                                                  </td>
                                              </tr>
                                          ))}
                                </tbody>
                            </table>
                        </div>
                        {!safeInfo && (
                            <button
                                className="text-h8 font-normal underline"
                                onClick={() => {
                                    setShowFallback(true)
                                }}
                            >
                                Explore & buy more tokens
                            </button>
                        )}
                    </div> // TODO: create components out of this
                ) : (
                    <div className="flex h-full w-full flex-col gap-4 px-2">
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
                            <ChainSelector />
                        </div>

                        {filterValue.length > 0 &&
                            components.tokenDisplay(_tokensToDisplay, setToken, balances, selectedChainID)}
                        <a
                            className="cursor-pointer text-center text-h8 font-normal underline"
                            href="https://discord.gg/BX9Ak7AW28"
                            target="_blank"
                        >
                            Reach out if you want to add a custom token
                        </a>
                    </div>
                )}
            </Modal>
        </>
    )
}

export default TokenSelector
