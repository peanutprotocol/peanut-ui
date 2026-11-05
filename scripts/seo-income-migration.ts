import inventory from './seo-income-migration.json'

/**
 * The October 2026 migration can publish before or after the approved removal,
 * never halfway through it. Required paths also catch a missing help/legal file
 * hidden by an unrelated new page. Keep the count baseline in pre-migration
 * units so new publications retain the existing regression guard.
 */
export function checkIncomeMigration(files: Set<string>, published: Set<string>) {
    const errors: string[] = []
    for (const file of [...inventory.retainedPublished, ...inventory.retainedUnpublished]) {
        if (!files.has(file)) errors.push(`Required content is missing: ${file}`)
    }
    for (const file of inventory.retainedPublished) {
        if (files.has(file) && !published.has(file)) errors.push(`Required content is unpublished: ${file}`)
    }
    const remaining = inventory.retired.filter((file) => files.has(file))
    if (remaining.length > 0 && remaining.length < inventory.retired.length) {
        errors.push(
            `Incomplete SEO retirement: ${remaining.length} of ${inventory.retired.length} removal files remain. Publish the complete reviewed inventory.`
        )
    }
    for (const file of remaining) {
        if (!published.has(file)) errors.push(`Retirement requires removing the file, not unpublishing it: ${file}`)
    }
    return {
        errors,
        retirementAllowance: remaining.length === 0 && errors.length === 0 ? inventory.retired.length : 0,
    }
}
