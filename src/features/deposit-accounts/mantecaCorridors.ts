import { MANTECA_ARG_DEPOSIT_CUIT, MANTECA_ARG_DEPOSIT_NAME } from '@/constants/manteca.consts'
import type { DepositAccount } from './types'

/**
 * What the shipped Manteca deposit screen has to work with — the fields
 * `MantecaDepositShareDetails` reads today.
 */
export interface MantecaDepositDetails {
    depositAddress?: string
    depositAlias?: string
}

/**
 * Argentina and Brazil are not claimable accounts and the adapter says so in
 * the contract rather than in a screen.
 *
 * The CVU belongs to Sixalime Sas, Manteca's Argentine entity, and Manteca
 * only credits a transfer that arrives from an account in the depositing
 * user's own name — so there is nothing a user could hand to an employer.
 * Modelling it as `nameOnAccount: 'provider'` plus `sender: 'own-name-only'`
 * lets the same screens render it honestly: the details are real and useful
 * for the user's own top-up, and the share surface stays off.
 */
export function fromMantecaArgentina(details: MantecaDepositDetails): DepositAccount {
    return {
        id: 'manteca-ars',
        railId: 'manteca.bank_transfer_ar',
        country: 'AR',
        currency: 'ARS',
        isPrimary: true,
        status: details.depositAddress ? 'active' : 'provisioning',
        matching: {
            nameOnAccount: 'provider',
            sender: 'own-name-only',
            memo: 'none',
            amount: 'exact',
        },
        instructions: {
            accountHolderName: MANTECA_ARG_DEPOSIT_NAME,
            cvu: details.depositAddress,
            alias: details.depositAlias,
            taxId: MANTECA_ARG_DEPOSIT_CUIT,
            paymentRails: ['transfer_ar'],
        },
    }
}

/**
 * Brazil is a Pix code minted per payment, from the user's own account. There
 * are no reusable details to hold, so the corridor has no instructions at all
 * and the UI routes the user to the existing Pix flow.
 */
export function mantecaBrazilAccount(): DepositAccount {
    return {
        id: 'manteca-brl',
        railId: 'manteca.pix_br',
        country: 'BR',
        currency: 'BRL',
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
