// About: data & resources (one line each), our team, and the AI disclosure.
import { ExternalLink, Sparkles } from 'lucide-react';
import { useT } from '../i18n/I18nContext';
import { DATA_SOURCES, TEAM } from '../data/team';
import { PageHead } from '../components/ui';
import './AboutView.css';

const initials = name => name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function AboutView() {
  const t = useT();
  return (
    <section aria-labelledby="about-title">
      <PageHead id="about-title" eyebrow={t('about.kicker')} title={t('about.title')} sub={t('about.text')} />

      <section className="about-block reveal" aria-labelledby="data-title">
        <h2 id="data-title" className="section-title">{t('about.dataTitle')}</h2>
        <ul className="source-list">
          {DATA_SOURCES.map(s => (
            <li key={s.id}>
              <span className="source-name">
                {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name} <ExternalLink size={14} aria-hidden="true" /></a> : s.name}
              </span>
              <span className="source-line">{t(`about.src.${s.id}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-block reveal" aria-labelledby="team-title">
        <h2 id="team-title" className="section-title">{t('about.teamTitle')}</h2>
        <ul className="team-grid">
          {TEAM.map(m => (
            <li key={m.name} className="member">
              {m.photo
                ? <img className="member-photo" src={m.photo} alt="" />
                : <span className="member-photo initials" aria-hidden="true">{initials(m.name)}</span>}
              <span className="member-name">{m.name}</span>
              <span className="member-role">{t(m.roleKey)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="about-block ai-block reveal" aria-labelledby="ai-title">
        <Sparkles size={22} aria-hidden="true" />
        <div>
          <h2 id="ai-title" className="section-title">{t('about.aiTitle')}</h2>
          <p>{t('ai.disclosure')}</p>
        </div>
      </section>
    </section>
  );
}
