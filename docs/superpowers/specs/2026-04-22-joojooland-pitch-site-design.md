# JooJooLand — 투자유치 프리젠테이션 사이트 설계서

- **작성일**: 2026-04-22
- **작성자**: Steven Lim + Claude (Opus 4.7)
- **상태**: 초안 v1 · 브레인스토밍 확정
- **구현 repo**: `C:\WORK\JooJooLand` → GitHub `JooJooLand-Pitch` (신규)
- **관련 자원**:
  - 기존 지도 도구: `C:\WORK\JooJooPatLand` (GitHub `JooJooLand`) — 지도 모듈 포팅 원본
  - 기반 템플릿: `C:\WORK\gaongn.net` — React19+FastAPI+SQLModel 구조 복제
  - AI 인프라: `infra-docs/ai-shared-registry.md` §3.5 OpenClaw LAN

---

## 1. 프로젝트 목표

### 1.1 한 문장
**세계 최초 "반려동물 디지털 영혼(Pet Twinverse)" 테마파크의 시드 투자(3–15억원)를 유치하는 프리젠테이션 사이트.**

### 1.2 핵심 메시지
> **"당신의 반려동물은 영원히 살아있습니다."**
>
> 태어나는 순간부터 디지털 클론이 함께 성장하고, 테마파크에 오면 홀로그램으로 재회하며,
> 현실의 반려동물이 떠난 뒤에도 디지털 클론은 계속 살아있어 상실의 아픔을 치유합니다.

### 1.3 타깃 오디언스
1. **1순위**: 시드 단계 투자자 (VC / 엔젤 / 반려동물 산업 CVC)
2. **2순위**: 파트너 후보 (동물병원, 반려동물 보험, 장묘 서비스)
3. **3순위**: 얼리 어답터 유저 (대기자 명단 확보)

### 1.4 성공 지표
- **Primary**: 투자자 미팅 요청 이메일 10건/월, 후속 IR 문서 다운로드 50건/월
- **Secondary**: 대기자 명단 500명, 언론 피쳐 3건

### 1.5 범위 (Scope)
- ✅ **포함**: 마케팅 페이지 + 데이터룸(로그인) + 지도 도구 + 경량 AI 클론 체험 + 홀로그램 스트림 데모
- ❌ **제외**: 실제 반려동물 온보딩 제품, 결제, 모바일 앱, 프로덕션 레벨 디지털 클론 AI (시드 이후 구축)

---

## 2. 비주얼 & 톤 (Hybrid D)

### 2.1 컬러 토큰
```css
--joojoo-night:   #0a0e27;   /* 히어로 · 비전 배경 */
--joojoo-aurora:  linear-gradient(135deg, #6b5bff 0%, #ff6bd6 100%);  /* 그라디언트 액센트 */
--joojoo-warm:    #fff4e6;   /* 펫·추모 섹션 */
--joojoo-tech:    #00e5ff;   /* 데이터룸·인프라 섹션 */
--joojoo-soul:    #c9a8ff;   /* 디지털 영혼 상징색 */
--joojoo-ink:     #11142a;   /* 본문 배경 (다크 섹션) */
--joojoo-cream:   #faf7f2;   /* 본문 배경 (라이트 섹션) */
--joojoo-text:    #1a1a2e;   /* 본문 텍스트 (라이트) */
--joojoo-text-invert: #f5f5fa; /* 본문 텍스트 (다크) */
```

### 2.2 타이포그래피
- **Heading**: Pretendard Bold (KR) + Inter Display (EN) — 96px/64px/48px/32px
- **Body**: Pretendard Regular + Inter Regular — 18px/16px/14px
- **Mono**: JetBrains Mono — 데이터룸/기술 섹션

### 2.3 섹션별 비주얼 톤
| 섹션 | 톤 | 기법 |
|------|----|----|
| Hero | Dreamy 우세 | 파티클 필드 + 펫 실루엣 → 클론 morph |
| Vision | Dreamy 강 | 풀스크린 스크롤 시퀀스 (framer-motion) |
| ThemePark | Dreamy+Tech | 3D 카드 flip, 실사+glassmorphism |
| DigitalClone | Tech 우세 | r3f 실시간 렌더, 성장 타임라인 |
| Map | Tech 우세 | Leaflet+Cesium, 다크 테마 override |
| Demo | Tech 강 | WebRTC 풀뷰포트 스트림 |
| Investment | Tech 강 | 차트 중심, 드라이 톤 |
| DataRoom | Tech 강 | 미니멀 다크, 파일 리스트 |
| Contact | Dreamy 우세 | 풀스크린 CTA + 아우로라 배경 |

---

## 3. 아키텍처

### 3.1 레이어 개요

```
┌────────────── Frontend (정적 배포: Vercel/Cloudflare Pages) ──────────────┐
│ React 19 + Vite 8 + CSS Modules                                            │
│  · react-three-fiber / drei → Pet Clone 3D Viewer                          │
│  · framer-motion           → 스크롤 시퀀스 (Hybrid D)                       │
│  · react-i18next            → KR/EN 토글                                    │
│  · react-leaflet + resium   → 지도 섹션 (오늘 작업 포팅)                    │
│  · WebRTC/Wilbur client     → Pixel Streaming (UE5 홀로그램)                │
│  · axios                    → API 호출                                      │
└─────────────────────┬──────────────────────────────────────────────────────┘
                      │ HTTPS / WSS (Cloudflare Tunnel)
┌─────────────────────▼────────── Backend (FastAPI) ────────────────────────┐
│ /api/auth     JWT 로그인/갱신 (데이터룸 접근용)                              │
│ /api/pets     샘플 반려동물 데이터                                           │
│ /api/clones   디지털 클론 프로필/성장 타임라인                                │
│ /api/ai/chat  WebSocket 릴레이 → OpenClaw (stateless)                       │
│ /api/ai/agent WebSocket 릴레이 → OpenClaw (persistent, pet agent)           │
│ /api/ue5      Pixel Streaming 세션 할당                                      │
│ /api/parcels  지도 필지 CRUD                                                 │
│ /api/dataroom IR 자료 다운로드 (권한 체크)                                    │
│ /api/content  마케팅 콘텐츠 CMS                                              │
└─────────────────────┬──────────────────────────────────────────────────────┘
                      │
┌─────────────────────▼────── Data & AI Infra (Orbitron 공용) ──────────────┐
│ PostgreSQL  orbitron-joojooland-db:3183/orbitron_db                        │
│ OpenClaw    ws://192.168.219.117:18789  (LAN only, CLI plan-token)         │
│   ├─ anthropic/claude-opus-4-7        (펫 클론 감성 대화)                    │
│   ├─ anthropic/claude-sonnet-4-6      (비전/이미지 분석)                     │
│   └─ openai-codex/gpt-5.4              (persistent agent + 콘텐츠 생성)      │
│ UE5.7 PS2   Wilbur signaling (8080 player / 8888 SFU)                      │
│ Orbitron    192.168.219.101 (Docker multistage + Cloudflare Tunnel)         │
│ SSOT        infra-docs/ai-shared-registry.md                                │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 AI 레이어 확정 (API 키 無)

**모든 AI 호출 → LAN OpenClaw 게이트웨이 단일 경로.**

| 사용처 | 모델 | 인증 |
|--------|------|------|
| 펫 클론 감성 대화 (Tier1, stateless) | `anthropic/claude-opus-4-7` | Claude Code CLI plan token |
| 펫 에이전트 (Tier2, persistent) | `openai-codex/gpt-5.4` | ChatGPT Plus CLI OAuth |
| 비전 (반려동물 사진 분석) | `anthropic/claude-sonnet-4-6` | Claude Code CLI plan token |
| 마케팅 카피 생성 | `openai-codex/gpt-5.4` | ChatGPT Plus CLI OAuth |

**환경변수** (`.env`):
```
OPENCLAW_WS_URL=ws://192.168.219.117:18789
OPENCLAW_TOKEN=<Orbitron secrets>
OPENCLAW_AGENT_PET=joojoo-pet-agent
OPENCLAW_MODEL_DEFAULT=anthropic/claude-opus-4-7
# 주의: ANTHROPIC_API_KEY / OPENAI_API_KEY 는 절대 등록하지 않음
```

**OpenClaw agent 등록 (구현 단계 실행)**:
- `joojoo-pet-main` → `anthropic/claude-opus-4-7`
- `joojoo-pet-agent` → `openai-codex/gpt-5.4`
- `joojoo-content-writer` → `openai-codex/gpt-5.4`
- `joojoo-vision` → `anthropic/claude-sonnet-4-6`

### 3.3 TwinverseAI 자산 흡수 매핑

| JooJooLand 기능 | 소스 | 포팅 방식 |
|----------------|------|----------|
| 펫 퍼스널리티 모듈 | `TwinverseAI/backend/routers/npc.py` | fork → `pet.py` (pet_breed/pet_age/pet_mood 추가) |
| Persistent 펫 에이전트 | `TwinverseAI/backend/routers/npc_agent.py` | 완성 구현 (WebSocket → OpenClaw 릴레이) |
| 홀로그램 스테이션 | `TwinverseAI/backend/routers/ps2_spawner.py` | 재사용 + `/ue5/PetHologram/` UE5 프로젝트 신규 |
| 콘텐츠 생성 | (신규) `backend/routers/content_gen.py` | OpenClaw + Flux (이미지는 ai-image-service:8100) |
| 테마파크 맵 | DeskRPG 2D 에디터 컨셉 | Leaflet 레이어로 재구성 |
| 인프라 | `TwinverseAI/Dockerfile` + `Orbitron.yaml` | 복제 (joojooland 네임스페이스) |

---

## 4. 컴포넌트 구조

```
JooJooLand/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.jsx               # Hero + 비전 스크롤 시퀀스
│   │   │   ├── Vision.jsx             # Pet Twinverse 철학
│   │   │   ├── ThemePark.jsx          # 4개 존 (놀이/미디어아트/경주/추모)
│   │   │   ├── DigitalClone.jsx       # 기술 + 3D 뷰어 + 성장 타임라인
│   │   │   ├── Map.jsx                # 오늘 작업 포팅 (34필지)
│   │   │   ├── Demo.jsx               # 클론 챗 + 홀로그램 스트림
│   │   │   ├── Investment.jsx         # 시장/재무/로드맵/팀
│   │   │   ├── DataRoom.jsx           # JWT 로그인 → IR 자료
│   │   │   └── Contact.jsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx (Nav + LangToggle)
│   │   │   │   ├── Footer.jsx
│   │   │   │   └── AuroraBackground.jsx
│   │   │   ├── hero/
│   │   │   │   ├── ScrollHero.jsx
│   │   │   │   └── ParticleField.jsx
│   │   │   ├── clone/
│   │   │   │   ├── CloneViewer3D.jsx  (r3f)
│   │   │   │   ├── GrowthTimeline.jsx
│   │   │   │   └── PersonalityChart.jsx
│   │   │   ├── map/
│   │   │   │   ├── ParcelMap2D.jsx    (react-leaflet)
│   │   │   │   └── ParcelMap3D.jsx    (resium)
│   │   │   ├── demo/
│   │   │   │   ├── HologramStream.jsx (WebRTC Wilbur client)
│   │   │   │   └── PetChatBox.jsx     (WS → /api/ai/chat)
│   │   │   └── common/
│   │   │       ├── SectionTitle.jsx
│   │   │       ├── CTAButton.jsx
│   │   │       └── Modal.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── usePetAgent.js         (WS → /api/ai/agent)
│   │   │   ├── usePixelStream.js
│   │   │   └── useI18n.js
│   │   ├── i18n/
│   │   │   ├── index.js
│   │   │   ├── ko.json
│   │   │   └── en.json
│   │   ├── styles/
│   │   │   ├── tokens.css             (컬러·타이포 변수)
│   │   │   ├── animations.css
│   │   │   └── global.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── public/
│   │   ├── models/ (r3f 3D assets)
│   │   ├── images/
│   │   └── fonts/
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py              (env + Orbitron secrets)
│   │   │   ├── security.py            (JWT)
│   │   │   └── db.py                  (SQLModel + PostgreSQL)
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── pet.py
│   │   │   ├── clone.py
│   │   │   ├── parcel.py
│   │   │   └── dataroom_doc.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── pets.py
│   │   │   ├── clones.py
│   │   │   ├── ai_chat.py             (WS relay)
│   │   │   ├── ai_agent.py            (WS relay, persistent)
│   │   │   ├── ue5_spawn.py
│   │   │   ├── parcels.py
│   │   │   ├── dataroom.py
│   │   │   └── content.py
│   │   └── services/
│   │       ├── openclaw_ws.py         (OpenClaw WebSocket client)
│   │       ├── ps2_client.py
│   │       └── flux_client.py         (이미지 생성 → ai-image-service:8100)
│   ├── alembic/                       (마이그레이션)
│   ├── requirements.txt
│   └── Dockerfile                     (multistage)
│
├── docs/
│   ├── superpowers/specs/2026-04-22-joojooland-pitch-site-design.md  (이 파일)
│   ├── dev-plan.md
│   ├── investor-deck-outline.md
│   └── content-drafts/                (KR 콘텐츠 초안)
│
├── .claude/                           (gaongn.net 에서 복사)
│   ├── settings.json
│   ├── launch.json
│   └── skills/
│
├── Orbitron.yaml                      (배포 명세)
├── .env.example
├── .gitignore
├── CLAUDE.md                          (프로젝트 가이드)
└── README.md
```

---

## 5. 데이터 흐름

### 5.1 공개 경로 (비로그인)
```
Browser → Vercel(정적 React) → 마케팅 페이지 완결
                              → /api/parcels (GET) → PostgreSQL (지도)
                              → /api/ai/chat (WS) → OpenClaw (클론 체험)
```

### 5.2 인증 경로 (데이터룸)
```
Browser → POST /api/auth/login → JWT (24h, HttpOnly)
       → GET /api/dataroom/docs (Bearer JWT) → presigned URL → Cloudflare R2
```

### 5.3 펫 에이전트 persistent 경로
```
Browser → WS /api/ai/agent/{petId}
       → FastAPI 릴레이
       → OpenClaw agent:joojoo-pet-{petId}:{userId}
       → openai-codex/gpt-5.4 (tool-use, 기억 유지)
       → streaming delta → 브라우저
```

### 5.4 홀로그램 스트리밍
```
Browser → POST /api/ue5/spawn → Wilbur 세션 할당 (8080 player signaling)
       → WebRTC P2P 연결 (8888 SFU)
       → 브라우저 WebRTC 렌더
```

---

## 6. 콘텐츠 IA (사이트맵)

```
상단 내비 (KR/EN 토글)
├─ 🏠 Home              Hero: "당신의 반려동물은 영원히 살아있습니다"
├─ 💫 Vision            Pet Twinverse 철학 · 상실 치유 스토리
├─ 🎡 Theme Park        놀이존 · 미디어아트존 · 경주존 · 추모존
├─ 🧬 Digital Clone     기술 설명 + 3D 성장 타임라인 + 퍼스널리티
├─ 🗺️  Map              34필지 지도 (JooJooPatLand 포팅)
├─ 🎮 Demo              ① 클론 챗 ② 홀로그램 스트림
├─ 📊 Investment        시장·재무·로드맵·팀
├─ 🔒 Data Room         로그인 (IR 상세)
└─ ✉️  Contact
```

### 6.1 Home Hero 카피 (KR)
- **H1**: 당신의 반려동물은 영원히 살아있습니다
- **Sub**: 태어나는 순간부터 디지털 영혼이 함께 자라고, 언제든 홀로그램으로 재회합니다
- **CTA Primary**: Pet Twinverse 체험하기
- **CTA Secondary**: 투자 상담 예약

### 6.2 Home Hero 카피 (EN)
- **H1**: Your pet lives forever.
- **Sub**: A digital soul born with your pet, growing alongside them, always there — even beyond.
- **CTA Primary**: Meet Your Pet Twinverse
- **CTA Secondary**: Book an Investor Briefing

---

## 7. 에러 처리

| 경계 | 실패 시 동작 |
|------|------------|
| OpenClaw 연결 실패 | "AI 엔진 점검 중" 배너 + 시나리오 스크립트 fallback |
| UE5 세션 혼잡/없음 | "홀로그램 대기열" 모달 + 녹화 데모 영상 재생 |
| JWT 만료 | 자동 `/api/auth/refresh` → 실패시 로그인 모달 |
| PostgreSQL 끊김 | 지도 localStorage 캐시 + "동기화 일시 중단" 배지 |
| i18n 키 누락 | EN→KR 자동 fallback, 원시 key 비노출 |
| 정적 자산 404 | placeholder 이미지 + 콘솔 로그 (Sentry 후속) |
| r3f 3D 로딩 실패 | 2D 썸네일로 우아하게 다운그레이드 |

**원칙**: 투자자 앞에서 빈 화면·스택트레이스 금지. 모든 실패는 graceful degradation.

---

## 8. 테스트 전략

| 레이어 | 도구 | 범위 |
|--------|------|------|
| 프론트 단위 | Vitest + RTL | 훅, i18n 토글, 폼 검증 |
| 프론트 E2E | Playwright | Home→Vision→Clone→Demo 투어, 로그인 플로우, KR/EN 전환 |
| 백엔드 단위 | pytest + httpx | 라우터, JWT, SQLModel 쿼리 |
| 백엔드 통합 | pytest + testcontainers-postgres | 실 DB + 마이그레이션 |
| OpenClaw 목 | WS mock fixture | LAN 없이도 CI 통과 |
| 비주얼 회귀 | Playwright screenshot diff | Hero/Clone/Map 주요 샷 |
| 배포 전 | 수동 체크리스트 | KR/EN, 모바일 반응형, 캐시 헤더 |

**CI/CD**:
- GitHub Actions → Vercel preview (PR마다)
- `main` merge → production (Cloudflare Tunnel 공개)
- Orbitron 배포 (backend) → `orbitron deploy joojooland`

---

## 9. 캐시 전략 (CLAUDE.md 전역 규칙 준수)

| 자산 | Cache-Control |
|------|---------------|
| HTML / 루트 | `public, max-age=0, must-revalidate` |
| `/assets/*-{hash}.*` | `public, max-age=31536000, immutable` |
| `/api/*` | `no-store` + `Pragma: no-cache` |
| `/uploads/*` | `public, max-age=0, must-revalidate` |

구현: `backend/app/main.py` 미들웨어 + `frontend/vite.config.js` `server.headers`.

---

## 10. 보안

- **API 키 금지**: OpenAI/Anthropic/기타 유료 API 키를 `.env` 에 절대 등록하지 않음 (CLI plan-token 전용)
- **JWT**: HS256, 24h 만료, HttpOnly + Secure 쿠키
- **OpenClaw 토큰**: Orbitron secrets 에만, 절대 Git 커밋 금지
- **PostgreSQL**: `orbitron-joojooland-db` 전용 DB, 비공개 네트워크
- **R2 presigned URL**: 5분 만료, 다운로드 로그 기록
- **Rate limit**: `/api/ai/*` 분당 20회/IP (슬로우 로리스 방지)

---

## 11. 구현 로드맵 (구현 단계에서 writing-plans 로 상세화)

### Phase 0 — Scaffolding (오늘)
- 프로젝트 디렉터리 + `.claude/` 복사
- 프론트/백엔드 스캐폴드 + Hello World 부팅
- 지도 모듈 포팅 (JooJooPatLand → React)
- Git 저장소 생성 + 초기 커밋

### Phase 1 — 마케팅 페이지 (1주)
- Home / Vision / ThemePark / DigitalClone / Contact 9개 페이지 스켈레톤
- i18n KR/EN 초벌
- 비주얼 시스템 (토큰 · 애니메이션) 적용

### Phase 2 — 데이터룸 + 지도 (1주)
- JWT 인증
- 데이터룸 파일 업로드/다운로드
- 지도 DB 이관 (localStorage → PostgreSQL)

### Phase 3 — AI 체험 (2주)
- OpenClaw WebSocket 클라이언트 (Python 포팅)
- 펫 클론 챗 UI
- Persistent 에이전트 (Phase 3 후반)

### Phase 4 — 홀로그램 데모 (2주)
- UE5 PetHologram 프로젝트 (최소 BP_PetCharacter + 3종 애니)
- Wilbur 시그널링 연동
- Demo 페이지 WebRTC 클라이언트

### Phase 5 — 투자 자료 + 런칭 (1주)
- Investment 페이지 차트/재무
- 데이터룸 IR 문서 업로드
- Cloudflare Tunnel 공개 URL
- 언론 보도자료

**총 예상**: 7주 (풀타임 1인 기준)

---

## 12. 오픈 질문 / 의사결정 예정

- [ ] 도메인: `joojooland.com` vs `joojooland.ai` vs `pettwinverse.com` — 런칭 직전 결정
- [ ] 배포: Vercel free vs Cloudflare Pages — frontend 트래픽 예측 후 결정
- [ ] UE5 펫 모델: 자체 제작 vs Sketchfab 라이선스 — Phase 4 착수시 결정
- [ ] IR 팩: 별도 PDF 링크 vs 데이터룸 내 뷰어 — 투자자 피드백 후 결정

---

## 13. 참고 문서

- `C:\WORK\gaongn.net\` — 구조 템플릿
- `C:\WORK\JooJooPatLand\` — 지도 모듈 원본
- `C:\WORK\TwinverseAI\` — AI 인프라 흡수 원본
- `C:\WORK\infra-docs\ai-shared-registry.md` — AI 공유 자원 SSOT
- `C:\WORK\llm-wiki\` — Wiki 참조

---

**이 문서는 브레인스토밍 산출물이다. 구현은 별도 writing-plans 스킬로 상세 플랜을 작성한 뒤 진행한다.**
