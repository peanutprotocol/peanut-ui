import { cookies } from 'next/headers'

/**
 * Forward the signed-in web session to the receipt API without placing the
 * credential in the shared link. Public capability receipts continue to work
 * without a cookie; private receipt kinds are authorized by the API.
 */
export async function getReceiptAuthorization(): Promise<string | undefined> {
    const token = (await cookies()).get('jwt-token')?.value
    return token ? `Bearer ${token}` : undefined
}
