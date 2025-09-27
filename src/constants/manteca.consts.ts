export const MANTECA_DEPOSIT_ADDRESS = '0x959e088a09f61aB01cb83b0eBCc74b2CF6d62053'

export const MANTECA_ARG_DEPOSIT_NAME = 'Sixalime Sas'
export const MANTECA_ARG_DEPOSIT_CUIT = '30-71678845-3'

// Countries that use Manteca for bank withdrawals instead of Bridge
export const MANTECA_COUNTRIES = [
    'argentina', // ARS, USD, BRL (QR pix payments)
    'chile', // CLP
    'brazil', // BRL
    'colombia', // COP
    'panama', // PUSD
    'costa-rica', // CRC
    'guatemala', // GTQ
    // 'mexico', // MXN - Keep as Bridge (CoDi disabled)
    'philippines', // PHP
    'bolivia', // BOB
] as const

// Type for Manteca countries
export type MantecaCountry = (typeof MANTECA_COUNTRIES)[number]

// Helper function to check if a country uses Manteca
export const isMantecaCountry = (countryPath: string): boolean => {
    return MANTECA_COUNTRIES.includes(countryPath as MantecaCountry)
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
 * Configuration for each country that uses Manteca
 * Some countries needs only account number but others need extra data,
 * and that data like account type and bank code is different for each
 * country and part of a list of valid values so we need to have a
 * config for each country
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
        accountNumberLabel: 'PIX Key',
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
