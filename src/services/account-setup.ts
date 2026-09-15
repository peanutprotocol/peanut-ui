import type { IUserProfile } from '@/interfaces/interfaces'

export const ACCOUNT_SETUP_MAX_REQUEST_ATTEMPTS = 2

export type AccountSetupOutcome = {
    status: 'created' | 'reconciled'
    requestAttempts: number
}

export type AccountSetupFailureKind = 'invalid_credentials' | 'account_conflict' | 'retryable' | 'rejected'

export class AccountSetupError extends Error {
    readonly kind: AccountSetupFailureKind
    readonly requestAttempts: number
    readonly status?: number

    constructor(
        message: string,
        options: {
            kind: AccountSetupFailureKind
            requestAttempts: number
            status?: number
            cause?: unknown
        }
    ) {
        super(message, { cause: options.cause })
        this.name = 'AccountSetupError'
        this.kind = options.kind
        this.requestAttempts = options.requestAttempts
        this.status = options.status
    }
}

type CompleteAccountSetupOptions = {
    accountIdentifier: string
    accountType: string
    request: () => Promise<Response>
    fetchProfile: () => Promise<IUserProfile | null>
    maxRequestAttempts?: number
    retryDelayMs?: number
    wait?: (delayMs: number) => Promise<void>
}

const DEFAULT_RETRY_DELAY_MS = 1_000

const isRetryableStatus = (status: number): boolean => status === 408 || status >= 500

const profileHasAccount = (profile: IUserProfile | null, accountIdentifier: string, accountType: string): boolean => {
    const expectedIdentifier = accountIdentifier.trim().toLowerCase()
    const accounts = [...(profile?.accounts ?? []), ...(profile?.user.accounts ?? [])]

    return accounts.some(
        (account) => account.type === accountType && account.identifier.trim().toLowerCase() === expectedIdentifier
    )
}

/**
 * Complete the idempotent /add-account mutation without treating an ambiguous
 * transport result as a logout. Before a POST is repeated, the current profile
 * is always checked for the derived wallet address: the first request may have
 * committed even when its response never reached the client.
 */
export const completeAccountSetup = async ({
    accountIdentifier,
    accountType,
    request,
    fetchProfile,
    maxRequestAttempts = ACCOUNT_SETUP_MAX_REQUEST_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
}: CompleteAccountSetupOptions): Promise<AccountSetupOutcome> => {
    let requestAttempts = 0
    let lastFailure: unknown
    let lastStatus: number | undefined

    const reconcile = async (): Promise<boolean> => {
        try {
            return profileHasAccount(await fetchProfile(), accountIdentifier, accountType)
        } catch (error) {
            lastFailure = error
            return false
        }
    }

    while (requestAttempts < maxRequestAttempts) {
        if (requestAttempts > 0) {
            await wait(retryDelayMs * requestAttempts)
            if (await reconcile()) {
                return { status: 'reconciled', requestAttempts }
            }
        }

        requestAttempts += 1

        let response: Response
        try {
            response = await request()
        } catch (error) {
            lastFailure = error
            if (requestAttempts < maxRequestAttempts) continue
            if (await reconcile()) return { status: 'reconciled', requestAttempts }
            throw new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts,
                cause: lastFailure,
            })
        }

        lastStatus = response.status

        if (response.ok) {
            if (await reconcile()) return { status: 'created', requestAttempts }

            lastFailure = new Error('Account was not present in the refreshed profile')
            if (requestAttempts < maxRequestAttempts) continue
            throw new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts,
                status: response.status,
                cause: lastFailure,
            })
        }

        // /add-account authenticates before touching the account. Its 401 is a
        // rejected/revoked session; its 403 is a proven token/body user mismatch.
        if (response.status === 401 || response.status === 403) {
            throw new AccountSetupError('Account creation credentials are no longer valid', {
                kind: 'invalid_credentials',
                requestAttempts,
                status: response.status,
            })
        }

        // A conflict can mean the response raced a prior successful create.
        // Accept it only when the authenticated profile owns this exact address.
        if (response.status === 409) {
            if (await reconcile()) return { status: 'reconciled', requestAttempts }
            throw new AccountSetupError('Account belongs to another user', {
                kind: 'account_conflict',
                requestAttempts,
                status: response.status,
            })
        }

        if (isRetryableStatus(response.status)) {
            if (requestAttempts < maxRequestAttempts) continue
            if (await reconcile()) return { status: 'reconciled', requestAttempts }
            throw new AccountSetupError('Account creation could not be confirmed', {
                kind: 'retryable',
                requestAttempts,
                status: response.status,
            })
        }

        throw new AccountSetupError('Account creation was rejected', {
            kind: 'rejected',
            requestAttempts,
            status: response.status,
        })
    }

    throw new AccountSetupError('Account creation could not be confirmed', {
        kind: 'retryable',
        requestAttempts,
        status: lastStatus,
        cause: lastFailure,
    })
}
