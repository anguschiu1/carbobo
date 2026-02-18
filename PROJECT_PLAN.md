# UK Car Health Coach + Fuel Saver (UK-first) — PROJECT_PLAN.md

Owner: You  
Tech Co-founder: Perplexity (this chat)  
Date: 2026-02-18  
Market: UK first, keep global in mind

---

## 1) What we’re building

A mobile-first web app for UK car owners that:
- Helps them proactively maintain their car via reminders + a monthly “photo health scan”.
- Makes ownership engaging via fuel logging, MPG insights, and nearby fuel prices.
- Automatically produces a shareable **Resale Pack** (documents + photos + mileage + costs) that makes selling easier.

---

## 2) Why this wedge works

We’re not building a two-sided used-car marketplace/auction.
Instead, we deliver immediate owner value (save money, reduce admin stress) while quietly building credible evidence (condition + maintenance + mileage) that improves resale confidence.

---

## 3) Target users (UK)

Primary:
- Owners who want a simple “car admin + running cost” hub.
- Owners who plan to sell in 3–12 months and want to maximise resale value.

Secondary:
- Owners of older cars where documentation is messy and trust matters.

---

## 4) Core product loops

### Loop A — Monthly “Car Health Scan” (retention + resale evidence)
1. Prompt monthly scan.
2. Guided photos: tyres, exterior panel area, dashboard/odometer.
3. 2-question check: warning lights, new noises.
4. Output: friendly, cautious maintenance advice + next best action.
5. Save to timeline and include in Resale Pack.

### Loop B — Fuel logging + fuel prices (daily/weekly engagement)
1. User logs every fill-up (supports partial fill-ups).
2. App estimates rolling MPG + L/100km and cost-per-mile.
3. User can check nearby fuel prices (simple list).
4. Insights remain non-judgemental and grounded in user-entered data.

---

## 5) UK-first integrations (phased)

### Fuel Finder (nearby fuel prices)
- Use UK government Fuel Finder data to list nearby stations + prices + last-updated timestamps. [web:85]

### MOT history (later milestone)
- Apply for DVSA MOT History API to import MOT timeline + mileages and support reminders. [web:84]

### Vehicle identity (optional early)
- DVLA Vehicle Enquiry Service (VES) to fetch basic vehicle attributes and reduce manual entry. [web:102]

---

## 6) Monetisation options (decision pending)

Option A (recommended early): garage referral/lead fee.
Option B: consumer subscription (“coach + premium resale pack”).
Option C: hybrid.

---

## 7) MVP scope (what ships first)

### Must-have (v1)
- Mobile-first web app.
- Vehicle onboarding (manual now; VRM lookup later).
- Reminders (manual scheduling): MOT/service due, insurance renewal (optional).
- Monthly health scan flow + timeline.
- Document vault (invoices/receipts/photos).
- Fuel logging (partial + full), MPG/L/100km, cost-per-mile.
- Nearby fuel prices list (postcode/location -> list).
- Resale Pack export (share link + PDF in later iteration).

### Add later (v1.5/v2)
- DVSA MOT History API import + automatic MOT reminders.
- Benchmarks: “your MPG vs same model average” (requires licensed or permitted dataset).
- Garage booking integrations, promos.
- Trust score / seller handoff to partners.

---

## 8) Key decisions already made
- UK first, global later.
- Fuel consumption: log every fill-up.
- Support partial fill-ups.
- Driving pattern input: percentage slider (town vs motorway).
- Fuel prices: keep it simple (nearby list only).
- Fuel entry: user inputs both total cost and pence/L; app warns if inconsistent.
- Default fuel type per vehicle; override per entry.

---

## 9) Risks & guardrails

- Crowded reminders category → differentiate via evidence-first photo scans + resale pack.
- Advice liability → use cautious language, avoid diagnosis, add disclaimers.
- Feature sprawl → any feature must improve cost savings now, maintenance outcomes, or resale credibility.

---

## 10) Definition of Done (v1)

A UK owner can:
- Add a car.
- Get basic reminders.
- Log fuel (including partial fill-ups).
- See rolling MPG and costs.
- See nearby fuel prices.
- Complete a monthly photo scan.
- Store receipts.
- Export/share a resale evidence pack link.
