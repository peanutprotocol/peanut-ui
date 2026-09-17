import { writeFileSync } from 'node:fs'
import { SCREENS } from '../../src/dev/screens/catalogue'
import { inventory } from './inventory.mjs'
const result = inventory('.', SCREENS)
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(result, null, 2))
else console.log(JSON.stringify(result, null, 2))
