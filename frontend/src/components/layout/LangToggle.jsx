import { useTranslation } from 'react-i18next';
import styles from './LangToggle.module.css';

const LANGS = [
  { code: 'ko', label: 'KR' },
  { code: 'en', label: 'EN' },
];

export default function LangToggle() {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || 'ko').slice(0, 2);

  return (
    <div className={styles.toggle} role="group" aria-label="Language switcher">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          className={`${styles.btn} ${current === l.code ? styles.active : ''}`}
          aria-pressed={current === l.code}
          onClick={() => i18n.changeLanguage(l.code)}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
