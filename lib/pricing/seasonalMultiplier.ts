export interface SeasonalRate {
  start_date: string  // YYYY-MM-DD inclusive
  end_date:   string  // YYYY-MM-DD inclusive
  multiplier: number
}

/** 指定日に該当する seasonal multiplier を返す。複数該当の場合は最も離れた（=最大）を採用。なければ 1.0。 */
export function seasonalMultiplierFor(date: string, rates: SeasonalRate[]): number {
  let mul = 1
  let matched = false
  for (const r of rates) {
    if (date >= r.start_date && date <= r.end_date) {
      if (!matched || Math.abs(r.multiplier - 1) > Math.abs(mul - 1)) {
        mul = r.multiplier
        matched = true
      }
    }
  }
  return mul
}
