// payment flow feature configuration
// feature flags and settings for the new payment flow architecture

// feature flag to enable/disable the new payment flow implementation
// set via environment variable: NEXT_PUBLIC_NEW_PAYMENT_FLOW=true
//
// when enabled:
// - /send/* routes use the new SendFlow
// - ?chargeId= uses the new FulfillRequestFlow
// - ?id= uses the new ContributePotFlow
// - external address payments use the new PayAddressFlow
//
// when disabled (default):
// - all routes use the existing PaymentForm/usePaymentInitiator implementation
export const isNewPaymentFlowEnabled = (): boolean => {
    return process.env.NEXT_PUBLIC_NEW_PAYMENT_FLOW === 'true'
}

// configuration for the payment flow system
export const paymentFlowConfig = {
    // default chain id for peanut wallet payments (arbitrum one)
    defaultChainId: '42161',

    // default token address for peanut wallet (usdc on arbitrum)
    defaultTokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as const,

    // default token decimals
    defaultTokenDecimals: 6,

    // default token symbol
    defaultTokenSymbol: 'USDC',

    // timeout for route calculation (ms)
    routeCalculationTimeout: 30000,

    // maximum retries for failed transactions
    maxTransactionRetries: 1,
} as const
