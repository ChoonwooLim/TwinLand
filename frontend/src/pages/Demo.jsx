import { useTranslation } from 'react-i18next';
import SectionTitle from '../components/common/SectionTitle.jsx';
import styles from './Demo.module.css';

export default function Demo() {
  const { t } = useTranslation();

  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <SectionTitle
            eyebrow="Demo"
            title={t('demo.title')}
            subtitle={t('demo.subtitle')}
            align="center"
            invert
          />
        </div>
      </section>

      <section className={`section ${styles.content}`}>
        <div className="container">
          <div className={styles.grid}>
            {/* Chat demo */}
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardBadge}>01</div>
                <h3>{t('demo.chat.title')}</h3>
              </div>
              <p className={styles.cardHint}>{t('demo.chat.hint')}</p>
              <div className={styles.chatPreview}>
                <div className={styles.chatMessage}>
                  <div className={styles.chatAvatar}>🐶</div>
                  <div className={styles.chatBubble}>
                    멍! 저는 주주예요. 오늘 뭐하고 놀까요?
                  </div>
                </div>
                <div className={`${styles.chatMessage} ${styles.chatMessageMe}`}>
                  <div className={styles.chatBubble}>안녕 주주!</div>
                </div>
                <div className={styles.chatInput}>
                  <input
                    type="text"
                    placeholder="주주와 대화해보세요…"
                    disabled
                    aria-label="Chat input (preview)"
                  />
                  <button disabled>→</button>
                </div>
                <div className={styles.statusBadge}>
                  <span className={styles.statusDot} />
                  WS → OpenClaw · <code>anthropic/claude-opus-4-7</code>
                </div>
              </div>
            </article>

            {/* Hologram demo */}
            <article className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardBadge}>02</div>
                <h3>{t('demo.hologram.title')}</h3>
              </div>
              <p className={styles.cardHint}>{t('demo.hologram.hint')}</p>
              <div className={styles.hologramPreview}>
                <div className={styles.hologramFrame}>
                  <div className={styles.hologramPlayButton}>▶</div>
                </div>
                <div className={styles.statusBadge}>
                  <span className={styles.statusDot} />
                  WebRTC · UE5.7 Pixel Streaming 2 (Wilbur)
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>
    </>
  );
}
