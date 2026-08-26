/**
 * Normalises a username into an invite code.
 *
 * Tolerates hand-typed input ("Who invited you?" asks for a username, so people
 * paste `@alice ` or ` Alice`): trims whitespace and strips a leading @.
 *
 * Kept in its own module because `demo.ts` needs only this helper, and
 * importing it from `general.utils` drags that module's chain/token metadata
 * (189 KB of JSON) onto every route that touches demo mode — including the
 * landing page.
 */
export const toInviteCode = (username: string): string => username.trim().replace(/^@/, '').toLowerCase()

/**
 * Reads the inviter from a link's query params. New links emit `invited_by`
 * (it names what the value is — the inviter's username); `code` is the alias
 * every previously shared link carries and stays supported forever. When both
 * are present the legacy `code` wins, so a pre-existing link keeps its exact
 * behavior even with the new param appended to it.
 */
export const inviteCodeFromParams = (params: { get(name: string): string | null }): string | null =>
    params.get('code') ?? params.get('invited_by')
