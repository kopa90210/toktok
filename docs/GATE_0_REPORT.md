# Gate 0 Report — توك أسوان (Tok Aswan)

**Status:** Development Baseline Established (Client-Side Prototype Only — **NOT** authorized for launch or production deployment).

---

## 1. Existing Project Inspection Summary

- **Framework & Runtime Versions:**
  - Node.js `v22.23.2`, npm `10.9.8`, Bun `1.4.4`
  - React `^19.0.1`, React DOM `^19.0.1`, Vite `^8.3.0`, TypeScript `^7.0.2`, Tailwind CSS `^4.3.3` (`@tailwindcss/vite`), `lucide-react` `^0.546.0`
- **Available Scripts & Lockfile:**
  - Lockfile: `bun.lock`
  - Scripts in `package.json`: `dev`, `build`, `preview`, `clean`, `lint` (`tsc --noEmit`), and newly added `test` (`tsx --test tests/*.test.ts`)
- **Domain State Machine & Storage:**
  - `src/domain/stateMachine.ts`: Pure state-transition validator (`VALID_RIDE_TRANSITIONS`, `VALID_OFFER_TRANSITIONS`, `VALID_DRIVER_APP_TRANSITIONS`), single-process offer selection (`selectOfferAtomically`), Egyptian phone validation (`validateEgyptianPhone`), Haversine service-zone check (`isInsideServiceZone`), and suggested fare calculation (`calculateSuggestedFare`).
  - `src/services/storageProvider.ts`: Browser `localStorage` persistence (`tok_aswan_demo_state_v1`) substituting for a shared database.
- **Real vs. Simulated Capabilities:**
  - **Client-side real logic:** TypeScript state-machine transition guards, phone format validation, distance/zone math, and local UI flows.
  - **Simulated only:** Phone OTP (`DemoPhoneAuthProvider`, test code `4829`, no SMS), Aswan map/GPS/routing (`SimulatedAswanMapProvider`, no Google Maps/Mapbox/GPS), incoming driver offers & vehicle movement, mock driver document filenames, prototype safety/share/emergency buttons, and client-side role switcher (`passenger` / `driver` / `admin`).
- **Security-Sensitive Configuration:**
  - `.env.example` contains placeholder keys only (`GEMINI_API_KEY`, `APP_URL`); no `.env` secrets are referenced in `src/`, `index.html`, or embedded in `dist/` (verified via `grep` on `dist/`).
  - Unused template dependencies (`@google/genai`, `express`, `dotenv`, `motion`) remain in `package.json`.

---

## 2. Changes Made in Gate 0

1. **Fixed Synchronous Action Result Reporting (`src/store/demoStoreActions.ts`, `src/store/DemoStoreContext.tsx`):**
   - **Bug found:** `chooseDriverOffer`, `cancelRide`, `markDriverArriving`, `markDriverArrived`, and `completeRide` previously relied on `let resultError; setState(prev => { ... resultError = ... })`. Because React queues `setState(updater)` callbacks rather than guaranteeing synchronous execution before `setState` returns, invalid calls could falsely return `{ ok: true }`. Additionally, `rateRide`, `adminUpdateDriverStatus`, and `withdrawDriverOffer` returned `{ ok: true }` even when targets were missing or in invalid states, and actions reading `state` directly risked stale closures on consecutive calls.
   - **Fix:** Extracted pure synchronous action handlers into `src/store/demoStoreActions.ts` returning `{ nextState, result }` and wired `DemoStoreContext.tsx` through `stateRef` (`runAction`) so `ActionResult` is computed and returned synchronously and consecutive calls see the updated state immediately.
2. **Added Automated Single-Process Domain & Store Action Unit Tests (`tests/domain.test.ts`, `tests/storeActions.test.ts`, `package.json`):**
   - Covered valid/invalid ride & offer transitions, expired offer rejection, blocking second offer selection once a ride leaves `offers_open`, accurate copying of offered fare & selected driver, Egyptian phone normalization/validation, Aswan service-zone checks, and driver approval gate.
   - Included a reproduction test demonstrating the deferred `setState(updater)` bug and verified all fixed synchronous store actions.
   - *Scope note:* All tests validate single-process client demo logic only and are **not** database concurrency tests.
3. **Made Demo Labels Visible & Persistent (`src/App.tsx`, `src/components/AswanInteractiveMap.tsx`, `src/components/passenger/PassengerHomeAndRide.tsx`, `src/components/passenger/PassengerOnboarding.tsx`, `src/components/driver/DriverOnboarding.tsx`):**
   - Added persistent header banner: `"نسخة تجريبية — لا توجد رحلات أو سائقون حقيقيون"`.
   - Explicitly labeled simulated OTP (`Demo OTP`), simulated map/GPS (`خريطة وموقع محاكاة تجريبية` / `موقعي (محاكاة)`), and simulated driver offers (`عرض تجريبي محاكى` / `محاكاة وضع السائق`).
   - Clarified JSDoc on `selectOfferAtomically` in `src/domain/stateMachine.ts` to state single-process client behavior only.

---

## 3. Exact Commands & Actual Results

| Command | Result | Details |
| :--- | :--- | :--- |
| `npm test` (`tsx --test tests/*.test.ts`) | **PASS** (exit 0) | 14 tests across 5 suites passed (`0` failed, `0` skipped) |
| `npm run lint` (`tsc --noEmit`) | **PASS** (exit 0) | No TypeScript errors |
| `npm run build` (`vite build`) | **PASS** (exit 0) | Built `dist/` in 641ms (`dist/assets/index-DnHdr6oQ.js` 631.10 kB; Vite chunk > 500 kB & `__dirname` config warnings noted) |
| `grep -rnE "MY_GEMINI_API_KEY\|GEMINI_API_KEY\|AIza[0-9A-Za-z_-]{20,}\|sk-[A-Za-z0-9]{20,}" dist` | **PASS** (exit 0) | Output: `NO_SECRETS_FOUND_IN_DIST` |

*Browser E2E / UI rendering tests:* **NOT RUN** (only Node unit tests, `tsc --noEmit`, and `vite build` were executed in this Gate 0 CLI check).

---

## 4. Files Changed / Added

- `package.json` — added `"test"` script
- `src/store/demoStoreActions.ts` — **new**: pure synchronous action handlers with accurate `ActionResult`
- `src/store/DemoStoreContext.tsx` — refactored to use `stateRef` + `demoStoreActions`
- `src/domain/stateMachine.ts` — clarified single-process comment on `selectOfferAtomically`
- `src/App.tsx` — added persistent header banner `"نسخة تجريبية — لا توجد رحلات أو سائقون حقيقيون"`
- `src/components/AswanInteractiveMap.tsx` — clarified simulated map and simulated GPS button labels
- `src/components/passenger/PassengerHomeAndRide.tsx` — labeled simulated driver offer cards & local-only selection note
- `src/components/passenger/PassengerOnboarding.tsx` — clarified simulated `Demo OTP` notice
- `src/components/driver/DriverOnboarding.tsx` — clarified simulated `Demo OTP` notice
- `tests/domain.test.ts` — **new**: unit tests for domain state machine, offer selection, phone, and zone logic
- `tests/storeActions.test.ts` — **new**: bug reproduction test + synchronous store action tests
- `docs/GATE_0_REPORT.md` — **new**: this Gate 0 baseline report

---

## 5. Current Limitations & Open Risks

- **No multi-user persistence or concurrency control:** `localStorage` is isolated to one browser; two tabs or devices do not share state and `selectOfferAtomically` provides zero cross-user locking.
- **No authentication or authorization:** OTP is static (`4829`) and client-checked; anyone can switch to the `admin` role in the UI.
- **No real maps, GPS, SMS, payments, or safety dispatch:** Routes, ETAs, driver movement, location, and emergency/support controls are simulated.
- **Bundle & template cleanup:** `dist/assets/index-*.js` exceeds 500 kB (631 kB unsplit) and unused template packages (`@google/genai`, `express`, `dotenv`, `motion`) remain listed in `package.json`.
- **UI component tests not automated yet:** End-to-end browser flows (Playwright/DOM) were not executed in Gate 0.

---

## 6. Recommended Gate 1 Scope & Test Cases

**Gate 1 Scope (Backend & Auth Foundation):**
1. Provision a server API (`server.ts` or backend service) + transactional database (PostgreSQL/Firestore) as the single source of truth.
2. Replace `DemoPhoneAuthProvider` with server-verified OTP/Auth and issue signed sessions/tokens with server-enforced RBAC (`passenger`, `driver`, `admin`).
3. Move `selectOfferAtomically` into a database transaction (`WHERE ride.state = 'offers_open' AND offer.state = 'submitted' AND offer.expires_at > NOW()`) with unique ride assignment constraints so concurrent passengers/drivers cannot double-book.
4. Store driver application documents in private, authenticated object storage with admin-only signed URLs and audit trails.

**Recommended Gate 1 Test Cases:**
- **Concurrent Offer Selection Integration Test:** Two parallel API requests attempting to select two different offers (or two drivers accepting/assigning simultaneously) must succeed for at most one and return `409 Conflict` for the second.
- **Server Auth & RBAC Test:** Unauthenticated or `passenger`-role requests to `/api/admin/*` (approve driver, cancel ride, edit zone/fare) must return `401`/`403`.
- **Offer Expiry & Replay Test:** Selecting an expired offer on the server returns `409`/`410` regardless of client clock tampering.
- **Driver Approval Gate Test:** Non-approved drivers calling `POST /api/driver/online` or `POST /api/offers` are rejected server-side with `403`.
- **Trip-Start OTP & Audit Log Test:** Wrong OTP increments failure count and denies `in_progress` transition; admin manual cancellation without `reason` returns `400`, and valid cancellations persist an immutable audit record.
