import { APPLE_PAY, GOOGLE_PAY, MERCADO_PAGO, SOLANA_ICON, TRON_ICON } from '@/assets'
import { BINANCE_LOGO, LEMON_LOGO, RIPIO_LOGO } from '@/assets/exchanges'
import { METAMASK_LOGO, RAINBOW_LOGO, TRUST_WALLET_LOGO } from '@/assets/wallets'
import { IconName } from '@/components/Global/Icons/Icon'
import { StaticImageData } from 'next/image'

export interface CryptoSource {
    id: string
    name: string
    type: 'exchange' | 'wallet'
    icon?: StaticImageData
    isGeneric?: boolean
    path: string
}

export interface CryptoToken {
    id: string
    name: string
    symbol: string
    icon: StaticImageData | string
}

// @dev: this is a temporary list of tokens for the deposit screen, using this for a couple of weeks, once x-chain is ready, we will use the x-chain tokens and remove this list, only useful token is USDC here for now
export const DEPOSIT_CRYPTO_TOKENS: CryptoToken[] = [
    {
        id: 'usdc',
        name: 'USD Coin',
        symbol: 'USDC',
        icon: 'https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png',
    },
    {
        id: 'usdt',
        name: 'Tether',
        symbol: 'USDT',
        icon: 'https://assets.coingecko.com/coins/images/325/small/Tether-logo.png',
    },
    {
        id: 'eth',
        name: 'Ethereum',
        symbol: 'ETH',
        icon: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
    },
    {
        id: 'sol',
        name: 'Solana',
        symbol: 'SOL',
        icon: SOLANA_ICON,
    },
    {
        id: 'btc',
        name: 'Bitcoin',
        symbol: 'BTC',
        icon: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
    },
    {
        id: 'trx',
        name: 'Tron',
        symbol: 'TRX',
        icon: TRON_ICON,
    },
]

export const CRYPTO_EXCHANGES: CryptoSource[] = [
    {
        id: 'binance',
        name: 'Binance',
        type: 'exchange',
        icon: BINANCE_LOGO,
        path: '/add-money/crypto/binance',
    },
    {
        id: 'lemon',
        name: 'Lemon',
        type: 'exchange',
        icon: LEMON_LOGO,
        path: '/add-money/crypto/lemon',
    },
    {
        id: 'ripio',
        name: 'Ripio',
        type: 'exchange',
        icon: RIPIO_LOGO,
        path: '/add-money/crypto/ripio',
    },
    {
        id: 'other-exchanges',
        name: 'Other exchanges',
        type: 'exchange',
        isGeneric: true,
        path: '/add-money/crypto/other-exchanges',
    },
]

export const CRYPTO_WALLETS: CryptoSource[] = [
    {
        id: 'metamask',
        name: 'Metamask',
        type: 'wallet',
        icon: METAMASK_LOGO,
        path: '/add-money/crypto/metamask',
    },
    {
        id: 'rainbow',
        name: 'Rainbow',
        type: 'wallet',
        icon: RAINBOW_LOGO,
        path: '/add-money/crypto/rainbow',
    },
    {
        id: 'trust-wallet',
        name: 'Trust Wallet',
        type: 'wallet',
        icon: TRUST_WALLET_LOGO,
        path: '/add-money/crypto/rainbow',
    },
    {
        id: 'other-wallets',
        name: 'Other wallets',
        type: 'wallet',
        isGeneric: true,
        path: '/add-money/crypto/other-wallets',
    },
]

export interface SpecificPaymentMethod {
    id: string
    icon: IconName | string | undefined
    title: string
    description: string
    isSoon?: boolean
    path?: string
}

export interface CountrySpecificMethods {
    add: SpecificPaymentMethod[]
    withdraw: SpecificPaymentMethod[]
}

export interface CountryData {
    id: string
    type: 'crypto' | 'country'
    title: string
    currency?: string
    description?: string
    path: string
}

export interface DepositMethods extends CountryData {
    specificMethods?: CountrySpecificMethods
}

export const UPDATED_DEFAULT_ADD_MONEY_METHODS: SpecificPaymentMethod[] = [
    {
        id: 'bank-transfer-add',
        icon: 'bank' as IconName,
        title: 'From Bank',
        description: 'Usually in minutes - KYC required',
        isSoon: false,
    },
    {
        id: 'crypto-add',
        icon: 'wallet-outline' as IconName,
        title: 'From Crypto',
        description: 'Usually arrives instantly',
        isSoon: false,
    },
    {
        id: 'mercado-pago-add',
        icon: MERCADO_PAGO,
        title: 'Mercado Pago',
        description: 'Popular in LATAM',
        isSoon: true,
    },
    {
        id: 'apple-pay-add',
        icon: APPLE_PAY,
        title: 'Apple Pay',
        description: 'Usually arrives instantly',
        isSoon: true,
    },
    {
        id: 'google-pay-add',
        icon: GOOGLE_PAY,
        title: 'Google Pay',
        description: 'Usually arrives instantly',
        isSoon: true,
    },
]

export const DEFAULT_BANK_WITHDRAW_METHOD: SpecificPaymentMethod = {
    id: 'default-bank-withdraw',
    icon: 'bank' as IconName,
    title: 'To Bank',
    description: 'Standard bank withdrawal',
    isSoon: false,
}

export const DEFAULT_WITHDRAW_METHODS: SpecificPaymentMethod[] = [
    {
        id: 'crypto-withdraw',
        icon: 'wallet-outline' as IconName,
        title: 'Crypto',
        description: 'Withdraw to a wallet address',
        isSoon: false,
        path: '/withdraw/crypto',
    },
    {
        id: 'default-bank-withdraw',
        icon: 'bank' as IconName,
        title: 'To Bank',
        description: 'Standard bank withdrawal',
        isSoon: false,
    },
]

const countrySpecificWithdrawMethods: Record<
    string,
    Array<{ title: string; description: string; icon?: IconName | string }>
> = {
    India: [{ title: 'UPI', description: 'Unified Payments Interface, ~17B txns/month, 84% of digital payments.' }],
    Brazil: [{ title: 'Pix', description: '75%+ population use it, 40% e-commerce share.' }],
    Argentina: [{ title: 'MercadoPago', description: 'Dominant wallet in LATAM, supports QR and bank transfers.' }],
    Mexico: [{ title: 'CoDi', description: 'Central bank-backed RTP, adoption growing.' }],
    Kenya: [{ title: 'M-Pesa', description: 'Over 90% penetration, also in Tanzania, Mozambique, etc.' }],
    Portugal: [{ title: 'MB WAY', description: 'Popular for QR payments, instant transfers.' }],
    Poland: [{ title: 'BLIK', description: '1.5B txns/year, widely used mobile payment app.' }],
    Spain: [{ title: 'Bizum', description: 'Instant P2P + merchant payments, deeply bank-integrated.' }],
    'United States': [
        { title: 'Cash App', description: '50M+ users, QR-based, popular for P2P.' },
        { title: 'Venmo', description: 'Owned by PayPal, strong in P2P payments.' },
    ],
    Nigeria: [{ title: 'Airtel Money', description: 'Mobile money leader in Nigeria; also MTN MoMo is relevant.' }],
    Malaysia: [{ title: 'DuitNow', description: 'Instant payments, QR-based, regional links.' }],
    Thailand: [{ title: 'PromptPay', description: '10B txns in 2024, QR-based.' }],
    Australia: [{ title: 'NPP', description: 'National RTP infrastructure, 2.2B txns/year.' }],
    'United Kingdom': [{ title: 'FPS', description: 'Longstanding RTP system, 5B txns/year.' }],
    'South Africa': [{ title: 'PayShap', description: 'Newer RTP system, promotes inclusion.' }],
    Sweden: [{ title: 'Swish', description: 'Widely adopted for P2P and retail.' }],
    Indonesia: [{ title: 'QRIS', description: 'QR code standard, growing rapidly.' }],
    Philippines: [{ title: 'GCash', description: 'Leading wallet, supports RTP + QR payments.' }],
    Vietnam: [{ title: 'MoMo', description: 'Most popular mobile wallet, instant transfers.' }],
    Colombia: [{ title: 'Transfiya', description: 'Inspired by Pix, expanding fast.' }],
    Peru: [{ title: 'Yape', description: 'QR-based app, high user growth.' }],
    'Costa Rica': [{ title: 'SINPE Móvil', description: 'Mobile RTP system for instant transfers.' }],
    Singapore: [{ title: 'PayNow', description: 'Mobile number + QR-based RTP.' }],
    Japan: [{ title: 'Zengin-Net', description: 'Real-time interbank network, legacy base.' }],
    UAE: [{ title: 'UAEFTS', description: 'Central bank RTP system, modernizing rapidly.' }],
    'Saudi Arabia': [{ title: 'SARIE', description: 'Real-time fund transfers, national scale.' }],
    Tanzania: [{ title: 'M-Pesa', description: 'Same infrastructure as Kenya.' }],
    Pakistan: [{ title: 'Raast', description: 'State-backed instant payments, scaling fast.' }],
    Turkey: [{ title: 'FAST', description: "Central bank's instant payment system." }],
    Canada: [{ title: 'Interac e-Transfer', description: 'Widely used for P2P and bill payments.' }],
}

export const countryData: CountryData[] = [
    {
        id: 'crypto',
        type: 'crypto',
        title: 'Crypto',
        description: '',
        path: 'crypto',
    },
    {
        id: 'AND',
        type: 'country',
        title: 'Andorra',
        currency: 'EUR',
        path: 'andorra',
    },
    {
        id: 'AE',
        type: 'country',
        title: 'United Arab Emirates',
        currency: 'AED',
        path: 'united-arab-emirates',
    },
    {
        id: 'AF',
        type: 'country',
        title: 'Afghanistan',
        currency: 'AFN',
        path: 'afghanistan',
    },
    {
        id: 'AG',
        type: 'country',
        title: 'Antigua and Barbuda',
        currency: 'XCD',
        path: 'antigua-and-barbuda',
    },
    {
        id: 'AI',
        type: 'country',
        title: 'Anguilla',
        currency: 'XCD',
        path: 'anguilla',
    },
    {
        id: 'AL',
        type: 'country',
        title: 'Albania',
        currency: 'ALL',
        path: 'albania',
    },
    {
        id: 'AM',
        type: 'country',
        title: 'Armenia',
        currency: 'AMD',
        path: 'armenia',
    },
    {
        id: 'AO',
        type: 'country',
        title: 'Angola',
        currency: 'AOA',
        path: 'angola',
    },
    {
        id: 'AQ',
        type: 'country',
        title: 'Antarctica',
        currency: '',
        path: 'antarctica',
    },
    {
        id: 'AR',
        type: 'country',
        title: 'Argentina',
        currency: 'ARS',
        path: 'argentina',
    },
    {
        id: 'AS',
        type: 'country',
        title: 'American Samoa',
        currency: 'USD',
        path: 'american-samoa',
    },
    {
        id: 'AUT',
        type: 'country',
        title: 'Austria',
        currency: 'EUR',
        path: 'austria',
    },
    {
        id: 'AU',
        type: 'country',
        title: 'Australia',
        currency: 'AUD',
        path: 'australia',
    },
    {
        id: 'AW',
        type: 'country',
        title: 'Aruba',
        currency: 'AWG',
        path: 'aruba',
    },
    {
        id: 'ALA',
        type: 'country',
        title: 'Åland',
        currency: 'EUR',
        path: 'aland',
    },
    {
        id: 'AZ',
        type: 'country',
        title: 'Azerbaijan',
        currency: 'AZN',
        path: 'azerbaijan',
    },
    {
        id: 'BA',
        type: 'country',
        title: 'Bosnia and Herzegovina',
        currency: 'BAM',
        path: 'bosnia-and-herzegovina',
    },
    {
        id: 'BB',
        type: 'country',
        title: 'Barbados',
        currency: 'BBD',
        path: 'barbados',
    },
    {
        id: 'BD',
        type: 'country',
        title: 'Bangladesh',
        currency: 'BDT',
        path: 'bangladesh',
    },
    {
        id: 'BEL',
        type: 'country',
        title: 'Belgium',
        currency: 'EUR',
        path: 'belgium',
    },
    {
        id: 'BF',
        type: 'country',
        title: 'Burkina Faso',
        currency: 'XOF',
        path: 'burkina-faso',
    },
    {
        id: 'BGR',
        type: 'country',
        title: 'Bulgaria',
        currency: 'BGN',
        path: 'bulgaria',
    },
    {
        id: 'BH',
        type: 'country',
        title: 'Bahrain',
        currency: 'BHD',
        path: 'bahrain',
    },
    {
        id: 'BI',
        type: 'country',
        title: 'Burundi',
        currency: 'BIF',
        path: 'burundi',
    },
    {
        id: 'BJ',
        type: 'country',
        title: 'Benin',
        currency: 'XOF',
        path: 'benin',
    },
    {
        id: 'BL',
        type: 'country',
        title: 'Saint Barthélemy',
        currency: 'EUR',
        path: 'saint-barthélemy',
    },
    {
        id: 'BM',
        type: 'country',
        title: 'Bermuda',
        currency: 'BMD',
        path: 'bermuda',
    },
    {
        id: 'BN',
        type: 'country',
        title: 'Brunei',
        currency: 'BND',
        path: 'brunei',
    },
    {
        id: 'BO',
        type: 'country',
        title: 'Bolivia',
        currency: 'BOB',
        path: 'bolivia',
    },
    {
        id: 'BQ',
        type: 'country',
        title: 'Bonaire',
        currency: 'USD',
        path: 'bonaire',
    },
    {
        id: 'BR',
        type: 'country',
        title: 'Brazil',
        currency: 'BRL',
        path: 'brazil',
    },
    {
        id: 'BS',
        type: 'country',
        title: 'Bahamas',
        currency: 'BSD',
        path: 'bahamas',
    },
    {
        id: 'BT',
        type: 'country',
        title: 'Bhutan',
        currency: 'BTN',
        path: 'bhutan',
    },
    {
        id: 'BV',
        type: 'country',
        title: 'Bouvet Island',
        currency: 'NOK',
        path: 'bouvet-island',
    },
    {
        id: 'BW',
        type: 'country',
        title: 'Botswana',
        currency: 'BWP',
        path: 'botswana',
    },
    {
        id: 'BY',
        type: 'country',
        title: 'Belarus',
        currency: 'BYN',
        path: 'belarus',
    },
    {
        id: 'BZ',
        type: 'country',
        title: 'Belize',
        currency: 'BZD',
        path: 'belize',
    },
    {
        id: 'CA',
        type: 'country',
        title: 'Canada',
        currency: 'CAD',
        path: 'canada',
    },
    {
        id: 'CC',
        type: 'country',
        title: 'Cocos (Keeling) Islands',
        currency: 'AUD',
        path: 'cocos-keeling-islands',
    },
    {
        id: 'CD',
        type: 'country',
        title: 'Democratic Republic of the Congo',
        currency: 'CDF',
        path: 'democratic-republic-of-the-congo',
    },
    {
        id: 'CF',
        type: 'country',
        title: 'Central African Republic',
        currency: 'XAF',
        path: 'central-african-republic',
    },
    {
        id: 'CG',
        type: 'country',
        title: 'Republic of the Congo',
        currency: 'XAF',
        path: 'republic-of-the-congo',
    },
    {
        id: 'CHE',
        type: 'country',
        title: 'Switzerland',
        currency: 'CHF',
        path: 'switzerland',
    },
    {
        id: 'CI',
        type: 'country',
        title: 'Ivory Coast',
        currency: 'XOF',
        path: 'ivory-coast',
    },
    {
        id: 'CK',
        type: 'country',
        title: 'Cook Islands',
        currency: 'NZD',
        path: 'cook-islands',
    },
    {
        id: 'CL',
        type: 'country',
        title: 'Chile',
        currency: 'CLP',
        path: 'chile',
    },
    {
        id: 'CM',
        type: 'country',
        title: 'Cameroon',
        currency: 'XAF',
        path: 'cameroon',
    },
    {
        id: 'CN',
        type: 'country',
        title: 'China',
        currency: 'CNY',
        path: 'china',
    },
    {
        id: 'CO',
        type: 'country',
        title: 'Colombia',
        currency: 'COP',
        path: 'colombia',
    },
    {
        id: 'CR',
        type: 'country',
        title: 'Costa Rica',
        currency: 'CRC',
        path: 'costa-rica',
    },
    {
        id: 'CU',
        type: 'country',
        title: 'Cuba',
        currency: 'CUP',
        path: 'cuba',
    },
    {
        id: 'CV',
        type: 'country',
        title: 'Cape Verde',
        currency: 'CVE',
        path: 'cape-verde',
    },
    {
        id: 'CW',
        type: 'country',
        title: 'Curacao',
        currency: 'ANG',
        path: 'curacao',
    },
    {
        id: 'CX',
        type: 'country',
        title: 'Christmas Island',
        currency: 'AUD',
        path: 'christmas-island',
    },
    {
        id: 'CYP',
        type: 'country',
        title: 'Cyprus',
        currency: 'EUR',
        path: 'cyprus',
    },
    {
        id: 'CZE',
        type: 'country',
        title: 'Czechia',
        currency: 'CZK',
        path: 'czechia',
    },
    {
        id: 'DEU',
        type: 'country',
        title: 'Germany',
        currency: 'EUR',
        path: 'germany',
    },
    {
        id: 'DJ',
        type: 'country',
        title: 'Djibouti',
        currency: 'DJF',
        path: 'djibouti',
    },
    {
        id: 'DNK',
        type: 'country',
        title: 'Denmark',
        currency: 'DKK',
        path: 'denmark',
    },
    {
        id: 'DM',
        type: 'country',
        title: 'Dominica',
        currency: 'XCD',
        path: 'dominica',
    },
    {
        id: 'DO',
        type: 'country',
        title: 'Dominican Republic',
        currency: 'DOP',
        path: 'dominican-republic',
    },
    {
        id: 'DZ',
        type: 'country',
        title: 'Algeria',
        currency: 'DZD',
        path: 'algeria',
    },
    {
        id: 'EC',
        type: 'country',
        title: 'Ecuador',
        currency: 'USD',
        path: 'ecuador',
    },
    {
        id: 'EST',
        type: 'country',
        title: 'Estonia',
        currency: 'EUR',
        path: 'estonia',
    },
    {
        id: 'EG',
        type: 'country',
        title: 'Egypt',
        currency: 'EGP',
        path: 'egypt',
    },
    {
        id: 'EH',
        type: 'country',
        title: 'Western Sahara',
        currency: 'MAD',
        path: 'western-sahara',
    },
    {
        id: 'ER',
        type: 'country',
        title: 'Eritrea',
        currency: 'ERN',
        path: 'eritrea',
    },
    {
        id: 'ESP',
        type: 'country',
        title: 'Spain',
        currency: 'EUR',
        path: 'spain',
    },
    {
        id: 'ET',
        type: 'country',
        title: 'Ethiopia',
        currency: 'ETB',
        path: 'ethiopia',
    },
    {
        id: 'FIN',
        type: 'country',
        title: 'Finland',
        currency: 'EUR',
        path: 'finland',
    },
    {
        id: 'FJ',
        type: 'country',
        title: 'Fiji',
        currency: 'FJD',
        path: 'fiji',
    },
    {
        id: 'FK',
        type: 'country',
        title: 'Falkland Islands',
        currency: 'FKP',
        path: 'falkland-islands',
    },
    {
        id: 'FM',
        type: 'country',
        title: 'Micronesia',
        currency: 'USD',
        path: 'micronesia',
    },
    {
        id: 'FO',
        type: 'country',
        title: 'Faroe Islands',
        currency: 'DKK',
        path: 'faroe-islands',
    },
    {
        id: 'FRA',
        type: 'country',
        title: 'France',
        currency: 'EUR',
        path: 'france',
    },
    {
        id: 'GA',
        type: 'country',
        title: 'Gabon',
        currency: 'XAF',
        path: 'gabon',
    },
    {
        id: 'GBR',
        type: 'country',
        title: 'United Kingdom',
        currency: 'GBP',
        path: 'united-kingdom',
    },
    {
        id: 'GD',
        type: 'country',
        title: 'Grenada',
        currency: 'XCD',
        path: 'grenada',
    },
    {
        id: 'GE',
        type: 'country',
        title: 'Georgia',
        currency: 'GEL',
        path: 'georgia',
    },
    {
        id: 'GUF',
        type: 'country',
        title: 'French Guiana',
        currency: 'EUR',
        path: 'french-guiana',
    },
    {
        id: 'GG',
        type: 'country',
        title: 'Guernsey',
        currency: 'GBP',
        path: 'guernsey',
    },
    {
        id: 'GH',
        type: 'country',
        title: 'Ghana',
        currency: 'GHS',
        path: 'ghana',
    },
    {
        id: 'GI',
        type: 'country',
        title: 'Gibraltar',
        currency: 'GIP',
        path: 'gibraltar',
    },
    {
        id: 'GL',
        type: 'country',
        title: 'Greenland',
        currency: 'DKK',
        path: 'greenland',
    },
    {
        id: 'GM',
        type: 'country',
        title: 'Gambia',
        currency: 'GMD',
        path: 'gambia',
    },
    {
        id: 'GN',
        type: 'country',
        title: 'Guinea',
        currency: 'GNF',
        path: 'guinea',
    },
    {
        id: 'GP',
        type: 'country',
        title: 'Guadeloupe',
        currency: 'EUR',
        path: 'guadeloupe',
    },
    {
        id: 'GQ',
        type: 'country',
        title: 'Equatorial Guinea',
        currency: 'XAF',
        path: 'equatorial-guinea',
    },
    {
        id: 'GR',
        type: 'country',
        title: 'Greece',
        currency: 'EUR',
        path: 'greece',
    },
    {
        id: 'GS',
        type: 'country',
        title: 'South Georgia and the South Sandwich Islands',
        currency: 'GBP',
        path: 'south-georgia-and-the-south-sandwich-islands',
    },
    {
        id: 'GT',
        type: 'country',
        title: 'Guatemala',
        currency: 'GTQ',
        path: 'guatemala',
    },
    {
        id: 'GU',
        type: 'country',
        title: 'Guam',
        currency: 'USD',
        path: 'guam',
    },
    {
        id: 'GW',
        type: 'country',
        title: 'Guinea-Bissau',
        currency: 'XOF',
        path: 'guinea-bissau',
    },
    {
        id: 'GY',
        type: 'country',
        title: 'Guyana',
        currency: 'GYD',
        path: 'guyana',
    },
    {
        id: 'HK',
        type: 'country',
        title: 'Hong Kong',
        currency: 'HKD',
        path: 'hong-kong',
    },
    {
        id: 'HM',
        type: 'country',
        title: 'Heard Island and McDonald Islands',
        currency: 'AUD',
        path: 'heard-island-and-mcdonald-islands',
    },
    {
        id: 'HN',
        type: 'country',
        title: 'Honduras',
        currency: 'HNL',
        path: 'honduras',
    },
    {
        id: 'HRV',
        type: 'country',
        title: 'Croatia',
        currency: 'EUR',
        path: 'croatia',
    },
    {
        id: 'HT',
        type: 'country',
        title: 'Haiti',
        currency: 'HTG',
        path: 'haiti',
    },
    {
        id: 'HUN',
        type: 'country',
        title: 'Hungary',
        currency: 'HUF',
        path: 'hungary',
    },
    {
        id: 'ID',
        type: 'country',
        title: 'Indonesia',
        currency: 'IDR',
        path: 'indonesia',
    },
    {
        id: 'IRL',
        type: 'country',
        title: 'Ireland',
        currency: 'EUR',
        path: 'ireland',
    },
    {
        id: 'IL',
        type: 'country',
        title: 'Israel',
        currency: 'ILS',
        path: 'israel',
    },
    {
        id: 'IM',
        type: 'country',
        title: 'Isle of Man',
        currency: 'GBP',
        path: 'isle-of-man',
    },
    {
        id: 'IN',
        type: 'country',
        title: 'India',
        currency: 'INR',
        path: 'india',
    },
    {
        id: 'IO',
        type: 'country',
        title: 'British Indian Ocean Territory',
        currency: 'USD',
        path: 'british-indian-ocean-territory',
    },
    {
        id: 'IQ',
        type: 'country',
        title: 'Iraq',
        currency: 'IQD',
        path: 'iraq',
    },
    {
        id: 'IR',
        type: 'country',
        title: 'Iran',
        currency: 'IRR',
        path: 'iran',
    },
    {
        id: 'ISL',
        type: 'country',
        title: 'Iceland',
        currency: 'ISK',
        path: 'iceland',
    },
    {
        id: 'ITA',
        type: 'country',
        title: 'Italy',
        currency: 'EUR',
        path: 'italy',
    },
    {
        id: 'JE',
        type: 'country',
        title: 'Jersey',
        currency: 'GBP',
        path: 'jersey',
    },
    {
        id: 'JM',
        type: 'country',
        title: 'Jamaica',
        currency: 'JMD',
        path: 'jamaica',
    },
    {
        id: 'JO',
        type: 'country',
        title: 'Jordan',
        currency: 'JOD',
        path: 'jordan',
    },
    {
        id: 'JP',
        type: 'country',
        title: 'Japan',
        currency: 'JPY',
        path: 'japan',
    },
    {
        id: 'KE',
        type: 'country',
        title: 'Kenya',
        currency: 'KES',
        path: 'kenya',
    },
    {
        id: 'KG',
        type: 'country',
        title: 'Kyrgyzstan',
        currency: 'KGS',
        path: 'kyrgyzstan',
    },
    {
        id: 'KH',
        type: 'country',
        title: 'Cambodia',
        currency: 'KHR',
        path: 'cambodia',
    },
    {
        id: 'KI',
        type: 'country',
        title: 'Kiribati',
        currency: 'AUD',
        path: 'kiribati',
    },
    {
        id: 'KM',
        type: 'country',
        title: 'Comoros',
        currency: 'KMF',
        path: 'comoros',
    },
    {
        id: 'KN',
        type: 'country',
        title: 'Saint Kitts and Nevis',
        currency: 'XCD',
        path: 'saint-kitts-and-nevis',
    },
    {
        id: 'KP',
        type: 'country',
        title: 'North Korea',
        currency: 'KPW',
        path: 'north-korea',
    },
    {
        id: 'KR',
        type: 'country',
        title: 'South Korea',
        currency: 'KRW',
        path: 'south-korea',
    },
    {
        id: 'KW',
        type: 'country',
        title: 'Kuwait',
        currency: 'KWD',
        path: 'kuwait',
    },
    {
        id: 'KY',
        type: 'country',
        title: 'Cayman Islands',
        currency: 'KYD',
        path: 'cayman-islands',
    },
    {
        id: 'KZ',
        type: 'country',
        title: 'Kazakhstan',
        currency: 'KZT',
        path: 'kazakhstan',
    },
    {
        id: 'LA',
        type: 'country',
        title: 'Laos',
        currency: 'LAK',
        path: 'laos',
    },
    {
        id: 'LB',
        type: 'country',
        title: 'Lebanon',
        currency: 'LBP',
        path: 'lebanon',
    },
    {
        id: 'LC',
        type: 'country',
        title: 'Saint Lucia',
        currency: 'XCD',
        path: 'saint-lucia',
    },
    {
        id: 'LI',
        type: 'country',
        title: 'Liechtenstein',
        currency: 'CHF',
        path: 'liechtenstein',
    },
    {
        id: 'LK',
        type: 'country',
        title: 'Sri Lanka',
        currency: 'LKR',
        path: 'sri-lanka',
    },
    {
        id: 'LR',
        type: 'country',
        title: 'Liberia',
        currency: 'LRD',
        path: 'liberia',
    },
    {
        id: 'LS',
        type: 'country',
        title: 'Lesotho',
        currency: 'LSL',
        path: 'lesotho',
    },
    {
        id: 'LTU',
        type: 'country',
        title: 'Lithuania',
        currency: 'EUR',
        path: 'lithuania',
    },
    {
        id: 'LUX',
        type: 'country',
        title: 'Luxembourg',
        currency: 'EUR',
        path: 'luxembourg',
    },
    {
        id: 'LVA',
        type: 'country',
        title: 'Latvia',
        currency: 'EUR',
        path: 'latvia',
    },
    {
        id: 'LY',
        type: 'country',
        title: 'Libya',
        currency: 'LYD',
        path: 'libya',
    },
    {
        id: 'MA',
        type: 'country',
        title: 'Morocco',
        currency: 'MAD',
        path: 'morocco',
    },
    {
        id: 'MC',
        type: 'country',
        title: 'Monaco',
        currency: 'EUR',
        path: 'monaco',
    },
    {
        id: 'MD',
        type: 'country',
        title: 'Moldova',
        currency: 'MDL',
        path: 'moldova',
    },
    {
        id: 'ME',
        type: 'country',
        title: 'Montenegro',
        currency: 'EUR',
        path: 'montenegro',
    },
    {
        id: 'MAF',
        type: 'country',
        title: 'Saint Martin',
        currency: 'EUR',
        path: 'saint-martin',
    },
    {
        id: 'MG',
        type: 'country',
        title: 'Madagascar',
        currency: 'MGA',
        path: 'madagascar',
    },
    {
        id: 'MH',
        type: 'country',
        title: 'Marshall Islands',
        currency: 'USD',
        path: 'marshall-islands',
    },
    {
        id: 'MK',
        type: 'country',
        title: 'Macedonia',
        currency: 'MKD',
        path: 'macedonia',
    },
    {
        id: 'ML',
        type: 'country',
        title: 'Mali',
        currency: 'XOF',
        path: 'mali',
    },
    {
        id: 'MM',
        type: 'country',
        title: 'Myanmar [Burma]',
        currency: 'MMK',
        path: 'myanmar-burma',
    },
    {
        id: 'MN',
        type: 'country',
        title: 'Mongolia',
        currency: 'MNT',
        path: 'mongolia',
    },
    {
        id: 'MO',
        type: 'country',
        title: 'Macao',
        currency: 'MOP',
        path: 'macao',
    },
    {
        id: 'MP',
        type: 'country',
        title: 'Northern Mariana Islands',
        currency: 'USD',
        path: 'northern-mariana-islands',
    },
    {
        id: 'MTQ',
        type: 'country',
        title: 'Martinique',
        currency: 'EUR',
        path: 'martinique',
    },
    {
        id: 'MR',
        type: 'country',
        title: 'Mauritania',
        currency: 'MRU',
        path: 'mauritania',
    },
    {
        id: 'MS',
        type: 'country',
        title: 'Montserrat',
        currency: 'XCD',
        path: 'montserrat',
    },
    {
        id: 'MLT',
        type: 'country',
        title: 'Malta',
        currency: 'EUR',
        path: 'malta',
    },
    {
        id: 'MU',
        type: 'country',
        title: 'Mauritius',
        currency: 'MUR',
        path: 'mauritius',
    },
    {
        id: 'MV',
        type: 'country',
        title: 'Maldives',
        currency: 'MVR',
        path: 'maldives',
    },
    {
        id: 'MW',
        type: 'country',
        title: 'Malawi',
        currency: 'MWK',
        path: 'malawi',
    },
    {
        id: 'MX',
        type: 'country',
        title: 'Mexico',
        currency: 'MXN',
        path: 'mexico',
    },
    {
        id: 'MY',
        type: 'country',
        title: 'Malaysia',
        currency: 'MYR',
        path: 'malaysia',
    },
    {
        id: 'MZ',
        type: 'country',
        title: 'Mozambique',
        currency: 'MZN',
        path: 'mozambique',
    },
    {
        id: 'NA',
        type: 'country',
        title: 'Namibia',
        currency: 'NAD',
        path: 'namibia',
    },
    {
        id: 'NC',
        type: 'country',
        title: 'New Caledonia',
        currency: 'XPF',
        path: 'new-caledonia',
    },
    {
        id: 'NE',
        type: 'country',
        title: 'Niger',
        currency: 'XOF',
        path: 'niger',
    },
    {
        id: 'NF',
        type: 'country',
        title: 'Norfolk Island',
        currency: 'AUD',
        path: 'norfolk-island',
    },
    {
        id: 'NG',
        type: 'country',
        title: 'Nigeria',
        currency: 'NGN',
        path: 'nigeria',
    },
    {
        id: 'NI',
        type: 'country',
        title: 'Nicaragua',
        currency: 'NIO',
        path: 'nicaragua',
    },
    {
        id: 'NLD',
        type: 'country',
        title: 'Netherlands',
        currency: 'EUR',
        path: 'netherlands',
    },
    {
        id: 'NOR',
        type: 'country',
        title: 'Norway',
        currency: 'NOK',
        path: 'norway',
    },
    {
        id: 'NP',
        type: 'country',
        title: 'Nepal',
        currency: 'NPR',
        path: 'nepal',
    },
    {
        id: 'NR',
        type: 'country',
        title: 'Nauru',
        currency: 'AUD',
        path: 'nauru',
    },
    {
        id: 'NU',
        type: 'country',
        title: 'Niue',
        currency: 'NZD',
        path: 'niue',
    },
    {
        id: 'NZ',
        type: 'country',
        title: 'New Zealand',
        currency: 'NZD',
        path: 'new-zealand',
    },
    {
        id: 'OM',
        type: 'country',
        title: 'Oman',
        currency: 'OMR',
        path: 'oman',
    },
    {
        id: 'PA',
        type: 'country',
        title: 'Panama',
        currency: 'PAB',
        path: 'panama',
    },
    {
        id: 'PE',
        type: 'country',
        title: 'Peru',
        currency: 'PEN',
        path: 'peru',
    },
    {
        id: 'PF',
        type: 'country',
        title: 'French Polynesia',
        currency: 'XPF',
        path: 'french-polynesia',
    },
    {
        id: 'PG',
        type: 'country',
        title: 'Papua New Guinea',
        currency: 'PGK',
        path: 'papua-new-guinea',
    },
    {
        id: 'PH',
        type: 'country',
        title: 'Philippines',
        currency: 'PHP',
        path: 'philippines',
    },
    {
        id: 'PK',
        type: 'country',
        title: 'Pakistan',
        currency: 'PKR',
        path: 'pakistan',
    },
    {
        id: 'PL',
        type: 'country',
        title: 'Poland',
        currency: 'PLN',
        path: 'poland',
    },
    {
        id: 'PM',
        type: 'country',
        title: 'Saint Pierre and Miquelon',
        currency: 'EUR',
        path: 'saint-pierre-and-miquelon',
    },
    {
        id: 'PN',
        type: 'country',
        title: 'Pitcairn Islands',
        currency: 'NZD',
        path: 'pitcairn-islands',
    },
    {
        id: 'PR',
        type: 'country',
        title: 'Puerto Rico',
        currency: 'USD',
        path: 'puerto-rico',
    },
    {
        id: 'PS',
        type: 'country',
        title: 'Palestine',
        currency: 'ILS',
        path: 'palestine',
    },
    {
        id: 'PRT',
        type: 'country',
        title: 'Portugal',
        currency: 'EUR',
        path: 'portugal',
    },
    {
        id: 'PW',
        type: 'country',
        title: 'Palau',
        currency: 'USD',
        path: 'palau',
    },
    {
        id: 'PY',
        type: 'country',
        title: 'Paraguay',
        currency: 'PYG',
        path: 'paraguay',
    },
    {
        id: 'QA',
        type: 'country',
        title: 'Qatar',
        currency: 'QAR',
        path: 'qatar',
    },
    {
        id: 'REU',
        type: 'country',
        title: 'Réunion',
        currency: 'EUR',
        path: 'reunion',
    },
    {
        id: 'ROU',
        type: 'country',
        title: 'Romania',
        currency: 'RON',
        path: 'romania',
    },
    {
        id: 'RS',
        type: 'country',
        title: 'Serbia',
        currency: 'RSD',
        path: 'serbia',
    },
    {
        id: 'RU',
        type: 'country',
        title: 'Russia',
        currency: 'RUB',
        path: 'russia',
    },
    {
        id: 'RW',
        type: 'country',
        title: 'Rwanda',
        currency: 'RWF',
        path: 'rwanda',
    },
    {
        id: 'SA',
        type: 'country',
        title: 'Saudi Arabia',
        currency: 'SAR',
        path: 'saudi-arabia',
    },
    {
        id: 'SB',
        type: 'country',
        title: 'Solomon Islands',
        currency: 'SBD',
        path: 'solomon-islands',
    },
    {
        id: 'SC',
        type: 'country',
        title: 'Seychelles',
        currency: 'SCR',
        path: 'seychelles',
    },
    {
        id: 'SD',
        type: 'country',
        title: 'Sudan',
        currency: 'SDG',
        path: 'sudan',
    },
    {
        id: 'SE',
        type: 'country',
        title: 'Sweden',
        currency: 'SEK',
        path: 'sweden',
    },
    {
        id: 'SG',
        type: 'country',
        title: 'Singapore',
        currency: 'SGD',
        path: 'singapore',
    },
    {
        id: 'SH',
        type: 'country',
        title: 'Saint Helena',
        currency: 'SHP',
        path: 'saint-helena',
    },
    {
        id: 'SVN',
        type: 'country',
        title: 'Slovenia',
        currency: 'EUR',
        path: 'slovenia',
    },
    {
        id: 'SJ',
        type: 'country',
        title: 'Svalbard and Jan Mayen',
        currency: 'NOK',
        path: 'svalbard-and-jan-mayen',
    },
    {
        id: 'SVK',
        type: 'country',
        title: 'Slovakia',
        currency: 'EUR',
        path: 'slovakia',
    },
    {
        id: 'SL',
        type: 'country',
        title: 'Sierra Leone',
        currency: 'SLL',
        path: 'sierra-leone',
    },
    {
        id: 'SM',
        type: 'country',
        title: 'San Marino',
        currency: 'EUR',
        path: 'san-marino',
    },
    {
        id: 'SN',
        type: 'country',
        title: 'Senegal',
        currency: 'XOF',
        path: 'senegal',
    },
    {
        id: 'SO',
        type: 'country',
        title: 'Somalia',
        currency: 'SOS',
        path: 'somalia',
    },
    {
        id: 'SR',
        type: 'country',
        title: 'Suriname',
        currency: 'SRD',
        path: 'suriname',
    },
    {
        id: 'SS',
        type: 'country',
        title: 'South Sudan',
        currency: 'SSP',
        path: 'south-sudan',
    },
    {
        id: 'ST',
        type: 'country',
        title: 'São Tomé and Príncipe',
        currency: 'STD',
        path: 'sao-tome-and-principe',
    },
    {
        id: 'SV',
        type: 'country',
        title: 'El Salvador',
        currency: 'USD',
        path: 'el-salvador',
    },
    {
        id: 'SX',
        type: 'country',
        title: 'Sint Maarten',
        currency: 'ANG',
        path: 'sint-maarten',
    },
    {
        id: 'SY',
        type: 'country',
        title: 'Syria',
        currency: 'SYP',
        path: 'syria',
    },
    {
        id: 'SZ',
        type: 'country',
        title: 'Swaziland',
        currency: 'SZL',
        path: 'swaziland',
    },
    {
        id: 'TC',
        type: 'country',
        title: 'Turks and Caicos Islands',
        currency: 'USD',
        path: 'turks-and-caicos-islands',
    },
    {
        id: 'TD',
        type: 'country',
        title: 'Chad',
        currency: 'XAF',
        path: 'chad',
    },
    {
        id: 'TF',
        type: 'country',
        title: 'French Southern Territories',
        currency: 'EUR',
        path: 'french-southern-territories',
    },
    {
        id: 'TG',
        type: 'country',
        title: 'Togo',
        currency: 'XOF',
        path: 'togo',
    },
    {
        id: 'TH',
        type: 'country',
        title: 'Thailand',
        currency: 'THB',
        path: 'thailand',
    },
    {
        id: 'TJ',
        type: 'country',
        title: 'Tajikistan',
        currency: 'TJS',
        path: 'tajikistan',
    },
    {
        id: 'TK',
        type: 'country',
        title: 'Tokelau',
        currency: 'NZD',
        path: 'tokelau',
    },
    {
        id: 'TL',
        type: 'country',
        title: 'East Timor',
        currency: 'USD',
        path: 'east-timor',
    },
    {
        id: 'TM',
        type: 'country',
        title: 'Turkmenistan',
        currency: 'TMT',
        path: 'turkmenistan',
    },
    {
        id: 'TN',
        type: 'country',
        title: 'Tunisia',
        currency: 'TND',
        path: 'tunisia',
    },
    {
        id: 'TO',
        type: 'country',
        title: 'Tonga',
        currency: 'TOP',
        path: 'tonga',
    },
    {
        id: 'TR',
        type: 'country',
        title: 'Turkey',
        currency: 'TRY',
        path: 'turkey',
    },
    {
        id: 'TT',
        type: 'country',
        title: 'Trinidad and Tobago',
        currency: 'TTD',
        path: 'trinidad-and-tobago',
    },
    {
        id: 'TV',
        type: 'country',
        title: 'Tuvalu',
        currency: 'AUD',
        path: 'tuvalu',
    },
    {
        id: 'TW',
        type: 'country',
        title: 'Taiwan',
        currency: 'TWD',
        path: 'taiwan',
    },
    {
        id: 'TZ',
        type: 'country',
        title: 'Tanzania',
        currency: 'TZS',
        path: 'tanzania',
    },
    {
        id: 'UA',
        type: 'country',
        title: 'Ukraine',
        currency: 'UAH',
        path: 'ukraine',
    },
    {
        id: 'UG',
        type: 'country',
        title: 'Uganda',
        currency: 'UGX',
        path: 'uganda',
    },
    {
        id: 'UM',
        type: 'country',
        title: 'U.S. Minor Outlying Islands',
        currency: 'USD',
        path: 'u.s.-minor-outlying-islands',
    },
    {
        id: 'US',
        type: 'country',
        title: 'United States',
        currency: 'USD',
        path: 'usa',
    },
    {
        id: 'UY',
        type: 'country',
        title: 'Uruguay',
        currency: 'UYU',
        path: 'uruguay',
    },
    {
        id: 'UZ',
        type: 'country',
        title: 'Uzbekistan',
        currency: 'UZS',
        path: 'uzbekistan',
    },
    {
        id: 'VA',
        type: 'country',
        title: 'Vatican City',
        currency: 'EUR',
        path: 'vatican-city',
    },
    {
        id: 'VC',
        type: 'country',
        title: 'Saint Vincent and the Grenadines',
        currency: 'XCD',
        path: 'saint-vincent-and-the-grenadines',
    },
    {
        id: 'VE',
        type: 'country',
        title: 'Venezuela',
        currency: 'VEF',
        path: 'venezuela',
    },
    {
        id: 'VG',
        type: 'country',
        title: 'British Virgin Islands',
        currency: 'USD',
        path: 'british-virgin-islands',
    },
    {
        id: 'VI',
        type: 'country',
        title: 'U.S. Virgin Islands',
        currency: 'USD',
        path: 'us-virgin-islands',
    },
    {
        id: 'VN',
        type: 'country',
        title: 'Vietnam',
        currency: 'VND',
        path: 'vietnam',
    },
    {
        id: 'VU',
        type: 'country',
        title: 'Vanuatu',
        currency: 'VUV',
        path: 'vanuatu',
    },
    {
        id: 'WF',
        type: 'country',
        title: 'Wallis and Futuna',
        currency: 'XPF',
        path: 'wallis-and-futuna',
    },
    {
        id: 'WS',
        type: 'country',
        title: 'Samoa',
        currency: 'WST',
        path: 'samoa',
    },
    {
        id: 'XK',
        type: 'country',
        title: 'Kosovo',
        currency: 'EUR',
        path: 'kosovo',
    },
    {
        id: 'YE',
        type: 'country',
        title: 'Yemen',
        currency: 'YER',
        path: 'yemen',
    },
    {
        id: 'YT',
        type: 'country',
        title: 'Mayotte',
        currency: 'EUR',
        path: 'mayotte',
    },
    {
        id: 'ZA',
        type: 'country',
        title: 'South Africa',
        currency: 'ZAR',
        path: 'south-africa',
    },
    {
        id: 'ZM',
        type: 'country',
        title: 'Zambia',
        currency: 'ZMW',
        path: 'zambia',
    },
    {
        id: 'ZW',
        type: 'country',
        title: 'Zimbabwe',
        currency: 'ZWL',
        path: 'zimbabwe',
    },
]

export const COUNTRY_SPECIFIC_METHODS: Record<string, CountrySpecificMethods> = {}

// LATAM country codes
const LATAM_COUNTRY_CODES = [
    'AR',
    'BO',
    'BR',
    'CL',
    'CO',
    'CR',
    'CU',
    'DO',
    'EC',
    'SV',
    'GT',
    'HN',
    'HT',
    'MX',
    'NI',
    'PA',
    'PY',
    'PE',
    'PR',
    'UY',
    'VE',
]

// bridge EAA country codes, source: https://apidocs.bridge.xyz/docs/sepa-euro-transactions
// note: this is a map of 3-letter country codes to 2-letter country codes, for flags to work, bridge expects 3 letter codes
export const countryCodeMap: { [key: string]: string } = {
    ALA: 'AX',
    AND: 'AD',
    AUT: 'AT',
    BEL: 'BE',
    BGR: 'BG',
    HRV: 'HR',
    CYP: 'CY',
    CZE: 'CZ',
    DNK: 'DK',
    EST: 'EE',
    FIN: 'FI',
    FRA: 'FR',
    GUF: 'GF',
    DEU: 'DE',
    GRC: 'GR',
    GLP: 'GP',
    HUN: 'HU',
    ISL: 'IS',
    IRL: 'IE',
    ITA: 'IT',
    LVA: 'LV',
    LIE: 'LI',
    LTU: 'LT',
    LUX: 'LU',
    MLT: 'MT',
    MTQ: 'MQ',
    MYT: 'YT',
    NLD: 'NL',
    NOR: 'NO',
    POL: 'PL',
    PRT: 'PT',
    REU: 'RE',
    ROU: 'RO',
    MAF: 'MF',
    SVK: 'SK',
    SVN: 'SI',
    ESP: 'ES',
    SWE: 'SE',
    CHE: 'CH',
    GBR: 'GB',
    USA: 'US',
}

const enabledBankTransferCountries = new Set([...Object.values(countryCodeMap), 'US', 'MX'])

// Helper function to check if a country code is enabled for bank transfers
// Handles both 2-letter and 3-letter country codes
const isCountryEnabledForBankTransfer = (countryCode: string): boolean => {
    // Direct check for 2-letter codes
    if (enabledBankTransferCountries.has(countryCode)) {
        return true
    }

    // Check if it's a 3-letter code that maps to an enabled 2-letter code
    const mappedCode = countryCodeMap[countryCode]
    return mappedCode ? enabledBankTransferCountries.has(mappedCode) : false
}

countryData.forEach((country) => {
    if (country.type === 'country') {
        const countryCode = country.id
        const countryTitle = country.title

        const withdrawList: SpecificPaymentMethod[] = []

        // 1. add specific country withdrawal methods
        const specificMethodDetails = countrySpecificWithdrawMethods[countryTitle]
        if (specificMethodDetails && specificMethodDetails.length > 0) {
            specificMethodDetails.forEach((method) => {
                withdrawList.push({
                    id: `${countryCode.toLowerCase()}-${method.title.toLowerCase().replace(/\s+/g, '-')}-withdraw`,
                    icon: method.icon ?? undefined,
                    title: method.title,
                    description: method.description,
                    isSoon: true,
                })
            })
        }

        // 2. add SEPA for EUR countries if not already present from specifics
        if (country.currency === 'EUR' && countrySpecificWithdrawMethods['Germany']) {
            // Germany as proxy for SEPA availability
            const sepaExists = withdrawList.some((m) => m.title === 'SEPA Instant')
            if (!sepaExists) {
                withdrawList.push({
                    id: `${countryCode.toLowerCase()}-sepa-instant-withdraw`,
                    icon: 'bank' as IconName,
                    title: 'SEPA Instant',
                    description: 'EU-wide real-time bank transfers.',
                    isSoon: false,
                })
            }
        }

        // 3. add DEFAULT_BANK_WITHDRAW_METHOD if an identical method (by title and icon) is not already present
        // AND if SEPA was added, don't add default bank
        const defaultBankTitle = DEFAULT_BANK_WITHDRAW_METHOD.title
        const defaultBankIcon = DEFAULT_BANK_WITHDRAW_METHOD.icon

        const sepaWasAdded = withdrawList.some((m) => m.id.endsWith('-sepa-instant-withdraw'))

        const genericBankExists = withdrawList.some((m) => m.title === defaultBankTitle && m.icon === defaultBankIcon)

        // only add default bank if it doesn't already exist AND (SEPA was not added OR it's not considered redundant by SEPA)
        // for now, we simplify: if SEPA was added, we assume default bank is redundant.
        if (!genericBankExists && !sepaWasAdded) {
            withdrawList.push({
                ...DEFAULT_BANK_WITHDRAW_METHOD,
                id: `${countryCode.toLowerCase()}-default-bank-withdraw`,
                path: `/withdraw/${countryCode.toLowerCase()}/bank`,
                isSoon: !isCountryEnabledForBankTransfer(countryCode),
            })
        }

        const cryptoWithdrawMethod = DEFAULT_WITHDRAW_METHODS.find((m) => m.id === 'crypto-withdraw')
        if (cryptoWithdrawMethod) {
            const cryptoExists = withdrawList.some((m) => m.id === 'crypto-withdraw')
            if (!cryptoExists) {
                withdrawList.unshift(cryptoWithdrawMethod)
            }
        }

        // filter add methods: include Mercado Pago only for LATAM countries
        const currentAddMethods = UPDATED_DEFAULT_ADD_MONEY_METHODS.filter((method) => {
            if (method.id === 'mercado-pago-add') {
                return LATAM_COUNTRY_CODES.includes(countryCode)
            }
            return true
        }).map((m) => {
            const newMethod = { ...m }
            if (newMethod.id === 'bank-transfer-add') {
                newMethod.path = `/add-money/${country.path}/bank`
                newMethod.isSoon = !isCountryEnabledForBankTransfer(countryCode) || countryCode === 'MX'
            } else if (newMethod.id === 'crypto-add') {
                newMethod.path = `/add-money/crypto`
                newMethod.isSoon = false
            } else {
                newMethod.isSoon = true
            }
            return newMethod
        })

        // Add country-specific add methods (same as withdraw methods for consistency)
        if (specificMethodDetails && specificMethodDetails.length > 0) {
            specificMethodDetails.forEach((method) => {
                currentAddMethods.push({
                    id: `${countryCode.toLowerCase()}-${method.title.toLowerCase().replace(/\s+/g, '-')}-add`,
                    icon: method.icon ?? undefined,
                    title: method.title,
                    description: method.description,
                    isSoon: true,
                })
            })
        }

        COUNTRY_SPECIFIC_METHODS[countryCode] = {
            add: currentAddMethods,
            withdraw: withdrawList,
        }
    }
})
