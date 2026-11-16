import { formatTaxId } from '../paperworkVerification.utils'
import { loadTaxIdChecker, taxIdOutcome, taxIdVerdict } from '../taxIdChecks'

describe('Argentina tax-ID acceptance', () => {
    let checkArTaxId: NonNullable<Awaited<ReturnType<typeof loadTaxIdChecker>>>

    beforeAll(async () => {
        const checker = await loadTaxIdChecker(['ar.cuit'])
        if (!checker) throw new Error('The ar.cuit checker must be available')
        checkArTaxId = checker
    })

    it('accepts a dotted eleven-digit CUIT', () => {
        expect(checkArTaxId('20.12345678.6')).toBe('valid')
    })

    it('rejects more than eleven normalized digits', () => {
        expect(checkArTaxId('201234567860')).not.toBe('valid')
        expect(checkArTaxId('20.12345678.60')).not.toBe('valid')
    })

    it.each(['1234567', '12345678', '1.234.567', '12.345.678'])('accepts DNI %s', (value) => {
        expect(checkArTaxId(value)).toBe('valid')
    })

    it.each(['DNI: 12.345.678', ' 1a2b3c4d5e6f7 ', 'CUIT: 20 / 12345678 / 6'])(
        'strips every non-digit before validating %s',
        (value) => {
            expect(checkArTaxId(value)).toBe('valid')
        }
    )

    it.each(['20-12345678-6', '20123456786'])('accepts checksum-valid CUIT %s', (value) => {
        expect(checkArTaxId(value)).toBe('valid')
    })

    it.each(['21-12345678-2', '21123456782'])('rejects checksum-valid %s with no CUIT type prefix', (value) => {
        expect(checkArTaxId(value)).toBe('invalid')
    })

    it.each(['20-12345678-8', '20123456788', '21-12345678-3'])('rejects checksum-invalid CUIT %s', (value) => {
        expect(checkArTaxId(value)).toBe('invalid')
    })

    it.each(['', '1', '12', '123', '1234', '12345', '123456', '123456789', '1234567890'])(
        'does not accept unsupported digit length for %s',
        (value) => {
            expect(checkArTaxId(value)).not.toBe('valid')
        }
    )

    it.each(['12.345.678-9', '12.345.678-90', 'letters only'])(
        'does not let punctuation or letters turn an unsupported length into a valid ID: %s',
        (value) => {
            expect(checkArTaxId(value)).not.toBe('valid')
        }
    )

    it('accepts derived checksum vectors for person prefixes and rejects each changed check digit', () => {
        // Person prefixes, body 12345678. Check digits derived with weights
        // 5,4,3,2,7,6,5,4,3,2 and modulo 11, independent of the production helper.
        const checkDigits: Record<number, number> = { 20: 6, 23: 5, 24: 1, 27: 0 }

        Object.entries(checkDigits).forEach(([prefix, checkDigit]) => {
            expect(checkArTaxId(`${prefix}12345678${checkDigit}`)).toBe('valid')
            expect(checkArTaxId(`${prefix}12345678${(checkDigit + 1) % 10}`)).toBe('invalid')
        })
    })

    it.each(['0000000', '00000000', '00000000000'])('refuses the all-zero AR identifier %s', (value) => {
        const field: Parameters<typeof taxIdVerdict>[0] = {
            key: 'taxId',
            kind: 'taxId',
            required: true,
            format: 'cuit',
            checks: ['ar.cuit'],
            value: null,
        }
        const values = { taxId: value }
        const verdict = taxIdVerdict(field, values, { checker: checkArTaxId, pending: false })
        expect(taxIdOutcome(field, values, verdict, true)).toMatchObject({ blocks: true, error: 'invalid_tax_id' })
    })

    it.each([
        ['ssn', '000000000'],
        ['cpf', '00000000000'],
    ] as const)('preserves the all-zero refusal for %s', (format, value) => {
        const field: Parameters<typeof taxIdOutcome>[0] = {
            key: 'taxId',
            kind: 'taxId',
            required: true,
            format,
            checks: [],
            value: null,
        }

        expect(taxIdOutcome(field, { taxId: value }, 'valid', true)).toMatchObject({
            blocks: true,
            error: 'invalid_tax_id',
        })
    })

    it.each(['1234567', '12345678'])('leaves plain DNI %s unmasked', (value) => {
        expect(formatTaxId('cuit', value)).toBe(value)
    })

    it.each([
        ['20123456786', '20-12345678-6'],
        ['21123456782', '21-12345678-2'],
    ])('formats eleven digits %s as %s', (value, expected) => {
        expect(formatTaxId('cuit', value)).toBe(expected)
        expect(formatTaxId('cuit', expected)).toBe(expected)
    })

    it('supports sequential typing through DNI into a complete CUIT', () => {
        const digits = '20123456786'
        let displayed = ''

        for (let index = 0; index < digits.length; index += 1) {
            displayed = formatTaxId('cuit', displayed + digits[index])
            const typedDigits = digits.slice(0, index + 1)
            expect(displayed.replace(/\D/g, '')).toBe(typedDigits)

            if (typedDigits.length === 7 || typedDigits.length === 8) {
                expect(displayed).toBe(typedDigits)
                expect(checkArTaxId(displayed)).toBe('valid')
            }
            if (typedDigits.length === 9 || typedDigits.length === 10) {
                expect(checkArTaxId(displayed)).not.toBe('valid')
            }
        }

        expect(displayed).toBe('20-12345678-6')
        expect(checkArTaxId(displayed)).toBe('valid')
    })

    it('removes the CUIT mask when deleting back to eight- and seven-digit DNI', () => {
        let displayed = '20-12345678-6'

        for (let remainingDigits = 10; remainingDigits >= 7; remainingDigits -= 1) {
            // Each edit removes one digit, including any trailing mask separator.
            const edited = displayed.replace(/\D*\d\D*$/, '')
            displayed = formatTaxId('cuit', edited)
            const expectedDigits = '20123456786'.slice(0, remainingDigits)
            expect(displayed.replace(/\D/g, '')).toBe(expectedDigits)

            if (remainingDigits > 8) {
                expect(checkArTaxId(displayed)).not.toBe('valid')
            } else {
                expect(displayed).toBe(expectedDigits)
                expect(checkArTaxId(displayed)).toBe('valid')
            }
        }
    })
})
