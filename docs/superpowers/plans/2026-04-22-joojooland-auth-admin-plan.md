# JooJooLand 인증 & 어드민 대시보드 — 구현 플랜

**관련 설계서**: `2026-04-22-joojooland-auth-admin-design.md`
**실행 모드**: 자율 구현 (사용자 위임)
**접근**: 백엔드 우선 → 프론트 순서, 각 Phase 종료 시 커밋

---

## P1. 백엔드 모델 & 스키마 (신규 6 + 기존 2 변경)

### 1.1 변경
- [ ] `app/models/user.py` — phone/company/is_active/last_login_at 필드 추가, role 기본값 `"guest"` 로 변경
- [ ] `app/models/dataroom_doc.py` — access_level/uploaded_by/version 필드 추가

### 1.2 신규 모델 파일
- [ ] `app/models/upgrade_request.py`
- [ ] `app/models/contact_lead.py`
- [ ] `app/models/content_block.py`
- [ ] `app/models/ai_chat_log.py`
- [ ] `app/models/email_log.py`
- [ ] `app/models/download_log.py`

### 1.3 DB 재생성 전략
- 개발: 기존 `backend/joojooland.db` 삭제 → `create_db_and_tables()` 에서 자동 재생성
- 부트스트랩 superadmin 생성 로직은 유지 (`choonwoo49@gmail.com` + `admin_password`)
- Seed 콘텐츠 블록 (roadmap/team/stats/financials) 자동 주입

## P2. 백엔드 인증 확장

### 2.1 `app/core/security.py`
- [ ] `create_access_token(uid, role, email)` → 15분
- [ ] `create_refresh_token(uid, jti)` → 30일
- [ ] `decode_token(token, expected_type)` → claims
- [ ] `can_access_role(user_role, required)` → bool

### 2.2 `app/core/deps.py` (신규)
- [ ] `current_user(access_token: cookie)` — 쿠키에서 access 추출, DB에서 User 조회
- [ ] `require_investor/admin/superadmin`

### 2.3 `app/routers/auth.py` 재작성
- [ ] POST /register
- [ ] POST /login — 쿠키 세팅
- [ ] POST /logout — 쿠키 삭제 + refresh 무효화
- [ ] POST /refresh — 쿠키에서 refresh 읽고 새 access 발급
- [ ] GET /me
- [ ] POST /forgot-password — 토큰 이메일
- [ ] POST /reset-password — 토큰 검증 + 비밀번호 변경
- [ ] POST /change-password (인증)

### 2.4 Refresh 토큰 저장소
- [ ] in-memory 화이트리스트 `RefreshTokenStore` (dict 로 MVP)
- [ ] 차후 Redis 로 이관 가능하도록 인터페이스

## P3. 백엔드 어드민 라우터 (13 + 부가 3)

### 3.1 `app/routers/admin/__init__.py`
- [ ] admin_router 를 각 서브 라우터 합쳐 export

### 3.2 서브 라우터 13개
- [ ] `admin/dashboard.py` — GET / (통계)
- [ ] `admin/users.py` — 목록/수정
- [ ] `admin/content.py` — ContentBlock CRUD
- [ ] `admin/parcels.py` — Parcel CRUD
- [ ] `admin/ai_logs.py` — 조회 + 필터
- [ ] `admin/emails.py` — EmailLog 조회 + 재전송
- [ ] `admin/clones.py` — Pet+Clone 조회
- [ ] `admin/skills.py` — .claude/skills 스캔
- [ ] `admin/plugins.py` — .claude/plugins 스캔
- [ ] `admin/docs.py` — docs/ *.md 목록 및 내용
- [ ] `admin/ops.py` — OpenClaw ping
- [ ] `admin/upgrade_review.py` — upgrade 승인/반려 (관리 UI용)
- [ ] `admin/lead_manage.py` — 리드 관리 (관리 UI용)

### 3.3 별도 라우터
- [ ] `app/routers/upgrade.py` — 본인이 요청/조회
- [ ] `app/routers/leads.py` — 공개 POST + admin 관리
- [ ] `app/routers/content.py` (확장) — GET /api/content/{page}
- [ ] `app/routers/dataroom.py` — 기존 확장 (업로드/다운로드)

### 3.4 `app/main.py` 수정
- [ ] 새 라우터 등록
- [ ] `create_db_and_tables()` 확장 — Seed 콘텐츠 주입
- [ ] CORS 에 `credentials: true`, `expose_headers: ["set-cookie"]`
- [ ] 정적 /uploads 서빙 (내부용 아님 — 실제 다운로드는 /api/dataroom 사용)

## P4. 백엔드 이메일 서비스

### 4.1 `app/services/email.py`
- [ ] `EmailService` 클래스 (Resend API 또는 log-only)
- [ ] `render_template(name, ctx)` — Jinja2

### 4.2 템플릿
- [ ] `app/templates/email/register_welcome.html`
- [ ] `app/templates/email/upgrade_requested.html`
- [ ] `app/templates/email/upgrade_approved.html`
- [ ] `app/templates/email/upgrade_rejected.html`
- [ ] `app/templates/email/password_reset.html`
- [ ] `app/templates/email/lead_received.html`

## P5. 프론트 Mantine 설치

### 5.1 의존성
- [ ] package.json 에 Mantine + 부속 추가
- [ ] `npm install`

### 5.2 테마 & Provider
- [ ] `src/styles/mantine-theme.js` — JooJooLand 다크 팔레트
- [ ] `src/main.jsx` 에 `<MantineProvider theme={...} defaultColorScheme="dark">` 래핑
- [ ] `<Notifications />` 마운트

### 5.3 `vite.config.js`
- [ ] manualChunks 에 `admin`, `mantine` 추가

## P6. 프론트 인증 코어

### 6.1 API 클라이언트
- [ ] `src/lib/api.js` — axios 인스턴스 (withCredentials) + 401 인터셉터

### 6.2 AuthContext
- [ ] `src/features/auth/AuthContext.jsx` — user/login/logout/register/refresh 상태
- [ ] `src/features/auth/useAuth.js` — 훅
- [ ] `src/features/auth/ProtectedRoute.jsx` — role 인자 받아 체크

### 6.3 App.jsx 변경
- [ ] 라우터 트리에 `<AuthProvider>` 래핑
- [ ] 인증 페이지 라우트 추가
- [ ] 어드민 라우트를 `<ProtectedRoute requiredRole="admin">` 로 감싸기

## P7. 프론트 인증 페이지

### 7.1 페이지
- [ ] `pages/Login.jsx`
- [ ] `pages/Register.jsx`
- [ ] `pages/ForgotPassword.jsx`
- [ ] `pages/ResetPassword.jsx`
- [ ] `pages/Upgrade.jsx`

### 7.2 Header 연동
- [ ] `components/layout/Header.jsx` — 로그인 시 display_name 배지 + 로그아웃 / 미로그인 시 "로그인" CTA

## P8. 프론트 AdminLayout + 14 페이지

### 8.1 레이아웃
- [ ] `features/admin/AdminLayout.jsx` — Mantine AppShell
- [ ] `features/admin/AdminSidebar.jsx` — 14개 링크 + 등업 pending 배지
- [ ] `features/admin/AdminHeader.jsx` — 타이틀/액션 슬롯

### 8.2 페이지 (14)
모두 `pages/admin/*.jsx`. 각 페이지는 최소:
- Mantine Table/Form 사용
- API 실제 호출
- 성공/실패 notification

구현 순서: Dashboard → Users → Upgrades → Leads → DataRoom → Content → Parcels → AILogs → Emails → Clones → Skills → Plugins → Docs → Ops

## P9. i18n

- [ ] `src/i18n/ko.json`, `en.json` 에 새 네임스페이스 4개 추가 (auth/admin/leads/dataroom)
- [ ] 하드코딩 문자열을 `t()` 호출로 교체

## P10. 검증 & 커밋

- [ ] `npm run build` 성공
- [ ] `python -c "from app.main import app"` 성공
- [ ] 커밋 묶기: Phase 단위 또는 "feat(auth)", "feat(admin)" 등
- [ ] 최종 보고

---

## 커밋 정책

각 Phase 종료 후 커밋. 메시지 프리픽스:
- `feat(auth)` — 인증 신설/확장
- `feat(admin)` — 어드민 페이지/라우터
- `feat(email)` — 이메일 서비스
- `feat(dataroom)` — DataRoom 확장
- `chore(deps)` — 의존성
- `docs(spec|plan)` — 문서

## 리스크

1. **Mantine 다크 테마 충돌** — 기존 CSS 변수와 경합. MantineProvider 를 admin 영역에만 씌우거나, 전역에 씌우되 공개 사이트의 CSS 는 !important 로 방어.
2. **CSRF on refresh** — POST /api/auth/refresh 가 쿠키만으로 동작. SameSite=Lax 로 기본 방어, 필요 시 Origin 헤더 검증 추가.
3. **DB 스키마 변경** — 기존 user/dataroom_doc 테이블에 필드 추가. 개발 환경은 삭제 후 재생성, 운영은 차후 alembic.
4. **이메일 미도착** — Resend API 키 미설정 시 `email_log.status=logged` 로만 남음. 어드민 UI 에서 "재전송" 버튼으로 수동 복구 가능.
5. **파일 업로드 경로** — Docker volume `/app/uploads` 는 orbitron.yaml 에 반영 필요. MVP 는 로컬 디렉토리.

## 미루는 항목

- Pet/Clone 3D 에셋 업로드 UI
- Parcel GeoJSON 편집기 (지도 UI)
- 2FA
- alembic 마이그레이션
- admin audit log
- CSRF 토큰 명시 발급
