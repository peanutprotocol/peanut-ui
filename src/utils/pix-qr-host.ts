export const PIX_QR_HOSTS = ['basspago', 'mercadopago', 'other-dynamic', 'static', 'unknown'] as const
export type PixQrHost = (typeof PIX_QR_HOSTS)[number]

export function boundedPixQrHost(value: unknown): PixQrHost {
    return PIX_QR_HOSTS.includes(value as PixQrHost) ? (value as PixQrHost) : 'unknown'
}

function fields(payload: string): Map<string, string> | null {
    const result = new Map<string, string>()
    let offset = 0
    while (offset < payload.length) {
        const header = payload.slice(offset, offset + 4)
        if (!/^[0-9]{4}$/.test(header)) return null
        const tag = header.slice(0, 2)
        const end = offset + 4 + Number(header.slice(2))
        if (end > payload.length || result.has(tag)) return null
        result.set(tag, payload.slice(offset + 4, end))
        offset = end
    }
    return result
}

export function pixQrHost(qrCode: string): PixQrHost {
    if (qrCode.length > 4096) return 'unknown'
    const top = fields(qrCode.trim())
    if (!top) return 'unknown'
    let account: Map<string, string> | undefined
    for (const [tag, value] of top) {
        if (Number(tag) < 26 || Number(tag) > 51) continue
        const nested = fields(value)
        if (!nested) return 'unknown'
        if (nested.get('00')?.toLowerCase() !== 'br.gov.bcb.pix') continue
        if (account) return 'unknown'
        account = nested
    }
    if (!account) return 'unknown'
    if (!account.has('25')) return account.get('01') ? 'static' : 'unknown'
    if (account.has('01')) return 'unknown'
    const location = account.get('25')!
    if (!location || /\s/.test(location)) return 'unknown'
    try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(location) ? location : `https://${location}`)
        if (url.protocol !== 'https:' || url.username || url.password || url.port) return 'unknown'
        const host = url.hostname.toLowerCase()
        if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(host)) return 'unknown'
        for (const provider of ['basspago', 'mercadopago'] as const) {
            if (
                ['com', 'com.br', 'com.ar'].some((suffix) => {
                    const domain = `${provider}.${suffix}`
                    return host === domain || host.endsWith(`.${domain}`)
                })
            )
                return provider
        }
        return 'other-dynamic'
    } catch {
        return 'unknown'
    }
}
