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
        registeredOffice: ['21750 Hardy Oak Blvd Ste 104 PMB 77950', 'San Antonio, TX 78258', 'USA'],
        registration: 'Delaware 7189238 · NMLS 2450917',
        regulator: 'Registered money services business (FinCEN). State money transmitter licences, NMLS 2450917',
        role: 'bridge',
        termsUrl: 'https://www.bridge.xyz/legal/us-terms/bridge-building-inc',
        privacyUrl: 'https://www.bridge.xyz/legal/us-privacy-policy/bridge-building-inc',
    },
    'bridge-eea': {
        id: 'bridge-eea',
        brand: 'Bridge',
        legalName: 'Bridge Building S.A.',
        registeredOffice: ['33, Boulevard Prince Henri', 'L-1724 Luxembourg'],
        registration: 'RCS Luxembourg B298785',
        regulator: 'CSSF: MiCA CASP N00000012, EMI W00000024',
        role: 'bridge',
        termsUrl: 'https://www.bridge.xyz/legal/eea-user-terms/bridge-building-s-a',
        privacyUrl: 'https://www.bridge.xyz/legal/eea-privacy-policy/bridge-building-s-a',
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
        termsUrl: 'https://www.bridge.xyz/legal/row-user-terms/bridge-building-limited',
        privacyUrl: 'https://www.bridge.xyz/legal/row-privacy-policy/bridge-building-limited',
    },
    // used when we cannot say which Bridge entity applies
    bridge: {
        id: 'bridge',
        brand: 'Bridge',
        role: 'bridge',
        termsUrl: 'https://www.bridge.xyz/legal',
    },
    'manteca-ar': {
        id: 'manteca-ar',
        brand: 'Manteca',
        legalName: 'SIXALIME S.A.U.',
        registeredOffice: ['República de la India 2781', 'C1425 Buenos Aires', 'Argentina'],
        registration: 'CUIT 30-71678854-3 · CNV PSAV No. 21',
        regulator: 'Comisión Nacional de Valores (CNV), PSAV No. 21',
        role: 'manteca',
        termsUrl: 'https://manteca.dev/es/tyc/crypto',
        privacyUrl: 'https://manteca.dev/es/pp/crypto',
    },
    'manteca-br': {
        id: 'manteca-br',
        brand: 'Manteca',
        legalName: 'PONTE GLOBAL SOCIEDADE PRESTADORA DE SERVICOS DE ATIVOS VIRTUAIS LTDA',
        registeredOffice: [
            'R. Brigadeiro Luís Antônio 300, 10º andar, conj. 104',
            'Bela Vista, São Paulo/SP, 01318-903',
            'Brazil',
        ],
        registration: 'CNPJ 63.653.001/0001-55',
        role: 'manteca',
        termsUrl: 'https://manteca.dev/brazil-politicas/tec',
        privacyUrl: 'https://manteca.dev/brazil-politicas/pdp',
    },
    rhino: {
        id: 'rhino',
        brand: 'Rhino.fi',
        legalName: 'Liquidity Labs Holdings Limited',
        registration: 'BVI company 2021531',
        role: 'rhino',
        termsUrl: 'https://rhino.fi/legal-policies-and-documentation/terms-conditions',
        privacyUrl: 'https://rhino.fi/legal-policies-and-documentation/privacy-policy',
    },
    'third-national': {
        id: 'third-national',
        brand: 'Third National',
        legalName: 'Nimbus LLC, doing business as Third National',
        registeredOffice: ['273 Ave Ponce de León, Estudio 6', 'San Juan, PR 00917', 'USA'],
        registration: 'NMLS 2612780',
        role: 'thirdNational',
        privacyUrl: 'https://third-national.com/privacypolicy',
    },
    // shown only as the identity-check line inside the Bridge sheets
    sumsub: {
        id: 'sumsub',
        brand: 'Sumsub',
        legalName: 'Sum and Substance Ltd',
        registeredOffice: ['30 St Mary Axe', 'London EC3A 8BF', 'UK'],
        registration: 'Companies House 09688671',
        role: 'sumsub',
    },
}
