# UK Car Health Coach + Fuel Saver — PRD.md

Date: 2026-02-18  
Platform: Mobile-first web app

---

## 1) Product goals
- Make owners feel proactive, not judged.
- Provide daily/weekly value (fuel savings) and monthly value (health scan).
- Build a resale-ready evidence pack as a by-product.

Non-goals (v1):
- Full telematics / GPS trip tracking.
- Running a garage network.
- Used-car marketplace/auction.

---

## 2) User stories (v1)

### Onboarding
- As an owner, I can create my vehicle profile (fuel type default, units) so entries are quick.
- As an owner, I can set reminder dates so I don’t forget MOT/service.

### Monthly health scan
- As an owner, I can complete a scan in under 2 minutes so it’s sustainable.
- As an owner, I can upload photos with guidance so they’re consistent.
- As an owner, I can answer 2 quick questions so the app can suggest next steps.

### Fuel logging + consumption
- As an owner, I can log every fill-up so I can track consumption.
- As an owner, I can log partial fill-ups so I don’t need to wait for a full tank.
- As an owner, I can see estimated MPG and L/100km so I understand my efficiency.
- As an owner, I can tag driving pattern (town vs motorway %) so I can compare.

### Fuel prices
- As an owner, I can enter postcode or use location so I can see nearby fuel prices.

### Resale pack
- As an owner, I can share a link to my car’s timeline and docs so a buyer can trust the car.

---

## 3) Data model (v1)

### Vehicle
- id (uuid)
- owner_user_id
- vrm (optional for v1)
- make/model/year (optional v1)
- fuel_type_default (enum)
- odometer_unit_default (miles|km)
- created_at/updated_at

### Document
- id, vehicle_id
- type (service_invoice, mot_certificate, repair_receipt, other)
- file_url
- occurred_at
- notes

### HealthScan
- id, vehicle_id
- scan_at
- tyre_photo_url
- exterior_photo_url
- dashboard_photo_url
- odometer_reading
- odometer_unit
- warning_lights (bool)
- new_noises (bool)
- generated_advice (json/text)

### FuelEntry
- id, vehicle_id
- occurred_at
- odometer_reading
- odometer_unit
- litres_added
- is_full_tank (bool)
- total_cost_gbp
- price_pence_per_litre
- fuel_type (defaults from vehicle, override per entry)
- town_pct (0..100)
- notes

---

## 4) Fuel economy calculations (partial fill-ups)

### Behavior
- Partial fills do not produce an “interval MPG” by themselves.
- When the user logs a FULL fill, we compute the interval since the previous FULL fill by accumulating litres (including partials) and using odometer delta. (Accumulate-until-full approach.)

### Formulas
- gallons_uk = litres_total / 4.54609
- mpg_uk = distance_miles / gallons_uk
- l_per_100km = (litres_total / distance_km) * 100

### Validation
- Odometer must increase.
- If cost and price disagree beyond tolerance, show warning but save.

---

## 5) Nearby fuel prices (UK)

### Source
- Use UK government Fuel Finder data: station-by-station prices by fuel type + forecourt details, with near-real-time updates and timestamps, accessible via API/email and authenticated for API via OAuth 2.0 client credentials. [web:85]

### UX
- Simple list sorted by distance (or cheapest for selected fuel type).
- Show station name/brand, address, price, last updated.

---

## 6) Screens (v1)
1. Home/dashboard (widgets: rolling MPG, cost/mile, next reminders, shortcut to nearby fuel prices, next scan).
2. Add fuel entry (includes full/partial toggle, town% slider, fuel type override).
3. Fuel history (entries + computed full-to-full intervals).
4. Monthly scan flow (guided photos + 2 questions + advice card).
5. Documents vault.
6. Resale Pack share page (public link with permissions).
7. Nearby fuel prices list.

---

## 7) Acceptance criteria (v1)

Fuel entry:
- User can add partial and full fills.
- App computes interval MPG only after a full fill completes an interval.
- App shows rolling MPG and L/100km.
- App stores town_pct and can group insights by town-heavy vs motorway-heavy.

Fuel prices:
- User can enter postcode and receive a list of nearby stations with prices + timestamps.

Health scan:
- User can upload 3 photos + odometer and answer 2 questions.
- App generates safe “next best action” guidance.

Resale pack:
- User can share a link that shows timeline items (scans, docs, mileage/fuel summaries).
