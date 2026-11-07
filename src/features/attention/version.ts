import { sha256, toBytes } from 'viem/utils'

export function normalizeVersion(value: string): string {
    const version = value.split(/#|%23/i)[0]
    return version.length <= 200 ? version : `sha256:${sha256(toBytes(version)).slice(2)}`
}
