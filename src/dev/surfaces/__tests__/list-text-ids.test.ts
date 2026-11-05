import { readFileSync } from 'fs'
import { join } from 'path'
import catalogue from '../../../../scripts/screens/capture-catalogue.json'
import { API_CONTRACT_STATES } from '../api-contract-states'
import { SURFACE_META } from '../list'

// The Screen Library capture (trusted copy from dev) finds a surface by searching list.ts's source text.
it('names every catalogued /dev/surfaces state literally in list.ts', () => {
    const text = readFileSync(join(__dirname, '../list.ts'), 'utf8')
    const ids = JSON.stringify(catalogue)
        .match(/\/dev\/surfaces\?s=[\w-]+/g)!
        .map((route) => route.split('s=')[1])
    expect(ids.length).toBeGreaterThan(0)
    expect([...new Set(ids)].filter((id) => !text.includes(id))).toEqual([])
})

it('lists every API ribbon state', () => {
    expect(Object.keys(API_CONTRACT_STATES).filter((id) => !SURFACE_META[id])).toEqual([])
})
