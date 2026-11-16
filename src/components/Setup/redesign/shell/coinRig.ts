/**
 * The USD and EUR coin characters are cut out of the approved Accounts rig (src/assets/onboarding/accounts.json),
 * keeping their layer names and anchors (mock core/coins.js). Never the GBP coin.
 */
export type CoinName = 'usd' | 'eur'

const RIG: Record<CoinName, { from: number; to: number; centre: [number, number] }> = {
    usd: { from: 1, to: 28, centre: [525, 380] },
    eur: { from: 56, to: 82, centre: [145, 730] },
}

/** One pass of the coin rig, then frame 0. */
export const COIN_PASS: [number, number] = [0, 72]

type RigLayer = { ind: number; ks: Record<string, unknown> }
type Rig = { w: number; h: number; markers?: unknown[]; layers: RigLayer[] }

/** A 400 x 400 Lottie of one coin, centred, at half the rig's scale. */
export function cutCoinRig(source: unknown, coin: CoinName): Rig {
    const { from, to, centre } = RIG[coin]
    const rig = structuredClone(source) as Rig
    rig.w = 400
    rig.h = 400
    rig.markers = []
    rig.layers = rig.layers.filter((layer) => (layer.ind >= from && layer.ind <= to) || layer.ind === 9999)
    const root = rig.layers.find((layer) => layer.ind === 9999)
    if (root) {
        root.ks.a = { a: 0, k: [centre[0], centre[1], 0] }
        root.ks.p = { a: 0, k: [200, 200, 0] }
        root.ks.s = { a: 0, k: [50, 50, 100] }
    }
    return rig
}
