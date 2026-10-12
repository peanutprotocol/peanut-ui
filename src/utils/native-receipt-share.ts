import { nativeCapability } from './native-capability'

export class NativeReceiptShareUnavailable extends Error {}

interface ReceiptSharePlugin {
    sharePdf(options: { data: string; filename: string; title: string }): Promise<{ cancelled?: boolean }>
}

const ReceiptShare = nativeCapability<ReceiptSharePlugin>('ReceiptShare', { platforms: ['ios', 'android'] })

/** Keep authenticated receipt bytes on-device; never turn private receipts into public links. */
export async function shareNativeReceipt(
    blob: Blob,
    filename: string,
    title: string,
    isCurrent: () => boolean = () => true
): Promise<void> {
    const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(reader.error ?? new Error('Unable to read receipt'))
        reader.readAsDataURL(blob)
    })
    // Encoding crosses an async boundary: a changed/closed receipt must not
    // open a stale share sheet after the user has moved on.
    if (!isCurrent()) return
    await ReceiptShare.call('sharePdf', { data, filename, title }, (cause) => {
        if ((cause as { code?: string })?.code === 'UNIMPLEMENTED' || !ReceiptShare.isSupportedPlatform()) {
            throw new NativeReceiptShareUnavailable('Native receipt sharing requires an app update')
        }
        throw cause
    })
}
