import { useState, useMemo } from 'react'

const FEE_RATE = 0.05
const SALE_MARGIN = 1.1

export default function RiceCalculator() {
  const [priceInput, setPriceInput] = useState('')
  const [members, setMembers] = useState<4 | 8>(4)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const price = Number(priceInput) || 0

  async function copyBid(key: string, value: number) {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(prev => (prev === key ? null : prev)), 1200)
    } catch {}
  }

  const result = useMemo(() => {
    if (price <= 0) return null
    const fee = price * FEE_RATE
    const netPrice = price - fee
    const breakeven = Math.floor(netPrice * (members - 1) / members)
    const saleBid = Math.round(breakeven / SALE_MARGIN)
    const takeHome = netPrice - saleBid
    const directShare = Math.round(breakeven / (members - 1))
    const saleShare = Math.round(saleBid / (members - 1))
    return { breakeven, saleBid, takeHome, directShare, saleShare }
  }, [price, members])

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">🍚 경매장 쌀 계산기</h2>

      <div className="bg-gray-700 rounded-xl p-4 mb-4 flex flex-col gap-3">
        <div>
          <p className="text-xs text-gray-400 mb-1">아이템 가격 (골드)</p>
          <input
            type="number"
            value={priceInput}
            onChange={e => setPriceInput(e.target.value)}
            placeholder="10000"
            className="w-full bg-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500"
          />
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">인원수</p>
          <div className="flex gap-2">
            {([4, 8] as const).map(n => (
              <button
                key={n}
                onClick={() => setMembers(n)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  members === n ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                }`}
              >
                {n}인
              </button>
            ))}
          </div>
        </div>
      </div>

      {result ? (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-500 -mt-1">💡 적정 입찰가를 클릭하면 숫자가 복사돼요 — 게임 입찰창에 바로 붙여넣으세요</p>

          <div className="bg-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-600">
              <span className="font-bold text-white">판매 목적일 경우</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">적정 입찰가</p>
                <p
                  onClick={() => copyBid('saleBid', result.saleBid)}
                  title="클릭하여 복사하기"
                  className="text-xl font-bold text-yellow-400 cursor-pointer hover:underline inline-flex items-center gap-2"
                >
                  {result.saleBid.toLocaleString()} G
                  {copiedKey === 'saleBid' && <span className="text-xs text-green-400 font-normal">복사됨!</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">내가 가져가는 금액</p>
                <p className="text-lg font-bold text-green-400">{result.takeHome.toLocaleString()} G</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">분배금 (1인당)</p>
                <p className="text-lg font-bold text-blue-300">{result.saleShare.toLocaleString()} G</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-600">
              <span className="font-bold text-white">직접 사용할 경우</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">적정 입찰가</p>
                <p
                  onClick={() => copyBid('breakeven', result.breakeven)}
                  title="클릭하여 복사하기"
                  className="text-xl font-bold text-yellow-400 cursor-pointer hover:underline inline-flex items-center gap-2"
                >
                  {result.breakeven.toLocaleString()} G
                  {copiedKey === 'breakeven' && <span className="text-xs text-green-400 font-normal">복사됨!</span>}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">분배금 (1인당)</p>
                <p className="text-lg font-bold text-blue-300">{result.directShare.toLocaleString()} G</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>아이템 가격을 입력해주세요.</p>
        </div>
      )}
    </div>
  )
}
