import { Link } from 'react-router-dom';
import styles from './Home.module.css';

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.eyebrow}>TwinLand · Korean Geographic Information System</div>
          <h1 className={styles.title}>
            필지 하나면<br />
            <span className={styles.accent}>모든 보고서가 나옵니다</span>
          </h1>
          <p className={styles.lead}>
            VWorld 오픈API · 산림청 SHP · Cesium 3D 위성 · 산사태위험 래스터를 통합해
            <strong> 필지분석 · 산지정보조회 · 경사도분석 · 토지이용계획서</strong> 를
            한 화면에서 자동 산출합니다.
          </p>
          <div className={styles.heroCtas}>
            <Link to="/reports/new" className={styles.btnPrimary}>보고서 생성하기</Link>
            <Link to="/map" className={styles.btnSecondary}>지도 둘러보기</Link>
          </div>
          <div className={styles.heroStats}>
            <div className={styles.stat}>
              <div className={styles.statValue}>41</div>
              <div className={styles.statLabel}>샘플 필지 (상교리)</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>316,270㎡</div>
              <div className={styles.statLabel}>총 면적 (≈ 95,672 평)</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statValue}>9 섹션</div>
              <div className={styles.statLabel}>종합 보고서 구조</div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IT DOES */}
      <section className={styles.features}>
        <h2 className={styles.h2}>TwinLand 가 자동화하는 것</h2>
        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardIcon}>📍</div>
            <h3>필지 데이터 통합</h3>
            <p>VWorld 지적·토지이용계획·공시지가 + 산림청 임상도·산지구분도 + DEM 슬로프를 한 번에 수집.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🤖</div>
            <h3>AI 종합 분석</h3>
            <p>OpenClaw LAN 게이트웨이로 강점·제약·권장 방향·체크리스트를 한국어 prose 로 자동 합성.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>📄</div>
            <h3>전문 보고서 산출</h3>
            <p>9개 섹션 종합 HTML + PDF 다운로드 + 공유 URL. 컨설팅 결과물 수준의 시각화·테이블.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🗺️</div>
            <h3>2D · 3D 듀얼 뷰</h3>
            <p>react-leaflet 으로 즉시 2D 지적, Cesium 으로 위성·지형 3D 시각화 (resium 통합).</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>📎</div>
            <h3>PDF 컨텍스트 흡수</h3>
            <p>기존 필지분석결과서·산지정보조회·토지이용계획 PDF 를 업로드하면 AI 가 본문에 흡수해 통합 분석.</p>
          </div>
          <div className={styles.card}>
            <div className={styles.cardIcon}>🔐</div>
            <h3>보고서 보관함 + 공유</h3>
            <p>생성한 보고서는 계정에 자동 저장. 공유 URL 로 외부 컨설팅 클라이언트에 즉시 공유.</p>
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className={styles.workflow}>
        <h2 className={styles.h2}>3단계 워크플로우</h2>
        <ol className={styles.steps}>
          <li>
            <div className={styles.stepNum}>1</div>
            <h3>필지 선택</h3>
            <p>지도에서 클릭하거나 PNU·지번을 직접 입력. 단일 필지 또는 인접 다수 필지 동시 선택 가능.</p>
          </li>
          <li>
            <div className={styles.stepNum}>2</div>
            <h3>(선택) PDF 첨부</h3>
            <p>기존 분석 PDF 를 드래그·드롭. 텍스트 자동 추출 후 AI 합성 컨텍스트로 사용.</p>
          </li>
          <li>
            <div className={styles.stepNum}>3</div>
            <h3>30 초 안에 보고서</h3>
            <p>HTML 뷰어 · PDF 다운로드 · 공유 URL — 모두 자동 생성. 보관함에서 언제든 재방문.</p>
          </li>
        </ol>
      </section>

      {/* CTA */}
      <section className={styles.cta}>
        <h2>지금 첫 보고서를 만들어 보세요</h2>
        <p>샘플 필지 (여주시 북내면 상교리 384-18 + 산31) 로 즉시 체험 가능.</p>
        <Link to="/reports/new" className={styles.btnPrimary}>보고서 생성하기 →</Link>
      </section>
    </>
  );
}
