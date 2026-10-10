# Qualification rubric: where each part comes from

| Part | Source |
|---|---|
| Three outcomes (qualified, grey, unqualified) with grey going to a human | AI class, Session 5 (7 Oct): the failure risk, "a good lead being rejected is a higher risk", and add a human layer where the risk is too high |
| Every decision carries a plain-English reason | AI class, Session 5: decisions you make must be justifiable in the viva; the dashboard shows the reasons |
| Second look rating for unqualified leads | AI class, Session 5: "after the unqualified leads are unqualified, you will add another rubric mechanism on how to rate them" |
| Build and test the rubric from the seed data with dummy calls (rude caller, clear qualify, clear disqualify, grey area) | AI class, Session 5 |
| No firm price, indicative range with a disclaimer | Case brief: pricing.md says "indicative only, varies by site"; Nikhil's ask is cut by the nine checks |
| Location, minimum area and minimum budget values | PLACEHOLDERS. Real values are in qualified.md on Nexus |
| Per-square-foot rates | PLACEHOLDERS. Real values are in pricing.md on Nexus |

## What you must replace before relying on it
1. `lib/rubric.js`: SERVICE_CITIES, MIN_AREA_SQFT, MIN_BUDGET_LAKH, GREY_BAND, REQUIRED_FIELDS.
2. `lib/pricing.js`: RATE_PER_SQFT and the disclaimer wording.
3. `docs/vaani-agent-prompt.md`: the services and price placeholders.
4. Run `node scripts/calibrate.js seed/enquiries` on the 40 transcripts and review every
   grey and near-miss decision against qualified.md.

## What this is not
It is not Nikhil's real policy. It is a working structure with clearly marked placeholder
values, so that replacing them takes minutes and the logic is already tested.
