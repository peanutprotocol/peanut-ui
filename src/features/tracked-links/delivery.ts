type DeliverySurface = 'tracked_link' | 'marketing_qr'
type StatusCategory = '2xx' | '429' | '4xx' | '5xx' | 'other' | 'transport'
export type OpeningDeliveryOutcome = {
    surface: DeliverySurface
    outcome: 'accepted' | 'rejected' | 'exhausted'
    status: StatusCategory
    attempts: number
}

/** Stable serialized events, at most two attempts, with no persistent queue. */
export async function deliverOpening(
    url: string,
    body: string,
    surface: DeliverySurface,
    options: { keepalive?: boolean; maxAttempts?: 1 | 2 } = {}
): Promise<OpeningDeliveryOutcome> {
    const deadline = Date.now() + 4500
    const maxAttempts = options.maxAttempts ?? 2
    let status: StatusCategory = 'transport'
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout> | undefined
        try {
            const response = await Promise.race([
                fetch(url, {
                    method: 'POST',
                    credentials: 'omit',
                    referrerPolicy: 'no-referrer',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    signal: controller.signal,
                    ...(options.keepalive ? { keepalive: true } : {}),
                }),
                new Promise<never>((_, reject) => {
                    timer = setTimeout(
                        () => {
                            controller.abort()
                            reject(new Error('Opening delivery timeout'))
                        },
                        Math.max(0, Math.min(2000, deadline - Date.now()))
                    )
                }),
            ])
            status =
                response.status >= 200 && response.status < 300
                    ? '2xx'
                    : response.status === 429
                      ? '429'
                      : response.status >= 500 && response.status < 600
                        ? '5xx'
                        : response.status >= 400 && response.status < 500
                          ? '4xx'
                          : 'other'
            if (status === '2xx') return record({ surface, outcome: 'accepted', status, attempts: attempt })
            if (status !== '429' && status !== '5xx')
                return record({ surface, outcome: 'rejected', status, attempts: attempt })
        } catch {
            status = 'transport'
        } finally {
            if (timer !== undefined) clearTimeout(timer)
        }
        if (attempt === maxAttempts || Date.now() >= deadline) {
            return record({ surface, outcome: 'exhausted', status, attempts: attempt })
        }
    }
    return record({ surface, outcome: 'exhausted', status, attempts: maxAttempts })
}

function record(outcome: OpeningDeliveryOutcome): OpeningDeliveryOutcome {
    // Do not use request-scoped error reporting: it can enrich with cookies,
    // user identity or URL. This envelope has only fixed operational categories.
    console.info('acquisition_opening_delivery', outcome)
    return outcome
}
