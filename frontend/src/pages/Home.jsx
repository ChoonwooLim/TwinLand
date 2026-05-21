import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AuroraBackground from '../components/hero/AuroraBackground.jsx';
import CosmicVFX from '../components/hero/CosmicVFX.jsx';
import CTAButton from '../components/common/CTAButton.jsx';
import SectionTitle from '../components/common/SectionTitle.jsx';
import styles from './Home.module.css';

export default function Home() {
  const { t } = useTranslation();

  return (
    <>
      {/* HERO */}
      <section className={styles.hero}>
        <AuroraBackground />
        <CosmicVFX />
        <div className={styles.heroInner}>
          <div className={styles.badge}>{t('home.hero.badge')}</div>
          <h1 className={styles.heroTitle}>
            {t('home.hero.h1').split('\n').map((line, i) => (
              <span key={i} className={i === 1 ? styles.heroTitleAccent : ''}>
                {line}
              </span>
            ))}
          </h1>
          <p className={styles.heroSub}>{t('home.hero.sub')}</p>
          <div className={styles.heroCtas}>
            <CTAButton to="/demo" variant="primary" size="lg">
              {t('cta.primary')} →
            </CTAButton>
            <CTAButton to="/contact" variant="secondary" size="lg">
              {t('cta.secondary')}
            </CTAButton>
          </div>
        </div>
        <div className={styles.scrollCue}>
          <span>scroll</span>
          <span className={styles.scrollLine} />
        </div>
      </section>

      {/* PROBLEM */}
      <section className={`section ${styles.problem}`}>
        <div className="container">
          <SectionTitle
            eyebrow="The Problem"
            title={t('home.problem.title')}
            align="center"
            invert
          />
          <div className={styles.stats}>
            <Stat value={t('home.problem.stat1')} label={t('home.problem.stat1Label')} />
            <Stat value={t('home.problem.stat2')} label={t('home.problem.stat2Label')} />
            <Stat value={t('home.problem.stat3')} label={t('home.problem.stat3Label')} />
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className={`section ${styles.solution}`}>
        <div className="container">
          <SectionTitle
            eyebrow="Our Answer"
            title={t('home.solution.title')}
            align="center"
          />
          <div className={styles.solutionBody}>
            <p>{t('home.solution.p1')}</p>
            <p>{t('home.solution.p2')}</p>
            <p className={styles.solutionHighlight}>{t('home.solution.p3')}</p>
          </div>
          <div className={styles.solutionCtas}>
            <CTAButton to="/vision" variant="primary">
              {t('nav.vision')} →
            </CTAButton>
            <Link to="/clone" className={styles.textLink}>
              {t('nav.clone')} →
            </Link>
            <Link to="/map" className={styles.textLink}>
              {t('nav.map')} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  );
}
