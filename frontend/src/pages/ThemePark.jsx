import { useTranslation } from 'react-i18next';
import SectionTitle from '../components/common/SectionTitle.jsx';
import CTAButton from '../components/common/CTAButton.jsx';
import styles from './ThemePark.module.css';

const ZONES = [
  { key: 'zone1', emoji: '🐾', color: '#ff6bd6' },
  { key: 'zone2', emoji: '🎨', color: '#6b5bff' },
  { key: 'zone3', emoji: '🏁', color: '#00e5ff' },
  { key: 'zone4', emoji: '🕊️', color: '#c9a8ff' },
];

export default function ThemePark() {
  const { t } = useTranslation();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <SectionTitle
            eyebrow="Theme Park"
            title={t('themepark.title')}
            subtitle={t('themepark.subtitle')}
            align="center"
            invert
          />
          <CTAButton to="/map" variant="secondary">
            {t('nav.map')} →
          </CTAButton>
        </div>
      </section>

      <section className={`section ${styles.zones}`}>
        <div className="container">
          <div className={styles.grid}>
            {ZONES.map((z) => (
              <article
                key={z.key}
                className={styles.card}
                style={{ '--zone-color': z.color }}
              >
                <div className={styles.cardEmoji}>{z.emoji}</div>
                <h3 className={styles.cardTitle}>{t(`themepark.${z.key}.title`)}</h3>
                <p className={styles.cardBody}>{t(`themepark.${z.key}.body`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
