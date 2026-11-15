import { useState, useRef, useEffect } from 'react';
import {
  Wheat, X, Mic, AlertTriangle, CheckCircle2, Sparkles, Square, Volume2,
  Droplets, Sprout, Coins, ShieldCheck, FlaskConical, Shuffle, Loader2,
  Lightbulb, Send, ChevronUp, ChevronDown, ChevronRight, RotateCcw,
} from 'lucide-react';
import { useFarm } from '../state/FarmContext';
import { useI18n } from '../i18n/I18nContext';
import { askAssistant, transcribeAudio } from '../api/client';
import { detectLanguage } from '../utils/localAssistant';

const SAMPLE_PROMPTS = {
  en: [
    '🌾 Which crops save the most water in my region?',
    '🌱 How do lentils and legumes reduce synthetic NPK costs?',
    '📅 Can I switch from a 3-year to a 2-year or 4-year rotation?',
    '💧 What crops handle severe drought best in this soil?',
  ],
  fr: [
    '🌾 Quelles cultures économisent le plus d’eau dans ma région ?',
    '🌱 Comment les légumineuses réduisent-elles les dépenses en engrais NPK ?',
    '📅 Peut-on passer d’une rotation sur 3 ans à 2 ans ou 4 ans ?',
    '💧 Quelles cultures résistent le mieux aux fortes sécheresses ?',
  ],
  ar: [
    '🌾 ما هي أفضل المحاصيل توفيراً للمياه في منطقتي؟',
    '🌱 كيف يقلل العدس والبقوليات من مصاريف الأسمدة الكيميائية؟',
    '📅 هل يمكنني اعتماد دورة من سنتين أو 4 سنوات بدلاً من 3 سنوات؟',
    '💧 ما هي المحاصيل الأكثر صموداً أمام موجات الجفاف؟',
  ],
};

const UI_TEXT = {
  en: {
    title: 'FieldShift Agronomy Advisor',
    subtitle: 'Practical, clear, and data-backed guidance for your farm.',
    welcome: (regionName, rotNames) =>
      `Hello! I am your Agronomy Advisor for **${regionName}** (active field plan: \`${rotNames}\`).\n\nAsk me in **English, Français, or العربية** about the best crops for your soil, water-saving rotations, or cutting your synthetic fertilizer costs.`,
    placeholder: 'Ask about crops, water, soil, or rotations in your region…',
    send: 'Ask',
    sending: 'Consulting agronomy models…',
    promptsToggle: 'Suggested Questions for Farmers',
    sourcesLabel: 'Verified Regional Agronomy Sources',
    engineContextLabel: 'Rotation Impact Summary',
    refusedBadge: 'Certified Agronomy Scope — No Unverified Advice',
    groundedBadge: 'Grounded in NASA Climate & SoilGrids Data',
    micStart: 'Voice',
    micStop: 'Stop',
    listen: 'Listen',
    stopListen: 'Stop',
    clearChat: 'Reset',
    fieldStrip: (region, plan) => `📍 Field: ${region} · Sequence: ${plan}`,
  },
  fr: {
    title: 'Conseiller Agronomique FieldShift',
    subtitle: 'Conseils pratiques et clairs pour vos cultures et rotations.',
    welcome: (regionName, rotNames) =>
      `Bonjour ! Je suis votre conseiller agronomique pour **${regionName}** (plan actuel : \`${rotNames}\`).\n\nPosez vos questions en **français, arabe ou anglais** sur le choix des cultures, la résistance à la sécheresse ou l'économie d'engrais NPK.`,
    placeholder: 'Posez votre question sur vos cultures, l’eau ou le sol…',
    send: 'Envoyer',
    sending: 'Analyse agronomique…',
    promptsToggle: 'Questions pratiques suggérées',
    sourcesLabel: 'Sources Agronomiques Régionales Vérifiées',
    engineContextLabel: 'Bilan d’Impact de la Rotation',
    refusedBadge: 'Périmètre Certifié — Aucun conseil non vérifié',
    groundedBadge: 'Fondé sur les données NASA POWER & SoilGrids',
    micStart: 'Voix',
    micStop: 'Arrêter',
    listen: 'Écouter',
    stopListen: 'Arrêter',
    clearChat: 'Effacer',
    fieldStrip: (region, plan) => `📍 Région : ${region} · Assolement : ${plan}`,
  },
  ar: {
    title: 'المرشد الزراعي الذكي',
    subtitle: 'إرشادات عملية واضحة للمزارع حول المحاصيل والدورات الزراعية.',
    welcome: (regionName, rotNames) =>
      `مرحباً بك! أنا مرشدك الزراعي الذكي لمنطقة **${regionName}** (دورتك الحالية: \`${rotNames}\`).\n\nتفضل بالسؤال **بالعربية أو الفرنسية أو الإنجليزية** عن أنسب المحاصيل لتربتك، وتوفير مياه الري، وتخفيض مصاريف الأسمدة.`,
    placeholder: 'اكتب سؤالك عن محاصيلك، التربة، مياه الري أو الدورة…',
    send: 'إرسال',
    sending: 'جارٍ تحليل البيانات الزراعية…',
    promptsToggle: 'أسئلة عملية شائعة للمزارعين',
    sourcesLabel: 'المراجع الزراعية الإقليمية المعتمدة',
    engineContextLabel: 'ملخص أثر الدورة الزراعية',
    refusedBadge: 'نطاق زراعي معتمد — لا نخمن نصائح غير مؤكدة',
    groundedBadge: 'موثق ببيانات ناسا المناخية وخصائص التربة',
    micStart: 'صوت',
    micStop: 'إيقاف',
    listen: 'استماع',
    stopListen: 'إيقاف',
    clearChat: 'مسح',
    fieldStrip: (region, plan) => `📍 المنطقة: ${region} · الدورة الحالية: ${plan}`,
  },
};

function renderFormattedInline(line) {
  if (!line) return null;
  const tokens = String(line).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((tok, i) => {
    if (tok.startsWith('**') && tok.endsWith('**') && tok.length > 4) {
      return <strong key={i} className="rag-bold">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith('`') && tok.endsWith('`') && tok.length > 2) {
      return <code key={i} className="rag-inline-code">{tok.slice(1, -1)}</code>;
    }
    if (tok.startsWith('*') && tok.endsWith('*') && tok.length > 2) {
      return <em key={i} className="rag-italic">{tok.slice(1, -1)}</em>;
    }
    return <span key={i}>{tok}</span>;
  });
}

function FormattedMessage({ text }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  const blocks = [];
  let currentList = null;
  let listKey = 0;

  const flushList = () => {
    if (currentList && currentList.length > 0) {
      blocks.push(
        <ul key={`ul-${listKey++}`} className="rag-msg-list">
          {currentList.map((item, idx) => (
            <li key={idx} className="rag-msg-list-item">{item}</li>
          ))}
        </ul>
      );
      currentList = null;
    }
  };

  lines.forEach((rawLine, idx) => {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    if (/^#{1,4}\s+/.test(trimmed)) {
      flushList();
      const hText = trimmed.replace(/^#{1,4}\s+/, '');
      blocks.push(
        <h4 key={`h-${idx}`} className="rag-msg-heading">
          {renderFormattedInline(hText)}
        </h4>
      );
      return;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^[-*•]\s+/, '');
      if (!currentList) currentList = [];
      currentList.push(renderFormattedInline(itemText));
      return;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const itemText = trimmed.replace(/^\d+\.\s+/, '');
      if (!currentList) currentList = [];
      currentList.push(renderFormattedInline(itemText));
      return;
    }

    if (trimmed.startsWith('> ')) {
      flushList();
      blocks.push(
        <blockquote key={`bq-${idx}`} className="rag-msg-quote">
          {renderFormattedInline(trimmed.slice(2))}
        </blockquote>
      );
      return;
    }

    const isEmojiKicker = /^(🎯|🌾|💧|🌱|💡|⚠️|💰|📊)\s+/.test(trimmed);
    flushList();
    blocks.push(
      <p key={`p-${idx}`} className={`rag-msg-p ${isEmojiKicker ? 'rag-msg-kicker' : ''}`}>
        {renderFormattedInline(trimmed)}
      </p>
    );
  });

  flushList();
  return <div className="rag-formatted-block">{blocks}</div>;
}

function fmtPctScore(val) {
  if (val == null || Number.isNaN(Number(val))) return '—';
  const num = Number(val);
  if (num <= 1.0 && num > 0) return `${Math.round(num * 100)}/100`;
  return `${Math.round(num)}/100`;
}

export default function AgronomyAssistant({ embedded = false, floating = false }) {
  const { state, region, cropById } = useFarm();
  const i18n = useI18n();
  const [activeLang, setActiveLang] = useState(i18n?.lang || 'en');

  useEffect(() => {
    if (i18n?.lang) setActiveLang(i18n.lang);
  }, [i18n?.lang]);

  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(!floating);
  const [showPrompts, setShowPrompts] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState('');
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [messages, setMessages] = useState([]);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const messagesBoxRef = useRef(null);
  const inputRef = useRef(null);

  const ui = UI_TEXT[activeLang] || UI_TEXT.en;
  const isRtl = activeLang === 'ar';
  const rotNames = (state.rotation || []).map((id) => cropById(id)?.name || id).join(' → ');
  const regDisplayName = region?.name || region?.short || state.region;

  useEffect(() => {
    if (messagesBoxRef.current) {
      messagesBoxRef.current.scrollTop = messagesBoxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleAsk(rawQuery) {
    const q = String(rawQuery ?? question).trim();
    if (!q || loading) return;

    const detected = detectLanguage(q, activeLang);
    setActiveLang(detected);
    setQuestion('');
    setVoiceNote('');
    setLoading(true);
    if (floating && messages.length >= 1) {
      setShowPrompts(false);
    }

    const userMsg = {
      role: 'user',
      text: q,
      lang: detected,
      direction: detected === 'ar' ? 'rtl' : 'ltr',
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await askAssistant({
        question: q,
        lang: detected,
        region: state.region,
        rotation: state.rotation,
        allowed: state.allowed,
        priorities: state.priorities,
        scenario: state.scenario,
        custom: state.custom,
      });

      const assistantMsg = {
        role: 'assistant',
        text: res.answer,
        lang: res.language || detected,
        direction: res.direction || res.dir || (detected === 'ar' ? 'rtl' : 'ltr'),
        refused: Boolean(res.refused),
        sources: res.sources || res.citations || [],
        engine_summary: res.engine_summary || null,
        mode: res.llm_provider || res.mode || 'live-api',
        whisperConfigured: Boolean(res.whisperConfigured),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            detected === 'ar'
              ? 'تعذر الاتصال بالمساعد الزراعي حالياً. يرجى المحاولة بعد قليل.'
              : detected === 'fr'
              ? 'Impossible de contacter l’assistant agronomique pour le moment. Veuillez réessayer.'
              : 'Unable to reach the agronomy assistant right now. Please try again shortly.',
          lang: detected,
          direction: detected === 'ar' ? 'rtl' : 'ltr',
          refused: true,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }

  async function toggleSpeechRecognition() {
    setVoiceNote('');

    if (isListening && mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        audioChunksRef.current = [];

        rec.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        rec.onstop = async () => {
          setIsListening(false);
          stream.getTracks().forEach((track) => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: rec.mimeType || 'audio/webm' });
          if (audioBlob.size < 400) return;

          setVoiceNote(activeLang === 'ar' ? '⏳ جارٍ معالجة الصوت بالذكاء الاصطناعي...' : '⏳ Processing voice input...');
          try {
            const res = await transcribeAudio(audioBlob, activeLang);
            if (res && res.text) {
              setVoiceNote('');
              setQuestion(res.text);
              handleAsk(res.text);
            } else {
              setVoiceNote(activeLang === 'ar' ? 'لم يتم التقاط أي صوت واضح.' : 'No clear speech detected.');
            }
          } catch (err) {
            console.error('Whisper STT error, trying Web Speech fallback:', err);
            setVoiceNote('STT Error: ' + (err.message || 'Server error'));
          }
        };

        rec.start();
        mediaRecorderRef.current = rec;
        setIsListening(true);
        setVoiceNote(activeLang === 'ar' ? '🔴 جارٍ تسجيل الصوت... انقر على الميكروفون مجدداً للإرسال' : '🔴 Recording voice... Click mic again to send');
        return;
      } catch (err) {
        console.warn('Microphone access denied or error, falling back to Web Speech:', err);
      }
    }

    const SpeechRec = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SpeechRec) {
      setVoiceNote(activeLang === 'ar' ? 'الإدخال الصوتي غير مدعوم في متصفحك.' : 'Voice input not supported in your browser.');
      return;
    }
    try {
      const rec = new SpeechRec();
      rec.lang = activeLang === 'ar' ? 'ar-DZ' : activeLang === 'fr' ? 'fr-FR' : 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = () => {
        setIsListening(false);
        setVoiceNote(activeLang === 'ar' ? 'تعذر التعرف على الصوت.' : 'Could not recognize voice.');
      };
      rec.onresult = (event) => {
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          setQuestion(transcript);
          handleAsk(transcript);
        }
      };
      recognitionRef.current = rec;
      rec.start();
    } catch {
      setIsListening(false);
      setVoiceNote(activeLang === 'ar' ? 'تعذر تشغيل الميكروفون.' : 'Could not activate microphone.');
    }
  }

  function toggleSpeakMessage(msg, idx) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = String(msg.text || '').replace(/[*_`#[\]]/g, '');
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = msg.lang === 'ar' ? 'ar-SA' : msg.lang === 'fr' ? 'fr-FR' : 'en-US';
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utter);
  }

  if (floating && !isOpen) {
    return (
      <div className="rag-dock-bar" role="region" aria-label="Agronomy Assistant Bar">
        <button
          type="button"
          className="rag-fab"
          onClick={() => setIsOpen(true)}
          aria-label="Open FieldShift Agronomy Assistant"
        >
          <span className="rag-fab-icon" aria-hidden="true"><Sprout size={20} /></span>
          <span className="rag-fab-text">
            <b>{ui.title}</b>
            <small>🌾 {regDisplayName} · AI Agronomy</small>
          </span>
          <span className="rag-fab-arrow" aria-hidden="true"><ChevronUp size={16} /></span>
        </button>
      </div>
    );
  }

  const inputDir = detectLanguage(question, activeLang) === 'ar' ? 'rtl' : 'ltr';

  return (
    <section
      className={`rag-assistant ${floating ? 'rag-floating-drawer' : 'rag-embedded-card card'}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      lang={activeLang}
      aria-label={ui.title}
    >
      {/* Modern Header */}
      <div className="rag-header">
        <div className="rag-header-info">
          <div className="rag-avatar-badge" aria-hidden="true">
            <Sprout size={20} color="#ffffff" />
          </div>
          <div className="rag-title-block">
            <div className="rag-title-row">
              <h3 className="rag-title">{ui.title}</h3>
              <span className="rag-status-badge">
                <span className="rag-status-dot" aria-hidden="true" />
                Ready
              </span>
            </div>
            <p className="rag-sub">📍 {regDisplayName}</p>
          </div>
        </div>

        <div className="rag-header-controls">
          <div className="rag-lang-switch" role="group" aria-label="Assistant language">
            {[
              { id: 'en', label: 'EN' },
              { id: 'fr', label: 'FR' },
              { id: 'ar', label: 'عربي' },
            ].map((l) => (
              <button
                key={l.id}
                type="button"
                className={`rag-lang-btn ${activeLang === l.id ? 'active' : ''}`}
                onClick={() => setActiveLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              className="rag-ctrl-btn"
              onClick={() => {
                setMessages([]);
                setShowPrompts(true);
              }}
              title={ui.clearChat}
            >
              <RotateCcw size={13} aria-hidden="true" />
            </button>
          )}
          {floating && (
            <button
              type="button"
              className="rag-ctrl-btn rag-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Minimize assistant"
              title="Minimize"
            >
              <X size={16} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Field & Climate Context Strip */}
      <div className="rag-context-strip">
        <div className="rag-context-item">
          <Wheat size={14} aria-hidden="true" />
          <span><b>Active Plan:</b> {rotNames || 'Not specified'}</span>
        </div>
        <div className="rag-context-item">
          <Droplets size={14} aria-hidden="true" />
          <span><b>Rain:</b> {region?.rain ? `${region.rain} mm/yr` : '—'}</span>
        </div>
      </div>

      {/* Scrollable Chat Stream */}
      <div className="rag-messages" ref={messagesBoxRef} role="log" aria-live="polite">
        {/* Initial Welcome Bubble */}
        <div className="rag-msg rag-msg-assistant rag-msg-welcome" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="rag-msg-body">
            <FormattedMessage text={ui.welcome(regDisplayName, rotNames)} />
          </div>
        </div>

        {messages.map((m, idx) => {
          const topPlan = m.engine_summary?.top_plan || m.engine_summary?.rank1;
          return (
            <div
              key={idx}
              className={`rag-msg rag-msg-${m.role} ${m.refused ? 'rag-msg-refused' : ''}`}
              dir={m.direction || (m.lang === 'ar' ? 'rtl' : 'ltr')}
              lang={m.lang || activeLang}
            >
              {m.role === 'assistant' && (
                <div className="rag-msg-meta">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`rag-status-pill ${m.refused ? 'refused' : 'grounded'}`}>
                      {m.refused ? <><AlertTriangle size={12} aria-hidden="true" /> {ui.refusedBadge}</> : <><CheckCircle2 size={12} aria-hidden="true" /> {ui.groundedBadge}</>}
                    </span>
                    {!m.refused && m.mode && String(m.mode).startsWith('groq:') && (
                      <span className="rag-status-pill groq-ai">
                        <Sparkles size={12} aria-hidden="true" /> Groq AI
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    className="rag-ctrl-btn rag-tts-btn"
                    onClick={() => toggleSpeakMessage(m, idx)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    {speakingIdx === idx ? <><Square size={12} aria-hidden="true" /> {ui.stopListen}</> : <><Volume2 size={12} aria-hidden="true" /> {ui.listen}</>}
                  </button>
                </div>
              )}

              <div className="rag-msg-body">
                <FormattedMessage text={m.text} />
              </div>

              {m.role === 'assistant' && topPlan && (
                <div className="rag-engine-box">
                  <div className="rag-section-kicker">📊 {ui.engineContextLabel}</div>
                  <div className="rag-score-chips">
                    <span className="rag-score-chip primary">
                      <b>Score:</b> {fmtPctScore(topPlan.score_100 ?? topPlan.score)}
                    </span>
                    <span className="rag-score-chip">
                      <Droplets size={12} aria-hidden="true" /> Water: {fmtPctScore(topPlan.criteria?.water)}
                    </span>
                    <span className="rag-score-chip">
                      <Sprout size={12} aria-hidden="true" /> Soil: {fmtPctScore(topPlan.criteria?.soil)}
                    </span>
                    <span className="rag-score-chip">
                      <Coins size={12} aria-hidden="true" /> Profit: {fmtPctScore(topPlan.criteria?.profit)}
                    </span>
                    {topPlan.fertilizer_saved_vs_existing_kg_ha != null && topPlan.fertilizer_saved_vs_existing_kg_ha > 0 && (
                      <span className="rag-score-chip highlight">
                        <FlaskConical size={12} aria-hidden="true" /> Saved NPK: +{topPlan.fertilizer_saved_vs_existing_kg_ha} kg/ha
                      </span>
                    )}
                  </div>
                </div>
              )}

              {m.role === 'assistant' && m.sources && m.sources.length > 0 && (
                <div className="rag-sources-box" dir="ltr">
                  <details className="rag-sources-accordion">
                    <summary className="rag-sources-summary">
                      <span>📚 {ui.sourcesLabel} ({m.sources.length})</span>
                      <ChevronDown size={14} className="rag-accordion-arrow" aria-hidden="true" />
                    </summary>
                    <div className="rag-sources-grid">
                      {m.sources.map((src, sIdx) => (
                        <div key={sIdx} className="rag-source-item">
                          <strong>{src.title}</strong> — <span className="muted">{src.section}</span>
                          {src.excerpt && <p className="rag-source-excerpt">{src.excerpt}</p>}
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="rag-msg rag-msg-assistant rag-msg-loading">
            <Loader2 size={16} className="rag-spinner" aria-hidden="true" />
            <span>{ui.sending}</span>
          </div>
        )}
      </div>

      {/* Suggested Questions for Farmers */}
      <div className="rag-prompts-wrap">
        <button
          type="button"
          className="rag-prompts-toggle"
          onClick={() => setShowPrompts((v) => !v)}
          aria-expanded={showPrompts}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Lightbulb size={14} aria-hidden="true" /> {ui.promptsToggle}
          </span>
          <span aria-hidden="true">{showPrompts ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
        </button>
        {showPrompts && (
          <div className="rag-prompts" aria-label="Sample farmer questions">
            {(SAMPLE_PROMPTS[activeLang] || SAMPLE_PROMPTS.en).map((promptText, i) => (
              <button
                key={i}
                type="button"
                className="rag-prompt-chip"
                onClick={() => handleAsk(promptText)}
                disabled={loading}
              >
                {promptText}
              </button>
            ))}
          </div>
        )}
      </div>

      {voiceNote && <div className="rag-voice-note">{voiceNote}</div>}

      {/* Pinned Bottom Chatbot Input Bar */}
      <form
        className="rag-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(question);
        }}
      >
        <input
          ref={inputRef}
          type="text"
          className="rag-input"
          value={question}
          dir={inputDir}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={ui.placeholder}
          disabled={loading}
          aria-label={ui.placeholder}
        />
        <button
          type="button"
          className={`rag-action-btn rag-mic-btn ${isListening ? 'listening' : ''}`}
          onClick={toggleSpeechRecognition}
          title="Voice input"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Mic size={15} aria-hidden="true" />
          <span>{isListening ? ui.micStop : ui.micStart}</span>
        </button>
        <button
          type="submit"
          className="rag-action-btn rag-send-btn"
          disabled={loading || !question.trim()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          <Send size={15} aria-hidden="true" />
          <span>{loading ? ui.sending : ui.send}</span>
        </button>
      </form>
      <div className="rag-footer-disclaimer">
        FieldShift Agronomy Advisor · Grounded in NASA POWER, ISRIC SoilGrids &amp; Groq AI
      </div>
    </section>
  );
}
