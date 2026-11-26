/**
 * Push deep links and email links name the message they belong to as `msg=<event type>` (TASK-22683), so
 * `notification_clicked` can say which message was opened. Only an event-type-shaped value is read: the param
 * reaches analytics, so nothing else in it may pass.
 */
export const MESSAGE_PARAM = 'msg'

const MESSAGE_TYPE = /^[a-z][a-z0-9_.-]{0,79}$/i

export function readMessageType(value: string | null | undefined): string | undefined {
    return value && MESSAGE_TYPE.test(value) ? value : undefined
}

/** The message type a notification link carries, or undefined. */
export function messageTypeOfLink(link: string | null | undefined): string | undefined {
    if (!link) return undefined
    try {
        return readMessageType(new URL(link, 'https://peanut.me').searchParams.get(MESSAGE_PARAM))
    } catch {
        return undefined
    }
}
