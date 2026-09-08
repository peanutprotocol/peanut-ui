export function isSelfRequestPayment(
    payerAddress: string | undefined,
    payerUserId: string | undefined,
    recipientAddress: string | undefined,
    recipientUserId?: string | null
): boolean {
    if (payerUserId && recipientUserId && payerUserId === recipientUserId) return true
    if (!payerAddress || !recipientAddress) return false
    const normalize = (address: string) => (/^0x/i.test(address) ? address.toLowerCase() : address)
    return normalize(payerAddress) === normalize(recipientAddress)
}
