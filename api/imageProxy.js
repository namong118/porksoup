export default async function handler(req, res) {
  const { url } = req.query
  if (!url || typeof url !== 'string') return res.status(400).send('Missing url')

  if (!url.startsWith('https://') || !url.includes('lostark')) {
    return res.status(403).send('Forbidden')
  }

  try {
    const response = await fetch(url, {
      headers: { Referer: 'https://lostark.game.onstove.com/' },
    })
    if (!response.ok) return res.status(response.status).send('Upstream error')

    const contentType = response.headers.get('content-type') ?? 'image/jpeg'
    const buffer = await response.arrayBuffer()

    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'public, max-age=86400')
    res.send(Buffer.from(buffer))
  } catch {
    res.status(500).send('Proxy error')
  }
}
