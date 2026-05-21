/* 새 버전 감지 시 상단 토스트 — 자동 reload 카운트다운 */
import { useEffect, useState } from 'react';
import styles from './UpdateBanner.module.css';

export default function UpdateBanner() {
  const [show, setShow] = useState(false);
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    function onUpdate() {
      setShow(true);
      let remaining = 3;
      setCountdown(remaining);
      const timer = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          window.location.reload();
        }
      }, 1000);
      return () => clearInterval(timer);
    }
    window.addEventListener('twinland:sw-update', onUpdate);
    return () => window.removeEventListener('twinland:sw-update', onUpdate);
  }, []);

  if (!show) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.icon}>🔄</span>
      <span className={styles.text}>새 버전이 도착했어요 · {countdown}초 후 자동 새로고침</span>
      <button
        type="button"
        className={styles.btn}
        onClick={() => window.location.reload()}
      >
        지금 새로고침
      </button>
    </div>
  );
}
