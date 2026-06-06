export default async function handler(req, res) {
  const { character } = req.query
  if (!character) return res.status(400).json({ error: '캐릭터명을 입력하세요' })

  const apiKey = process.env.LOSTARK_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' })

  try {
    const response = await fetch(
      `https://developer-lostark.game.onstove.com/armories/characters/${encodeURIComponent(character)}/profiles`,
      {
        headers: {
          Authorization: `bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }
    )

    const text = await response.text()
    if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
      return res.status(502).json({ error: `status=${response.status} body=${text.slice(0, 200)}` })
    }

    const data = JSON.parse(text)
    const rawLevel = data.ItemMaxLevel ?? ''
    const itemLevel = parseFloat(rawLevel.replace(/,/g, '')) || null

    return res.json({
      name: data.CharacterName,
      server: data.ServerName,
      class: data.CharacterClassName,
      itemLevel,
    })
  } catch (err) {
    return res.status(500).json({ error: String(err?.message ?? err) })
  }
}
