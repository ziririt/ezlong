# Life Signal Firebase setup

This MVP works with localStorage fallback when `firebase-config.js` is absent.
The intended production path is Firebase Anonymous Auth + Firestore + Cloud
Functions + App Check. Create `life-signal/firebase-config.js` from
`firebase-config.example.js` and enable:

- Firebase Authentication: Anonymous sign-in
- Cloud Firestore
- Cloud Functions, region `asia-northeast3`
- App Check with reCAPTCHA v3 for Web
- Firestore rules from `life-signal/firestore.rules`

Stored data:

- anonymous `ownerUid`
- generated `systemKey`
- derived life stage, zodiac, season element, life path
- gender and personality type
- answers, axis scores, leakage causes, reports, daily check-ins

Never stored:

- raw birth date
- name, email, phone, location
- blood type
- asset size, holdings, stock symbols
- medical or mental health diagnosis

Why Firestore matters:

- today-only testing can run in the browser
- longitudinal personalization needs previous results
- repeated leakage patterns can be detected only after storing history
- future routine completion tracking can use the same anonymous profile

Cloud Function:

- `submitAssessment`: validates input, derives birth profile, discards raw birth
  date, scores answers, assigns Top 3 leakage causes, generates prescriptions,
  stores assessment/report/daily check-in, and returns report cards.
- `deleteMyLifeSignalData`: deletes the anonymous user's Life Signal data.

Operational rules:

- Do not write after every question. Submit once at the end.
- Do not store raw birth date.
- Do not collect name, email, phone, exact location, workplace, school, asset
  size, holdings, health diagnosis, or blood type.
- Keep `/content` and `/system/dailySignals` read-only.
- Never deploy production rules with `allow read, write: if true`.
