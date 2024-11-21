'use client'

import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import Modal from '../Modal'
import Search from '../Search'
import ChainSelector from '../ChainSelector'
import { useBalance } from '@/hooks/useBalance'
import { supportedPeanutChains, peanutTokenDetails } from '@/constants'
import * as context from '@/context'
import { areTokenAddressesEqual, formatTokenAmount } from '@/utils'
import { AdvancedTokenSelectorButton } from './Components'
import { IUserBalance, IToken } from '@/interfaces'

import { TokenSelectorProps } from './TokenSelector.consts'
import { useAccount } from 'wagmi'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useWalletType } from '@/hooks/useWalletType'
import Icon from '../Icon'
import { CrispButton } from '@/components/CrispChat'
import { interfaces } from '@squirrel-labs/peanut-sdk'
import Image from 'next/image'

const TokenList = ({ balances, setToken }: { balances: IUserBalance[]; setToken: (address: IUserBalance) => void }) => {
    const { selectedChainID, selectedTokenAddress, supportedSquidChainsAndTokens } = useContext(
        context.tokenSelectorContext
    )
    const [tokenPlaceholders, setTokenPlaceholders] = useState<{ [key: string]: boolean }>({})
    const [chainPlaceholders, setChainPlaceholders] = useState<{ [key: string]: boolean }>({})

    const containerRef = useRef<HTMLDivElement>(null)
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 10 })
    const ITEM_HEIGHT = 56

    const handleScroll = () => {
        if (!containerRef.current) return

        const element = containerRef.current
        const scrollTop = element.scrollTop
        const viewportHeight = element.clientHeight

        const start = Math.floor(scrollTop / ITEM_HEIGHT)
        const visibleCount = Math.ceil(viewportHeight / ITEM_HEIGHT)
        const end = Math.min(start + visibleCount + 3, balances.length)

        setVisibleRange({
            start: Math.max(0, start - 3),
            end,
        })
    }

    useEffect(() => {
        const element = containerRef.current
        if (element) {
            element.addEventListener('scroll', handleScroll)
            handleScroll()
            return () => element.removeEventListener('scroll', handleScroll)
        }
    }, [balances.length])

    if (balances.length === 0) {
        return <div className="w-full py-2 text-center">No balances to display!</div>
    }

    const topSpacerHeight = visibleRange.start * ITEM_HEIGHT
    const bottomSpacerHeight = (balances.length - visibleRange.end) * ITEM_HEIGHT

    return (
        <div ref={containerRef} className="overflow-auto">
            {topSpacerHeight > 0 && <div style={{ height: topSpacerHeight }} />}

            <div className="relative">
                {balances.slice(visibleRange.start, visibleRange.end).map((balance) => (
                    <div
                        key={`${balance.address}_${balance.chainId}`}
                        className={`flex h-14 cursor-pointer items-center transition-colors hover:bg-n-3/10 ${
                            areTokenAddressesEqual(balance.address, selectedTokenAddress) &&
                            balance.chainId === selectedChainID &&
                            'bg-n-3/10'
                        }`}
                        onClick={() => setToken(balance)}
                    >
                        <div className="w-16 py-2 pr-2">
                            <div className="flex flex-row items-center justify-center gap-2 pl-1">
                                <div className="relative h-6 w-6">
                                    {!balance.logoURI || tokenPlaceholders[`${balance.address}_${balance.chainId}`] ? (
                                        <Icon
                                            name="token_placeholder"
                                            className="absolute left-0 top-0 h-6 w-6"
                                            fill="#999"
                                        />
                                    ) : (
                                        <Image
                                            src={balance.logoURI}
                                            className="absolute left-0 top-0 h-6 w-6"
                                            alt={`${balance.name} logo`}
                                            width={24}
                                            height={24}
                                            unoptimized
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none'
                                                setTokenPlaceholders((prev) => ({
                                                    ...prev,
                                                    [`${balance.address}_${balance.chainId}`]: true,
                                                }))
                                            }}
                                        />
                                    )}
                                    {chainPlaceholders[`${balance.address}_${balance.chainId}`] ? (
                                        <Icon
                                            name="token_placeholder"
                                            className="absolute -top-1 left-3 h-4 w-4 rounded-full"
                                            fill="#999"
                                        />
                                    ) : (
                                        <img
                                            src={
                                                supportedSquidChainsAndTokens[balance.chainId]?.chainIconURI ??
                                                supportedPeanutChains.find((c) => c.chainId === balance.chainId)?.icon
                                                    .url
                                            }
                                            className="absolute -top-1 left-3 h-4 w-4 rounded-full"
                                            alt="logo"
                                            onError={(_e) => {
                                                setChainPlaceholders((prev) => ({
                                                    ...prev,
                                                    [`${balance.address}_${balance.chainId}`]: true,
                                                }))
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 py-2">
                            <div className="flex flex-col items-start justify-center gap-1">
                                <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                                    {balance.symbol}
                                </div>
                                <div className="text-h9 font-normal">
                                    {balance.amount ? formatTokenAmount(balance.amount) : ''}
                                </div>
                            </div>
                        </div>

                        <div className="w-24 py-2 text-h8">
                            {balance.value ? `$${formatTokenAmount(parseFloat(balance.value), 2)}` : balance.name}
                        </div>

                        <div className="w-32 py-2">
                            <div className="flex flex-row items-center justify-end gap-2 pr-1">
                                <div className="text-h8 text-gray-1">
                                    {supportedPeanutChains.find((chain) => chain.chainId === balance.chainId)?.name ??
                                        ''}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {bottomSpacerHeight > 0 && <div style={{ height: bottomSpacerHeight }} />}
        </div>
    )
}

const TokenSelector = ({
    classNameButton,
    shouldBeConnected = true,
    showOnlySquidSupported = false,
    onReset,
}: TokenSelectorProps) => {
    const [visible, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')
    const [selectedBalance, setSelectedBalance] = useState<IUserBalance | undefined>(undefined)
    const [hasUserChangedChain, setUserChangedChain] = useState(false)
    const focusButtonRef = useRef<HTMLButtonElement>(null)

    const { balances } = useBalance()
    const {
        selectedChainID,
        selectedTokenAddress,
        setSelectedTokenAddress,
        setSelectedChainID,
        isXChain,
        supportedSquidChainsAndTokens,
    } = useContext(context.tokenSelectorContext)
    const { isConnected } = useAccount()
    const { open } = useWeb3Modal()
    const { safeInfo, walletType } = useWalletType()

    const selectedChainTokens = useMemo(() => {
        let tokens: Array<interfaces.ISquidToken | IToken> =
            supportedSquidChainsAndTokens[selectedChainID]?.tokens || []
        if (!showOnlySquidSupported) {
            tokens = [
                ...tokens,
                ...(peanutTokenDetails.find((token) => token.chainId === selectedChainID)?.tokens || []).filter(
                    (token) => !tokens.find((t) => areTokenAddressesEqual(t.address, token.address))
                ),
            ]
        }
        return tokens.map((token) => ({
            ...token,
            chainId: selectedChainID,
            price: 0,
            amount: 0,
            currency: '',
            value: '',
        }))
    }, [selectedChainID, supportedSquidChainsAndTokens])

    const _balancesToDisplay = useMemo(() => {
        let balancesToDisplay: IUserBalance[]

        if (safeInfo && walletType === 'blockscout') {
            balancesToDisplay = balances.filter((balance) => balance.chainId.toString() === safeInfo.chainId.toString())
        } else {
            balancesToDisplay = balances
        }

        balancesToDisplay = [
            ...balancesToDisplay,
            ...selectedChainTokens.filter(
                //remove tokens that are already in the balances
                (token) =>
                    !balancesToDisplay.find(
                        (balance) =>
                            balance.chainId === token.chainId && areTokenAddressesEqual(balance.address, token.address)
                    )
            ),
        ]

        return balancesToDisplay
    }, [balances, safeInfo, selectedChainTokens, walletType])

    const filteredBalances = useMemo(() => {
        // initially show all balances and the tokens on the current chain
        if (filterValue.length === 0 && !hasUserChangedChain) return _balancesToDisplay

        const byChainAndText = ({ name, symbol, chainId }: IUserBalance): boolean =>
            // if the user has changed chains, only show tokens on the current chain
            // even if they have balances on other chains
            (!hasUserChangedChain || selectedChainID === chainId) &&
            // if the user has typed something, only show tokens that match
            (filterValue.length === 0 ||
                name.toLowerCase().includes(filterValue.toLowerCase()) ||
                symbol.toLowerCase().includes(filterValue.toLowerCase()))

        return _balancesToDisplay.filter(byChainAndText)
    }, [_balancesToDisplay, filterValue, selectedChainID, hasUserChangedChain])

    function setToken(balance: IUserBalance): void {
        setSelectedChainID(balance.chainId)
        setSelectedTokenAddress(balance.address)
        setSelectedBalance(balance)
        setVisible(false)
        setTimeout(() => {
            setFilterValue('')
            setUserChangedChain(false)
        }, 200) // the modal takes 200ms to close (duration-200 on leave)
    }

    useEffect(() => {
        if (focusButtonRef.current) {
            focusButtonRef.current.focus()
        }
    }, [visible])

    useEffect(() => {
        if (selectedBalance) return

        if (_balancesToDisplay.length > 0) {
            setSelectedBalance(
                _balancesToDisplay.find(
                    (balance) =>
                        areTokenAddressesEqual(balance.address, selectedTokenAddress) &&
                        balance.chainId === selectedChainID
                )
            )
        } else {
            setSelectedBalance(undefined)
        }
    }, [_balancesToDisplay, selectedTokenAddress, selectedChainID])

    const displayedChain = useMemo(() => {
        if (!selectedChainID) return undefined
        if (supportedSquidChainsAndTokens[selectedChainID]) {
            const chain = supportedSquidChainsAndTokens[selectedChainID]
            return {
                name: chain.axelarChainName,
                iconURI: chain.chainIconURI,
                chainId: chain.chainId,
            }
        } else {
            const chain = supportedPeanutChains.find((chain) => chain.chainId === selectedChainID)
            return {
                name: chain?.name,
                iconURI: chain?.icon.url,
                chainId: chain?.chainId,
            }
        }
    }, [selectedChainID, supportedSquidChainsAndTokens])

    return (
        <>
            <AdvancedTokenSelectorButton
                onClick={() => {
                    setVisible(!visible)
                }}
                isVisible={visible}
                tokenLogoUri={selectedBalance?.logoURI}
                tokenSymbol={selectedBalance?.symbol ?? ''}
                tokenBalance={selectedBalance?.amount}
                chainIconUri={displayedChain?.iconURI ?? ''}
                chainName={displayedChain?.name ?? ''}
                classNameButton={classNameButton}
                type={isXChain ? 'xchain' : 'send'}
                onReset={() => {
                    onReset?.()
                    setSelectedBalance(undefined)
                    setUserChangedChain(false)
                }}
            />

            <Modal
                visible={visible}
                onClose={async () => {
                    setVisible(false)
                    setUserChangedChain(false)
                }}
                title={'Select Token'}
                classNameWrapperDiv="px-2 pb-7 pt-8"
                classWrap="max-w-[32rem]"
            >
                {!isConnected && shouldBeConnected ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-2 ">
                        <label className="text-center text-h5">Connect a wallet to select a token to send.</label>
                        <button
                            className="btn btn-purple btn-xl w-full"
                            onClick={() => {
                                open()
                            }}
                        >
                            Connect Wallet
                        </button>
                        <div className="flex w-full flex-col gap-2 text-center text-h8 font-normal">
                            We support 30+ chains and 1000+ tokens.
                            <a
                                href="https://docs.peanut.to/learn/supported-chains-and-tokens"
                                target="_blank"
                                className="text-link-decoration font-medium"
                            >
                                See the full list
                            </a>
                        </div>
                    </div>
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
                            <ChainSelector
                                chainsToDisplay={
                                    showOnlySquidSupported
                                        ? supportedPeanutChains.filter(
                                              (chain) => !!supportedSquidChainsAndTokens[chain.chainId]
                                          )
                                        : supportedPeanutChains
                                }
                                onChange={(_chainId) => {
                                    setUserChangedChain(true)
                                }}
                            />
                        </div>
                        <div className="h-full max-h-96 w-full overflow-auto">
                            <TokenList balances={filteredBalances} setToken={setToken} />
                        </div>
                        <CrispButton className="cursor-pointer text-center text-h8 font-normal underline">
                            Chat with us if you want to add a custom token
                        </CrispButton>
                    </div>
                )}
            </Modal>
        </>
    )
}

export default TokenSelector
