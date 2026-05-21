import { useTranslation } from 'react-i18next';
import SectionTitle from '../components/common/SectionTitle.jsx';
import CTAButton from '../components/common/CTAButton.jsx';
import styles from './Investment.module.css';

const ROADMAP = [
  { phase: 'Seed', when: '2026 Q2', what: 'MVP 클론 엔진 + 부지 확정 + 1호 홀로그램 스테이션 프로토' },
  { phase: 'Pre-A', when: '2026 Q4', what: '테마파크 부분 개장 (놀이존 · 추모존) · 100 beta 가족' },
  { phase: 'Series A', when: '2027 Q2', what: '전체 4존 개장 · 클론 서비스 상용화 · 해외 확장 준비' },
  { phase: 'Series B', when: '2028+', what: '일본·미국 프랜차이즈 · B2B 동물병원/장묘 파트너' },
];

const MARKET = [
  { label: '국내 반려동물 시장 (2024)', value: '6조원' },
  { label: '글로벌 시장 (2030 예측)', value: '70조원' },
  { label: '장묘·추모 세그먼트', value: '1.2조원' },
  { label: '국내 1인 가구 반려율', value: '34%' },
];

const TEAM = [
  { role: 'Founder · CEO · CTO', name: 'Steven Lim', bio: 'Pet Twinverse / JooJooLand 창시자. 모든 IP·라이선스 보유.' },
  { role: 'AI Infra', name: 'TwinverseAI Stack', bio: 'OpenClaw 게이트웨이 + UE5 Pixel Streaming 2 자체 운영' },
  { role: 'Land', name: '양평 34필지 / 51.7ha', bio: '이재호·이세용·덕수이씨 등 확보 진행 중' },
];

export default function Investment() {
  const { t } = useTranslation();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <SectionTitle
            eyebrow="Investment"
            title={t('investment.title')}
            subtitle={t('investment.subtitle')}
            align="center"
            invert
          />
          <div className={styles.heroCtas}>
            <CTAButton to="/dataroom" variant="tech">
              {t('nav.dataroom')} →
            </CTAButton>
            <CTAButton to="/contact" variant="secondary">
              {t('cta.secondary')}
            </CTAButton>
          </div>
        </div>
      </section>

      <section className={`section ${styles.market}`}>
        <div className="container">
          <SectionTitle eyebrow="Market" title={t('investment.market')} align="left" />
          <div className={styles.marketGrid}>
            {MARKET.map((m) => (
              <div key={m.label} className={styles.marketCard}>
                <div className={styles.marketValue}>{m.value}</div>
                <div className={styles.marketLabel}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`section ${styles.roadmap}`}>
        <div className="container">
          <SectionTitle eyebrow="Roadmap" title={t('investment.roadmap')} align="left" invert />
          <ol className={styles.timeline}>
            {ROADMAP.map((r, i) => (
              <li key={r.phase} className={styles.timelineItem}>
                <div className={styles.timelinePhase}>{r.phase}</div>
                <div className={styles.timelineBody}>
                  <div className={styles.timelineWhen}>{r.when}</div>
                  <div className={styles.timelineWhat}>{r.what}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`section ${styles.team}`}>
        <div className="container">
          <SectionTitle eyebrow="Team" title={t('investment.team')} align="left" />
          <div className={styles.teamGrid}>
            {TEAM.map((p) => (
              <div key={p.role} className={styles.teamCard}>
                <div className={styles.teamRole}>{p.role}</div>
                <div className={styles.teamName}>{p.name}</div>
                <div className={styles.teamBio}>{p.bio}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
