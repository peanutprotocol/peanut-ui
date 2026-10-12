import { isValidEmail } from '@/utils/format.utils'
import { validateCbuCvuAlias, validateMXCLabeAccount, validatePixKey } from '@/utils/withdraw.utils'
import { extractPaymentValue } from '@/utils/clipboard-extract.utils'

// TASK-23132: hostile values in the account and contact fields — the way users
// actually paste them (spaces, newlines, emoji, max length).

const CBU = '0000003100066354450379'
const CLABE = '032180000118359719'

describe('isValidEmail with hostile values', () => {
    it.each(['a+b@x.co', 'user@mail.sub.domain.co.uk', 'josé@ejemplo.com', 'a@xn--bcher-kva.example'])(
        'accepts %j',
        (email) => expect(isValidEmail(email)).toBe(true)
    )

    it.each(['a b@x.co', 'a@b', '@x.co', 'a@@x.co', ' a@x.co', 'a@x.co\n'])('rejects %j', (email) =>
        expect(isValidEmail(email)).toBe(false)
    )

    // bug: no length cap. rfc 5321 allows 254 characters, providers reject longer
    // addresses, and the app only finds out after the provider call fails
    it.failing('rejects a 255-character email', () => {
        const email = `${'a'.repeat(64)}@${'b'.repeat(187)}.co`
        expect(email.length).toBe(255)
        expect(isValidEmail(email)).toBe(false)
    })
})

describe('validateMXCLabeAccount with hostile values', () => {
    it.each([CLABE, '0321 8000 0118 3597 19', '032-180-000118359719', `${CLABE}\n`, ` ${CLABE} `])(
        'accepts %j',
        (value) => expect(validateMXCLabeAccount(value).isValid).toBe(true)
    )

    it.each([`${CLABE}9`, CLABE.slice(0, 17), `${CLABE.slice(0, 17)}😀`, '0'.repeat(18)])('rejects %j', (value) =>
        expect(validateMXCLabeAccount(value).isValid).toBe(false)
    )
})

describe('validateCbuCvuAlias with hostile values', () => {
    it.each([CBU, ` ${CBU}\n`, 'mi.alias-123'])('accepts %j', (value) =>
        expect(validateCbuCvuAlias(value).valid).toBe(true)
    )

    it.each(['mi alias', 'alias😀😀', 'a'.repeat(21), 'alias<b>'])('rejects %j', (value) =>
        expect(validateCbuCvuAlias(value).valid).toBe(false)
    )

    // bug: a CBU copied with spaces between groups is rejected ("Invalid
    // length"), while CLABE strips spaces and hyphens. the paste extractor
    // misses it too — it only looks for one unbroken 22-digit group.
    it.failing('accepts a CBU typed or pasted in groups', () => {
        const grouped = `${CBU.slice(0, 8)} ${CBU.slice(8)}`
        expect(validateCbuCvuAlias(grouped).valid).toBe(true)
    })

    it.failing('the paste extractor finds a grouped CBU', () => {
        const grouped = `CBU: ${CBU.slice(0, 8)} ${CBU.slice(8)}`
        expect(extractPaymentValue(grouped, 'cbuCvuAlias')).toBe(CBU)
    })
})

describe('validatePixKey with hostile values', () => {
    it.each([
        ' +55 11 99999-9999 ',
        '+5511999999999\n',
        'pix+test@example.com',
        '123e4567-e89b-12d3-a456-426614174000',
    ])('accepts %j', (value) => expect(validatePixKey(value).valid).toBe(true))

    it.each(['', '   ', '😀', 'pix@exam ple.com', `${'a'.repeat(70)}@example.com`, '+55 11 9999'])(
        'rejects %j',
        (value) => expect(validatePixKey(value).valid).toBe(false)
    )
})
