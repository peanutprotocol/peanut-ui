// The app's `twMerge`. Import this, never `tailwind-merge` directly.
//
// feat/design-system extends this with custom class groups for its Tailwind 4
// token scale (text-heading-*, rounded-round, etc). None of those tokens exist
// on this branch yet, so a plain re-export is the correct equivalent here —
// swap this file for the DS one wholesale once that branch merges.
export { twMerge } from 'tailwind-merge'
