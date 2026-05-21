/* 모바일 미리보기 모달 — 디바이스 프레임 + iframe + QR */
import { useEffect, useMemo, useState } from 'react';
import styles from './MobilePreview.module.css';

const DEVICES = [
  { id: 'iphone-se',  label: 'iPhone SE',  width: 375, height: 667, dpr: 2 },
  { id: 'iphone-14',  label: 'iPhone 14',  width: 390, height: 844, dpr: 3 },
  { id: 'iphone-pro', label: 'iPhone 14 Pro Max', width: 430, height: 932, dpr: 3 },
  { id: 'galaxy',     label: 'Galaxy S23', width: 360, height: 780, dpr: 3 },
  { id: 'ipad-mini',  label: 'iPad mini',  width: 744, height: 1133, dpr: 2 },
];

export default function MobilePreview({ open, onClose }) {
  const [deviceId, setDeviceId] = useState('iphone-14');
  const [orientation, setOrientation] = useState('portrait'); // portrait | landscape
  const [path, setPath] = useState(typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');
  const [keyTick, setKeyTick] = useState(0);  // iframe 재로드용

  // 모달 열릴 때 현재 경로 자동 동기화
  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      setPath(window.location.pathname + window.location.search);
    }
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const device = DEVICES.find((d) => d.id === deviceId) || DEVICES[1];
  const { width, height } = orientation === 'portrait'
    ? { width: device.width, height: device.height }
    : { width: device.height, height: device.width };

  const fullUrl = useMemo(() => {
    if (typeof window === 'undefined') return path;
    try {
      return new URL(path, window.location.origin).toString();
    } catch {
      return window.location.origin + (path.startsWith('/') ? path : '/' + path);
    }
  }, [path]);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=2&data=${encodeURIComponent(fullUrl)}`;

  if (!open) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-label="모바일 미리보기" onClick={(e) => {
      if (e.target === e.currentTarget) onClose?.();
    }}>
      <div className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.titleWrap}>
            <h2>📱 모바일 미리보기</h2>
            <span className={styles.muted}>{device.label} · {width}×{height}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
        </header>

        <div className={styles.controls}>
          <label className={styles.field}>
            <span>디바이스</span>
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
              {DEVICES.map((d) => (
                <option key={d.id} value={d.id}>{d.label} ({d.width}×{d.height})</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>방향</span>
            <div className={styles.segmented}>
              <button
                type="button"
                className={orientation === 'portrait' ? styles.segActive : ''}
                onClick={() => setOrientation('portrait')}
              >세로</button>
              <button
                type="button"
                className={orientation === 'landscape' ? styles.segActive : ''}
                onClick={() => setOrientation('landscape')}
              >가로</button>
            </div>
          </label>
          <label className={`${styles.field} ${styles.fieldGrow}`}>
            <span>경로</span>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/ 또는 /map · /reports/new"
              onKeyDown={(e) => { if (e.key === 'Enter') setKeyTick((t) => t + 1); }}
            />
          </label>
          <button type="button" className={styles.reloadBtn} onClick={() => setKeyTick((t) => t + 1)} title="새로고침">⟳</button>
        </div>

        <div className={styles.body}>
          {/* 디바이스 프레임 */}
          <div className={styles.deviceCol}>
            <div
              className={`${styles.deviceFrame} ${orientation === 'landscape' ? styles.landscape : ''}`}
              style={{
                width: `${width + 24}px`,
                height: `${height + 80}px`,
              }}
            >
              {orientation === 'portrait' && (
                <>
                  <div className={styles.notch} />
                  <div className={styles.homeIndicator} />
                </>
              )}
              <iframe
                key={keyTick}
                title="모바일 미리보기"
                src={fullUrl}
                style={{ width: `${width}px`, height: `${height}px` }}
                className={styles.iframe}
              />
            </div>
          </div>

          {/* 사이드: 정보 + QR */}
          <aside className={styles.side}>
            <section>
              <h3>현재 미리보기 URL</h3>
              <div className={styles.urlBox}>
                <code>{fullUrl}</code>
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => navigator.clipboard?.writeText(fullUrl)}>📋 복사</button>
                <a href={fullUrl} target="_blank" rel="noopener noreferrer">↗ 새 탭에서 열기</a>
              </div>
            </section>
            <section>
              <h3>📷 휴대폰으로 스캔</h3>
              <img className={styles.qr} src={qrUrl} alt="QR code" width="180" height="180" />
              <p className={styles.muted}>같은 네트워크의 휴대폰으로 QR 을 스캔하면 실제 디바이스에서 확인할 수 있습니다.</p>
            </section>
            <section>
              <h3>빠른 경로</h3>
              <ul className={styles.quickList}>
                <li><button onClick={() => setPath('/')}>홈</button></li>
                <li><button onClick={() => setPath('/map')}>지도</button></li>
                <li><button onClick={() => setPath('/reports/new')}>보고서 생성</button></li>
                <li><button onClick={() => setPath('/reports')}>내 보고서</button></li>
                <li><button onClick={() => setPath('/login')}>로그인</button></li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
