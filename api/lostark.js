export default async function handler(req, res) {
  const { character } = req.query
  if (!character) return res.status(400).json({ error: '캐릭터명을 입력하세요' })

  const apiKey = process.env.LOSTARK_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'API 키가 설정되지 않았습니다' })

  try {
    const response = await fetch(
      `https://developer-lostark.game.onstove.com/characters/${encodeURIComponent(character)}/armories/profile`,
      {
        headers: {
          Authorization: `bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }
    )

    if (response.status === 404) return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다' })
    if (!response.ok) return res.status(502).json({ error: `로스트아크 API 오류 (${response.status})` })

    const data = await response.json()
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
