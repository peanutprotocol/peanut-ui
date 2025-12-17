'use client'

import { Button } from '@/components/0_Bruddle/Button'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useWallet } from '@/hooks/wallet/useWallet'
import {
    createSmartDepositAddress,
    getDepositAddressHistory,
    getSupportedEvmChains,
    type BridgeTransaction,
    type RhinoDepositAddress,
    SupportedChains,
} from '@/services/rhino'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

type RhinoPocStep = 'loading' | 'depositAddresses' | 'monitoring' | 'error'

// Hardcoded supported tokens for the POC
const SUPPORTED_TOKENS = ['USDC', 'USDT']

// Chain display info - maps chain IDs to friendly names and icons
const CHAIN_DISPLAY_INFO: Record<string, { name: string; icon: string }> = {
    ETHEREUM: { name: 'Ethereum', icon: '⟠' },
    ARBITRUM_ONE: { name: 'Arbitrum', icon: '🔷' },
    BASE: { name: 'Base', icon: '🔵' },
    OPTIMISM: { name: 'Optimism', icon: '🔴' },
    MATIC_POS: { name: 'Polygon', icon: '🟣' },
    LINEA: { name: 'Linea', icon: '🟢' },
    SCROLL: { name: 'Scroll', icon: '📜' },
    ZKSYNC_ERA: { name: 'zkSync', icon: '⚡' },
    BNB_SMART_CHAIN: { name: 'BNB Chain', icon: '🟡' },
    AVALANCHE: { name: 'Avalanche', icon: '🔺' },
    GNOSIS: { name: 'Gnosis', icon: '🦉' },
    MANTLE: { name: 'Mantle', icon: '🟫' },
    MODE: { name: 'Mode', icon: '🟩' },
    TAIKO: { name: 'Taiko', icon: '🥁' },
    SOLANA: { name: 'Solana', icon: '◎' },
    TON: { name: 'TON', icon: '💎' },
    TRON: { name: 'Tron', icon: '🔻' },
    CELO: { name: 'Celo', icon: '🟢' },
    INK: { name: 'Ink', icon: '🖋️' },
    KAIA: { name: 'Kaia', icon: '🔹' },
    KATANA: { name: 'Katana', icon: '⚔️' },
    MANTA: { name: 'Manta', icon: '🐋' },
    METIS: { name: 'Metis', icon: '🌐' },
    MOONBEAM: { name: 'Moonbeam', icon: '🌙' },
    WORLDCHAIN: { name: 'World Chain', icon: '🌍' },
    STARKNET: { name: 'Starknet', icon: '⭐' },
    SONIC: { name: 'Sonic', icon: '🔊' },
}

const RhinoPocPage = () => {
    const router = useRouter()
    const { address: peanutWalletAddress, isConnected } = useWallet()

    const [currentStep, setCurrentStep] = useState<RhinoPocStep>('loading')
    const [depositAddresses, setDepositAddresses] = useState<RhinoDepositAddress[]>([])
    const [selectedAddress, setSelectedAddress] = useState<RhinoDepositAddress | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Monitoring state
    const [bridges, setBridges] = useState<BridgeTransaction[]>([])
    const [isPolling, setIsPolling] = useState(false)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Get chain display info with fallback
    const getChainInfo = (chainId: string) => {
        return CHAIN_DISPLAY_INFO[chainId] || { name: chainId, icon: '🔗' }
    }

    // Create deposit addresses for all supported chains on mount
    const initializeDepositAddresses = useCallback(async () => {
        if (!peanutWalletAddress) {
            setError('Wallet not connected')
            setCurrentStep('error')
            return
        }

        setCurrentStep('loading')
        setError(null)

        try {
            // Fetch all supported EVM chains from rhino SDK (filtered by type: "EVM")
            const evmChains = await getSupportedEvmChains()
            console.log('Rhino supported EVM chains:', evmChains)

            if (!evmChains || evmChains.length === 0) {
                throw new Error('No supported EVM chains available')
            }

            // Create deposit addresses for all EVM chains at once
            const result = await createSmartDepositAddress({
                depositChains: evmChains,
                destinationChain: SupportedChains.ARBITRUM_ONE,
                destinationAddress: peanutWalletAddress,
                addressNote: peanutWalletAddress, // To create unique address per user
            })

            if (result && result.length > 0) {
                setDepositAddresses(result)
                setSelectedAddress(result[0]) // Select first by default
                setCurrentStep('depositAddresses')
            } else {
                throw new Error('No deposit addresses returned')
            }
        } catch (err) {
            console.error('Failed to create deposit addresses:', err)
            setError(err instanceof Error ? err.message : 'Failed to create deposit addresses')
            setCurrentStep('error')
        }
    }, [peanutWalletAddress])

    // Poll for deposit history
    const pollDepositHistory = useCallback(async () => {
        if (!selectedAddress) return

        try {
            const history = await getDepositAddressHistory(selectedAddress.depositAddress, selectedAddress.depositChain)
            console.log('Deposit history:', history)

            if (history.bridges && history.bridges.length > 0) {
                setBridges(history.bridges)
            }
        } catch (err) {
            console.error('Failed to fetch deposit history:', err)
            // Don't set error, just log - polling will continue
        }
    }, [selectedAddress])

    // Start monitoring
    const startMonitoring = useCallback(() => {
        setCurrentStep('monitoring')
        setIsPolling(true)
        setBridges([])

        // Poll immediately
        pollDepositHistory()

        // Then poll every 5 seconds
        pollingIntervalRef.current = setInterval(() => {
            pollDepositHistory()
        }, 5000)
    }, [pollDepositHistory])

    // Stop monitoring
    const stopMonitoring = useCallback(() => {
        setIsPolling(false)
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
        }
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (isConnected && peanutWalletAddress) {
            initializeDepositAddresses()
        }
    }, [isConnected, peanutWalletAddress, initializeDepositAddresses])

    // Loading state while wallet connects
    if (!isConnected) {
        return <PeanutLoading />
    }

    // Loading step
    if (currentStep === 'loading') {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                <PeanutLoading />
                <p className="text-sm text-grey-1">Creating deposit addresses for all chains...</p>
            </div>
        )
    }

    // Error step
    if (currentStep === 'error') {
        return (
            <div className="flex h-full w-full flex-col justify-start gap-6 self-start">
                <NavHeader title="Rhino.fi POC" onPrev={() => router.back()} />

                <div className="flex flex-col items-center gap-4 px-4 py-8">
                    <div className="text-4xl">⚠️</div>
                    <h2 className="text-red-500 text-lg font-bold">Error</h2>
                    <p className="text-center text-sm text-grey-1">{error}</p>
                    <Button variant="dark" onClick={initializeDepositAddresses} className="mt-4">
                        Try Again
                    </Button>
                </div>
            </div>
        )
    }

    // Monitoring step - poll for deposits
    if (currentStep === 'monitoring' && selectedAddress) {
        const chainInfo = getChainInfo(selectedAddress.depositChain)

        return (
            <div className="flex h-full w-full flex-col justify-start gap-4 self-start pb-5">
                <NavHeader
                    title="Monitoring Deposits"
                    onPrev={() => {
                        stopMonitoring()
                        setCurrentStep('depositAddresses')
                    }}
                />

                <div className="flex flex-col gap-4 px-1">
                    {/* Status card */}
                    <Card className="flex flex-col gap-3 p-4" position="single">
                        <div className="flex items-center gap-2">
                            <div
                                className={`h-3 w-3 rounded-full ${isPolling ? 'animate-pulse bg-green-500' : 'bg-grey-3'}`}
                            />
                            <span className="text-sm font-medium">
                                {isPolling ? 'Listening for deposits...' : 'Monitoring paused'}
                            </span>
                        </div>
                        <div className="text-xs text-grey-1">
                            <p>
                                Chain: {chainInfo.icon} {chainInfo.name}
                            </p>
                            <p className="mt-1 truncate font-mono">Address: {selectedAddress.depositAddress}</p>
                        </div>
                    </Card>

                    {/* Deposit instructions */}
                    <Card className="flex flex-col gap-2 border-yellow-200 bg-yellow-50 p-4" position="single">
                        <h3 className="text-sm font-semibold">📋 Test Instructions</h3>
                        <ol className="list-inside list-decimal space-y-1 text-xs text-grey-1">
                            <li>Copy the deposit address above</li>
                            <li>Send USDC or USDT from {chainInfo.name}</li>
                            <li>Watch for the transaction to appear below</li>
                            <li>Funds will be bridged to Arbitrum automatically</li>
                        </ol>
                    </Card>

                    {/* QR Code for easy deposit */}
                    <div className="flex items-center justify-center">
                        <QRCodeWrapper url={selectedAddress.depositAddress} />
                    </div>

                    {/* Copy address */}
                    <Card className="flex items-center gap-2 px-4 py-3" position="single">
                        <p className="min-w-0 flex-1 truncate font-mono text-xs">{selectedAddress.depositAddress}</p>
                        <CopyToClipboard
                            textToCopy={selectedAddress.depositAddress}
                            className="text-black"
                            iconSize="4"
                        />
                    </Card>

                    {/* Bridge transactions */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-bold">Detected Deposits ({bridges.length})</h3>

                        {bridges.length === 0 ? (
                            <Card className="p-4 text-center" position="single">
                                <p className="text-sm text-grey-1">No deposits detected yet...</p>
                                <p className="mt-1 text-xs text-grey-2">Polling every 5 seconds</p>
                            </Card>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {bridges.map((bridge) => (
                                    <Card key={bridge._id} className="flex flex-col gap-2 p-4" position="single">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold">{bridge.tokenSymbol}</span>
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                                    bridge._tag === 'accepted'
                                                        ? 'bg-green-100 text-green-700'
                                                        : bridge._tag === 'pending'
                                                          ? 'bg-yellow-100 text-yellow-700'
                                                          : bridge._tag === 'failed'
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-grey-3 text-grey-1'
                                                }`}
                                            >
                                                {bridge._tag}
                                            </span>
                                        </div>
                                        <div className="text-xs text-grey-1">
                                            <p>
                                                Amount: {bridge.amount} (${bridge.amountUsd?.toFixed(2) || '?'})
                                            </p>
                                            <p className="truncate">From: {bridge.sender}</p>
                                            {bridge.txHash && <p className="truncate">Tx: {bridge.txHash}</p>}
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="mt-2 flex gap-2">
                        <Button
                            shadowSize="4"
                            variant="stroke"
                            onClick={() => {
                                if (isPolling) {
                                    stopMonitoring()
                                } else {
                                    setIsPolling(true)
                                    pollingIntervalRef.current = setInterval(pollDepositHistory, 5000)
                                    pollDepositHistory()
                                }
                            }}
                            className="flex-1"
                        >
                            {isPolling ? '⏸️ Pause' : '▶️ Resume'}
                        </Button>
                        <Button
                            shadowSize="4"
                            variant="purple"
                            onClick={() => {
                                stopMonitoring()
                                router.push('/home')
                            }}
                            className="flex-1"
                        >
                            Finish
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // Deposit addresses display
    if (currentStep === 'depositAddresses' && depositAddresses.length > 0) {
        return (
            <div className="flex h-full w-full flex-col justify-start gap-4 self-start pb-5">
                <NavHeader title="Rhino.fi POC" onPrev={() => router.back()} />

                <div className="flex flex-col gap-4 px-1">
                    {/* Info card */}
                    <Card className="flex flex-col gap-2 p-4" position="single">
                        <h3 className="text-sm font-semibold">Smart Deposit Addresses</h3>
                        <p className="text-xs text-grey-1">
                            Send tokens from any of the {depositAddresses.length} supported chains below. They will be
                            automatically bridged to your Arbitrum wallet.
                        </p>
                    </Card>

                    {/* Chain tabs */}
                    <div className="flex flex-wrap gap-2">
                        {depositAddresses.map((addr) => {
                            const chainInfo = getChainInfo(addr.depositChain)
                            const isSelected = selectedAddress?.depositChain === addr.depositChain
                            return (
                                <button
                                    key={addr.depositChain}
                                    onClick={() => setSelectedAddress(addr)}
                                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                                        isSelected ? 'bg-black text-white' : 'bg-grey-4 text-grey-1 hover:bg-grey-3'
                                    }`}
                                >
                                    <span>{chainInfo.icon}</span>
                                    <span>{chainInfo.name}</span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Selected address details */}
                    {selectedAddress && (
                        <>
                            {/* QR Code */}
                            <div className="flex items-center justify-center">
                                <QRCodeWrapper url={selectedAddress.depositAddress} />
                            </div>

                            {/* Deposit Address */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold">
                                    Deposit Address ({getChainInfo(selectedAddress.depositChain).name})
                                </label>
                                <Card className="flex items-center gap-2 px-4 py-3" position="single">
                                    <p className="min-w-0 flex-1 truncate font-mono text-xs">
                                        {selectedAddress.depositAddress}
                                    </p>
                                    <CopyToClipboard
                                        textToCopy={selectedAddress.depositAddress}
                                        className="text-black"
                                        iconSize="4"
                                    />
                                </Card>
                            </div>

                            {/* Hardcoded supported tokens */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold">Supported Tokens</label>
                                <Card className="flex flex-wrap gap-2 p-4" position="single">
                                    {SUPPORTED_TOKENS.map((token) => (
                                        <span
                                            key={token}
                                            className="rounded-full bg-grey-4 px-3 py-1 text-xs font-medium"
                                        >
                                            {token}
                                        </span>
                                    ))}
                                </Card>
                            </div>

                            {/* Status info */}
                            <Card className="flex flex-col gap-2 p-4" position="single">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-grey-1">Status</span>
                                    <span className={selectedAddress.isActive ? 'text-green-500' : 'text-red-500'}>
                                        {selectedAddress.isActive ? '● Active' : '● Inactive'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-grey-1">Bridges to</span>
                                    <span className="font-medium">🔷 {selectedAddress.destinationChain}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-grey-1">Your Wallet</span>
                                    <span className="font-mono text-xs">
                                        {selectedAddress.destinationAddress.slice(0, 6)}...
                                        {selectedAddress.destinationAddress.slice(-4)}
                                    </span>
                                </div>
                            </Card>
                        </>
                    )}

                    <Button variant="purple" onClick={startMonitoring} className="mt-2" shadowSize="4">
                        I sent tokens - Monitor for deposits
                    </Button>
                </div>
            </div>
        )
    }

    return null
}

export default RhinoPocPage
