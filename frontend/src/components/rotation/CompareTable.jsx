// Usual rotation vs recommended (rank 1) on the 5 farm metrics, with difference and % change.
import { useT } from '../../i18n/I18nContext';
import { fmtInt, pct } from '../../utils/format';
import { Delta } from '../ui';
import './rotation.css';

export function compareRows(ranking) {
  const u = ranking.usual, b = ranking.rotations[0];
  return [
    { id: 'water', icon: '💧', a: u.waterNeed, b: b.waterNeed, unit: '/100', goal: 'lower' },
    { id: 'soilN', icon: '🧪', a: u.soilNEnd, b: b.years.at(-1).soilN, unit: ' kg/ha', goal: 'higher' },
    { id: 'fert', icon: '⚗️', a: u.fertilizer, b: b.fertilizer, unit: ' kg/ha', goal: 'lower' },
    { id: 'stability', icon: '🌾', a: u.ndviStability, b: b.ndviStability, unit: '/100', goal: 'higher' },
    { id: 'income', icon: '💰', a: u.income, b: b.income, unit: ' DA/ha', goal: 'higher' },
  ];
}

export default function CompareTable({ ranking, usualName }) {
  const t = useT();
  const best = ranking.rotations[0];
  return (
    <div className="table-wrap">
      <table className="data-table compare-table">
        <caption className="sr-only">{t('cmp.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('cmp.metric')}</th>
            <th scope="col">{t('cmp.usual')}<br /><small>{usualName}</small></th>
            <th scope="col">{t('cmp.rec')}<br /><small>{best.crops.join(' → ')}</small></th>
            <th scope="col">{t('ind.diff')}</th>
            <th scope="col">{t('cmp.change')}</th>
          </tr>
        </thead>
        <tbody>
          {compareRows(ranking).map(row => {
            const d = row.b - row.a, p = pct(row.a, row.b);
            const better = row.goal === 'lower' ? d < 0 : d > 0;
            return (
              <tr key={row.id}>
                <th scope="row"><span aria-hidden="true">{row.icon}</span> {t(`cmp.${row.id}`)}</th>
                <td className="num">{fmtInt(row.a)}{row.unit}</td>
                <td className="num"><b>{fmtInt(row.b)}{row.unit}</b></td>
                <td className="num" dir="ltr"><Delta value={d} goal={row.goal} /></td>
                <td className="num">
                  {d === 0 ? '—' : <span className={better ? 'delta-good' : 'delta-bad'}>{better ? t('cmp.better') : t('cmp.worse')} {Math.abs(p)}%</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
