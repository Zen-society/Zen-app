/**
 * Zen システム設定値
 * 未確定のルールは null または undefined として隔離し、
 * 勝手に仮定しないこと。
 */
export const ZEN_CONFIG = {
  // === Zen 発行 ===
  /** 法定通貨購入時の基本Zen発行割合 (0.10 = 10%) */
  baseIssueRate: 0.10,
  /** 条件付き最大Zen発行割合 (0.20 = 20%) */
  maxIssueRate: 0.20,

  // === Zen 有効期限 ===
  /** 基本有効期限（発行時点からの日数） */
  baseExpiryDays: 7,
  /** 延長後の最大有効期限（発行日からの日数） */
  maxExpiryDays: 90,

  // === Zen 適用率 ===
  /** 店舗の基本Zen適用率 (0.20 = 20%) */
  baseApplicationRate: 0.20,
  /** 最大Zen適用率 (1.00 = 100%) */
  maxApplicationRate: 1.00,

  // === 縁環料 ===
  /** 基本縁環料率 (0.05 = 5%) */
  baseCirculationFeeRate: 0.05,
  /** 店舗側手数料率 (現段階では0%) */
  storeFeeRate: 0,

  // === デジタル資産販売手数料 ===
  /** デジタル資産販売手数料率 (0.08 = 8%) */
  digitalAssetFeeRate: 0.08,

  // === ロック ===
  /** 最大ロック期間（日数） */
  maxLockDays: 365,

  // === 最小単位 ===
  /** 内部計算の最小単位（1 = 1 Zen、プロトタイプ用） */
  minimalUnit: 1,

  // === 共通プール（みんなの蓄財）===
  commonReserve: {
    burnEnabled: false,
    burnRate: null as number | null,
    burnPolicy: null as string | null,
    burnSchedule: null as string | null,
  },

  // === 未確定ルール（勝手に設定してはいけない）===
  /**
   * Zen+累積に応じた期限延長日数の算出式
   * 未確定のため null。設定されるまで延長処理は未確定として扱う。
   */
  expiryExtensionFormula: null as string | null,

  /**
   * 期限切れZenからZen+への換算率
   * 未確定のため null。設定されるまで期限切れ時のZen+獲得は行わない。
   */
  expiredZenToZenPlusRate: null as number | null,

  /**
   * ロック解除後の再利用間隔（日数）
   * 「1週間の間隔」がどの期間を指すか未確定のため null。
   */
  reuseIntervalAfterUnlock: null as number | null,

  /**
   * Zen残高と法定通貨額の換算レート
   * 未確定のため null。
   */
  zenToYenConversionRate: null as number | null,

  /**
   * 縁環料率のZen適用率連動式
   * 未確定のため null。基本率のみ使用。
   */
  circulationFeeRateByApplication: null as string | null,

  /**
   * デジタル資産手数料の計算対象額定義
   * 未確定のため null。
   */
  digitalAssetFeeBase: null as string | null,
} as const

export type ZenConfig = typeof ZEN_CONFIG
