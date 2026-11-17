import { isReservedSignupUsername } from '@/features/setup/reserved-username'
import { USERNAME_MAX } from '@/features/setup/username-suggestions'
import { isDemoUsername } from '@/utils/demo'

/**
 * What the username field shows. `default` = the checked suggestion the person has not picked; `rolled` = a name
 * the die landed on; `empty` = the person emptied the field; `short` / `checking` = a typed name that is too short or
 * waits for its check.
 */
export type UsernameKind =
    | 'default'
    | 'rolled'
    | 'rolling'
    | 'empty'
    | 'short'
    | 'checking'
    | 'available'
    | 'demo'
    | 'taken'
    | 'invalid-start'
    | 'invalid-chars'
    | 'too-long'
    | 'reserved'
    | 'check-failed'

/** A typed value's kind before any request, in the mock's rule order (contract § 3.1, C9). */
export function evaluateUsername(value: string, refusedUsername: string | null): UsernameKind {
    if (isDemoUsername(value)) return 'demo'
    if (!value) return 'empty'
    if (/^[0-9]/.test(value)) return 'invalid-start'
    if (/[^a-z0-9]/.test(value)) return 'invalid-chars'
    if (value.length > USERNAME_MAX) return 'too-long'
    if (value.length < 4) return 'short'
    if (isReservedSignupUsername(value) || value === refusedUsername) return 'reserved'
    return 'checking'
}

export const ERROR_KINDS: readonly UsernameKind[] = [
    'taken',
    'invalid-start',
    'invalid-chars',
    'too-long',
    'reserved',
    'check-failed',
]

/** The mock's state names for `data-setup-state` (tests and captures). */
export function usernameStateName(kind: UsernameKind, claiming: boolean): string {
    if (claiming) return 'claiming'
    switch (kind) {
        case 'empty':
        case 'short':
        case 'checking':
            return 'typing'
        case 'demo':
            return 'available'
        case 'invalid-start':
        case 'invalid-chars':
            return 'invalid'
        default:
            return kind
    }
}
