'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import borderCloud from '@/assets/illustrations/border-cloud.svg'
import noHiddenFees from '@/assets/illustrations/no-hidden-fees.svg'
import { Star } from '@/assets'
import Image from 'next/image'
import { Button } from '../0_Bruddle'
import CurrencySelect from './CurrencySelect'
import { Icon } from '../Global/Icons/Icon'
import { useDebounce } from '@/hooks/useDebounce'
import { useSearchParams, useRouter } from 'next/navigation'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'

export function NoFees() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)

    // Get values from URL or use defaults
    const sourceCurrency = searchParams.get('from') || 'USD'
    const destinationCurrency = searchParams.get('to') || 'EUR'
    const urlSourceAmount = parseFloat(searchParams.get('amount') || '10') || 10

    // Local state for immediate UI updates (amount input)
    const [localSourceAmount, setLocalSourceAmount] = useState(urlSourceAmount)
    const [destinationAmount, setDestinationAmount] = useState(0)
    const [currentExchangeRate, setCurrentExchangeRate] = useState(0)

    // Use local amount for immediate display, URL amount for API calls
    const sourceAmount = localSourceAmount
    const debouncedSourceAmount = useDebounce(localSourceAmount, 300)

    // Function to update URL parameters
    const updateUrlParams = useCallback(
        (params: { from?: string; to?: string; amount?: number }) => {
            const newSearchParams = new URLSearchParams(searchParams.toString())

            if (params.from) newSearchParams.set('from', params.from)
            if (params.to) newSearchParams.set('to', params.to)
            if (params.amount !== undefined) newSearchParams.set('amount', params.amount.toString())

            router.replace(`?${newSearchParams.toString()}`, { scroll: false })
        },
        [searchParams, router]
    )

    // Setter functions that update URL
    const setSourceCurrency = useCallback(
        (currency: string) => {
            updateUrlParams({ from: currency })
        },
        [updateUrlParams]
    )

    const setDestinationCurrency = useCallback(
        (currency: string) => {
            updateUrlParams({ to: currency })
        },
        [updateUrlParams]
    )

    const setSourceAmount = useCallback((amount: number) => {
        setLocalSourceAmount(amount) // Immediate UI update
    }, [])

    // Sync URL amount with local amount when URL changes
    useEffect(() => {
        setLocalSourceAmount(urlSourceAmount)
    }, [urlSourceAmount])

    // Debounced URL update for amount
    useEffect(() => {
        if (debouncedSourceAmount !== urlSourceAmount) {
            updateUrlParams({ amount: debouncedSourceAmount })
        }
    }, [debouncedSourceAmount, urlSourceAmount, updateUrlParams])

    useEffect(() => {
        const handleResize = () => {
            setScreenWidth(window.innerWidth)
        }

        handleResize()
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const createCloudAnimation = (side: 'left' | 'right', top: string, width: number, speed: number) => {
        const vpWidth = screenWidth || 1080
        const totalDistance = vpWidth + width

        return {
            initial: { x: side === 'left' ? -width : vpWidth },
            animate: { x: side === 'left' ? vpWidth : -width },
            transition: {
                ease: 'linear',
                duration: totalDistance / speed,
                repeat: Infinity,
            },
        }
    }

    const sourceCurrencyFlag = useMemo(
        () => countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.flagCode,
        [sourceCurrency]
    )

    const destinationCurrencyFlag = useMemo(
        () => countryCurrencyMappings.find((currency) => currency.currencyCode === destinationCurrency)?.flagCode,
        [destinationCurrency]
    )

    useEffect(() => {
        const fetchExchangeRate = async () => {
            const _sourceCurrency = sourceCurrency
            const _destinationCurrency = destinationCurrency
            const response = await fetch(`/api/exchange-rate?from=${_sourceCurrency}&to=${_destinationCurrency}`)
            const data = await response.json()
            setCurrentExchangeRate(data.rate)
            setDestinationAmount(debouncedSourceAmount * data.rate)
        }

        fetchExchangeRate()
    }, [sourceCurrency, destinationCurrency, debouncedSourceAmount])

    return (
        <section className="relative overflow-hidden bg-secondary-3 px-4 py-24 md:py-14">
            <div className="absolute left-0 top-0 h-full w-full overflow-hidden">
                {/* Animated clouds */}
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute left-0"
                    style={{ top: '20%', width: 200 }}
                    {...createCloudAnimation('left', '20%', 200, 35)}
                />
                <motion.img
                    src={borderCloud.src}
                    alt="Floating Border Cloud"
                    className="absolute right-0"
                    style={{ top: '60%', width: 220 }}
                    {...createCloudAnimation('right', '60%', 220, 40)}
                />
            </div>

            <div className="relative mx-auto max-w-3xl text-center">
                {/* Animated stars */}
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-36 -top-12"
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.2 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-58 top-30"
                    initial={{ opacity: 0, translateY: 28, translateX: -5, rotate: -17 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -17 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.4 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -right-0 -top-16 md:top-58"
                    initial={{ opacity: 0, translateY: 20, translateX: 5, rotate: 22 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: 22 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.6 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -left-36 -top-20"
                    initial={{ opacity: 0, translateY: 15, translateX: -5, rotate: -7 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -7 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.8 }}
                />
                <motion.img
                    src={Star.src}
                    alt="Floating Star"
                    width={50}
                    height={50}
                    className="absolute -bottom-6 -left-10"
                    initial={{ opacity: 0, translateY: 25, translateX: -5, rotate: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0, rotate: -5 }}
                    transition={{ type: 'spring', damping: 5, delay: 1.0 }}
                />

                <h1 className="font-roboto-flex-extrabold text-heading text-black md:text-headingMedium">ZERO FEES</h1>

                {/* No hidden fees SVG */}
                <div className="mb-1">
                    <Image
                        src={noHiddenFees}
                        alt="Really, we mean zero. No hidden fees"
                        width={600}
                        height={150}
                        className="mx-auto h-auto w-full max-w-xs md:max-w-md"
                    />
                </div>

                <div className="btn btn-shadow-primary-4 mx-auto mt-12 flex h-fit w-full flex-col items-center justify-center gap-4 bg-white p-7 md:w-[420px]">
                    <div className="w-full">
                        <h2 className="text-left text-sm">You Send</h2>
                        <div className="btn btn-shadow-primary-4 mt-2 flex w-full items-center justify-center gap-4 bg-white p-4">
                            <input
                                min={0}
                                value={sourceAmount}
                                onChange={(e) => {
                                    const value = parseFloat(e.target.value)
                                    setSourceAmount(isNaN(value) || value < 0 ? 0 : value)
                                }}
                                type="number"
                                className="w-full bg-transparent outline-none"
                            />
                            <CurrencySelect
                                selectedCurrency={sourceCurrency}
                                setSelectedCurrency={setSourceCurrency}
                                excludeCurrencies={[destinationCurrency]}
                                trigger={
                                    <button className="flex w-32 items-center gap-2">
                                        <Image
                                            src={`https://flagcdn.com/w320/${sourceCurrencyFlag}.png`}
                                            alt={`${sourceCurrencyFlag} flag`}
                                            width={160}
                                            height={160}
                                            className="size-4 rounded-full object-cover"
                                        />
                                        {sourceCurrency} <Icon name="chevron-down" className="text-gray-1" size={10} />
                                    </button>
                                }
                            />
                        </div>
                    </div>

                    <div className="w-full">
                        <h2 className="text-left text-sm">Recipient gets</h2>
                        <div className="btn btn-shadow-primary-4 mt-2 flex w-full items-center justify-center gap-4 bg-white p-4">
                            <input
                                value={destinationAmount.toFixed(2)}
                                readOnly
                                type="number"
                                className="w-full bg-transparent outline-none"
                            />
                            <CurrencySelect
                                selectedCurrency={destinationCurrency}
                                setSelectedCurrency={setDestinationCurrency}
                                excludeCurrencies={[sourceCurrency]}
                                trigger={
                                    <button className="flex w-32 items-center gap-2">
                                        <Image
                                            src={`https://flagcdn.com/w320/${destinationCurrencyFlag}.png`}
                                            alt={`${destinationCurrencyFlag} flag`}
                                            width={160}
                                            height={160}
                                            className="size-4 rounded-full object-cover"
                                        />
                                        {destinationCurrency}{' '}
                                        <Icon name="chevron-down" className="text-gray-1" size={10} />
                                    </button>
                                }
                            />
                        </div>
                    </div>

                    {destinationAmount > 0 && (
                        <div className="rounded-full bg-grey-4 px-2 py-[2px] text-xs font-bold text-gray-1">
                            1 {sourceCurrency} = {currentExchangeRate.toFixed(2)} {destinationCurrency}
                        </div>
                    )}

                    {destinationAmount > 0 && (
                        <div className="flex w-full flex-col gap-3 rounded-sm border-[1.15px] border-black px-4 py-2">
                            <div className="flex items-center justify-between">
                                <h2 className="text-left text-sm font-normal">Bank fee</h2>
                                <h2 className="text-left text-sm font-normal">Free!</h2>
                            </div>

                            <div className="flex items-center justify-between">
                                <h2 className="text-left text-sm font-normal">Peanut fee</h2>
                                <h2 className="text-left text-sm font-normal">Free!</h2>
                            </div>
                        </div>
                    )}

                    <Button
                        onClick={() => router.push('/setup')}
                        icon="arrow-up-right"
                        iconSize={13}
                        shadowSize="4"
                        className="w-full text-base font-bold"
                    >
                        Send Money
                    </Button>
                </div>
            </div>
        </section>
    )
}
