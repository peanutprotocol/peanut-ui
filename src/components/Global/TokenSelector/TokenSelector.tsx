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
import { AdvancedTokenSelectorButton } from './Components'
import { IToken, IUserBalance } from '@/interfaces'

import * as _consts from './TokenSelector.consts'
import { useWeb3Modal } from '@web3modal/wagmi/react'
import { useWalletType } from '@/hooks/useWalletType'
import Icon from '../Icon'
import { CrispButton } from '@/components/CrispChat'
import { useWallet } from '@/context/walletContext'

const TokenList = ({ balances, setToken }: { balances: IUserBalance[]; setToken: (address: IUserBalance) => void }) => {
    const { selectedChainID, selectedTokenAddress } = useContext(context.tokenSelectorContext)
    const [tokenPlaceholders, setTokenPlaceholders] = useState<{ [key: string]: boolean }>({})
    const [chainPlaceholders, setChainPlaceholders] = useState<{ [key: string]: boolean }>({})

    return (
        <table className="w-full divide-y divide-black">
            <tbody className="divide-y divide-black bg-white">
                {balances.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="py-2 text-center">
                            No balances to display!
                        </td>
                    </tr>
                ) : (
                    balances.map((balance, idx) => (
                        <tr
                            key={idx}
                            className={`h-14 cursor-pointer gap-0 transition-colors hover:bg-n-3/10 ${utils.areTokenAddressesEqual(balance.address, selectedTokenAddress) && balance.chainId === selectedChainID && `bg-n-3/10`}`}
                            onClick={() => {
                                setToken(balance)
                            }}
                        >
                            <td className="py-2 pr-2">
                                <div className="flex flex-row items-center justify-center gap-2 pl-1">
                                    <div className="relative h-6 w-6">
                                        {tokenPlaceholders[`${balance.address}_${balance.chainId}`] ? (
                                            <Icon
                                                name="token_placeholder"
                                                className="absolute left-0 top-0 h-6 w-6"
                                                fill="#999"
                                            />
                                        ) : (
                                            <img
                                                src={balance.logoURI}
                                                className="absolute left-0 top-0 h-6 w-6"
                                                alt="logo"
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
                                                    consts.supportedPeanutChains.find(
                                                        (chain) => chain.chainId === balance.chainId
                                                    )?.icon.url
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
                            </td>
                            <td className="py-2">
                                <div className="flex flex-col items-start justify-center gap-1">
                                    <div className="inline-block w-full overflow-hidden overflow-ellipsis whitespace-nowrap text-start text-h8">
                                        {balance.symbol}
                                    </div>
                                    <div className="text-h9 font-normal">
                                        {balance.amount ? utils.formatTokenAmount(balance.amount) : ''}
                                    </div>
                                </div>
                            </td>
                            <td className="py-2 text-h8">
                                {balance.value
                                    ? `$${utils.formatTokenAmount(parseFloat(balance.value), 2)}`
                                    : balance.name}
                            </td>
                            <td className="y-2">
                                <div className="flex flex-row items-center justify-end gap-2 pr-1">
                                    <div className="text-h8 text-gray-1 ">
                                        {consts.supportedPeanutChains.find((chain) => chain.chainId === balance.chainId)
                                            ?.name ?? ''}
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    )
}

const TokenSelector = ({ classNameButton, shouldBeConnected = true, onReset }: _consts.TokenSelectorProps) => {
    const [visible, setVisible] = useState(false)
    const [filterValue, setFilterValue] = useState('')
    const [selectedBalance, setSelectedBalance] = useState<IUserBalance | undefined>(undefined)
    const [hasUserChangedChain, setUserChangedChain] = useState(false)
    const focusButtonRef = useRef<HTMLButtonElement>(null)

    const { balances } = useBalance()
    const { selectedChainID, selectedTokenAddress, setSelectedTokenAddress, setSelectedChainID, isXChain } = useContext(
        context.tokenSelectorContext
    )
    const { isConnected } = useWallet()
    const { open } = useWeb3Modal()
    const { safeInfo, walletType } = useWalletType()
    console.log(balances)

    const selectedChainTokens = useMemo(() => {
        return (
            peanutTokenDetails.find((token) => token.chainId === selectedChainID)?.tokens ||
            peanutTokenDetails[0].tokens
        ).map((token: IToken) => ({
            ...token,
            chainId: selectedChainID || token.chainId,
            price: 0,
            amount: 0,
            currency: '',
            value: '',
        }))
    }, [selectedChainID])

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
                            balance.chainId === token.chainId &&
                            utils.areTokenAddressesEqual(balance.address, token.address)
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
        if (_balancesToDisplay.length > 0) {
            setSelectedBalance(
                _balancesToDisplay.find(
                    (balance) =>
                        utils.areTokenAddressesEqual(balance.address, selectedTokenAddress) &&
                        balance.chainId === selectedChainID
                )
            )
        } else {
            setSelectedBalance(undefined)
        }
    }, [_balancesToDisplay, selectedTokenAddress, selectedChainID])

    const displayedChain = useMemo(
        () => supportedPeanutChains.find((chain) => chain.chainId === selectedChainID),
        [selectedChainID]
    )

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
                chainIconUri={displayedChain?.icon.url}
                chainName={displayedChain?.name ?? ''}
                classNameButton={classNameButton}
                type={isXChain ? 'xchain' : 'send'}
                onReset={() => {
                    onReset?.()
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
                                onSubmit={() => { }}
                                medium
                                border
                            />
                            <ChainSelector
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
