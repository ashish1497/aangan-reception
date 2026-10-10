# Seed data

Put the 40 anonymised enquiry transcripts from the case (the `enquiries/` folder on
Nexus) into `seed/enquiries/`, one call per file (.txt, .md or .json). Then:

    node scripts/calibrate.js seed/enquiries

The script prints the decision for every file and lists the grey and near-miss ones to
check by hand against qualified.md. Edit the values in `lib/rubric.js` and
`lib/pricing.js` until the decisions match Nikhil's own description.

Do not commit real customer data to a public repo. These transcripts are anonymised for
the class, but keep `seed/enquiries/` out of git (it is in .gitignore).
