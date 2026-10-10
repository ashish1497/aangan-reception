# How the desk decides, and where the numbers live

| Part                                         | Where                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Policy in plain words                        | `policy/qualified.md` and `policy/pricing.md`                                                                                   |
| The numbers the code uses                    | `policy/rubric.json` (service cities, minimum area, minimum budget, grey band, near-miss ratio, rates per sq ft, price wording) |
| The decision logic                           | `lib/rubric.js`                                                                                                                 |
| Three outcomes: qualified, grey, unqualified | Grey goes to a person. A good lead wrongly turned away is the costly mistake                                                    |
| Reasons on every decision                    | Shown on the dashboard and in the designer note                                                                                 |
| Second look for unqualified calls            | `near_miss` or `clear`                                                                                                          |
| Price                                        | A range with a "varies by site" line, never one number                                                                          |

## Changing the policy

1. Edit `policy/rubric.json`.
2. Run `node scripts/calibrate.js seed/enquiries` on a folder of call transcripts and read the grey and near-miss ones.
3. Run `npm test`. If the change is intended, run `node scripts/make-golden.js` and review the diff.

## Note on the values

The numbers in `policy/` were written for this desk from the case facts (Pune studio, homes and
small offices, average project Rs 8 to 14 lakh). If Nikhil's own `qualified.md` and
`pricing.md` say something different, his files win: change `policy/rubric.json` to match.
