import type { DepositAccount } from './types'

/**
 * Neither Manteca corridor is a standing account, and both say so in the
 * contract rather than in a screen.
 *
 * Argentina looked like the exception, because the CVU and its alias read like
 * permanent coordinates. They are not: Manteca mints them per deposit, from an
 * amount the user names first, and the CVU belongs to Sixalime Sas rather than
 * to the user. Manteca also only credits a transfer arriving from an account in
 * the depositing user's own name, so there was never anything to hand to an
 * employer either.
 *
 * Modelling Argentina as `provisioning` — waiting on details that no request
 * was ever going to fetch — left the details screen on a skeleton that could
 * not resolve. `unavailable` plus the corridor's real top-up route is the true
 * state: this corridor has a working way in, and it is not this flow.
 */
function mantecaCorridor(railId: string, country: string, currency: string, id: string): DepositAccount {
    return {
        id,
        railId,
        country,
        currency,
        isPrimary: true,
        status: 'unavailable',
        matching: {
            nameOnAccount: 'provider',
            sender: 'own-name-only',
            memo: 'none',
            amount: 'exact',
        },
    }
}

/** Argentina: a per-deposit CVU held by the provider, credited only from the user's own account. */
export function mantecaArgentinaAccount(): DepositAccount {
    return mantecaCorridor('manteca.bank_transfer_ar', 'AR', 'ARS', 'manteca-ars')
}

/** Brazil: a Pix code minted per payment, from the user's own account. */
export function mantecaBrazilAccount(): DepositAccount {
    return mantecaCorridor('manteca.pix_br', 'BR', 'BRL', 'manteca-brl')
}
