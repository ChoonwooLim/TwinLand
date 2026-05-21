# JooJooLand — 인증 & 어드민 대시보드 설계서

**버전**: v1 (2026-04-22)
**작성**: Claude Code + Steven Lim
**상위 설계서**: `2026-04-22-joojooland-pitch-site-design.md`

---

## 1. 목표

공개 회원가입 · 등업 승인 · 투자자 전용 DataRoom · 운영 콘솔을 갖춘 통합 인증/어드민 시스템을 구축한다. 레퍼런스는 `C:\WORK\gaongn.net` 의 어드민 구조이며, JooJooLand 피치 사이트 성격에 맞게 재구성한다.

### 1.1 성공 기준

- 공개 방문자가 `/register` 로 guest 계정 생성 가능
- guest 가 `/upgrade` 에서 투자자 등업 요청 → admin 이 `/admin/upgrades` 에서 승인
- investor 가 `/dataroom` 에서 NDA 급 문서 다운로드 (각 다운로드가 로그 남김)
- admin 이 14개 어드민 메뉴에서 유저/리드/콘텐츠/자산을 운영
- httpOnly 쿠키 기반 세션으로 XSS 방어

## 2. 결정사항 요약 (브레인스토밍 합의)

| # | 결정 | 내용 |
|---|------|------|
| 1 | 범위 | 투자자 리드 + CMS + 유저/권한 + 시스템 운영 + gaongn.net 메뉴 포팅 **모두** |
| 2 | 사용자 구조 | 공개 회원가입 + 등업 승인제. `superadmin / admin / investor / guest` 4단계 |
| 3 | 메뉴 개수 | 14개 (gaongn.net 6 + JooJooLand 전용 8) |
| 4 | 구현 범위 | 한 번에 전량 구현 (Phase 분할 없이 하나의 spec/plan) |
| 5 | UI 라이브러리 | Mantine v7 (어드민 청크 전용), 공개 사이트는 기존 CSS Modules 유지 |
| 6 | 인증 메커니즘 | httpOnly 쿠키 + refresh token. access 15분 / refresh 30일. 2FA 없음 |
| 7 | CMS 깊이 | 얕음. roadmap / team / financials / home stats 4개 블록만 DB 이관. ko/en 둘 다 필수 |
| 8 | 이메일 | Resend API 기반. API 키 미설정 시 `email_log` 테이블에 로그만 |
| 9 | DataRoom 저장소 | Orbitron 로컬 디스크 + JWT 게이트 프록시. 워터마크/제한 없음 |
| 10 | 로그인 페이지 | 단일 `/login` + 역할별 리다이렉트. 리드 파이프라인 7단계 |
| 11 | 코드 구조 | Feature-folder. `app/routers/admin/{feature}.py` 13개 + 프론트 `pages/admin/*` |

## 3. 사용자 & 권한 모델

### 3.1 역할

| 역할 | 부여 방식 | 가능한 것 | 불가능한 것 |
|------|----------|---------|-----------|
| **guest** | 공개 회원가입 | 로그인, 자기 정보 편집, 등업 요청 | DataRoom 다운로드, 어드민 진입 |
| **investor** | guest 가 등업 요청 → admin 승인 | guest 의 모든 것 + DataRoom 다운로드 (access_level=public/investor) | 어드민 진입 |
| **admin** | superadmin 이 승격 | investor 의 모든 것 + `/admin` 14개 메뉴 전부 | 다른 admin 의 role 변경, superadmin 생성 |
| **superadmin** | bootstrap 자동 생성 (`SUPERADMIN_USERNAME`) | admin 의 모든 것 + admin 역할 부여/회수, 시스템 설정 | — |

### 3.2 권한 계층 함수

```python
# app/core/security.py (확장)
def can_access_role(user_role: str, required: str) -> bool:
    order = {"guest": 0, "investor": 1, "admin": 2, "superadmin": 3}
    return order.get(user_role, -1) >= order.get(required, 99)
```

### 3.3 FastAPI 디펜던시

- `current_user` — 쿠키에서 access 추출, 없으면 401
- `require_investor` — investor 이상만
- `require_admin` — admin 이상만
- `require_superadmin` — superadmin 만

## 4. 인증 플로우 (httpOnly cookie + refresh)

### 4.1 토큰 구조

| 토큰 | 저장 | 수명 | 내용 |
|------|------|------|------|
| access | httpOnly · SameSite=Lax · Secure · Path=/ | 15분 | `{sub, uid, role, exp, iat, type:"access"}` |
| refresh | httpOnly · SameSite=Lax · Secure · Path=/api/auth/refresh | 30일 | `{sub, uid, exp, iat, type:"refresh", jti}` |

- `jti` 는 refresh 토큰 무효화(로그아웃, 비밀번호 변경)를 위한 화이트리스트 키.
- 개발 환경(`APP_ENV=dev`)에서는 `Secure=False` 허용. 운영은 강제 `Secure=True`.

### 4.2 엔드포인트

```
POST /api/auth/register              { email, password, display_name } → 201 + auto login
POST /api/auth/login                 (OAuth2PasswordRequestForm) → 200 + Set-Cookie
POST /api/auth/logout                → 204 + Clear cookies + invalidate refresh jti
POST /api/auth/refresh               (refresh cookie) → 200 + new access cookie
GET  /api/auth/me                    (access cookie) → 200 { id, email, role, display_name, ... }
POST /api/auth/forgot-password       { email } → 204 (이메일 전송)
POST /api/auth/reset-password        { token, new_password } → 204
POST /api/auth/change-password       { old_password, new_password } (auth) → 204
```

### 4.3 프론트 인터셉터

- axios 인스턴스 `withCredentials: true`
- 401 응답 시 → `POST /api/auth/refresh` 자동 호출 → 성공 시 원 요청 재시도
- refresh 도 실패하면 → AuthContext 로그아웃 처리 → `/login` 리다이렉트

### 4.4 CSRF

- httpOnly 쿠키 + SameSite=Lax 로 기본 CSRF 방어
- 중요 액션(비밀번호 변경 등)은 `X-Requested-With: joojooland` 헤더 검증
- 별도 CSRF 토큰은 MVP 에서 생략 (SameSite=Lax 가 대부분 커버)

## 5. 데이터 모델

### 5.1 변경되는 기존 모델

```python
# app/models/user.py — 필드 추가
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    role: str = Field(default="guest")               # guest/investor/admin/superadmin (기본값 변경)
    display_name: str | None = None
    phone: str | None = None                         # 신규
    company: str | None = None                       # 신규
    is_active: bool = Field(default=True)            # 신규
    created_at: datetime
    last_login_at: datetime | None = None            # 신규

# app/models/dataroom_doc.py — 필드 추가
class DataRoomDoc(SQLModel, table=True):
    ...
    access_level: str = Field(default="investor")    # public / investor / admin
    uploaded_by: int | None = Field(default=None, foreign_key="user.id")
    version: int = Field(default=1)
```

### 5.2 신규 모델

```python
# app/models/upgrade_request.py
class UpgradeRequest(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    realname: str
    phone: str
    company: str | None = None
    purpose: str                                     # 투자 의사/실사 등
    status: str = Field(default="pending")           # pending/approved/rejected
    reviewed_by: int | None = None                   # admin user id
    reviewed_at: datetime | None = None
    reject_reason: str | None = None
    created_at: datetime = Field(default_factory=...)

# app/models/contact_lead.py
class ContactLead(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    name: str | None = None
    phone: str | None = None
    company: str | None = None
    source: str = Field(default="contact_form")      # contact_form / waitlist / referral
    stage: str = Field(default="new")                # new / contacting / meeting / diligence / contract / hold / closed
    message: str | None = None
    memo: str | None = None                          # admin 내부 메모
    assigned_to: int | None = None                   # admin user id
    created_at: datetime
    updated_at: datetime

# app/models/content_block.py
class ContentBlock(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    page: str = Field(index=True)                    # home / investment / ...
    slot: str                                        # hero_stats / roadmap / team / financials
    key: str                                         # item1_title, item1_body, ...
    value_ko: str
    value_en: str
    order_idx: int = Field(default=0)
    updated_by: int | None = None
    updated_at: datetime

# app/models/ai_chat_log.py
class AIChatLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = None                       # null = 비로그인
    session_id: str = Field(index=True)
    agent_id: str                                    # joojoo-pet-agent 등
    model: str
    prompt_chars: int
    response_chars: int
    latency_ms: int
    error: str | None = None
    created_at: datetime

# app/models/email_log.py
class EmailLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    to_email: str = Field(index=True)
    subject: str
    template: str                                    # register_welcome / upgrade_approved / ...
    body_html: str | None = None
    status: str = Field(default="queued")            # queued / sent / failed / logged
    provider_id: str | None = None                   # Resend 메시지 ID
    error: str | None = None
    created_at: datetime

# app/models/download_log.py
class DownloadLog(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    doc_id: int = Field(foreign_key="dataroomdoc.id", index=True)
    ip: str | None = None
    user_agent: str | None = None
    created_at: datetime
```

### 5.3 스키마 마이그레이션 전략

- 개발 환경: SQLModel `create_all()` 로 자동 생성 (기존 joojooland.db 는 삭제 후 재생성)
- 운영 환경: Phase 1 은 `create_all()` 유지, 필요 시 alembic 도입 (이후 spec)

## 6. 백엔드 API 맵

### 6.1 `/api/auth` (기존 확장)

이미 4.2 에 기술.

### 6.2 `/api/upgrade` (신규)

```
POST /api/upgrade/request              (guest auth) → UpgradeRequest 생성
GET  /api/upgrade/mine                 (auth) → 본인 요청 목록
GET  /api/upgrade/admin/list           (admin) ?status=pending|approved|rejected|all
POST /api/upgrade/admin/{id}/approve   (admin) → user.role = investor + 이메일 발송
POST /api/upgrade/admin/{id}/reject    (admin) { reason } → 이메일 발송
```

### 6.3 `/api/leads` (신규)

```
POST /api/leads                        (공개) { email, name?, phone?, company?, message?, source } → ContactLead 생성
GET  /api/leads/admin                  (admin) ?stage=... → 목록
GET  /api/leads/admin/{id}             (admin) → 상세
PUT  /api/leads/admin/{id}             (admin) { stage, memo, assigned_to } → 수정
DELETE /api/leads/admin/{id}           (admin)
```

### 6.4 `/api/dataroom` (확장)

```
GET  /api/dataroom                     (auth) → 요청자 role 기준 열람 가능한 문서만
GET  /api/dataroom/{id}/download       (auth + role check) → 파일 스트림 + DownloadLog
POST /api/dataroom/admin/upload        (admin) multipart/form-data → 업로드
PUT  /api/dataroom/admin/{id}          (admin) → 메타데이터 수정
DELETE /api/dataroom/admin/{id}        (admin) → 파일 + 레코드 삭제
GET  /api/dataroom/admin/downloads     (admin) ?doc_id=&user_id= → DownloadLog 조회
```

### 6.5 `/api/admin` (13개 서브라우터)

```
/api/admin/dashboard         GET        통계 (유저/투자자/리드/DataRoom/AI chat 최근 7일)
/api/admin/users             GET        전체 유저 목록 (페이지네이션)
/api/admin/users/{id}/role   PUT        role 변경 (superadmin 만 admin 부여)
/api/admin/users/{id}/active PUT        활성화 토글
/api/admin/content           GET/PUT    ContentBlock CRUD
/api/admin/content/{page}    GET        특정 page 의 블록들
/api/admin/parcels           GET/POST/PUT/DELETE  Parcel CRUD
/api/admin/ai-logs           GET        AIChatLog 조회 (필터 多)
/api/admin/emails            GET        EmailLog 조회 + 재전송 POST
/api/admin/clones            GET        Clone 모델 목록
/api/admin/skills            GET        .claude/skills/ 스캔 결과 (하드코딩 fallback)
/api/admin/plugins           GET        .claude/plugins/ 스캔 결과
/api/admin/docs              GET        docs/ 하의 *.md 파일 목록 + 단건
/api/admin/ops/openclaw      GET        OpenClaw WS ping 결과 + 모델 리스트
```

### 6.6 공개 엔드포인트 확장

```
GET /api/content/{page}                모든 사용자가 읽는 ContentBlock (투자자 피치용)
```

## 7. 어드민 메뉴 & 페이지 구조 (14개)

| # | 메뉴 | 경로 | 페이지 | 주요 컴포넌트 |
|---|------|------|--------|-----------|
| 1 | 대시보드 | `/admin` | Dashboard.jsx | StatCards(4) + 최근 7일 AreaChart + 최근 리드/업그레이드 Table |
| 2 | 사용자 관리 | `/admin/users` | Users.jsx | DataTable + role Select + active Switch |
| 3 | 등업 요청 | `/admin/upgrades` | Upgrades.jsx | Tabs(pending/approved/rejected) + Modal(상세+승인/반려) |
| 4 | 투자자 리드 | `/admin/leads` | Leads.jsx | Kanban-like (stage별 컬럼) 또는 Table + 필터 |
| 5 | DataRoom 문서 | `/admin/dataroom` | DataRoom.jsx | Dropzone + Table + access_level Select + 다운로드 로그 Drawer |
| 6 | 콘텐츠 CMS | `/admin/content` | Content.jsx | Page Tab + 블록별 Form (ko/en 나란히) |
| 7 | 부지 관리 | `/admin/parcels` | Parcels.jsx | Table + GeoJSON Editor (Textarea 버전) |
| 8 | AI 로그 | `/admin/ai-logs` | AILogs.jsx | Table + 모델별 횟수 BarChart |
| 9 | 이메일 이력 | `/admin/emails` | Emails.jsx | Table + 필터(status/template) + 재전송 |
| 10 | Pet/Clone | `/admin/clones` | Clones.jsx | Table (Pet + Clone Join) |
| 11 | AI 스킬 | `/admin/skills` | Skills.jsx | Accordion 카탈로그 (하드코딩 + API) |
| 12 | 플러그인 | `/admin/plugins` | Plugins.jsx | Accordion 카탈로그 |
| 13 | 프로젝트 문서 | `/admin/docs` | Docs.jsx | Sidebar(파일 트리) + MarkdownViewer |
| 14 | 운영 모니터 | `/admin/ops` | Ops.jsx | OpenClaw ping + GPU 상태 (static) + DB 커넥션 |

## 8. 프론트엔드 구조

### 8.1 라우트 트리 (App.jsx)

```
/                         (public) Home
/vision, /themepark, /clone, /map, /demo, /investment, /contact    (public)
/dataroom                 (investor+) DataRoom — 실제 다운로드 게이트
/login                    (public) Login
/register                 (public) Register
/forgot-password, /reset-password   (public)
/upgrade                  (guest+) UpgradeRequest 폼

/admin                    (admin+) Dashboard
/admin/users              (admin+)
/admin/upgrades           (admin+)
/admin/leads              (admin+)
/admin/dataroom           (admin+)
/admin/content            (admin+)
/admin/parcels            (admin+)
/admin/ai-logs            (admin+)
/admin/emails             (admin+)
/admin/clones             (admin+)
/admin/skills             (admin+)
/admin/plugins            (admin+)
/admin/docs               (admin+)
/admin/ops                (admin+)
```

### 8.2 폴더 구조 변경

```
frontend/src/
├─ pages/
│   ├─ Home.jsx            (기존)
│   ├─ ...
│   ├─ Login.jsx           (신규)
│   ├─ Register.jsx        (신규)
│   ├─ ForgotPassword.jsx  (신규)
│   ├─ ResetPassword.jsx   (신규)
│   ├─ Upgrade.jsx         (신규)
│   └─ admin/
│       ├─ Dashboard.jsx
│       ├─ Users.jsx
│       ├─ Upgrades.jsx
│       ├─ Leads.jsx
│       ├─ DataRoom.jsx
│       ├─ Content.jsx
│       ├─ Parcels.jsx
│       ├─ AILogs.jsx
│       ├─ Emails.jsx
│       ├─ Clones.jsx
│       ├─ Skills.jsx
│       ├─ Plugins.jsx
│       ├─ Docs.jsx
│       └─ Ops.jsx
├─ features/
│   ├─ auth/
│   │   ├─ AuthContext.jsx
│   │   ├─ useAuth.js
│   │   └─ ProtectedRoute.jsx
│   └─ admin/
│       ├─ AdminLayout.jsx
│       ├─ AdminSidebar.jsx
│       ├─ AdminHeader.jsx
│       └─ components/
│           ├─ StatCard.jsx
│           ├─ DataTable.jsx
│           └─ MarkdownViewer.jsx
├─ lib/
│   ├─ api.js              (axios 인스턴스 + refresh 인터셉터)
│   └─ format.js           (날짜·숫자)
├─ hooks/
│   ├─ useApi.js
│   └─ useDebouncedValue.js
└─ styles/
    └─ mantine-theme.js    (다크 테마 토큰)
```

### 8.3 Mantine 테마

JooJooLand 다크 팔레트를 Mantine `createTheme` 으로 이관:
- primaryColor: `joojoo` (curated 10단계, 중심 `#6b5bff` Aurora)
- defaultRadius: `md`
- fontFamily: Pretendard
- colorScheme: `dark`

### 8.4 Admin 청크 분리

- `vite.config.js` `manualChunks` 에 `admin` 청크 추가
- AdminLayout 및 하위 14개 페이지는 `React.lazy()` 로 로딩
- Mantine 번들이 공개 사이트에 섞이지 않도록 admin 진입 시에만 로드

## 9. 이메일 발송

### 9.1 EmailService 구조

```python
# app/services/email.py
class EmailService:
    def __init__(self, resend_api_key: str | None):
        self.api_key = resend_api_key
        self.from_email = settings.email_from

    async def send(self, to: str, template: str, context: dict) -> EmailLog:
        subject, html = render_template(template, context)
        log = EmailLog(to_email=to, subject=subject, template=template, body_html=html)

        if not self.api_key:
            log.status = "logged"
            # DB 에 저장만, 전송 안 함
        else:
            try:
                provider_id = await _post_resend(self.api_key, to, subject, html)
                log.status = "sent"
                log.provider_id = provider_id
            except Exception as e:
                log.status = "failed"
                log.error = str(e)

        db.add(log); db.commit()
        return log
```

### 9.2 이메일 템플릿

- `register_welcome` — 가입 환영
- `upgrade_requested` — 요청 접수 (admin 도 참조)
- `upgrade_approved` — 투자자 등업 승인
- `upgrade_rejected` — 반려 사유 포함
- `password_reset` — 토큰 링크 (30분 유효)
- `lead_received` — 리드 등록 감사 (리드 본인에게)

Jinja2 HTML 템플릿을 `app/templates/email/*.html` 에 저장.

## 10. DataRoom 파일 저장

### 10.1 저장 경로

- `UPLOAD_DIR=/app/uploads/dataroom` (Docker volume 마운트)
- 파일명: `{uuid}_{slugified_title}.{ext}`
- DB `path` 필드: `dataroom/<uuid>_<slug>.<ext>` (상대 경로)

### 10.2 다운로드 플로우

1. 프론트: `<a href="/api/dataroom/{id}/download" download>`
2. 백엔드: `current_user` 로 role 확인 → doc.access_level 과 비교
3. 허용되면 `FileResponse` 로 스트리밍, `DownloadLog` 추가
4. 거부되면 403

### 10.3 업로드 보안

- 허용 확장자: `pdf, xlsx, docx, zip, png, jpg, mp4`
- 최대 크기: 200MB
- 업로드 시 MIME 체크 (python-magic 선택)

## 11. 콘텐츠 CMS

### 11.1 블록 이관 대상

| page | slot | 블록 | 비고 |
|------|------|------|------|
| home | hero_stats | `stat1_value/stat1_label`, stat2, stat3 | 현재 Home.jsx 하드코딩 |
| investment | roadmap | phase1_title, phase1_body, ..., phase4_* | 현재 JS 배열 |
| investment | team | member1_name, member1_role, member1_bio, member1_photo, ..., member3_* | 현재 JSX |
| investment | financials | total_raised, monthly_burn, runway, ... | 현재 "TBD" 또는 하드코딩 |

### 11.2 프론트 사용법

```jsx
const { blocks } = useContent('investment')  // GET /api/content/investment
// blocks = { roadmap: { phase1_title: { ko: "...", en: "..." }, ... } }
<h3>{t(blocks.roadmap?.phase1_title)}</h3>
```

i18n 현재 언어 기반 `block.value_ko` or `block.value_en` 선택.

### 11.3 어드민 편집 UI

- 페이지 Select (home / investment)
- slot 별 Fieldset
- 각 블록마다 `ko / en` Textarea 나란히
- 저장 시 해당 page 의 모든 블록 PUT

## 12. 캐시 & 보안 정책

기존 정책 유지 + 추가:

| 경로 | Cache-Control | 비고 |
|------|---------------|------|
| `/api/auth/*` | `no-store` | 모든 쿠키 응답 |
| `/api/admin/*` | `no-store` | |
| `/api/dataroom/*/download` | `private, no-store` | |
| `/api/content/{page}` | `public, max-age=0, must-revalidate` | 공개 캐시 가능하나 즉시 갱신 |

- CORS 허용 origin 에 프로덕션 도메인 추가 (`joojooland.twinverse.org`)
- `Secure` 쿠키는 `APP_ENV=production` 에서만 True
- 비밀번호: bcrypt cost 12

## 13. i18n 추가 네임스페이스

- `auth` — login/register/forgot/reset/upgrade 문구
- `admin` — 공통 UI (저장/취소/삭제 확인 등)
- `leads` — 리드 스테이지 이름
- `dataroom` — 게이트/업로드 UI

기존 12개 네임스페이스와 합쳐 총 16개.

## 14. 구현 플랜 (거시 단계)

플랜 상세는 `docs/superpowers/plans/2026-04-22-joojooland-auth-admin-plan.md` 에 별도 작성.

| 단계 | 범위 | 검증 |
|------|------|------|
| P1 | 백엔드 모델 + DB 재생성 + 기존 데이터 호환 | `python -c "from app.main import app"` 성공 |
| P2 | 백엔드 인증 (쿠키·refresh·register·forgot) | curl 로 로그인/리프레시 테스트 |
| P3 | 백엔드 어드민 라우터 13개 + upgrade + leads + dataroom 확장 | OpenAPI docs 접속 확인 |
| P4 | 백엔드 이메일 서비스 (Resend/log fallback) | EmailLog 레코드 생성 확인 |
| P5 | 프론트 Mantine 설치 + 테마 + AuthContext + axios | `npm run dev` 기동 |
| P6 | 프론트 Login/Register/Forgot/Reset/Upgrade 페이지 | E2E 로그인→대시보드 진입 |
| P7 | 프론트 AdminLayout + ProtectedRoute + 14 페이지 스켈레톤 | 네비게이션 동작 |
| P8 | 프론트 14 페이지 구현 (핵심 기능 전체) | 각 페이지 API 연동 |
| P9 | i18n 추가 + 공개 Header 로그인 상태 표시 | 언어 전환 동작 |
| P10 | 빌드 검증 + 커밋 묶기 | `npm run build`, `python -m compileall app/` |

## 15. 의존성 추가 목록

### 15.1 Backend `requirements.txt`

```
python-multipart>=0.0.20     # 파일 업로드
email-validator>=2.2.0       # Pydantic EmailStr
jinja2>=3.1.4                # 이메일 템플릿 렌더
itsdangerous>=2.2.0          # reset 토큰 서명
resend>=2.0.0                # 이메일 발송 (선택)
```

### 15.2 Frontend `package.json`

```
@mantine/core
@mantine/hooks
@mantine/form
@mantine/notifications
@mantine/modals
@mantine/dropzone
@mantine/charts
@tabler/icons-react
recharts
react-markdown
remark-gfm
dayjs
```

## 16. 환경변수 추가

```
# Auth
JWT_ACCESS_EXPIRE_MIN=15
JWT_REFRESH_EXPIRE_DAYS=30
COOKIE_SECURE=false             # 개발용, prod 는 true
COOKIE_DOMAIN=                  # prod 는 .twinverse.org

# Email
RESEND_API_KEY=                 # 비어있으면 log-only 모드
EMAIL_FROM=noreply@joojooland.twinverse.org
EMAIL_FROM_NAME=JooJooLand

# Upload
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=200
```

## 17. 오픈 이슈 & 향후 작업

- **Pet/Clone 관리 페이지** — 모델은 있으나 실제 클론 생성 플로우는 다른 spec (3D 에셋 업로드 UI) 에서 다룸
- **OpenClaw Ops 모니터** — GPU/컨테이너 상태를 SSH 없이 확인할 수 있는 백엔드 에이전트가 없음. 1차는 OpenClaw ping 만 구현
- **Parcel GeoJSON 에디터** — MVP 는 JSON Textarea, 이후 Leaflet 편집기 도입
- **i18n 네임스페이스 병합** — 16개로 늘어나면 파일 분할 고려 (현재 단일 파일 2개)
- **Admin audit log** — 현재는 EmailLog/DownloadLog 만. admin 액션(role 변경 등) 감사 로그는 v2

## 18. 참고

- gaongn.net 어드민 구조 — `C:\WORK\gaongn.net\frontend\src\pages\admin\*`
- Mantine 7 문서 — context7 MCP `/mantine/mantine`
- Resend Python SDK — https://resend.com/docs/send-with-python
