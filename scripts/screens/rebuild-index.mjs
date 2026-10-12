/** Trusted publisher only. Immutable reports are uploaded without a global
 * lock; this short job serializes the two shared catalogue pointers. */
import { createStorage } from './cloudflare-storage.mjs'
import { updateIndexes } from './publication-index.mjs'

const storage = await createStorage()
const { entries, latest } = await updateIndexes(storage)

console.log(`Indexed ${entries.length} retained Screen Library reports.`)
if (latest) console.log(`Latest complete dev library: ${latest.path}`)
