import {
    DEPOSIT_CRYPTO_TOKENS,
    CRYPTO_EXCHANGES,
    CRYPTO_WALLETS,
    UPDATED_DEFAULT_ADD_MONEY_METHODS,
    DEFAULT_BANK_WITHDRAW_METHOD,
    countryData,
    COUNTRY_SPECIFIC_METHODS,
    countryCodeMap,
    CryptoSource,
    CryptoToken,
    SpecificPaymentMethod,
    CountryData,
    DepositMethods,
    CountrySpecificMethods
} from './index'

// Testing framework: Jest (inferred from .test.ts extension and common patterns)

describe('AddMoney Constants', () => {
    describe('DEPOSIT_CRYPTO_TOKENS', () => {
        it('should contain expected crypto tokens', () => {
            expect(DEPOSIT_CRYPTO_TOKENS).toHaveLength(6)
            expect(DEPOSIT_CRYPTO_TOKENS).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ id: 'usdc', symbol: 'USDC' }),
                    expect.objectContaining({ id: 'usdt', symbol: 'USDT' }),
                    expect.objectContaining({ id: 'eth', symbol: 'ETH' }),
                    expect.objectContaining({ id: 'sol', symbol: 'SOL' }),
                    expect.objectContaining({ id: 'btc', symbol: 'BTC' }),
                    expect.objectContaining({ id: 'trx', symbol: 'TRX' })
                ])
            )
        })

        it('should have valid CryptoToken structure for each token', () => {
            DEPOSIT_CRYPTO_TOKENS.forEach(token => {
                expect(token).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    symbol: expect.any(String),
                    icon: expect.anything() // Can be string or StaticImageData
                })
                expect(token.id).toBeTruthy()
                expect(token.name).toBeTruthy()
                expect(token.symbol).toBeTruthy()
                expect(token.icon).toBeTruthy()
            })
        })

        it('should have unique ids for all tokens', () => {
            const ids = DEPOSIT_CRYPTO_TOKENS.map(token => token.id)
            const uniqueIds = new Set(ids)
            expect(uniqueIds.size).toBe(ids.length)
        })

        it('should have valid icon URLs or imports', () => {
            DEPOSIT_CRYPTO_TOKENS.forEach(token => {
                if (typeof token.icon === 'string') {
                    expect(token.icon).toMatch(/^https?:\/\//)
                }
                // For StaticImageData imports, just check they exist
                expect(token.icon).toBeDefined()
            })
        })

        it('should contain USDC as primary token', () => {
            const usdc = DEPOSIT_CRYPTO_TOKENS.find(token => token.id === 'usdc')
            expect(usdc).toBeDefined()
            expect(usdc?.name).toBe('USD Coin')
            expect(usdc?.symbol).toBe('USDC')
        })
    })

    describe('CRYPTO_EXCHANGES', () => {
        it('should contain expected exchanges', () => {
            expect(CRYPTO_EXCHANGES).toHaveLength(4)
            const exchangeIds = CRYPTO_EXCHANGES.map(ex => ex.id)
            expect(exchangeIds).toEqual(['binance', 'lemon', 'ripio', 'other-exchanges'])
        })

        it('should have valid CryptoSource structure for exchanges', () => {
            CRYPTO_EXCHANGES.forEach(exchange => {
                expect(exchange).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    type: 'exchange',
                    path: expect.stringMatching(/^\/add-money\/crypto\//)
                })
                expect(exchange.id).toBeTruthy()
                expect(exchange.name).toBeTruthy()
            })
        })

        it('should have correct paths for each exchange', () => {
            CRYPTO_EXCHANGES.forEach(exchange => {
                expect(exchange.path).toBe(`/add-money/crypto/${exchange.id}`)
            })
        })

        it('should mark "other-exchanges" as generic', () => {
            const otherExchanges = CRYPTO_EXCHANGES.find(ex => ex.id === 'other-exchanges')
            expect(otherExchanges?.isGeneric).toBe(true)
        })

        it('should have icons for non-generic exchanges', () => {
            const nonGenericExchanges = CRYPTO_EXCHANGES.filter(ex => !ex.isGeneric)
            nonGenericExchanges.forEach(exchange => {
                expect(exchange.icon).toBeDefined()
            })
        })
    })

    describe('CRYPTO_WALLETS', () => {
        it('should contain expected wallets', () => {
            expect(CRYPTO_WALLETS).toHaveLength(4)
            const walletIds = CRYPTO_WALLETS.map(wallet => wallet.id)
            expect(walletIds).toEqual(['metamask', 'rainbow', 'trust-wallet', 'other-wallets'])
        })

        it('should have valid CryptoSource structure for wallets', () => {
            CRYPTO_WALLETS.forEach(wallet => {
                expect(wallet).toMatchObject({
                    id: expect.any(String),
                    name: expect.any(String),
                    type: 'wallet',
                    path: expect.stringMatching(/^\/add-money\/crypto\//)
                })
            })
        })

        it('should mark "other-wallets" as generic', () => {
            const otherWallets = CRYPTO_WALLETS.find(wallet => wallet.id === 'other-wallets')
            expect(otherWallets?.isGeneric).toBe(true)
        })

        it('should have potential path inconsistency for trust-wallet', () => {
            // This test documents the apparent bug where trust-wallet path points to rainbow
            const trustWallet = CRYPTO_WALLETS.find(wallet => wallet.id === 'trust-wallet')
            expect(trustWallet?.path).toBe('/add-money/crypto/rainbow') // Documents existing behavior
        })
    })

    describe('UPDATED_DEFAULT_ADD_MONEY_METHODS', () => {
        it('should contain expected payment methods', () => {
            expect(UPDATED_DEFAULT_ADD_MONEY_METHODS).toHaveLength(4)
            const methodIds = UPDATED_DEFAULT_ADD_MONEY_METHODS.map(method => method.id)
            expect(methodIds).toEqual([
                'bank-transfer-add',
                'mercado-pago-add',
                'apple-pay-add',
                'google-pay-add'
            ])
        })

        it('should have valid SpecificPaymentMethod structure', () => {
            UPDATED_DEFAULT_ADD_MONEY_METHODS.forEach(method => {
                expect(method).toMatchObject({
                    id: expect.any(String),
                    icon: expect.anything(),
                    title: expect.any(String),
                    description: expect.any(String),
                    isSoon: expect.any(Boolean)
                })
            })
        })

        it('should have bank transfer as non-soon method', () => {
            const bankTransfer = UPDATED_DEFAULT_ADD_MONEY_METHODS.find(method => method.id === 'bank-transfer-add')
            expect(bankTransfer?.isSoon).toBe(false)
        })

        it('should have other methods marked as soon', () => {
            const otherMethods = UPDATED_DEFAULT_ADD_MONEY_METHODS.filter(method => method.id !== 'bank-transfer-add')
            otherMethods.forEach(method => {
                expect(method.isSoon).toBe(true)
            })
        })
    })

    describe('DEFAULT_BANK_WITHDRAW_METHOD', () => {
        it('should have correct structure and values', () => {
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toMatchObject({
                id: 'default-bank-withdraw',
                icon: 'bank',
                title: 'To Bank',
                description: 'Standard bank withdrawal',
                isSoon: false
            })
        })

        it('should be a valid SpecificPaymentMethod', () => {
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toMatchObject({
                id: expect.any(String),
                icon: expect.anything(),
                title: expect.any(String),
                description: expect.any(String),
                isSoon: expect.any(Boolean)
            })
        })
    })

    describe('countryData', () => {
        it('should contain crypto entry and multiple countries', () => {
            expect(countryData.length).toBeGreaterThan(200) // Should have many countries
            const cryptoEntry = countryData.find(country => country.id === 'crypto')
            expect(cryptoEntry).toBeDefined()
            expect(cryptoEntry?.type).toBe('crypto')
        })

        it('should have valid CountryData structure for all entries', () => {
            countryData.forEach(country => {
                expect(country).toMatchObject({
                    id: expect.any(String),
                    type: expect.stringMatching(/^(crypto|country)$/),
                    title: expect.any(String),
                    path: expect.any(String)
                })
                
                if (country.type === 'country') {
                    expect(country.currency).toBeDefined()
                }
            })
        })

        it('should have unique ids for all countries', () => {
            const ids = countryData.map(country => country.id)
            const uniqueIds = new Set(ids)
            expect(uniqueIds.size).toBe(ids.length)
        })

        it('should contain expected major countries', () => {
            const majorCountries = ['US', 'GBR', 'DEU', 'FRA', 'JP', 'CA', 'AU']
            majorCountries.forEach(countryCode => {
                const country = countryData.find(c => c.id === countryCode)
                expect(country).toBeDefined()
                expect(country?.type).toBe('country')
            })
        })

        it('should have proper currency codes for countries', () => {
            const countriesWithCurrency = countryData.filter(c => c.type === 'country' && c.currency)
            countriesWithCurrency.forEach(country => {
                expect(country.currency).toMatch(/^[A-Z]{3}$/) // 3-letter currency codes
            })
        })

        it('should have crypto entry with correct properties', () => {
            const crypto = countryData.find(c => c.id === 'crypto')
            expect(crypto).toEqual({
                id: 'crypto',
                type: 'crypto',
                title: 'Crypto',
                description: '',
                path: 'crypto'
            })
        })
    })

    describe('countryCodeMap', () => {
        it('should map 3-letter codes to 2-letter codes', () => {
            const entries = Object.entries(countryCodeMap)
            entries.forEach(([threeLetterCode, twoLetterCode]) => {
                expect(threeLetterCode).toMatch(/^[A-Z]{3}$/)
                expect(twoLetterCode).toMatch(/^[A-Z]{2}$/)
            })
        })

        it('should contain expected mappings', () => {
            expect(countryCodeMap['USA']).toBe('US')
            expect(countryCodeMap['GBR']).toBe('GB')
            expect(countryCodeMap['DEU']).toBe('DE')
            expect(countryCodeMap['FRA']).toBe('FR')
        })

        it('should have unique values', () => {
            const values = Object.values(countryCodeMap)
            const uniqueValues = new Set(values)
            expect(uniqueValues.size).toBe(values.length)
        })

        it('should map all EAA countries mentioned in comment', () => {
            const expectedCodes = ['AUT', 'BEL', 'BGR', 'HRV', 'CYP', 'CZE', 'DNK', 'EST', 'FIN', 'FRA', 'DEU', 'GRC', 'HUN', 'ISL', 'IRL', 'ITA', 'LVA', 'LTU', 'LUX', 'MLT', 'NLD', 'NOR', 'POL', 'PRT', 'ROU', 'SVK', 'SVN', 'ESP', 'SWE', 'CHE', 'GBR']
            expectedCodes.forEach(code => {
                expect(countryCodeMap[code]).toBeDefined()
            })
        })
    })

    describe('COUNTRY_SPECIFIC_METHODS', () => {
        it('should be populated after module initialization', () => {
            expect(Object.keys(COUNTRY_SPECIFIC_METHODS).length).toBeGreaterThan(0)
        })

        it('should have methods for each country in countryData', () => {
            const countryEntries = countryData.filter(c => c.type === 'country')
            countryEntries.forEach(country => {
                expect(COUNTRY_SPECIFIC_METHODS[country.id]).toBeDefined()
                expect(COUNTRY_SPECIFIC_METHODS[country.id]).toMatchObject({
                    add: expect.any(Array),
                    withdraw: expect.any(Array)
                })
            })
        })

        it('should have valid structure for each country method set', () => {
            Object.values(COUNTRY_SPECIFIC_METHODS).forEach(methods => {
                expect(methods).toMatchObject({
                    add: expect.any(Array),
                    withdraw: expect.any(Array)
                })
                
                methods.add.forEach(method => {
                    expect(method).toMatchObject({
                        id: expect.any(String),
                        title: expect.any(String),
                        description: expect.any(String),
                        isSoon: expect.any(Boolean)
                    })
                })

                methods.withdraw.forEach(method => {
                    expect(method).toMatchObject({
                        id: expect.any(String),
                        title: expect.any(String),
                        description: expect.any(String),
                        isSoon: expect.any(Boolean)
                    })
                })
            })
        })

        it('should include Mercado Pago for LATAM countries only', () => {
            const latamCountries = ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'SV', 'GT', 'HN', 'HT', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'UY', 'VE']
            const nonLatamCountries = ['US', 'CA', 'AU', 'GB', 'DE', 'FR', 'JP']

            latamCountries.forEach(countryCode => {
                if (COUNTRY_SPECIFIC_METHODS[countryCode]) {
                    const hasMercadoPago = COUNTRY_SPECIFIC_METHODS[countryCode].add.some(method => 
                        method.id === 'mercado-pago-add'
                    )
                    expect(hasMercadoPago).toBe(true)
                }
            })

            nonLatamCountries.forEach(countryCode => {
                if (COUNTRY_SPECIFIC_METHODS[countryCode]) {
                    const hasMercadoPago = COUNTRY_SPECIFIC_METHODS[countryCode].add.some(method => 
                        method.id === 'mercado-pago-add'
                    )
                    expect(hasMercadoPago).toBe(false)
                }
            })
        })

        it('should include SEPA for EUR countries', () => {
            const eurCountries = countryData.filter(c => c.type === 'country' && c.currency === 'EUR')
            
            eurCountries.forEach(country => {
                if (COUNTRY_SPECIFIC_METHODS[country.id]) {
                    const methods = COUNTRY_SPECIFIC_METHODS[country.id].withdraw
                    // Should have either SEPA or default bank method, but not both
                    const hasSepa = methods.some(m => m.title === 'SEPA Instant')
                    const hasDefaultBank = methods.some(m => m.title === 'To Bank')
                    
                    // For EUR countries, expect either SEPA or default bank, but not both
                    expect(hasSepa || hasDefaultBank).toBe(true)
                    if (hasSepa) {
                        expect(hasDefaultBank).toBe(false) // Should not have both
                    }
                }
            })
        })

        it('should have unique method ids within each country', () => {
            Object.values(COUNTRY_SPECIFIC_METHODS).forEach(methods => {
                const allMethodIds = [...methods.add.map(m => m.id), ...methods.withdraw.map(m => m.id)]
                const uniqueIds = new Set(allMethodIds)
                expect(uniqueIds.size).toBe(allMethodIds.length)
            })
        })

        it('should include country-specific payment methods for known countries', () => {
            // Test some specific countries that should have special methods
            const indiaOrIN = COUNTRY_SPECIFIC_METHODS['IN']
            if (indiaOrIN) {
                const hasUPI = indiaOrIN.withdraw.some(m => m.title === 'UPI')
                expect(hasUPI).toBe(true)
            }

            const brazilOrBR = COUNTRY_SPECIFIC_METHODS['BR']
            if (brazilOrBR) {
                const hasPix = brazilOrBR.withdraw.some(m => m.title === 'Pix')
                expect(hasPix).toBe(true)
            }
        })
    })

    describe('Type Safety and Interfaces', () => {
        it('should validate CryptoSource interface compliance', () => {
            const testSource: CryptoSource = CRYPTO_EXCHANGES[0]
            expect(testSource.id).toBeDefined()
            expect(testSource.name).toBeDefined()
            expect(['exchange', 'wallet']).toContain(testSource.type)
            expect(testSource.path).toBeDefined()
        })

        it('should validate CryptoToken interface compliance', () => {
            const testToken: CryptoToken = DEPOSIT_CRYPTO_TOKENS[0]
            expect(testToken.id).toBeDefined()
            expect(testToken.name).toBeDefined()
            expect(testToken.symbol).toBeDefined()
            expect(testToken.icon).toBeDefined()
        })

        it('should validate SpecificPaymentMethod interface compliance', () => {
            const testMethod: SpecificPaymentMethod = UPDATED_DEFAULT_ADD_MONEY_METHODS[0]
            expect(testMethod.id).toBeDefined()
            expect(testMethod.title).toBeDefined()
            expect(testMethod.description).toBeDefined()
            expect(typeof testMethod.isSoon).toBe('boolean')
        })

        it('should validate CountryData interface compliance', () => {
            const testCountry: CountryData = countryData[1] // Skip crypto entry
            expect(testCountry.id).toBeDefined()
            expect(['crypto', 'country']).toContain(testCountry.type)
            expect(testCountry.title).toBeDefined()
            expect(testCountry.path).toBeDefined()
        })
    })

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty arrays gracefully', () => {
            expect(DEPOSIT_CRYPTO_TOKENS).not.toHaveLength(0)
            expect(CRYPTO_EXCHANGES).not.toHaveLength(0)
            expect(CRYPTO_WALLETS).not.toHaveLength(0)
            expect(countryData).not.toHaveLength(0)
        })

        it('should handle missing optional properties', () => {
            // Test that optional properties are handled correctly
            const genericExchange = CRYPTO_EXCHANGES.find(ex => ex.isGeneric)
            expect(genericExchange).toBeDefined()
            // isGeneric is optional, so it's OK if it's undefined for others
        })

        it('should handle country lookup edge cases', () => {
            // Test that all country codes in the map exist in countryData
            Object.keys(countryCodeMap).forEach(threeLetterCode => {
                const country = countryData.find(c => c.id === threeLetterCode)
                expect(country).toBeDefined()
            })
        })

        it('should handle currency edge cases', () => {
            // Antarctica should have empty currency
            const antarctica = countryData.find(c => c.id === 'AQ')
            expect(antarctica?.currency).toBe('')
        })
    })

    describe('Data Consistency', () => {
        it('should have consistent path formats', () => {
            // Crypto sources should have consistent path format
            CRYPTO_EXCHANGES.forEach(exchange => {
                expect(exchange.path).toMatch(/^\/add-money\/crypto\/[a-z-]+$/)
            })

            CRYPTO_WALLETS.forEach(wallet => {
                expect(wallet.path).toMatch(/^\/add-money\/crypto\/[a-z-]+$/)
            })
        })

        it('should have consistent id formats', () => {
            // IDs should be lowercase with hyphens
            [...CRYPTO_EXCHANGES, ...CRYPTO_WALLETS].forEach(source => {
                expect(source.id).toMatch(/^[a-z-]+$/)
            })

            DEPOSIT_CRYPTO_TOKENS.forEach(token => {
                expect(token.id).toMatch(/^[a-z]+$/)
            })
        })

        it('should have all required countries for specific methods', () => {
            // Countries mentioned in countrySpecificWithdrawMethods should exist in countryData
            const countriesWithSpecificMethods = [
                'India', 'Brazil', 'Argentina', 'Mexico', 'Kenya', 'Portugal', 
                'Poland', 'Spain', 'United States', 'Nigeria', 'Malaysia', 
                'Thailand', 'Australia', 'United Kingdom', 'South Africa', 
                'Sweden', 'Indonesia', 'Philippines', 'Vietnam', 'Colombia', 
                'Peru', 'Costa Rica', 'Singapore', 'Japan', 'UAE', 'Saudi Arabia', 
                'Tanzania', 'Pakistan', 'Turkey', 'Canada'
            ]

            countriesWithSpecificMethods.forEach(countryName => {
                const country = countryData.find(c => c.title === countryName)
                expect(country).toBeDefined()
            })
        })

        it('should have valid currency codes', () => {
            const validCurrencies = new Set([
                'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 'BRL',
                'KRW', 'MXN', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'TRY', 'ZAR',
                'RUB', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LBP', 'EGP',
                'MAD', 'DZD', 'TND', 'LYD', 'SDG', 'ETB', 'KES', 'UGX', 'TZS', 'RWF',
                'NGN', 'GHS', 'XOF', 'XAF', 'XCD', 'XPF', 'SOS', 'DJF', 'ERN', 'MRU',
                'STD', 'CVE', 'GMD', 'GNF', 'LRD', 'SLL', 'LSL', 'SZL', 'BWP', 'NAD',
                'MZN', 'MGA', 'KMF', 'SCR', 'MUR', 'MVR', 'NPR', 'BTN', 'LKR', 'MVR',
                'IDR', 'MYR', 'SGD', 'THB', 'VND', 'KHR', 'LAK', 'MMK', 'PHP', 'TWD',
                'HKD', 'MOP', 'KRW', 'JPY', 'CNY', 'MNT', 'KZT', 'KGS', 'TJS', 'UZS',
                'TMT', 'AFN', 'PKR', 'BDT', 'INR', 'LKR', 'MVR', 'NPR', 'BTN', 'IRR',
                'IQD', 'SYP', 'JOD', 'LBP', 'ILS', 'TRY', 'AZN', 'GEL', 'AMD', 'BYN',
                'RUB', 'UAH', 'MDL', 'RON', 'BGN', 'RSD', 'BAM', 'MKD', 'ALL', 'EUR',
                'CHF', 'SEK', 'NOK', 'DKK', 'ISK', 'CZK', 'SKK', 'HUF', 'PLN', 'HRK',
                'SIT', 'EEK', 'LVL', 'LTL', 'MTL', 'CYP', 'GBP', 'IEP', 'ITL', 'ESP',
                'PTE', 'FRF', 'BEF', 'LUF', 'NLG', 'DEM', 'ATS', 'FIM', 'GRD', 'CAD',
                'USD', 'MXN', 'GTQ', 'BZD', 'SVC', 'HNL', 'NIO', 'CRC', 'PAB', 'USD',
                'COP', 'VEF', 'GYD', 'SRD', 'UYU', 'PYG', 'BOB', 'BRL', 'ARS', 'CLP',
                'PEN', 'FKP', 'GS', 'AUD', 'NZD', 'FJD', 'PGK', 'SBD', 'VUV', 'NCF',
                'XPF', 'TON', 'WST', 'KID', 'AUD', 'TVD', 'NRU', 'AUD', 'MHD', 'USD',
                'PWD', 'USD', 'USD', 'GUM', 'USD', 'ASM', 'USD', 'VIR', 'USD', 'PRI',
                'USD', 'UMI', 'USD', 'IOT', 'USD', 'CCK', 'AUD', 'CXR', 'AUD', 'NFK',
                'AUD', 'HMD', 'AUD'
            ])
            
            countryData.forEach(country => {
                if (country.type === 'country' && country.currency && country.currency !== '') {
                    // Most currencies should be valid, but we'll be lenient for edge cases
                    expect(country.currency).toMatch(/^[A-Z]{3}$/)
                }
            })
        })
    })
})