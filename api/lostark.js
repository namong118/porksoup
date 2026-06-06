const BASE = 'https://developer-lostark.game.onstove.com'

async function lostarkFetch(apiKey, path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `bearer ${apiKey}`, Accept: 'application/json' },
  })
  const text = await response.text()
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`status=${response.status} body=${text.slice(0, 100)}`)
  }
  return JSON.parse(text)
}

export default async function handler(req, res) {
  const { character, all } = req.query
  if (!character) return res.status(400).json({ error: '캐릭터명을 입력하세요' })

  const apiKey = process.env.LOSTARK_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' })

  try {
    if (all === 'true') {
      const data = await lostarkFetch(apiKey, `/characters/${encodeURIComponent(character)}/siblings`)
      return res.json(data.map(c => ({
        name: c.CharacterName,
        server: c.ServerName,
        class: c.CharacterClassName,
        itemLevel: parseFloat((c.ItemAvgLevel ?? '').replace(/,/g, '')) || null,
      })))
    }

    const data = await lostarkFetch(apiKey, `/armories/characters/${encodeURIComponent(character)}/profiles`)
    const itemLevel = parseFloat((data.ItemAvgLevel ?? data.ItemMaxLevel ?? '').replace(/,/g, '')) || null
    return res.json({ name: data.CharacterName, server: data.ServerName, class: data.CharacterClassName, itemLevel, characterImage: data.CharacterImage ?? null, _raw: data })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
