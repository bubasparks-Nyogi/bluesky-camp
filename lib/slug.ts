// Convert a title (Japanese or English) to a URL-safe slug.
// Strategy: lowercase, replace whitespace with hyphens, drop chars unsafe for URLs.
// For Japanese titles (which would lose all chars), fall back to a timestamp suffix.
export function slugify(input: string): string {
  const lower = input.toLowerCase().trim()
  // Keep ASCII alphanumerics and hyphens; convert spaces/underscores to hyphens.
  const replaced = lower
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (replaced.length === 0) {
    // Fallback: timestamp-based slug for non-ASCII-only titles.
    return 'post-' + Date.now().toString(36)
  }
  return replaced
}
