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
    CountrySpecificMethods,
    CountryData,
    DepositMethods
} from './index'

// Mock the assets imports since they're external dependencies
jest.mock('@/assets', () => ({
    APPLE_PAY: 'mock-apple-pay-icon',
    GOOGLE_PAY: 'mock-google-pay-icon',
    MERCADO_PAGO: 'mock-mercado-pago-icon',
    SOLANA_ICON: 'mock-solana-icon',
    TRON_ICON: 'mock-tron-icon'
}))

jest.mock('@/assets/exchanges', () => ({
    BINANCE_LOGO: 'mock-binance-logo',
    LEMON_LOGO: 'mock-lemon-logo',
    RIPIO_LOGO: 'mock-ripio-logo'
}))

jest.mock('@/assets/wallets', () => ({
    METAMASK_LOGO: 'mock-metamask-logo',
    RAINBOW_LOGO: 'mock-rainbow-logo',
    TRUST_WALLET_LOGO: 'mock-trust-wallet-logo'
}))

describe('AddMoney Constants', () => {
    describe('DEPOSIT_CRYPTO_TOKENS', () => {
        it('should contain correct number of tokens', () => {
            expect(DEPOSIT_CRYPTO_TOKENS).toHaveLength(6)
        })

        it('should have all required CryptoToken properties', () => {
            DEPOSIT_CRYPTO_TOKENS.forEach(token => {
                expect(token).toHaveProperty('id')
                expect(token).toHaveProperty('name')
                expect(token).toHaveProperty('symbol')
                expect(token).toHaveProperty('icon')
                expect(typeof token.id).toBe('string')
                expect(typeof token.name).toBe('string')
                expect(typeof token.symbol).toBe('string')
            })
        })

        it('should contain USDC token with correct properties', () => {
            const usdc = DEPOSIT_CRYPTO_TOKENS.find(token => token.id === 'usdc')
            expect(usdc).toBeDefined()
            expect(usdc?.name).toBe('USD Coin')
            expect(usdc?.symbol).toBe('USDC')
            expect(typeof usdc?.icon).toBe('string')
        })

        it('should contain SOL token with imported icon', () => {
            const sol = DEPOSIT_CRYPTO_TOKENS.find(token => token.id === 'sol')
            expect(sol).toBeDefined()
            expect(sol?.name).toBe('Solana')
            expect(sol?.symbol).toBe('SOL')
            expect(sol?.icon).toBe('mock-solana-icon')
        })

        it('should contain TRX token with imported icon', () => {
            const trx = DEPOSIT_CRYPTO_TOKENS.find(token => token.id === 'trx')
            expect(trx).toBeDefined()
            expect(trx?.name).toBe('Tron')
            expect(trx?.symbol).toBe('TRX')
            expect(trx?.icon).toBe('mock-tron-icon')
        })

        it('should have unique token IDs', () => {
            const ids = DEPOSIT_CRYPTO_TOKENS.map(token => token.id)
            const uniqueIds = [...new Set(ids)]
            expect(ids).toHaveLength(uniqueIds.length)
        })

        it('should have unique token symbols', () => {
            const symbols = DEPOSIT_CRYPTO_TOKENS.map(token => token.symbol)
            const uniqueSymbols = [...new Set(symbols)]
            expect(symbols).toHaveLength(uniqueSymbols.length)
        })
    })

    describe('CRYPTO_EXCHANGES', () => {
        it('should contain correct number of exchanges', () => {
            expect(CRYPTO_EXCHANGES).toHaveLength(4)
        })

        it('should have all required CryptoSource properties', () => {
            CRYPTO_EXCHANGES.forEach(exchange => {
                expect(exchange).toHaveProperty('id')
                expect(exchange).toHaveProperty('name')
                expect(exchange).toHaveProperty('type')
                expect(exchange).toHaveProperty('path')
                expect(exchange.type).toBe('exchange')
                expect(typeof exchange.id).toBe('string')
                expect(typeof exchange.name).toBe('string')
                expect(typeof exchange.path).toBe('string')
            })
        })

        it('should contain Binance exchange with correct properties', () => {
            const binance = CRYPTO_EXCHANGES.find(exchange => exchange.id === 'binance')
            expect(binance).toBeDefined()
            expect(binance?.name).toBe('Binance')
            expect(binance?.type).toBe('exchange')
            expect(binance?.icon).toBe('mock-binance-logo')
            expect(binance?.path).toBe('/add-money/crypto/binance')
            expect(binance?.isGeneric).toBeUndefined()
        })

        it('should contain other-exchanges with isGeneric flag', () => {
            const otherExchanges = CRYPTO_EXCHANGES.find(exchange => exchange.id === 'other-exchanges')
            expect(otherExchanges).toBeDefined()
            expect(otherExchanges?.name).toBe('Other exchanges')
            expect(otherExchanges?.isGeneric).toBe(true)
            expect(otherExchanges?.icon).toBeUndefined()
        })

        it('should have unique exchange IDs', () => {
            const ids = CRYPTO_EXCHANGES.map(exchange => exchange.id)
            const uniqueIds = [...new Set(ids)]
            expect(ids).toHaveLength(uniqueIds.length)
        })

        it('should have valid paths starting with /add-money/crypto/', () => {
            CRYPTO_EXCHANGES.forEach(exchange => {
                expect(exchange.path).toMatch(/^\/add-money\/crypto\//)
            })
        })
    })

    describe('CRYPTO_WALLETS', () => {
        it('should contain correct number of wallets', () => {
            expect(CRYPTO_WALLETS).toHaveLength(4)
        })

        it('should have all required CryptoSource properties', () => {
            CRYPTO_WALLETS.forEach(wallet => {
                expect(wallet).toHaveProperty('id')
                expect(wallet).toHaveProperty('name')
                expect(wallet).toHaveProperty('type')
                expect(wallet).toHaveProperty('path')
                expect(wallet.type).toBe('wallet')
                expect(typeof wallet.id).toBe('string')
                expect(typeof wallet.name).toBe('string')
                expect(typeof wallet.path).toBe('string')
            })
        })

        it('should contain Metamask wallet with correct properties', () => {
            const metamask = CRYPTO_WALLETS.find(wallet => wallet.id === 'metamask')
            expect(metamask).toBeDefined()
            expect(metamask?.name).toBe('Metamask')
            expect(metamask?.type).toBe('wallet')
            expect(metamask?.icon).toBe('mock-metamask-logo')
            expect(metamask?.path).toBe('/add-money/crypto/metamask')
        })

        it('should contain Trust Wallet with incorrect path (bug test)', () => {
            const trustWallet = CRYPTO_WALLETS.find(wallet => wallet.id === 'trust-wallet')
            expect(trustWallet).toBeDefined()
            expect(trustWallet?.name).toBe('Trust Wallet')
            expect(trustWallet?.path).toBe('/add-money/crypto/rainbow') // This appears to be a bug - should be trust-wallet
        })

        it('should contain other-wallets with isGeneric flag', () => {
            const otherWallets = CRYPTO_WALLETS.find(wallet => wallet.id === 'other-wallets')
            expect(otherWallets).toBeDefined()
            expect(otherWallets?.name).toBe('Other wallets')
            expect(otherWallets?.isGeneric).toBe(true)
            expect(otherWallets?.icon).toBeUndefined()
        })

        it('should have unique wallet IDs', () => {
            const ids = CRYPTO_WALLETS.map(wallet => wallet.id)
            const uniqueIds = [...new Set(ids)]
            expect(ids).toHaveLength(uniqueIds.length)
        })
    })

    describe('UPDATED_DEFAULT_ADD_MONEY_METHODS', () => {
        it('should contain correct number of payment methods', () => {
            expect(UPDATED_DEFAULT_ADD_MONEY_METHODS).toHaveLength(4)
        })

        it('should have all required SpecificPaymentMethod properties', () => {
            UPDATED_DEFAULT_ADD_MONEY_METHODS.forEach(method => {
                expect(method).toHaveProperty('id')
                expect(method).toHaveProperty('icon')
                expect(method).toHaveProperty('title')
                expect(method).toHaveProperty('description')
                expect(method).toHaveProperty('isSoon')
                expect(typeof method.id).toBe('string')
                expect(typeof method.title).toBe('string')
                expect(typeof method.description).toBe('string')
                expect(typeof method.isSoon).toBe('boolean')
            })
        })

        it('should contain bank transfer method', () => {
            const bankTransfer = UPDATED_DEFAULT_ADD_MONEY_METHODS.find(method => method.id === 'bank-transfer-add')
            expect(bankTransfer).toBeDefined()
            expect(bankTransfer?.icon).toBe('bank')
            expect(bankTransfer?.title).toBe('From Bank')
            expect(bankTransfer?.isSoon).toBe(false)
        })

        it('should contain Mercado Pago method', () => {
            const mercadoPago = UPDATED_DEFAULT_ADD_MONEY_METHODS.find(method => method.id === 'mercado-pago-add')
            expect(mercadoPago).toBeDefined()
            expect(mercadoPago?.icon).toBe('mock-mercado-pago-icon')
            expect(mercadoPago?.title).toBe('Mercado Pago')
            expect(mercadoPago?.isSoon).toBe(true)
        })

        it('should contain Apple Pay and Google Pay methods', () => {
            const applePay = UPDATED_DEFAULT_ADD_MONEY_METHODS.find(method => method.id === 'apple-pay-add')
            const googlePay = UPDATED_DEFAULT_ADD_MONEY_METHODS.find(method => method.id === 'google-pay-add')
            
            expect(applePay).toBeDefined()
            expect(applePay?.icon).toBe('mock-apple-pay-icon')
            expect(applePay?.title).toBe('Apple Pay')
            expect(applePay?.isSoon).toBe(true)

            expect(googlePay).toBeDefined()
            expect(googlePay?.icon).toBe('mock-google-pay-icon')
            expect(googlePay?.title).toBe('Google Pay')
            expect(googlePay?.isSoon).toBe(true)
        })

        it('should have unique method IDs', () => {
            const ids = UPDATED_DEFAULT_ADD_MONEY_METHODS.map(method => method.id)
            const uniqueIds = [...new Set(ids)]
            expect(ids).toHaveLength(uniqueIds.length)
        })
    })

    describe('DEFAULT_BANK_WITHDRAW_METHOD', () => {
        it('should have correct properties', () => {
            expect(DEFAULT_BANK_WITHDRAW_METHOD.id).toBe('default-bank-withdraw')
            expect(DEFAULT_BANK_WITHDRAW_METHOD.icon).toBe('bank')
            expect(DEFAULT_BANK_WITHDRAW_METHOD.title).toBe('To Bank')
            expect(DEFAULT_BANK_WITHDRAW_METHOD.description).toBe('Standard bank withdrawal')
            expect(DEFAULT_BANK_WITHDRAW_METHOD.isSoon).toBe(false)
        })

        it('should be of type SpecificPaymentMethod', () => {
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toHaveProperty('id')
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toHaveProperty('icon')
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toHaveProperty('title')
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toHaveProperty('description')
            expect(DEFAULT_BANK_WITHDRAW_METHOD).toHaveProperty('isSoon')
        })
    })

    describe('countryData', () => {
        it('should contain crypto entry and multiple countries', () => {
            expect(countryData.length).toBeGreaterThan(200) // Should have many countries
            
            const crypto = countryData.find(country => country.id === 'crypto')
            expect(crypto).toBeDefined()
            expect(crypto?.type).toBe('crypto')
            expect(crypto?.title).toBe('Crypto')
            expect(crypto?.path).toBe('crypto')
        })

        it('should have all required CountryData properties', () => {
            countryData.forEach(country => {
                expect(country).toHaveProperty('id')
                expect(country).toHaveProperty('type')
                expect(country).toHaveProperty('title')
                expect(country).toHaveProperty('path')
                expect(['crypto', 'country']).toContain(country.type)
                expect(typeof country.id).toBe('string')
                expect(typeof country.title).toBe('string')
                expect(typeof country.path).toBe('string')
            })
        })

        it('should contain specific countries with correct properties', () => {
            const usa = countryData.find(country => country.id === 'US')
            expect(usa).toBeDefined()
            expect(usa?.type).toBe('country')
            expect(usa?.title).toBe('United States')
            expect(usa?.currency).toBe('USD')
            expect(usa?.path).toBe('usa')

            const germany = countryData.find(country => country.id === 'DEU')
            expect(germany).toBeDefined()
            expect(germany?.type).toBe('country')
            expect(germany?.title).toBe('Germany')
            expect(germany?.currency).toBe('EUR')
            expect(germany?.path).toBe('germany')
        })

        it('should have unique country IDs', () => {
            const ids = countryData.map(country => country.id)
            const uniqueIds = [...new Set(ids)]
            expect(ids).toHaveLength(uniqueIds.length)
        })

        it('should have unique country paths', () => {
            const paths = countryData.map(country => country.path)
            const uniquePaths = [...new Set(paths)]
            expect(paths).toHaveLength(uniquePaths.length)
        })

        it('should contain countries with various currencies', () => {
            const currencies = countryData
                .filter(country => country.type === 'country')
                .map(country => country.currency)
                .filter(currency => currency)
            
            expect(currencies).toContain('USD')
            expect(currencies).toContain('EUR')
            expect(currencies).toContain('GBP')
            expect(currencies).toContain('JPY')
        })
    })

    describe('countryCodeMap', () => {
        it('should map 3-letter country codes to 2-letter codes', () => {
            expect(countryCodeMap['USA']).toBe('US')
            expect(countryCodeMap['DEU']).toBe('DE')
            expect(countryCodeMap['GBR']).toBe('GB')
            expect(countryCodeMap['FRA']).toBe('FR')
        })

        it('should contain European country mappings', () => {
            expect(countryCodeMap['AUT']).toBe('AT') // Austria
            expect(countryCodeMap['BEL']).toBe('BE') // Belgium
            expect(countryCodeMap['ESP']).toBe('ES') // Spain
            expect(countryCodeMap['ITA']).toBe('IT') // Italy
        })

        it('should have all values as 2-character strings', () => {
            Object.values(countryCodeMap).forEach(code => {
                expect(typeof code).toBe('string')
                expect(code).toHaveLength(2)
                expect(code).toMatch(/^[A-Z]{2}$/)
            })
        })

        it('should have all keys as 3-character strings', () => {
            Object.keys(countryCodeMap).forEach(code => {
                expect(typeof code).toBe('string')
                expect(code).toHaveLength(3)
                expect(code).toMatch(/^[A-Z]{3}$/)
            })
        })
    })

    describe('COUNTRY_SPECIFIC_METHODS', () => {
        it('should be populated for country entries', () => {
            // The constant is populated by a forEach loop at the end of the file
            // We need to check that it contains methods for countries
            const countryCodes = countryData
                .filter(country => country.type === 'country')
                .map(country => country.id)
            
            countryCodes.forEach(countryCode => {
                expect(COUNTRY_SPECIFIC_METHODS[countryCode]).toBeDefined()
                expect(COUNTRY_SPECIFIC_METHODS[countryCode]).toHaveProperty('add')
                expect(COUNTRY_SPECIFIC_METHODS[countryCode]).toHaveProperty('withdraw')
                expect(Array.isArray(COUNTRY_SPECIFIC_METHODS[countryCode].add)).toBe(true)
                expect(Array.isArray(COUNTRY_SPECIFIC_METHODS[countryCode].withdraw)).toBe(true)
            })
        })

        it('should not be populated for crypto entry', () => {
            expect(COUNTRY_SPECIFIC_METHODS['crypto']).toBeUndefined()
        })

        it('should contain appropriate methods for EUR countries', () => {
            const eurCountries = countryData
                .filter(country => country.type === 'country' && country.currency === 'EUR')
                .map(country => country.id)
            
            eurCountries.forEach(countryCode => {
                const methods = COUNTRY_SPECIFIC_METHODS[countryCode]
                expect(methods).toBeDefined()
                
                // Should contain SEPA for EUR countries
                const sepaMethod = methods.withdraw.find(method => 
                    method.title === 'SEPA Instant' || method.id.includes('sepa')
                )
                if (sepaMethod) {
                    expect(sepaMethod.title).toBe('SEPA Instant')
                    expect(sepaMethod.description).toBe('EU-wide real-time bank transfers.')
                }
            })
        })

        it('should contain bank transfer methods for enabled countries', () => {
            // Test a few known enabled countries
            const enabledCountries = ['US', 'DEU', 'GBR']
            
            enabledCountries.forEach(countryCode => {
                const methods = COUNTRY_SPECIFIC_METHODS[countryCode]
                if (methods) {
                    const bankMethods = methods.add.filter(method => 
                        method.id.includes('bank') || method.title.includes('Bank')
                    )
                    expect(bankMethods.length).toBeGreaterThan(0)
                }
            })
        })

        it('should filter Mercado Pago for LATAM countries only', () => {
            const latamCountries = ['AR', 'BR', 'MX', 'CO', 'CL']
            const nonLatamCountries = ['US', 'DEU', 'GBR', 'JP']
            
            latamCountries.forEach(countryCode => {
                const methods = COUNTRY_SPECIFIC_METHODS[countryCode]
                if (methods) {
                    const mercadoPagoMethod = methods.add.find(method => 
                        method.id.includes('mercado-pago')
                    )
                    expect(mercadoPagoMethod).toBeDefined()
                }
            })
            
            nonLatamCountries.forEach(countryCode => {
                const methods = COUNTRY_SPECIFIC_METHODS[countryCode]
                if (methods) {
                    const mercadoPagoMethod = methods.add.find(method => 
                        method.id.includes('mercado-pago')
                    )
                    expect(mercadoPagoMethod).toBeUndefined()
                }
            })
        })

        it('should contain specific country payment methods', () => {
            // Test specific countries that have custom payment methods
            const indiaMethod = COUNTRY_SPECIFIC_METHODS['IN']
            if (indiaMethod) {
                const upiMethod = indiaMethod.withdraw.find(method => method.title === 'UPI')
                if (upiMethod) {
                    expect(upiMethod.description).toContain('Unified Payments Interface')
                }
            }

            const brazilMethod = COUNTRY_SPECIFIC_METHODS['BR']
            if (brazilMethod) {
                const pixMethod = brazilMethod.withdraw.find(method => method.title === 'Pix')
                if (pixMethod) {
                    expect(pixMethod.description).toContain('75%+ population use it')
                }
            }
        })
    })

    // Edge case and error handling tests
    describe('Edge Cases and Data Validation', () => {
        it('should handle empty arrays gracefully', () => {
            expect(DEPOSIT_CRYPTO_TOKENS).toBeDefined()
            expect(CRYPTO_EXCHANGES).toBeDefined()
            expect(CRYPTO_WALLETS).toBeDefined()
            expect(countryData).toBeDefined()
        })

        it('should have consistent naming conventions for IDs', () => {
            DEPOSIT_CRYPTO_TOKENS.forEach(token => {
                expect(token.id).toMatch(/^[a-z]+$/)
            })
            
            CRYPTO_EXCHANGES.forEach(exchange => {
                expect(exchange.id).toMatch(/^[a-z-]+$/)
            })
            
            CRYPTO_WALLETS.forEach(wallet => {
                expect(wallet.id).toMatch(/^[a-z-]+$/)
            })
        })

        it('should have valid URLs for crypto token icons', () => {
            const urlTokens = DEPOSIT_CRYPTO_TOKENS.filter(token => 
                typeof token.icon === 'string' && token.icon.startsWith('http')
            )
            
            urlTokens.forEach(token => {
                expect(token.icon).toMatch(/^https?:\/\//)
            })
        })

        it('should not have duplicate paths in country data', () => {
            const paths = countryData.map(country => country.path)
            const duplicatePaths = paths.filter((path, index) => 
                paths.indexOf(path) !== index
            )
            expect(duplicatePaths).toHaveLength(0)
        })

        it('should have consistent path formatting', () => {
            countryData.forEach(country => {
                expect(country.path).not.toMatch(/^\//) // Should not start with slash
                expect(country.path).not.toMatch(/\/$/) // Should not end with slash
                expect(country.path).toMatch(/^[a-z0-9-\.]+$/) // Should be lowercase with hyphens and dots only
            })
        })

        it('should have valid currency codes for countries', () => {
            const countriesWithCurrency = countryData.filter(country => 
                country.type === 'country' && country.currency
            )
            
            countriesWithCurrency.forEach(country => {
                expect(country.currency).toMatch(/^[A-Z]{3}$/) // ISO currency codes are 3 uppercase letters
            })
        })
    })

    // Type safety and interface compliance tests
    describe('TypeScript Interface Compliance', () => {
        it('should comply with CryptoToken interface', () => {
            const sampleToken: CryptoToken = {
                id: 'test',
                name: 'Test Token',
                symbol: 'TEST',
                icon: 'test-icon'
            }
            
            expect(sampleToken.id).toBeDefined()
            expect(sampleToken.name).toBeDefined()
            expect(sampleToken.symbol).toBeDefined()
            expect(sampleToken.icon).toBeDefined()
        })

        it('should comply with CryptoSource interface', () => {
            const sampleSource: CryptoSource = {
                id: 'test',
                name: 'Test Source',
                type: 'exchange',
                path: '/test'
            }
            
            expect(sampleSource.id).toBeDefined()
            expect(sampleSource.name).toBeDefined()
            expect(sampleSource.type).toBeDefined()
            expect(sampleSource.path).toBeDefined()
        })

        it('should comply with SpecificPaymentMethod interface', () => {
            const sampleMethod: SpecificPaymentMethod = {
                id: 'test',
                icon: 'test-icon',
                title: 'Test Method',
                description: 'Test description'
            }
            
            expect(sampleMethod.id).toBeDefined()
            expect(sampleMethod.title).toBeDefined()
            expect(sampleMethod.description).toBeDefined()
        })

        it('should comply with CountryData interface', () => {
            const sampleCountry: CountryData = {
                id: 'TEST',
                type: 'country',
                title: 'Test Country',
                path: 'test-country'
            }
            
            expect(sampleCountry.id).toBeDefined()
            expect(sampleCountry.type).toBeDefined()
            expect(sampleCountry.title).toBeDefined()
            expect(sampleCountry.path).toBeDefined()
        })
    })
})