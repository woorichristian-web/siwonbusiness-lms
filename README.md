# Siwon Business LMS

기업 영어 교육용 LMS (Learning Management System).

## ✨ 기능
- ✅ **교육생 자율 회원가입** — 이름·생년월일·아이디·비밀번호·회사명·산업·직무·학습목적·선호 수업방식(온/오프라인·1:1/소그룹)·선호 시간대(이른아침/점심/저녁) 입력
- ✅ **로그인 후 달력 뷰** — Week 기본, Month·Year 탭 전환
- ✅ **시간슬롯별 강사 이름 시간순 노출** — 클릭 → 신청·취소 모달
- ✅ **본인 신청 수업 강조 표시** — 짙은 색 + ✓ 표시 + "내가 신청한 수업" 라벨
- ✅ **강사 별도 로그인** — 본인 시간 슬롯 직접 추가·수정·삭제
- ✅ **관리자 페이지** — 회원 기업별 그룹화 조회, 역할 변경, 수동 회원 추가
- ✅ **엑셀 일괄 업로드** — 강사 시간표 한 번에 등록 (.xlsx/.csv)
- ✅ **PWA** — 모바일에서 홈 화면 추가 시 앱처럼 사용 가능
- ✅ **무료 배포** — Vercel + Supabase Free Tier

## 🛠 기술 스택
- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (PostgreSQL + Auth + Row Level Security)
- FullCalendar (Week/Month/MultiMonth Year 뷰)
- xlsx (엑셀 파싱)

---

## 🚀 셋업 (개발자 / 운영자용)

### 1. Supabase 프로젝트 만들기
1. https://supabase.com 가입 (무료) → **New Project** (region은 `Northeast Asia (Seoul)` 추천)
2. 좌측 메뉴 **SQL Editor → New Query** → `supabase/migrations/0001_init.sql` 내용 복붙 → **Run**
3. 좌측 메뉴 **Project Settings → API** 에서 세 값 복사:
   - `Project URL`
   - `anon` `public` key
   - `service_role` `secret` key (⚠️ 절대 클라이언트에 노출하지 말 것)

### 2. 환경변수 설정
```bash
cp .env.local.example .env.local
```
`.env.local` 을 열어 위에서 복사한 값을 채우세요.
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN=lms.siwon.local
```

### 3. 개발 서버 실행
```bash
npm install
npm run dev
```
→ http://localhost:3000

### 4. 본인을 관리자로 승격 (최초 1회)
1. 일반 회원으로 회원가입
2. Supabase Dashboard → **Table Editor → profiles** → 본인 row 의 `role` 컬럼을 `student` → `admin` 으로 변경
3. 다시 로그인 → `/admin` 자동 진입

### 5. 강사 계정 만들기
관리자 페이지 → **회원 직접 추가** → 역할 `강사` 선택 후 발급.
또는 기존 교육생 계정의 role을 `teacher` 로 변경.

### 6. Vercel 배포 (무료)
1. GitHub repo 에 푸시
2. https://vercel.com → **New Project** → repo import
3. **Environment Variables** 에 위의 4개 환경변수 입력
4. **Deploy** → 몇 분 내 https://your-app.vercel.app 으로 공개

---

## 📐 시스템 설계

### 역할 (Role) 체계
| role | 가입 방식 | 메인 화면 | 권한 |
|---|---|---|---|
| `student` | 자율 가입 (`/signup`) | `/student/calendar` | 본인 정보 조회, 달력 보기, 수업 신청/취소 |
| `teacher` | 관리자 발급 | `/teacher/schedule` | 본인 시간 슬롯 추가·수정·삭제 |
| `admin` | DB에서 role 변경 | `/admin` | 전체 회원 조회·역할변경·삭제, 수동 추가, 엑셀 일괄 업로드 |

### "아이디 + 비밀번호" 로그인 구현 방식
Supabase Auth 는 이메일 기반이므로, 사용자가 입력한 `username` 을 내부적으로 `{username}@lms.siwon.local` 합성 이메일로 매핑해서 저장합니다. UI에서는 username만 노출됩니다. 도메인은 `NEXT_PUBLIC_USERNAME_EMAIL_DOMAIN` 환경변수로 변경 가능 (변경 시 기존 계정 로그인 불가).

### DB 스키마
| 테이블 | 역할 |
|---|---|
| `profiles` | 모든 사용자 공통 (회원가입 필드 전부 + role) |
| `teachers` | 강사 추가 정보 |
| `time_slots` | 강사별 수업 가능 시간 |
| `bookings` | 교육생 수강 신청 |

RLS 정책으로 교육생/강사/관리자 권한이 DB 레벨에서 분리되어 있습니다.

### 폴더 구조
```
app/
  (auth)/login                로그인 (공통)
  (auth)/signup               회원가입 (교육생 자율)
  dashboard                   로그인 후 진입점 (역할별 분기)
  student/calendar            교육생 달력
  teacher/schedule            강사 스케줄 편집
  admin/                      관리자 홈
  admin/users                 회원 기업별 목록
  admin/users/add             회원 직접 추가
  admin/upload                엑셀 일괄 업로드
  api/auth/signout            로그아웃
components/                   UI 컴포넌트
lib/
  supabase/{client,server,middleware,admin}.ts
  actions/{booking,slots,admin}.ts   서버 액션
  auth.ts, constants.ts, types.ts
middleware.ts                 세션 갱신 + 라우트 보호
supabase/migrations/          DB 마이그레이션 SQL
public/manifest.json, icon.svg, sw.js   PWA
```

---

## ⏰ 24시간 전 자동 알림

마이그레이션 `0009` 실행 시 Supabase pg_cron 으로 매시간 정각(UTC)에 `send_24h_reminders()` 함수가 자동 실행됩니다.

- 시작 23~25 시간 후의 확정된 예약을 찾아 → 교육생에게 내부 메시지 발송 + Realtime 알림
- 같은 예약에 두 번 보내지 않도록 `bookings.reminder_sent_at` 컬럼으로 중복 방지
- 메시지 발신자는 해당 수업의 담당 강사

### 카카오톡(알림톡) 연동

카카오 알림톡은 별도 서비스 가입이 필요합니다 (한국 사업자만 가능):

1. **카카오비즈니스 계정** 생성 (https://business.kakao.com)
2. **알림톡 발신 프로필 등록** + 비즈니스 인증
3. **메시지 템플릿** 사전 심사·등록 (카카오 측 영업일 1~3일)
4. 발송 대행사 선택: **Aligo, NHN Toast, SOLAPI, Kakao Sense** 등
5. 받은 API 키를 환경변수로 설정 (예: `ALIGO_API_KEY`, `ALIGO_USER_ID`)
6. `lib/actions/attendance.ts` 같은 액션에서 발송 API 호출 코드 추가

> **현재 구현**: 내부 메시지 + 브라우저/시스템 알림으로 충분히 작동.  
> 카톡까지 필요하면 위 단계 진행 후 webhook URL 만 추가하면 됩니다.

---

## 📋 출석 체크

- **강사**: My Schedule → **Class Manage** 탭 → 수업별 드롭다운에서 출석/지각/결석 마킹
- **교육생**: 수강현황 페이지에서 실제 출석률 + 지난 수업 옆 출석 상태 배지
- **출석률** = `출석 횟수 / (출석 + 지각 + 결석)` × 100

---

## 📤 엑셀 일괄 업로드 형식

첫 행은 헤더(컬럼명)여야 합니다. 컬럼:

| 컬럼명 | 의미 | 예시 |
|---|---|---|
| `teacher_username` | 강사 아이디 (사전 등록 필요) | `jane_kim` |
| `start_at` | 시작 시간 (Excel datetime 또는 ISO) | `2026-06-01 09:00` |
| `end_at` | 종료 시간 | `2026-06-01 10:00` |
| `format` | `online` 또는 `offline` | `online` |
| `class_type` | `1on1` 또는 `small_group` | `1on1` |
| `capacity` | 정원 (정수) | `1` |

업로드 실패 시 어느 행이 왜 실패했는지 결과 페이지에 표시됩니다.

---

## 🗺 로드맵 (완료)
- [x] **Phase 1**: 회원가입/로그인 + DB 스키마 + 미들웨어
- [x] **Phase 2**: 달력 UI (Week/Month/Year) + 교육생 수업 신청/취소
- [x] **Phase 3**: 강사 로그인 + 본인 시간표 직접 수정
- [x] **Phase 4**: 관리자 페이지 (기업별 회원 조회 + 수동 추가 + 엑셀 업로드)
- [x] **Phase 5**: PWA 매니페스트 + Service Worker

## 🔜 향후 확장 (옵션)
- [ ] 이메일/SMS 알림 (수업 예약 확정, 24시간 전 리마인더)
- [ ] 수업 후 교육생 피드백·평점
- [ ] 강사 프로필 페이지 (사진, 자기소개, 자격증)
- [ ] 결제 연동 (Toss Payments / Stripe)
- [ ] Zoom/Google Meet 자동 링크 생성
- [ ] 다국어 (영문)

---

## 💰 운영 비용
**무료** — 사용자 50,000명 / DB 500MB / 월 대역폭 5GB 이내라면 0원으로 운영 가능.
- Supabase Free Tier: 50K MAU, 500MB DB, 1GB storage
- Vercel Hobby: 무제한 트래픽 (상업적 사용 시 Pro $20/월 필요)

규모 커지면 Supabase Pro ($25/월) 만 켜면 8GB DB / 100K MAU.
