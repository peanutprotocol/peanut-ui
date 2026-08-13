// shared flatten helpers for the catalog test suites — keep the recursion in
// one place so the parity, shhhhh and glossary tests can't drift apart
export function leafPaths(obj: Record<string, unknown>, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return typeof value === 'object' && value !== null ? leafPaths(value as Record<string, unknown>, path) : [path]
    })
}

export function leafValue(catalog: Record<string, unknown>, path: string): string {
    return path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], catalog) as string
}

export function leafEntries(obj: Record<string, unknown>, prefix = ''): Array<[string, string]> {
    return Object.entries(obj).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key
        return typeof value === 'object' && value !== null
            ? leafEntries(value as Record<string, unknown>, path)
            : [[path, String(value)] as [string, string]]
    })
}
