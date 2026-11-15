// Plain-language insights generated from the numbers (shown with the "AI-generated" badge;
// the ranking API can later return its own text in the same place).
import { signed } from './format';

const pct = v => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v)}%`;

export function climateInsight(t, regionName, m, scenario) {
  const { trend, sc } = m;
  const dir = trend.decade < 0 ? t('ins.falling') : t('ins.rising');
  const trendText = {
    clear: t('ins.trendClear', { dir, d: Math.abs(trend.decade).toFixed(1) }),
    weak: t('ins.trendWeak', { dir, d: Math.abs(trend.decade).toFixed(1) }),
    none: t('ins.trendNone'),
  }[trend.sig];
  const advice = scenario.rain <= -10 ? t('ins.adviceDry') : scenario.rain >= 10 ? t('ins.adviceWet') : t('ins.adviceSame');
  return [
    t('ins.climate', {
      region: regionName, rain: pct(scenario.rain), temp: signed(scenario.temp, 1),
      mm: sc.rain, base: trend.mean, dry: sc.dry, dry0: m.ind.longestDrySpell,
    }),
    trendText,
    advice,
  ].join(' ');
}

export function extremeInsight(t, m) {
  const { ind, sc } = m;
  return t('ins.extreme', { hot: sc.hot - ind.hotDays, frost: ind.frostDays - sc.frost });
}

export function monthlyInsight(t, months, m) {
  const order = m.base.map((v, i) => i).sort((a, b) => m.base[b] - m.base[a]).slice(0, 3).sort((a, b) => a - b);
  const loss = order.reduce((s, i) => s + (m.base[i] - m.monthly[i]), 0);
  const wet = m.monthly.filter(v => v >= 40).length;
  const parts = [
    t(loss >= 0 ? 'ins.monthlyLoss' : 'ins.monthlyGain', { months: order.map(i => months[i]).join(', '), mm: Math.abs(loss) }),
    t('ins.monthlyWet', { n: wet }),
  ];
  if (m.sc.et > 0) parts.push(t('ins.et', { et: m.sc.et }));
  return parts.join(' ');
}
