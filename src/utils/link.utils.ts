// This file holds all relevant link utils
// TODO: bring all link utils from general.utils.ts to here

export async function get(bankAccount: string): Promise<boolean> {
    bankAccount = bankAccount.replace(/\s/g, '')
    const response = await fetch(`/api/peanut/iban/validate-bank-account`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            bankAccount,
        }),
    })

    if (response.status !== 200) {
        return false
    } else {
        return true
    }
}