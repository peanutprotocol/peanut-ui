import peanut from '@squirrel-labs/peanut-sdk'
export async function resolveFromEnsName(ensName: string): Promise<string | undefined> {
    const provider = await peanut.getDefaultProvider('1')
    const x = await provider.resolveName(ensName)

    return x ? x : undefined
}
