// Create a mapping from your tailwind.config.js colors to actual hex values
export const TAILWIND_COLORS = {
  'primary-1': '#FF90E8',
  'primary-2': '#CC73BA', 
  'primary-3': '#EFE4FF',
  'primary-4': '#BA8BFF',
  'secondary-1': '#FFC900',
  'secondary-2': '#E99898',
  'secondary-3': '#90A8ED',
  'secondary-4': '#FFF4CC',
  'secondary-5': '#FBEAEA',
  'secondary-6': '#E9EEFB',
  'secondary-7': '#5883FF',
  'grey-1': '#5F646D',
  'grey-2': '#E7E8E9',
  'grey-3': '#FAF4F0',
  'grey-4': '#EFEFF0',
  'outline-1': '#98E9AB',
  'outline-2': '#AE7AFF',
  'outline-3': '#E99898',
} as const

export type TailwindColorKey = keyof typeof TAILWIND_COLORS

/**
 * Convert a Tailwind color key to its hex value
 * @param colorKey - The Tailwind color key (e.g., 'secondary-1')
 * @returns The hex color value or undefined if not found
 */
export function getTailwindColorValue(colorKey: string): string | undefined {
  return TAILWIND_COLORS[colorKey as TailwindColorKey]
}

/**
 * Convert a Tailwind color key to its hex value with fallback
 * @param colorKey - The Tailwind color key (e.g., 'secondary-1')
 * @param fallback - Fallback color if key not found
 * @returns The hex color value or fallback
 */
export function getTailwindColorValueWithFallback(colorKey: string, fallback: string = '#000000'): string {
  return getTailwindColorValue(colorKey) ?? fallback
}