/**
 * Utility for assigning consistent colors to users
 * Uses a deterministic hash to ensure the same user always gets the same color
 */

// Expanded color palette with 32 distinct colors for better variety
const colorPalette = [
  // Original 16 colors
  { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300', hex: '#DC2626' },
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300', hex: '#2563EB' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300', hex: '#16A34A' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300', hex: '#9333EA' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300', hex: '#EA580C' },
  { bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-300', hex: '#0D9488' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300', hex: '#DB2777' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300', hex: '#4F46E5' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300', hex: '#CA8A04' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', border: 'border-cyan-300', hex: '#0891B2' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-300', hex: '#059669' },
  { bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-300', hex: '#7C3AED' },
  { bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-300', hex: '#E11D48' },
  { bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-300', hex: '#0284C7' },
  { bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-300', hex: '#D97706' },
  { bg: 'bg-lime-100', text: 'text-lime-800', border: 'border-lime-300', hex: '#65A30D' },
  
  // Additional 16 color variations for more diversity
  { bg: 'bg-fuchsia-100', text: 'text-fuchsia-800', border: 'border-fuchsia-300', hex: '#A21CAF' },
  { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-300', hex: '#475569' },
  { bg: 'bg-zinc-100', text: 'text-zinc-800', border: 'border-zinc-300', hex: '#52525B' },
  { bg: 'bg-stone-100', text: 'text-stone-800', border: 'border-stone-300', hex: '#57534E' },
  { bg: 'bg-red-200', text: 'text-red-900', border: 'border-red-400', hex: '#B91C1C' },
  { bg: 'bg-blue-200', text: 'text-blue-900', border: 'border-blue-400', hex: '#1E40AF' },
  { bg: 'bg-green-200', text: 'text-green-900', border: 'border-green-400', hex: '#15803D' },
  { bg: 'bg-purple-200', text: 'text-purple-900', border: 'border-purple-400', hex: '#7E22CE' },
  { bg: 'bg-orange-200', text: 'text-orange-900', border: 'border-orange-400', hex: '#C2410C' },
  { bg: 'bg-teal-200', text: 'text-teal-900', border: 'border-teal-400', hex: '#0F766E' },
  { bg: 'bg-pink-200', text: 'text-pink-900', border: 'border-pink-400', hex: '#BE185D' },
  { bg: 'bg-indigo-200', text: 'text-indigo-900', border: 'border-indigo-400', hex: '#3730A3' },
  { bg: 'bg-emerald-200', text: 'text-emerald-900', border: 'border-emerald-400', hex: '#047857' },
  { bg: 'bg-violet-200', text: 'text-violet-900', border: 'border-violet-400', hex: '#6D28D9' },
  { bg: 'bg-sky-200', text: 'text-sky-900', border: 'border-sky-400', hex: '#075985' },
  { bg: 'bg-rose-200', text: 'text-rose-900', border: 'border-rose-400', hex: '#BE123C' },
];

/**
 * Better hash function to convert string to number with better distribution
 */
function hashString(str: string): number {
  let hash = 5381; // Use a prime number as initial value
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    // Use a different algorithm for better distribution
    hash = ((hash << 5) + hash) + char; // hash * 33 + char
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Additional mixing for better distribution
  hash = Math.abs(hash);
  // Add string length as additional entropy
  hash = hash + (str.length * 7919); // Another prime for mixing
  return Math.abs(hash);
}

/**
 * Get consistent color for a user based on their ID
 * @param userId - The user's ID (GHL user ID or any unique identifier)
 * @returns Object with Tailwind CSS classes for the user's color
 */
export function getUserColor(userId: string | null | undefined) {
  if (!userId) {
    // Default color for unassigned
    return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300', hex: '#6B7280' };
  }
  
  // Convert to lowercase and trim for consistency
  const normalizedId = userId.toLowerCase().trim();
  
  // Use the full string including any unique identifiers for better distribution
  const hash = hashString(normalizedId);
  const colorIndex = hash % colorPalette.length;
  return colorPalette[colorIndex];
}

/**
 * Get initials from a name
 * @param name - The user's full name
 * @returns 1-2 character initials
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  
  // Take first letter of first and last name
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}