import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchDisplayRate, FxApiError } from '@/utils/fx.utils'
import { PEANUT_WALLET_TOKEN_DECIMALS } from '@/constants/wallet-token.consts'

type InputValue = number | ''

/**
 * The source amount a caller wants the NEXT pair change to start from, as a
 * fresh object per request: identity says "new intent", the value says what
 * (a number, or '' for a deliberately empty field).
 */
type SourceAmountIntent = { value: InputValue }

// A source derived from a typed destination is rounded UP at the wallet
// token's precision, so the amount that would be sent always funds what was
// asked for (0.17 USD × 5.8 = 0.986 BRL; 0.172414 USD funds 1 BRL).
const SOURCE_SCALE = 10 ** PEANUT_WALLET_TOKEN_DECIMALS
const ceilToSourcePrecision = (value: number) => Math.ceil(value * SOURCE_SCALE - 1e-6) / SOURCE_SCALE

interface UseExchangeRateProps {
    sourceCurrency: string
    destinationCurrency: string
    initialSourceAmount?: number
    /** A pair change with a fresh intent starts from its value; without one, from `initialSourceAmount`. */
    sourceAmountIntent?: SourceAmountIntent
    enabled?: boolean
}

interface UseExchangeRateReturn {
    sourceAmount: InputValue
    destinationAmount: InputValue
    destinationInputValue: string
    exchangeRate: number
    isLoading: boolean
    isError: boolean
    handleSourceAmountChange: (amount: InputValue) => void
    handleDestinationAmountChange: (inputValue: string, amount: InputValue) => void
    getDestinationDisplayValue: () => string
}

const isValidAmount = (amount: InputValue): amount is number => typeof amount === 'number' && amount > 0

export function useExchangeRate({
    sourceCurrency,
    destinationCurrency,
    initialSourceAmount = 10,
    sourceAmountIntent,
    enabled = true,
}: UseExchangeRateProps): UseExchangeRateReturn {
    // What the user typed on each side, and which side was typed last. Both
    // amounts are derived from these and the current rate at render time —
    // never stored by an effect, so no render can pair one pair's amount with
    // another pair's rate (TASK-21369).
    const [sourceInput, setSourceInput] = useState<InputValue>(initialSourceAmount)
    const [destinationInput, setDestinationInput] = useState<{ text: string; amount: InputValue }>({
        text: '',
        amount: '',
    })
    const [lastEditedField, setLastEditedField] = useState<'source' | 'destination' | null>(null)

    // A new pair restarts from the source side; a new amount alone replaces
    // the source input. Adjusted during render so no frame shows the old
    // inputs against the new pair.
    const [seen, setSeen] = useState({ sourceCurrency, destinationCurrency, initialSourceAmount, sourceAmountIntent })
    if (seen.sourceCurrency !== sourceCurrency || seen.destinationCurrency !== destinationCurrency) {
        const fresh = sourceAmountIntent !== undefined && sourceAmountIntent !== seen.sourceAmountIntent
        setSeen({ sourceCurrency, destinationCurrency, initialSourceAmount, sourceAmountIntent })
        setSourceInput(fresh ? sourceAmountIntent.value : initialSourceAmount)
        setDestinationInput({ text: '', amount: '' })
        setLastEditedField(null)
    } else if (seen.initialSourceAmount !== initialSourceAmount) {
        setSeen({ ...seen, initialSourceAmount })
        setSourceInput(initialSourceAmount)
    }

    // Handlers
    const handleSourceAmountChange = useCallback((amount: InputValue) => {
        setSourceInput(amount)
        setLastEditedField('source')
    }, [])

    const handleDestinationAmountChange = useCallback((inputValue: string, amount: InputValue) => {
        setDestinationInput({ text: inputValue, amount })
        setLastEditedField('destination')
    }, [])

    // Client-side cached exchange rate (5 minutes)
    const {
        data: rateData,
        // v5 isLoading = pending && fetching — pair changes still show the
        // skeleton, background refetches don't flash it over live data
        isLoading,
        isError,
    } = useQuery<{ rate: number }>({
        queryKey: ['exchangeRate', sourceCurrency, destinationCurrency],
        // First-party browsers and native clients both call api.peanut.me
        // directly. This preserves the real client IP at the API rate limiter;
        // proxying normal web traffic through Vercel collapses every user onto
        // one egress address and lets one noisy client throttle everyone.
        queryFn: async () => ({ rate: await fetchDisplayRate(sourceCurrency, destinationCurrency) }),
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // garbage collect after 10 minutes
        refetchOnWindowFocus: true, // Refresh rates when user returns to tab
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
        // Invalid or unsupported pairs are deterministic client outcomes. Do
        // not turn one selection into four identical rate-limited requests.
        retry: (failureCount, error) =>
            !(error instanceof FxApiError && [400, 404, 429].includes(error.status)) && failureCount < 3,
        enabled: enabled && !!sourceCurrency && !!destinationCurrency,
    })

    // TanStack intentionally retains the last successful data when a
    // background refetch fails. FX must fail closed instead: otherwise a
    // repeatedly failing refresh can leave an arbitrarily old conversion on
    // screen even though the query is in its terminal error state.
    const exchangeRate = isError ? 0 : (rateData?.rate ?? 0)

    // The typed side is authoritative; the other follows the rate. No rate
    // (loading, error) leaves the derived side empty.
    let sourceAmount: InputValue
    let destinationAmount: InputValue
    if (lastEditedField === 'destination') {
        destinationAmount = destinationInput.amount
        sourceAmount =
            exchangeRate > 0 && isValidAmount(destinationInput.amount)
                ? ceilToSourcePrecision(destinationInput.amount / exchangeRate)
                : ''
    } else {
        sourceAmount = sourceInput
        destinationAmount = exchangeRate > 0 && isValidAmount(sourceInput) ? sourceInput * exchangeRate : ''
    }

    const destinationInputValue =
        lastEditedField === 'destination'
            ? destinationInput.text
            : typeof destinationAmount === 'number'
              ? destinationAmount.toFixed(2)
              : ''

    const getDestinationDisplayValue = useCallback(() => destinationInputValue, [destinationInputValue])

    return {
        sourceAmount,
        destinationAmount,
        destinationInputValue,
        exchangeRate,
        isLoading,
        isError,
        handleSourceAmountChange,
        handleDestinationAmountChange,
        getDestinationDisplayValue,
    }
}
