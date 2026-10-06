import type { ProviderId, ProviderRecord } from '@/types/provider.types'

/**
 * The legal entities behind each provider, for the "not us" disclosure
 * (Brazil Resolution 520, TASK-23295). Every fact here was checked against a
 * public register; anything unverified is left out on purpose.
 */
export const PROVIDERS: Record<ProviderId, ProviderRecord> = {
    'bridge-us': {
        id: 'bridge-us',
        brand: 'Bridge',
        legalName: 'Bridge Building Inc',
        registeredOffice: ['1209 Orange St', 'Wilmington DE 19801'],
        registration: 'Delaware 7189238',
        regulator: 'US state money transmitter licences (NMLS 2450917)',
        role: 'bridge',
        userContract: true,
        termsUrl: 'https://www.bridge.xyz/legal/us-terms/bridge-building-inc',
        termsName: 'Bridge US terms',
        privacyUrl: 'https://www.bridge.xyz/legal/us-privacy-policy/bridge-building-inc',
        support: 'support@bridge.xyz · (888) 523-6133',
    },
    'bridge-eea': {
        id: 'bridge-eea',
        brand: 'Bridge',
        legalName: 'Bridge Building S.A.',
        registeredOffice: ['33, Boulevard Prince Henri', 'L-1724 Luxembourg'],
        registration: 'RCS Luxembourg B298785 · LEI 254900MVWQXMF77YZP65',
        taxId: 'VAT LU37059083',
        regulator: 'CSSF: MiCA CASP N00000012 · EMI W00000024 (passported to the EEA)',
        role: 'bridgeEea',
        userContract: true,
        termsUrl: 'https://www.bridge.xyz/legal/eea-user-terms/bridge-building-s-a',
        termsName: 'Bridge EEA user terms',
        privacyUrl: 'https://www.bridge.xyz/legal/eea-privacy-policy/bridge-building-s-a',
        support: 'support@bridge.xyz',
    },
    'bridge-row': {
        id: 'bridge-row',
        brand: 'Bridge',
        legalName: 'Bridge Building Limited',
        registeredOffice: [
            'c/o Ogier Global (BVI) Limited, Ritter House, Wickhams Cay II',
            'Road Town, Tortola VG1110',
            'British Virgin Islands',
        ],
        registration: 'BVI company 2149703',
        role: 'bridge',
        userContract: true,
        termsUrl: 'https://www.bridge.xyz/legal/row-user-terms/bridge-building-limited',
        termsName: 'Bridge user terms',
        privacyUrl: 'https://www.bridge.xyz/legal/row-privacy-policy/bridge-building-limited',
        support: 'support@bridge.xyz · (888) 523-6133',
    },
    // used when we cannot say which Bridge entity applies
    bridge: {
        id: 'bridge',
        brand: 'Bridge',
        role: 'bridge',
        userContract: true,
        termsUrl: 'https://www.bridge.xyz/legal',
        termsName: 'Bridge terms',
    },
    'manteca-ar': {
        id: 'manteca-ar',
        brand: 'Manteca',
        legalName: 'SIXALIME S.A.U.',
        registeredOffice: ['República de la India 2781', 'CABA'],
        taxId: 'CUIT 30-71678854-3',
        regulator: 'CNV: Proveedor de Servicios de Activos Virtuales (PSAV) No. 21',
        role: 'mantecaAr',
        userContract: true,
        termsUrl: 'https://manteca.dev/es/tyc/crypto',
        privacyUrl: 'https://manteca.dev/es/pp/crypto',
        support: 'hola@manteca.dev · soporte@manteca.dev',
    },
    'manteca-br': {
        id: 'manteca-br',
        brand: 'Manteca',
        legalName: 'PONTE GLOBAL SOCIEDADE PRESTADORA DE SERVICOS DE ATIVOS VIRTUAIS LTDA',
        registeredOffice: [
            'R. Brigadeiro Luís Antônio 300, 10º andar, conj. 104 (parte)',
            'Bela Vista, São Paulo/SP, CEP 01318-903',
        ],
        taxId: 'CNPJ 63.653.001/0001-55',
        role: 'mantecaBr',
        userContract: true,
        termsUrl: 'https://manteca.dev/brazil-politicas/tec',
        privacyUrl: 'https://manteca.dev/brazil-politicas/pdp',
        support: 'brazil@manteca.dev',
    },
    // peanut is rhino's customer; the user never signs rhino's terms.
    // grade B in the register: legal name, role and documents only
    rhino: {
        id: 'rhino',
        brand: 'Rhino.fi',
        legalName: 'Liquidity Labs Holdings Limited',
        role: 'rhino',
        userContract: false,
        termsUrl: 'https://rhino.fi/legal-policies-and-documentation/terms-conditions',
        privacyUrl: 'https://rhino.fi/legal-policies-and-documentation/privacy-policy',
    },
    'third-national': {
        id: 'third-national',
        brand: 'Third National',
        legalName: 'Nimbus LLC, doing business as Third National',
        registeredOffice: ['273 Ave Ponce de León, Estudio 6', 'San Juan, PR 00917'],
        registration: 'NMLS 2612780',
        // no regulator: the OCIF licence TM-0207 is self-stated, not yet checked on the register
        role: 'thirdNational',
        programManager: 'Rain (Signify Holdings, Inc.)',
        userContract: true,
        privacyUrl: 'https://third-national.com/privacypolicy',
        support: 'support@peanut.me · info@3rdnational.com',
    },
}
