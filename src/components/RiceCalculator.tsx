import { useState, useMemo } from 'react'

const FEE_RATE = 0.05
const SALE_MARGIN = 1.1

export default function RiceCalculator() {
  const [priceInput, setPriceInput] = useState('')
  const [members, setMembers] = useState<4 | 8>(4)

  const price = Number(priceInput) || 0

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
          <div className="bg-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-600">
              <span className="font-bold text-white">직접 사용할 경우</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">적정 입찰가</p>
                <p className="text-xl font-bold text-yellow-400">{result.breakeven.toLocaleString()} G</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">분배금 (1인당)</p>
                <p className="text-lg font-bold text-blue-300">{result.directShare.toLocaleString()} G</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-700 rounded-2xl overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-600">
              <span className="font-bold text-white">판매 목적일 경우</span>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2">
              <div>
                <p className="text-xs text-gray-400 mb-1">적정 입찰가</p>
                <p className="text-xl font-bold text-yellow-400">{result.saleBid.toLocaleString()} G</p>
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
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>아이템 가격을 입력해주세요.</p>
        </div>
      )}
    </div>
  )
}
