import { getBicFromIban } from '@/app/actions/ibanToBic'
import { SUPPLEMENTARY_BIC_BY_BANK_CODE } from '@/constants/iban-bic.consts'
import { BANK_CODE_POSITION, getIbanBankCode, hasValidIbanChecksum } from '@/utils/iban-bank-code.utils'
import fs from 'fs'

/**
 * Build an IBAN with correct ISO 7064 check digits from a country, a bank code
 * and filler.
 *
 * Every IBAN in this file is made this way. None is a customer's: the bank code
 * names a bank and the rest is filler, so the string identifies an institution
 * and nobody else. The checksum has to be right or the test would only be
 * proving that we reject malformed input.
 */
function buildIban(country: string, bban: string): string {
    const rearranged = `${bban}${country}00`
    let remainder = 0
    for (const character of rearranged) {
        const value = character >= 'A' ? character.charCodeAt(0) - 55 : Number(character)
        remainder = value > 9 ? (remainder * 100 + value) % 97 : (remainder * 10 + value) % 97
    }
    return `${country}${String(98 - remainder).padStart(2, '0')}${bban}`
}

describe('buildIban', () => {
    it('produces IBANs that pass the checksum', () => {
        expect(hasValidIbanChecksum(buildIban('LT', '325000000000000000'))).toBe(true)
        expect(hasValidIbanChecksum(buildIban('GB', 'REVO00997000000000'))).toBe(true)
    })
})

describe('getBicFromIban', () => {
    it('resolves a country the bundled register covers', async () => {
        // The published example IBAN for Germany; bank code 37040044 is Commerzbank.
        await expect(getBicFromIban('DE89370400440532013000')).resolves.toBe('COBADEFFXXX')
    })

    it('resolves a country only the supplement covers', async () => {
        // Lithuania is absent from iban-to-bic entirely. Bank code 32500 is
        // Revolut Bank UAB, the single most common bank in our IBAN population.
        await expect(getBicFromIban(buildIban('LT', '325000000000000000'))).resolves.toBe('REVOLT21')
    })

    it('gives one bank the same BIC across its sort codes', async () => {
        // In the UK the BBAN opens with the bank's SWIFT institution code and
        // continues with a six-digit sort code, so one table entry has to serve
        // every branch.
        const first = await getBicFromIban(buildIban('GB', 'REVO00997000000000'))
        const second = await getBicFromIban(buildIban('GB', 'REVO00420000000000'))
        expect(first).toBe('REVOGB21')
        expect(second).toBe(first)
    })

    it('ignores spacing and case', async () => {
        const spaced = await getBicFromIban('de89 3704 0044 0532 0130 00')
        expect(spaced).toBe('COBADEFFXXX')
    })

    it('returns null for a bank code we do not know', async () => {
        // Well-formed Lithuanian IBAN, bank code that belongs to no bank.
        await expect(getBicFromIban(buildIban('LT', '999990000000000000'))).resolves.toBeNull()
    })

    it('returns null for a country we have no table for', async () => {
        // Saudi Arabia: outside SEPA and outside both sources.
        await expect(getBicFromIban(buildIban('SA', '80000000608010167519'))).resolves.toBeNull()
    })

    it('returns null for a malformed IBAN', async () => {
        await expect(getBicFromIban('GB82WEST12345698765433')).resolves.toBeNull() // checksum fails
        await expect(getBicFromIban('not an iban')).resolves.toBeNull()
        await expect(getBicFromIban('')).resolves.toBeNull()
        await expect(getBicFromIban('DE89')).resolves.toBeNull() // too short to hold a bank code
    })

    it('never returns a partial or lower-case BIC', async () => {
        const bic = await getBicFromIban(buildIban('LT', '325000000000000000'))
        expect(bic).toMatch(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/)
    })
})

/**
 * The table is written by hand, so a typo is the likeliest way a wrong BIC
 * reaches a user. These check the shape of every entry rather than its truth —
 * truth comes from the published source cited when the entry is added.
 */
describe('SUPPLEMENTARY_BIC_BY_BANK_CODE', () => {
    const entries = Object.entries(SUPPLEMENTARY_BIC_BY_BANK_CODE).flatMap(([country, banks]) =>
        Object.entries(banks).map(([bankCode, bic]) => ({ country, bankCode, bic }))
    )

    it('is not empty', () => {
        expect(entries.length).toBeGreaterThan(0)
    })

    it('holds a well-formed BIC against every bank code', () => {
        const malformed = entries.filter(({ bic }) => !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic))
        expect(malformed).toEqual([])
    })

    it('registers each BIC in the country whose IBAN it answers', () => {
        // Passporting puts a foreign BIC on a local IBAN often enough that the
        // form only remarks on it — but not here. Every bank in this table is
        // licensed where its IBAN is issued, so a country mismatch is a typo.
        const foreign = entries.filter(({ country, bic }) => bic.slice(4, 6) !== country)
        expect(foreign).toEqual([])
    })

    it('keys every entry by a bank code of the length its country uses', () => {
        // A key of the wrong length can never be looked up: `getIbanBankCode`
        // slices to the country's own length and would miss it every time.
        const wrongLength = entries.filter(
            ({ country, bankCode }) => bankCode.length !== BANK_CODE_POSITION[country]?.length
        )
        expect(wrongLength).toEqual([])
    })
})

/**
 * Coverage over the real production IBAN population.
 *
 * The corpus is `(country, bank code, iban length, stored BIC, count)` rows —
 * a bank code names an institution, not a person, and no IBAN, account number
 * or user id is in it. It is built by hand from a read-only production query,
 * kept under `local/` which is gitignored, and never committed. Point
 * `IBAN_BIC_CORPUS` at it to run this suite:
 *
 *     IBAN_BIC_CORPUS=<path>/corpus.csv npm test -- ibanToBic
 *
 * Without the variable the suite skips, so CI and anyone without the file is
 * unaffected. See local/scratch/bic-coverage.md for how the corpus is built.
 */
const corpusPath = process.env.IBAN_BIC_CORPUS
const describeCorpus = corpusPath && fs.existsSync(corpusPath) ? describe : describe.skip

describeCorpus('coverage over the production IBAN population', () => {
    type Row = { cc: string; bank_code: string; iban_len: number; known_bic: string; n: number }

    // Loaded in beforeAll, not at module scope: `describe.skip` still evaluates
    // its body, so reading the file eagerly breaks the run that has no corpus.
    let rows: Row[] = []
    beforeAll(() => {
        const lines = fs
            .readFileSync(corpusPath as string, 'utf8')
            .trim()
            .split('\n')
        const head = lines[0].split(',')
        rows = lines.slice(1).map((line) => {
            const values = line.split(',')
            const row = Object.fromEntries(head.map((key, i) => [key, values[i]])) as unknown as Row
            return { ...row, n: Number(row.n), iban_len: Number(row.iban_len) }
        })
    })

    const mod97 = (digits: string) => [...digits].reduce((r, d) => (r * 10 + Number(d)) % 97, 0)

    /**
     * Belgium, Spain and France carry their own check digits inside the BBAN,
     * and the bundled register refuses an IBAN whose ones are wrong. Filling
     * those positions here is the difference between measuring our coverage and
     * measuring my padding.
     */
    const applyNationalCheckDigits = (country: string, bban: string): string => {
        if (country === 'BE') {
            const body = bban.slice(0, 10)
            return body + String(mod97(body) || 97).padStart(2, '0')
        }
        if (country === 'ES') {
            const weights = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6]
            const digit = (ten: string) => {
                const sum = [...ten].reduce((total, d, i) => total + Number(d) * weights[i], 0)
                const value = 11 - (sum % 11)
                return String(value === 11 ? 0 : value === 10 ? 1 : value)
            }
            const branchAndBank = bban.slice(0, 8)
            const account = bban.slice(10, 20)
            return branchAndBank + digit('00' + branchAndBank) + digit(account) + account
        }
        if (country === 'FR') {
            // Letters carry a digit value in the RIB key; A-I are 1-9, J-R are
            // 1-9 again, S-Z are 2-9.
            const toDigits = (part: string) =>
                [...part].map((c) => (c >= 'A' ? String(((c.charCodeAt(0) - 65) % 9) + 1) : c)).join('')
            const bank = mod97(bban.slice(0, 5))
            const branch = mod97(bban.slice(5, 10))
            const account = mod97(toDigits(bban.slice(10, 21)))
            const key = 97 - ((89 * bank + 15 * branch + 3 * account) % 97)
            return bban.slice(0, 21) + String(key).padStart(2, '0')
        }
        return bban
    }

    // The corpus stores the widest bank-identifying prefix we can read out of
    // an IBAN; the lookup wants the country's own bank-code length, so rebuild
    // an IBAN of the right length and let the resolver slice it.
    const ibanFor = (row: Row) => {
        const country = row.cc
        const cin = country === 'IT' || country === 'SM' ? 'X' : ''
        const width = row.iban_len - 4
        const body = (cin + row.bank_code).slice(0, width).padEnd(width, '0')
        return buildIban(country, applyNationalCheckDigits(country, body))
    }

    it('resolves at least 85% of accounts and agrees with the stored BIC', async () => {
        let total = 0
        let resolved = 0
        let crossChecked = 0
        let agreed = 0
        const disagreements: string[] = []
        const perCountry = new Map<string, { total: number; resolved: number }>()

        for (const row of rows) {
            total += row.n
            const country = perCountry.get(row.cc) ?? { total: 0, resolved: 0 }
            country.total += row.n

            const bic = await getBicFromIban(ibanFor(row))
            if (bic) {
                resolved += row.n
                country.resolved += row.n
                if (row.known_bic) {
                    crossChecked += row.n
                    if (bic.slice(0, 8) === row.known_bic.slice(0, 8)) agreed += row.n
                    else disagreements.push(`${row.cc}/${row.bank_code}: derived ${bic}, stored ${row.known_bic}`)
                }
            }
            perCountry.set(row.cc, country)
        }

        const breakdown = [...perCountry.entries()]
            .sort((a, b) => b[1].total - a[1].total)
            .map(([cc, s]) => `  ${cc} ${s.resolved}/${s.total} (${Math.round((s.resolved / s.total) * 100)}%)`)

        console.log(
            [
                `corpus coverage ${resolved}/${total} (${((resolved / total) * 100).toFixed(1)}%), ` +
                    `agreement ${agreed}/${crossChecked}`,
                ...breakdown,
                ...disagreements.map((d) => '  disagreed — ' + d),
            ].join('\n')
        )

        expect(resolved / total).toBeGreaterThanOrEqual(0.85)
        // Not 100%: a handful of stored BICs are what the user typed, and some
        // of those name a different bank than their own IBAN does. Derivation
        // is the more reliable of the two, so a disagreement is not a failure —
        // a lot of them would be.
        expect(agreed / crossChecked).toBeGreaterThanOrEqual(0.95)
    })

    it('reads a bank code out of every IBAN in the corpus', () => {
        const missing = rows.filter((row) => !getIbanBankCode(ibanFor(row))).map((row) => row.cc)
        expect(missing).toEqual([])
    })
})
