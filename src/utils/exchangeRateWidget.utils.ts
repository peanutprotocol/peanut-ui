import countryCurrencyMappings from '@/constants/countryCurrencyMapping'

export const getExchangeRateWidgetRedirectRoute = (
    sourceCurrency: string,
    destinationCurrency: string,
    userBalance: number
): string => {
    let route = '/add-money'
    let countryPath: string | undefined = ''

    // Case 1: source currency is not usd and destination currency is usd -> redirect to add-money/sourceCurrencyCountry page
    if (sourceCurrency !== 'USD' && destinationCurrency === 'USD') {
        countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
        route = '/add-money'
    }

    // Case 2: source currency is usd and destination currency is not usd -> redirect to withdraw/destinationCurrencyCountry page
    if (sourceCurrency === 'USD' && destinationCurrency !== 'USD') {
        // if there is no balance, redirect to add-money
        if (userBalance <= 0) {
            countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
            route = '/add-money'
        } else {
            countryPath = countryCurrencyMappings.find(
                (currency) => currency.currencyCode === destinationCurrency
            )?.path
            route = '/withdraw'
        }
    }

    // Case 3: source currency is not usd and destination currency is not usd -> redirect to add-money/sourceCurrencyCountry page
    if (sourceCurrency !== 'USD' && destinationCurrency !== 'USD') {
        countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === sourceCurrency)?.path
        route = '/add-money'
    }

    // Case 4: source currency is usd and destination currency is usd
    if (sourceCurrency === 'USD' && destinationCurrency === 'USD') {
        countryPath = countryCurrencyMappings.find((currency) => currency.currencyCode === 'USD')?.path
        route = userBalance <= 0 ? '/add-money' : '/withdraw'
    }

    if (!countryPath) {
        const redirectRoute = `${route}?currencyCode=EUR`
        return redirectRoute
    } else {
        const redirectRoute = `${route}/${countryPath}`
        return redirectRoute
    }
}
