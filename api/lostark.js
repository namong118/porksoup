export const config = { runtime: 'edge' }

export default async function handler(request) {
  const { searchParams } = new URL(request.url)
  const character = searchParams.get('character')

  if (!character) {
    return new Response(JSON.stringify({ error: '캐릭터명을 입력하세요' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.LOSTARK_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API 키가 설정되지 않았습니다' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

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

    if (response.status === 404) {
      return new Response(JSON.stringify({ error: '캐릭터를 찾을 수 없습니다' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `로스트아크 API 오류 (${response.status})` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const rawLevel = data.ItemMaxLevel ?? ''
    const itemLevel = parseFloat(rawLevel.replace(/,/g, '')) || null

    return new Response(
      JSON.stringify({
        name: data.CharacterName,
        server: data.ServerName,
        class: data.CharacterClassName,
        itemLevel,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
