export const MANTECA_DEPOSIT_ADDRESS = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'

// QR-payment funding wallets, split by rail country (Manteca request, 2026-07-21):
// Argentine QRs (MercadoPago / QR3) fund the AR wallet; Pix — and eventually any
// non-Argentina QR — funds the non-AR wallet. Bank withdrawals and claims still
// fund MANTECA_DEPOSIT_ADDRESS. Mirrors peanut-api-ts/src/manteca/consts.ts.
export const MANTECA_QR_DEPOSIT_ADDRESS_AR = '0x6E945f8EC93061f5f11Edc5e6Fb4A70BeB514e97'
export const MANTECA_QR_DEPOSIT_ADDRESS_NON_AR = '0x49200bF84dC26349C86ce040019063FeCE88CB1c'

export const MANTECA_ARG_DEPOSIT_NAME = 'Sixalime Sas'
export const MANTECA_ARG_DEPOSIT_CUIT = '30-71678845-3'

// ui mirror of peanut-api-ts/src/manteca/consts.ts MANTECA_SUPPORTED_COUNTRIES.
// first-party manteca bank/kyc rails are currently active only in argentina and brazil.
export const MANTECA_SUPPORTED_EXCHANGES = {
    AR: 'ARGENTINA',
    BR: 'BRAZIL',
} as const

export const MANTECA_SUPPORTED_COUNTRY_PATHS = ['argentina', 'brazil'] as const

// type for manteca countries
export type MantecaCountry = (typeof MANTECA_SUPPORTED_COUNTRY_PATHS)[number]

// helper function to check if a country uses manteca
export const isMantecaCountry = (countryPath: string | null | undefined): boolean => {
    if (!countryPath) return false
    return MANTECA_SUPPORTED_COUNTRY_PATHS.includes(countryPath as MantecaCountry)
}

export const isMantecaSupportedCountryCode = (countryCode: string | null | undefined): boolean => {
    if (!countryCode) return false
    return Object.prototype.hasOwnProperty.call(MANTECA_SUPPORTED_EXCHANGES, countryCode.toUpperCase())
}

export enum MantecaAccountType {
    SAVINGS = 'SAVINGS',
    CHECKING = 'CHECKING',
    DEBIT = 'DEBIT',
    PHONE = 'PHONE',
    VISTA = 'VISTA',
    RUT = 'RUT',
}

export type MantecaBankCode = {
    code: string
    name: string
}

type MantecaCountryConfig = {
    accountNumberLabel: string
    depositAddressLabel: string
} & (
    | {
          needsBankCode: true
          needsAccountType: true
          validAccountTypes: MantecaAccountType[]
          validBankCodes: MantecaBankCode[]
      }
    | {
          needsBankCode: false
          needsAccountType: false
      }
)

/**
 * destination field config for manteca country forms.
 * this is not an eligibility gate; use isMantecaCountry or
 * isMantecaSupportedCountryCode for routing.
 *
 * @see https://docs.manteca.dev/cripto/start-operating/manual-operation/requesting-a-withdraw/defining-the-destination
 */
export const MANTECA_COUNTRIES_CONFIG: Record<string, MantecaCountryConfig> = {
    AR: {
        accountNumberLabel: 'CBU, CVU or Alias',
        depositAddressLabel: 'CBU',
        needsBankCode: false,
        needsAccountType: false,
    },
    BR: {
        accountNumberLabel: 'PIX Key (Include +55 in case of phone number)',
        depositAddressLabel: 'PIX Key',
        needsBankCode: false,
        needsAccountType: false,
    },
    BO: {
        accountNumberLabel: 'Account Number',
        depositAddressLabel: 'Deposit Address',
        needsBankCode: true,
        needsAccountType: true,
        validAccountTypes: [MantecaAccountType.CHECKING, MantecaAccountType.SAVINGS],
        validBankCodes: [
            { code: '001', name: 'BANCO MERCANTIL' },
            { code: '002', name: 'BANCO NACIONAL DE BOLIVIA' },
            { code: '003', name: 'BANCO DE CRÉDITO DE BOLIVIA' },
            { code: '005', name: 'BANCO BISA' },
            { code: '006', name: 'BANCO UNIÓN' },
            { code: '007', name: 'BANCO ECONÓMICO' },
            { code: '008', name: 'BANCO SOLIDARIO' },
            { code: '009', name: 'BANCO GANADERO' },
            { code: '011', name: 'LA PRIMERA ENTIDAD FINANCIERA DE VIVIENDA (EX MUTUAL LA PRIMERA)' },
            { code: '013', name: 'MUTUAL LA PROMOTORA' },
            { code: '014', name: 'EL PROGRESO ENTIDAD FINANCIERA DE VIVIENDA (EX MUTUAL EL PROGRESO)' },
            { code: '022', name: 'COOPERATIVA JESÚS NAZARENO' },
            { code: '023', name: 'COOPERATIVA SAN MARTIN' },
            { code: '024', name: 'COOPERATIVA FÁTIMA' },
            { code: '029', name: 'COOPERATIVA PIO X' },
            { code: '031', name: 'COOPERATIVA QUILLACOLLO' },
            { code: '033', name: 'COOPERATIVA TRINIDAD' },
            { code: '034', name: 'COOPERATIVA COMARAPA' },
            { code: '035', name: 'COOPERATIVA SAN MATEO' },
            { code: '036', name: 'COOPERATIVA EL CHOROLQUE' },
            { code: '038', name: 'COOPERATIVA CATEDRAL' },
            { code: '039', name: 'MAGISTERIO RURAL' },
            { code: '044', name: 'BANCO PYME DE LA COMUNIDAD (BANCOMUNIDAD)' },
            { code: '045', name: 'BANCO FIE' },
            { code: '047', name: 'BANCO ECOFUTURO' },
            { code: '049', name: 'BANCO FORTALEZA' },
            { code: '052', name: 'BANCO DE LA NACION ARGENTINA' },
            { code: '053', name: 'TIGO MONEY (BILLETERA MOVIL)' },
            { code: '054', name: 'BILLETERA MÓVIL DE ENTEL' },
        ],
    },
}
