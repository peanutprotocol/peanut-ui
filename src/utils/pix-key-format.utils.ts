import { formatBrTaxId, isValidCpf } from './br-tax-id.utils'

/** "11 99999-9999" (a mobile) or "11 9999-9999" (a landline): the area code, then the number. */
function formatBrPhone(national: string): string {
    return `${national.slice(0, 2)} ${national.slice(2, -4)}-${national.slice(-4)}`
}

/**
 * A Pix key as receipts and the Pix screens print it (Aleks, 2026-11-14): a CPF `111.444.777-35`, a
 * CNPJ `12.345.678/0001-90`, a phone `11 99999-9999`. An 11-digit key is a CPF when its check digits
 * are valid, else a phone; a key that starts with `+55` is a phone. A 14-digit key is a CNPJ whatever
 * its check digits: no other Pix key is 14 bare digits. An email or a random key prints as it is.
 * Display only: a copy button copies the key itself.
 */
export function formatPixKey(key: string): string {
    const compact = key.replace(/[\s.\-/()]/g, '')
    const phone = compact.match(/^\+55(\d{10,11})$/)
    if (phone) return formatBrPhone(phone[1])
    if (/^\d{11}$/.test(compact)) return isValidCpf(compact) ? formatBrTaxId(compact) : formatBrPhone(compact)
    if (/^\d{14}$/.test(compact)) return compact.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
    return key
}
