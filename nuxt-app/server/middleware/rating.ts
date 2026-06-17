// The /podcast/[slug]/[up|down] links ship in RSS show notes (Spotify, Apple
// Podcasts, Pocket Casts, …), where only plain GET links work. GET must stay
// safe and idempotent, so this no longer writes a vote — it redirects to the
// podcast page, whose client-side script POSTs /api/vote. Crawlers follow the
// redirect but don't run JS, so they never register a vote.
export default eventHandler(function (event) {
  const requestPath = event.path
  if (!requestPath.startsWith('/podcast/')) {
    return
  }

  // Path pattern "/podcast/[slug]/[up|down]"
  const match = requestPath.match(/^\/podcast\/([^/]+)\/(up|down)$/)
  if (!match) {
    return
  }

  const slug = match[1]
  const direction = match[2]

  return sendRedirect(event, `/podcast/${slug}?vote=${direction}`, 302)
})
