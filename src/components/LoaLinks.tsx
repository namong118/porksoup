const LINKS = [
  { name: 'LOPEC', url: 'https://lopec.kr/', desc: '공대 편성 · 레이드 계산기' },
  { name: 'KLOA', url: 'https://kloa.gg/', desc: '캐릭터 정보 · 아이템 분석' },
  { name: 'LOAUP', url: 'https://loaup.com/', desc: '각종 로아 유틸 도구 모음' },
  { name: 'ALOA', url: 'https://aloa.gg/ko', desc: '공략 · 가이드 · 정보' },
]

export default function LoaLinks() {
  return (
    <div>
      <h2 className="text-lg font-bold mb-4">각종 사이트</h2>
      <div className="flex flex-col gap-3">
        {LINKS.map(link => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-gray-700 hover:bg-gray-600 rounded-xl px-5 py-4 flex items-center justify-between transition-colors group"
          >
            <div>
              <p className="font-bold text-white group-hover:text-blue-300 transition-colors">{link.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">{link.desc}</p>
              <p className="text-xs text-gray-600 mt-1">{link.url}</p>
            </div>
            <span className="text-gray-500 group-hover:text-blue-300 transition-colors text-lg">→</span>
          </a>
        ))}
      </div>
    </div>
  )
}
