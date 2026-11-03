import { useEffect, useState } from 'react'
import type {
    PaperworkVerificationAnswers,
    PaperworkVerificationField,
} from '@/app/actions/types/kyc-paperwork-verification.types'
import { looksLikeItin, maskedUntouched } from './paperworkVerification.utils'

interface StdnumValidator {
    validate(value: string): { isValid: boolean; error?: { name: string } }
}

// One chunk per stdnum country module, loaded only for the checks the API names.
const COUNTRY_MODULES: Record<string, () => Promise<unknown>> = {
    ad: () => import('stdnum/lib/esm/ad'),
    ai: () => import('stdnum/lib/esm/ai'),
    al: () => import('stdnum/lib/esm/al'),
    ao: () => import('stdnum/lib/esm/ao'),
    ar: () => import('stdnum/lib/esm/ar'),
    at: () => import('stdnum/lib/esm/at'),
    au: () => import('stdnum/lib/esm/au'),
    az: () => import('stdnum/lib/esm/az'),
    ba: () => import('stdnum/lib/esm/ba'),
    be: () => import('stdnum/lib/esm/be'),
    bg: () => import('stdnum/lib/esm/bg'),
    bo: () => import('stdnum/lib/esm/bo'),
    br: () => import('stdnum/lib/esm/br'),
    by: () => import('stdnum/lib/esm/by'),
    bz: () => import('stdnum/lib/esm/bz'),
    ca: () => import('stdnum/lib/esm/ca'),
    ch: () => import('stdnum/lib/esm/ch'),
    cl: () => import('stdnum/lib/esm/cl'),
    cn: () => import('stdnum/lib/esm/cn'),
    co: () => import('stdnum/lib/esm/co'),
    cr: () => import('stdnum/lib/esm/cr'),
    cu: () => import('stdnum/lib/esm/cu'),
    cy: () => import('stdnum/lib/esm/cy'),
    cz: () => import('stdnum/lib/esm/cz'),
    de: () => import('stdnum/lib/esm/de'),
    dk: () => import('stdnum/lib/esm/dk'),
    do: () => import('stdnum/lib/esm/do'),
    dz: () => import('stdnum/lib/esm/dz'),
    ec: () => import('stdnum/lib/esm/ec'),
    ee: () => import('stdnum/lib/esm/ee'),
    eg: () => import('stdnum/lib/esm/eg'),
    es: () => import('stdnum/lib/esm/es'),
    fi: () => import('stdnum/lib/esm/fi'),
    fo: () => import('stdnum/lib/esm/fo'),
    fr: () => import('stdnum/lib/esm/fr'),
    gb: () => import('stdnum/lib/esm/gb'),
    gh: () => import('stdnum/lib/esm/gh'),
    gn: () => import('stdnum/lib/esm/gn'),
    gr: () => import('stdnum/lib/esm/gr'),
    gt: () => import('stdnum/lib/esm/gt'),
    hk: () => import('stdnum/lib/esm/hk'),
    hr: () => import('stdnum/lib/esm/hr'),
    hu: () => import('stdnum/lib/esm/hu'),
    id: () => import('stdnum/lib/esm/id'),
    ie: () => import('stdnum/lib/esm/ie'),
    il: () => import('stdnum/lib/esm/il'),
    in: () => import('stdnum/lib/esm/in'),
    is: () => import('stdnum/lib/esm/is'),
    it: () => import('stdnum/lib/esm/it'),
    jp: () => import('stdnum/lib/esm/jp'),
    ke: () => import('stdnum/lib/esm/ke'),
    kr: () => import('stdnum/lib/esm/kr'),
    li: () => import('stdnum/lib/esm/li'),
    lk: () => import('stdnum/lib/esm/lk'),
    lt: () => import('stdnum/lib/esm/lt'),
    lu: () => import('stdnum/lib/esm/lu'),
    lv: () => import('stdnum/lib/esm/lv'),
    ma: () => import('stdnum/lib/esm/ma'),
    mc: () => import('stdnum/lib/esm/mc'),
    md: () => import('stdnum/lib/esm/md'),
    me: () => import('stdnum/lib/esm/me'),
    mk: () => import('stdnum/lib/esm/mk'),
    mt: () => import('stdnum/lib/esm/mt'),
    mu: () => import('stdnum/lib/esm/mu'),
    mx: () => import('stdnum/lib/esm/mx'),
    my: () => import('stdnum/lib/esm/my'),
    mz: () => import('stdnum/lib/esm/mz'),
    nl: () => import('stdnum/lib/esm/nl'),
    no: () => import('stdnum/lib/esm/no'),
    nz: () => import('stdnum/lib/esm/nz'),
    pe: () => import('stdnum/lib/esm/pe'),
    pk: () => import('stdnum/lib/esm/pk'),
    pl: () => import('stdnum/lib/esm/pl'),
    pt: () => import('stdnum/lib/esm/pt'),
    py: () => import('stdnum/lib/esm/py'),
    ro: () => import('stdnum/lib/esm/ro'),
    rs: () => import('stdnum/lib/esm/rs'),
    ru: () => import('stdnum/lib/esm/ru'),
    se: () => import('stdnum/lib/esm/se'),
    sg: () => import('stdnum/lib/esm/sg'),
    si: () => import('stdnum/lib/esm/si'),
    sk: () => import('stdnum/lib/esm/sk'),
    sm: () => import('stdnum/lib/esm/sm'),
    sv: () => import('stdnum/lib/esm/sv'),
    th: () => import('stdnum/lib/esm/th'),
    tn: () => import('stdnum/lib/esm/tn'),
    tr: () => import('stdnum/lib/esm/tr'),
    tw: () => import('stdnum/lib/esm/tw'),
    ua: () => import('stdnum/lib/esm/ua'),
    us: () => import('stdnum/lib/esm/us'),
    uy: () => import('stdnum/lib/esm/uy'),
    ve: () => import('stdnum/lib/esm/ve'),
    vn: () => import('stdnum/lib/esm/vn'),
    za: () => import('stdnum/lib/esm/za'),
}

/** `incomplete`: a check refusing it wants another length, so the user may still be typing. */
export type TaxIdVerdict = 'valid' | 'invalid' | 'incomplete' | 'pending'
export type TaxIdChecker = (value: string) => Exclude<TaxIdVerdict, 'pending'>

async function loadValidator(check: string): Promise<StdnumValidator | null> {
    const [country = '', name = ''] = check.split('.')
    const load = COUNTRY_MODULES[country]
    if (!load) return null
    const validator = ((await load()) as Record<string, StdnumValidator | undefined>)[name]
    return typeof validator?.validate === 'function' ? validator : null
}

/**
 * The tax field's checks (`de.idnr`, stdnum validators the API runs too) as one
 * checker: a number passes when any accepts it. Null when there are none or one
 * isn't known here, so the app never refuses what the API would accept.
 */
export async function loadTaxIdChecker(checks: readonly string[]): Promise<TaxIdChecker | null> {
    const validators = await Promise.all(checks.map(loadValidator))
    if (!validators.length || validators.some((v) => !v)) return null
    return (value) => {
        const results = (validators as StdnumValidator[]).map((v) => v.validate(value))
        if (results.some((r) => r.isValid)) return 'valid'
        return results.some((r) => r.error?.name === 'InvalidLength') ? 'incomplete' : 'invalid'
    }
}

/** What the screen's own check says of the tax number typed; an empty, masked or ITIN value is left to the other checks. */
export function taxIdVerdict(
    field: PaperworkVerificationField,
    values: PaperworkVerificationAnswers,
    check: { checker: TaxIdChecker | null; pending: boolean }
): TaxIdVerdict {
    const value = values[field.key]?.trim() ?? ''
    if (!value || maskedUntouched(field, values) || looksLikeItin(field.format, value)) return 'valid'
    if (check.pending) return 'pending'
    return check.checker?.(value) ?? 'valid'
}

/** The checker of a tax field's checks, loaded when the field shows; pending until it loads. */
export function useTaxIdChecker(checks: readonly string[] | undefined) {
    const key = checks?.join(',') ?? ''
    const [loaded, setLoaded] = useState<{ key: string; checker: TaxIdChecker | null } | null>(null)
    useEffect(() => {
        if (!key) return
        let live = true
        // A chunk that fails to load leaves the number to the API's check.
        const settle = (checker: TaxIdChecker | null) => {
            if (live) setLoaded({ key, checker })
        }
        loadTaxIdChecker(key.split(',')).then(settle, () => settle(null))
        return () => {
            live = false
        }
    }, [key])
    if (!key) return { checker: null, pending: false }
    return loaded?.key === key ? { checker: loaded.checker, pending: false } : { checker: null, pending: true }
}
