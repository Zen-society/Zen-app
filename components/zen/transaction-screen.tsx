'use client'

import { useState } from 'react'
import { ArrowRight, CheckCircle2, Loader2, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { ZEN_CONFIG } from '@/lib/zen/config'
import { formatNumber } from '@/lib/zen-data'

export function TransactionScreen() {
  const [priceYen, setPriceYen] = useState(1000)
  const [applicationRate, setApplicationRate] = useState(ZEN_CONFIG.baseApplicationRate)
  const [availableZen, setAvailableZen] = useState(15782)
  const [processing, setProcessing] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const maxZenUsable = Math.floor(priceYen * applicationRate)
  const useZen = Math.min(maxZenUsable, availableZen)
  const yenPayment = priceYen - useZen
  const circulationFeeRate = ZEN_CONFIG.baseCirculationFeeRate
  const circulationFeeYen = Math.floor(yenPayment * circulationFeeRate)
  const circulationFeeZen = Math.floor(useZen * circulationFeeRate)

  // Zen発行量（円支払額の10%）— Zenで支払った部分には付与しない
  const zenIssued = Math.floor(yenPayment * ZEN_CONFIG.baseIssueRate)

  const isFeeFormulaConfirmed = ZEN_CONFIG.circulationFeeRateByApplication === null
  const isConversionRateConfirmed = ZEN_CONFIG.zenToYenConversionRate === null

  const handleConfirm = () => {
    setShowConfirm(false)
    setProcessing(true)
    toast('取引を記録しました（プロトタイプ）')
    setTimeout(() => {
      setProcessing(false)
      setAvailableZen((prev) => prev - useZen + zenIssued)
    }, 800)
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <header>
        <p className="text-xs font-bold text-zen-mint-deep">取引空間</p>
        <h1 className="font-display text-2xl font-bold text-zen-ink">お買い物</h1>
      </header>

      <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 ring-1 ring-zen-ink/5">
        <div>
          <label htmlFor="price-yen" className="text-xs font-bold text-zen-ink/70">
            商品・サービス価格
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id="price-yen"
              type="number"
              value={priceYen}
              min={0}
              onChange={(e) => setPriceYen(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-xl bg-zen-mint-soft px-3 py-2.5 text-sm font-bold tabular-nums text-zen-ink outline-none ring-1 ring-zen-ink/10 focus:ring-2 focus:ring-zen-mint"
            />
            <span className="text-sm font-bold text-zen-ink/70">円</span>
          </div>
        </div>

        <div>
          <label htmlFor="app-rate" className="text-xs font-bold text-zen-ink/70">
            店舗のZen適用率: {Math.round(applicationRate * 100)}%
          </label>
          <input
            id="app-rate"
            type="range"
            min={0}
            max={100}
            step={5}
            value={applicationRate * 100}
            onChange={(e) => setApplicationRate(Number(e.target.value) / 100)}
            className="mt-2 w-full accent-zen-mint"
          />
        </div>

        <div className="rounded-2xl bg-zen-mint-soft p-4">
          <h2 className="text-xs font-bold text-zen-mint-deep">支払い内訳</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-zen-ink/70">使用可能Zen</dt>
              <dd className="font-bold tabular-nums text-zen-ink">{formatNumber(availableZen)} Zen</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zen-ink/70">使用予定Zen</dt>
              <dd className="font-bold tabular-nums text-zen-mint-deep">
                {formatNumber(useZen)} Zen
                {isConversionRateConfirmed && (
                  <span className="ml-1 text-[10px] text-zen-ink/40">（換算レート未確定）</span>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-zen-ink/70">円支払額</dt>
              <dd className="font-bold tabular-nums text-zen-ink">{formatNumber(yenPayment)} 円</dd>
            </div>
            <div className="border-t border-zen-mint/20 pt-2">
              <div className="flex items-center justify-between">
                <dt className="text-zen-ink/70">縁環料（円分）</dt>
                <dd className="font-bold tabular-nums text-zen-amber">
                  {formatNumber(circulationFeeYen)} 円
                  {!isFeeFormulaConfirmed && (
                    <span className="ml-1 text-[10px] text-zen-ink/40">（基本率）</span>
                  )}
                </dd>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <dt className="text-zen-ink/70">縁環料（Zen分）</dt>
                <dd className="font-bold tabular-nums text-zen-amber">
                  {formatNumber(circulationFeeZen)} Zen → 蓄財
                </dd>
              </div>
            </div>
            <div className="border-t border-zen-mint/20 pt-2">
              <div className="flex items-center justify-between">
                <dt className="text-zen-mint-deep font-bold">Zen獲得予想</dt>
                <dd className="font-bold tabular-nums text-zen-mint-deep">
                  +{formatNumber(zenIssued)} Zen
                </dd>
              </div>
              <p className="mt-0.5 text-[10px] text-zen-ink/50">
                円決済分の{Math.round(ZEN_CONFIG.baseIssueRate * 100)}%がZenとして発行されます
              </p>
            </div>
          </dl>
        </div>

        <button
          type="button"
          disabled={processing || priceYen <= 0}
          onClick={() => setShowConfirm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-zen-ink py-3 text-sm font-bold text-white transition hover:bg-zen-mint-deep disabled:opacity-50"
        >
          <ShoppingBag className="size-4" aria-hidden="true" />
          取引を確定する
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-5" onClick={() => setShowConfirm(false)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold text-zen-ink">取引確認</h3>
            <p className="mt-2 text-sm text-zen-ink/70">
              以下の内容で取引を確定します。よろしいですか？
            </p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zen-ink/60">商品価格</dt>
                <dd className="font-bold tabular-nums text-zen-ink">{formatNumber(priceYen)} 円</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zen-ink/60">Zen使用</dt>
                <dd className="font-bold tabular-nums text-zen-mint-deep">{formatNumber(useZen)} Zen</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zen-ink/60">円支払</dt>
                <dd className="font-bold tabular-nums text-zen-ink">{formatNumber(yenPayment)} 円</dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-full bg-zen-mint-soft py-2.5 text-sm font-bold text-zen-ink transition hover:bg-zen-mint/20"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 rounded-full bg-zen-ink py-2.5 text-sm font-bold text-white transition hover:bg-zen-mint-deep"
              >
                確定
              </button>
            </div>
          </div>
        </div>
      )}

      {processing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-6">
            <Loader2 className="size-8 animate-spin text-zen-mint" />
            <p className="text-sm font-bold text-zen-ink">取引処理中...</p>
          </div>
        </div>
      )}

      <p className="flex items-center justify-center gap-1 text-[11px] text-zen-ink/50">
        <ArrowRight className="size-3" aria-hidden="true" />
        この画面はプロトタイプです。実際の決済は行われません。
      </p>
    </div>
  )
}
