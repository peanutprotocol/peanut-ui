import { parseVariantCookie } from './variant-cookie'

type WeightedExperiment = { id: string; variants: readonly { id: string; weight: number }[] }

/**
 * Keeps the visitor's variant while the cookie names this experiment and a live variant;
 * otherwise picks by weight. `null` when every weight is 0, which parks the creator's page.
 */
export function pickVariant(
    experiment: WeightedExperiment,
    cookieValue: string | null | undefined,
    random: () => number = Math.random
): string | null {
    const live = experiment.variants.filter((variant) => variant.weight > 0)
    const sticky = parseVariantCookie(cookieValue)
    if (sticky?.experimentId === experiment.id && live.some((variant) => variant.id === sticky.variantId))
        return sticky.variantId

    let remaining = random() * live.reduce((sum, variant) => sum + variant.weight, 0)
    for (const variant of live) {
        remaining -= variant.weight
        if (remaining < 0) return variant.id
    }
    // Float rounding can leave the last step at exactly 0.
    return live.at(-1)?.id ?? null
}
