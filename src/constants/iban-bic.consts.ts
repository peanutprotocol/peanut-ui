/**
 * BICs that `iban-to-bic` cannot supply.
 *
 * That package ships bank registers for seven countries — AT, BE, DE, ES, FR,
 * LU, NL — and returns nothing for every other country before it looks
 * anything up. Measured against our production IBANs that left 89 of 195
 * accounts with no BIC, Lithuania and the United Kingdom among them.
 *
 * Mostly countries the package has no register for. Spain and France are here
 * too, for the handful of banks their registers predate; the package answers
 * first, so an entry under ES or FR only ever fills a gap.
 *
 * Keyed by IBAN country code, then by the bank identifier
 * `getIbanBankCode` reads out of the IBAN. For GB, IE, MT, RO and BG that
 * identifier is the bank's own four-letter SWIFT institution code, so one entry
 * covers every sort code the bank holds. Elsewhere it is the national bank
 * code, whose length is fixed per country in `BANK_CODE_POSITION`.
 *
 * Every BIC here comes from the bank itself or from its national register. Add
 * an entry only with such a source: a BIC that is merely plausible routes a
 * withdrawal to the wrong bank, and no BIC at all is the better failure — the
 * form then asks the user.
 */
export const SUPPLEMENTARY_BIC_BY_BANK_CODE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    // Lithuania, from the Bank of Lithuania's published bank-code register.
    // The largest single gap we had: bank code 32500 is Revolut, which alone is
    // 23 of the 195 IBANs in production.
    LT: {
        '21400': 'AGBLLT2X', // Luminor Bank, Lithuanian branch
        '30800': 'NEUALT21', // NexPay
        '32500': 'REVOLT21', // Revolut Bank
        '35000': 'EVIULT2V', // Paysera LT
        '70440': 'CBVILT2X', // SEB bankas
        '71800': 'CBSBLT26', // Artea bankas, formerly Siauliu bankas
        '72900': 'INDULT2X', // Citadele bankas
        '73000': 'HABALT22', // Swedbank
        '74000': 'SMPOLT22', // Danske Bank, Lithuanian branch
    },
    PT: {
        '0007': 'BESCPTPL', // Novo Banco
        '0010': 'BBPIPTPL', // Banco BPI
        '0018': 'TOTAPTPL', // Banco Santander Totta
        '0023': 'ACTVPTPL', // Banco ActivoBank
        '0033': 'BCOMPTPL', // Banco Comercial Portugues (Millennium bcp)
        '0035': 'CGDIPTPL', // Caixa Geral de Depositos
        '0036': 'MPIOPTPL', // Banco Montepio
        '0045': 'CCCMPTPL', // Caixa Central de Credito Agricola Mutuo
        '3560': 'REVOPTP2', // Revolut Bank, Portuguese branch
    },
    // Spain and France are in the bundled register, which wins over anything
    // here. These are the banks it does not carry — all of them recent arrivals.
    ES: {
        '1563': 'NTSBESM1', // N26 Bank, Spanish branch
        '1586': 'TRBKESM2', // Trade Republic Bank, Spanish branch
    },
    FR: {
        '28233': 'REVOFRP2', // Revolut Bank, French branch
    },
    // Great Britain. The four letters are the institution; the six digits that
    // follow them are the sort code and play no part here.
    GB: {
        BUKB: 'BUKBGB22', // Barclays Bank UK
        HBUK: 'HBUKGB4B', // HSBC UK Bank
        MONZ: 'MONZGB2L', // Monzo Bank
        NWBK: 'NWBKGB2L', // National Westminster Bank
        PRTC: 'PRTCGB21', // Prepay Technologies
        REVO: 'REVOGB21', // Revolut
        SRLG: 'SRLGGB3L', // Starling Bank
        TRWI: 'TRWIGB2L', // Wise Payments
    },
    IE: {
        AIBK: 'AIBKIE2D', // Allied Irish Banks
        BOFI: 'BOFIIE2D', // Bank of Ireland
        MODR: 'MODRIE22', // Modulr FS Europe
    },
    MT: {
        MMEB: 'MMEBMTMT', // HSBC Bank Malta
    },
    RO: {
        BACX: 'BACXROBU', // UniCredit Bank
        BRDE: 'BRDEROBU', // BRD - Groupe Societe Generale
        BTRL: 'BTRLRO22', // Banca Transilvania
        INGB: 'INGBROBU', // ING Bank, Bucharest branch
        RNCB: 'RNCBROBU', // Banca Comerciala Romana
        RZBR: 'RZBRROBU', // Raiffeisen Bank
    },
    BG: {
        BPBI: 'BPBIBGSF', // Eurobank Bulgaria (Postbank)
        FINV: 'FINVBGSF', // First Investment Bank
        STSA: 'STSABGSF', // DSK Bank
        UBBS: 'UBBSBGSF', // United Bulgarian Bank
        UNCR: 'UNCRBGSF', // UniCredit Bulbank
    },
    // Poland, from the National Bank of Poland's settlement-number register.
    PL: {
        '102': 'BPKOPLPW', // PKO Bank Polski
        '109': 'WBKPPLPP', // Erste Bank Polska, formerly Santander Bank Polska
        '114': 'BREXPLPW', // mBank
        '116': 'BIGBPLPW', // Bank Millennium
        '124': 'PKOPPLPW', // Bank Pekao
        '175': 'PPABPLPK', // BNP Paribas Bank Polska
        '195': 'PKOPPLPW', // Bank Pekao, second settlement range
        '249': 'ALBPPLPW', // Alior Bank
        '291': 'BMPBPLPP', // UniCredit, Polish branch, formerly Aion Bank
    },
    // Switzerland, from the SIX bank master file. 04835 (Credit Suisse) is
    // deliberately absent: SIX marks it retired and publishes no BIC for it,
    // only a pointer to UBS's own code.
    CH: {
        '00243': 'UBSWCHZH', // UBS Switzerland
        '00700': 'ZKBKCHZZ', // Zuercher Kantonalbank
        '08307': 'HYPLCH22', // Hypothekarbank Lenzburg
        '08401': 'MIGRCHZZ', // Migros Bank
        '08843': 'DUBACHGG', // Dukascopy Bank
        '09000': 'POFICHBE', // PostFinance
    },
    // Estonia, from the Estonian Banking Association's bank-code list.
    EE: {
        '10': 'EEUHEE2X', // SEB Pank
        '17': 'RIKOEE22', // Luminor Bank, second code range
        '22': 'HABAEE2X', // Swedbank
        '77': 'LHVBEE22', // LHV Pank
        '96': 'RIKOEE22', // Luminor Bank
    },
    // Cyprus, from the Central Bank of Cyprus BIC list.
    CY: {
        '002': 'BCYPCY2N', // Bank of Cyprus
        '005': 'HEBACY2N', // Eurobank, formerly Hellenic Bank
        '902': 'CARDCY2L', // CardPay Europe
    },
    // Hungary, from the Magyar Nemzeti Bank register.
    HU: {
        '104': 'OKHBHUHB', // K&H Bank
        '109': 'BACXHUHB', // UniCredit Bank Hungary
        '117': 'OTPVHUHB', // OTP Bank
    },
    // Croatia, from the Croatian National Bank's payment-provider list.
    HR: {
        '2360000': 'ZABAHR2X', // Zagrebacka banka
        '2402006': 'ESBCHR22', // Erste & Steiermaerkische Bank
        '2484008': 'RZBHHR2X', // Raiffeisenbank Austria
    },
    // Slovenia, from the Bank of Slovenia's list of identification codes.
    SI: {
        '02': 'LJBASI2X', // NLB
        '19': 'SZKBSI2X', // Dezelna banka Slovenije
        '61': 'HDELSI22', // Delavska hranilnica
    },
    // Sweden. Danske and Swedbank each hold two clearing ranges, so both of
    // each bank's leading digits need an entry.
    SE: {
        '120': 'DABASESX', // Danske Bank Sverige
        '240': 'DABASESX', // Danske Bank Sverige, 2400-2499
        '500': 'ESSESESS', // SEB
        '600': 'HANDSESS', // Handelsbanken
        '700': 'SWEDSESS', // Swedbank, 7000-7999
        '800': 'SWEDSESS', // Swedbank
    },
    DK: {
        '0040': 'NDEADKKK', // Nordea Danmark
        '3000': 'DABADKKK', // Danske Bank
        '5301': 'ALBADKKK', // AL Sydbank, formerly Arbejdernes Landsbank
        '9860': 'MISPDK21', // Middelfart Sparekasse
    },
    // Norway. Note that 3000 is Sparebanken Soer here and Danske Bank in
    // Denmark — the two registers are unrelated.
    // Norway. 3000 (Sparebanken Norge) is deliberately absent: its BIC changes
    // from SPSONO22 to SPAVNOBB on 2026-10-10, and a table that is right for
    // three more weeks is worse than a field the user fills in.
    NO: {
        '1503': 'DNBANOKK', // DNB Bank
        '6011': 'NDEANOKK', // Nordea Bank, Norwegian branch
    },
    TR: {
        '00010': 'TCZBTR2A', // Ziraat Bankasi
        '00046': 'AKBKTRIS', // Akbank
        '00067': 'YAPITRIS', // Yapi ve Kredi Bankasi
        '00103': 'FBHLTRIS', // Fibabanka
    },
    IT: {
        '03069': 'BCITITMM', // Intesa Sanpaolo
        '03669': 'REVOITM2', // Revolut Bank, Italian branch
        '05034': 'BAPPIT22', // Banco BPM
    },
    SM: {
        '08540': 'MAOISMSM', // Banca di San Marino
    },
    VA: {
        '001': 'IOPRVAVX', // Istituto per le Opere di Religione
    },
}

/**
 * A BIC as ISO 9362 defines it: four letters for the institution, two for the
 * country, two alphanumeric for the location, and an optional three-character
 * branch code.
 */
export const ISO_9362_BIC = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/
