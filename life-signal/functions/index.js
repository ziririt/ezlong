const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

const KNOWLEDGE_FILES = [
  "questions",
  "trigger_rules",
  "leakage_causes",
  "prescriptions",
  "seven_day_routines",
  "personality_clusters",
  "life_stages",
  "daily_fortune_seeds",
  "safety_copy"
];

let knowledgeCache = null;

function loadKnowledge() {
  if (knowledgeCache) return knowledgeCache;
  const base = path.join(__dirname, "data", "knowledge");
  knowledgeCache = {};
  for (const file of KNOWLEDGE_FILES) {
    knowledgeCache[file] = JSON.parse(fs.readFileSync(path.join(base, `${file}.json`), "utf8"));
  }
  return knowledgeCache;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function digitalRoot(str) {
  let n = String(str).split("").reduce((a, b) => a + (+b || 0), 0);
  while (n > 9) n = String(n).split("").reduce((a, b) => a + (+b || 0), 0);
  return n;
}

function seasonOf(month) {
  if ([3, 4, 5].includes(month)) return "wood";
  if ([6, 7, 8].includes(month)) return "fire";
  if ([9, 10, 11].includes(month)) return "metal";
  return "water";
}

function zodiacOf(month, day) {
  const n = month * 100 + day;
  const cuts = [
    ["capricorn", 120], ["aquarius", 219], ["pisces", 320], ["aries", 420],
    ["taurus", 521], ["gemini", 621], ["cancer", 723], ["leo", 823],
    ["virgo", 923], ["libra", 1023], ["scorpio", 1122], ["sagittarius", 1222],
    ["capricorn", 1232]
  ];
  return (cuts.find((x) => n < x[1]) || ["capricorn"])[0];
}

function deriveBirth(birthDateInput) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(birthDateInput || ""));
  if (!m) throw new HttpsError("invalid-argument", "birthDateInput must be YYYY-MM-DD");
  const year = +m[1], month = +m[2], day = +m[3];
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now < new Date(now.getFullYear(), month - 1, day)) age--;
  if (age < 10 || age > 100) throw new HttpsError("invalid-argument", "unsupported age range");
  const lifeStage = age < 20 ? "teen" : age < 25 ? "early20s" : age < 30 ? "late20s" : age < 40 ? "30s_build" : age < 50 ? "40s_pivot" : age < 60 ? "50s_harvest" : age < 70 ? "60s_wisdom" : "70plus_legacy";
  const animals = ["rat", "ox", "tiger", "rabbit", "dragon", "snake", "horse", "goat", "monkey", "rooster", "dog", "pig"];
  return {
    age,
    lifeStage,
    zodiac: zodiacOf(month, day),
    chineseZodiac: animals[(year - 4) % 12],
    seasonElement: seasonOf(month),
    lifePath: digitalRoot(`${year}${String(month).padStart(2, "0")}${String(day).padStart(2, "0")}`)
  };
}

function clusterOf(type, kb) {
  if (!type) return "unknown";
  return (kb.personality_clusters.find((c) => (c.types || []).includes(type)) || {}).id || "unknown";
}

function makeKey(seed) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "", n = seed;
  for (let i = 0; i < 16; i++) {
    n = hash(`${n}:${i}`);
    s += chars[n % chars.length];
  }
  return s.match(/.{1,4}/g).join("-");
}

function makeProfile(input, derived, uid, kb) {
  const seed = hash([derived.lifeStage, derived.zodiac, derived.chineseZodiac, derived.seasonElement, derived.lifePath, input.gender, input.personalityType || "unknown", uid].join("|"));
  const displayName = `${pick(["SOLAR", "MOON", "CALM", "BOLD", "WISE", "SOFT"], seed)}-${pick(["TIGER", "RABBIT", "OWL", "FOX", "BEAR", "DOLPHIN", "DRAGON"], seed >> 3)}-${String(seed % 10000).padStart(4, "0")}`;
  return {
    displayName,
    systemKey: `LS1.${makeKey(seed)}`,
    ownerUid: uid,
    lifeStage: derived.lifeStage,
    gender: input.gender,
    personalityType: input.personalityType || "unknown",
    personalityCluster: clusterOf(input.personalityType, kb),
    zodiac: derived.zodiac,
    chineseZodiac: derived.chineseZodiac,
    seasonElement: derived.seasonElement,
    lifePath: derived.lifePath,
    investorMode: !!input.investorMode,
    createdAt: todayKey(),
    lastVisitAt: todayKey(),
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10)
  };
}

function selectQuestions(kb, interestMode) {
  const base = ["q_sleep", "q_space", "q_meaning", "q_goal", "q_finish", "q_money_leak", "q_contact", "q_walk", "q_screen", "q_ask", "q_risk", "q_opportunity", "q_selftalk", "q_decisions", "q_emotion_regulation", "q_boundary"];
  const extras = {
    work: ["q_workload", "q_document"],
    money: ["q_pause_buy", "q_financial_order"],
    people: ["q_weak_tie", "q_kindness"],
    health: ["q_body_check", "q_morning"],
    energy: ["q_plan_tiny", "q_recover_after_fail"],
    investor: ["q_risk", "q_pause_buy"],
    daily: ["q_microjoy", "q_reduce_noise"]
  }[interestMode] || [];
  const ids = [...new Set([...base, ...extras])].slice(0, 18);
  return ids.map((id) => kb.questions.find((q) => q.id === id)).filter(Boolean);
}

function scoreAxes(questions, answers) {
  const external = {}, internal = {}, ew = {}, iw = {};
  ["wealth", "people", "health", "energy"].forEach((k) => external[k] = ew[k] = 0);
  ["recovery", "clarity", "execution", "connection", "opportunity", "resource", "meaning"].forEach((k) => internal[k] = iw[k] = 0);
  for (const q of questions) {
    const score = (((answers || {})[q.id] || 3) - 1) / 4 * 100;
    for (const [k, w] of Object.entries(q.externalAxisWeights || {})) {
      external[k] += score * w; ew[k] += w;
    }
    for (const [k, w] of Object.entries(q.internalAxisWeights || {})) {
      internal[k] += score * w; iw[k] += w;
    }
  }
  Object.keys(external).forEach((k) => external[k] = Math.round(ew[k] ? external[k] / ew[k] : 60));
  Object.keys(internal).forEach((k) => internal[k] = Math.round(iw[k] ? internal[k] / iw[k] : 60));
  return { external, internal };
}

function detectLeakages(kb, questions, answers, external, internal) {
  const byId = {};
  for (const rule of kb.trigger_rules) {
    const c = rule.if || {};
    let ok = false;
    if (c.questionId) {
      const v = (answers || {})[c.questionId] || 3;
      ok = (c.lte && v <= c.lte) || (c.gte && v >= c.gte);
    } else if (c.axis) {
      const score = external[c.axis] ?? internal[c.axis];
      ok = (c.lte && score <= c.lte) || (c.gte && score >= c.gte);
    }
    if (ok) {
      byId[rule.addLeakage] ||= { id: rule.addLeakage, score: 0, reasons: [] };
      byId[rule.addLeakage].score += rule.priority || 50;
      byId[rule.addLeakage].reasons.push(rule.explain);
    }
  }
  return Object.values(byId)
    .sort((a, b) => b.score - a.score)
    .map((x) => ({ ...x, info: kb.leakage_causes.find((l) => l.id === x.id) || { title: x.id, description: "현재 응답에서 반복 신호가 감지되었습니다.", primaryAxis: "energy" } }))
    .slice(0, 3);
}

function selectPrescriptions(kb, leakages) {
  const ids = leakages.map((x) => x.id);
  const pool = kb.prescriptions.filter((x) => ids.includes(x.leakage));
  const get = (type) => pool.find((x) => x.type === type) || kb.prescriptions.find((x) => x.type === type);
  return { m3: get("3min"), m15: get("15min"), avoid: get("avoid"), signal: get("signal") };
}

function selectRoutine(kb, leakages, lowAxis) {
  const ids = leakages.map((x) => x.id);
  return kb.seven_day_routines.find((x) => (x.fitWhen || []).some((f) => ids.includes(f)))
    || kb.seven_day_routines.find((x) => (x.fitWhen || []).includes(`${lowAxis}_leakage`))
    || kb.seven_day_routines[0];
}

function composeReport(input, uid, history, kb) {
  const derived = deriveBirth(input.birthDateInput);
  const profile = makeProfile(input, derived, uid, kb);
  const questions = selectQuestions(kb, input.interestMode);
  const { external, internal } = scoreAxes(questions, input.answers || {});
  const leakages = detectLeakages(kb, questions, input.answers || {}, external, internal);
  const topAxis = Object.entries(external).sort((a, b) => b[1] - a[1])[0];
  const lowAxis = Object.entries(external).sort((a, b) => a[1] - b[1])[0];
  const total = Math.round(Object.values(external).reduce((a, b) => a + b, 0) / 4);
  const seed = pick(kb.daily_fortune_seeds, hash(`${profile.displayName}${todayKey()}${leakages.map((x) => x.id).join("|")}`));
  const prescriptions = selectPrescriptions(kb, leakages);
  const routine = selectRoutine(kb, leakages, lowAxis[0]);
  const previous = history[0] || null;
  const comparison = previous ? {
    previousTotal: previous.total || null,
    deltaTotal: typeof previous.total === "number" ? total - previous.total : null,
    previousLeakage: previous.leakages?.[0]?.id || null,
    currentLeakage: leakages[0]?.id || null
  } : null;
  return {
    profile,
    input: {
      todayMood: input.todayMood,
      interestMode: input.interestMode,
      investorMode: !!input.investorMode
    },
    answers: input.answers || {},
    external,
    internal,
    total,
    topAxis,
    lowAxis,
    leakages,
    prescriptions,
    routine,
    seed,
    comparison,
    diagnosisVersion: "server-2026-06-22-v1",
    createdAt: new Date().toISOString()
  };
}

function validateInput(input) {
  const forbidden = ["name", "email", "phone", "location", "address", "bloodType", "assetSize", "holdings", "diagnosis", "workplace", "school"];
  for (const key of forbidden) {
    if (key in (input || {})) throw new HttpsError("invalid-argument", `forbidden field: ${key}`);
  }
  if (!["male", "female", "prefer_not_to_say"].includes(input.gender)) throw new HttpsError("invalid-argument", "invalid gender");
  if (!input.todayMood || !input.interestMode) throw new HttpsError("invalid-argument", "todayMood and interestMode required");
}

exports.submitAssessment = onCall({ region: "asia-northeast3", enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Anonymous auth required");
  const input = request.data || {};
  validateInput(input);
  const kb = loadKnowledge();
  const uid = request.auth.uid;
  const userRef = admin.firestore().collection("users").doc(uid);
  const prevSnap = await userRef.collection("reports").orderBy("createdAt", "desc").limit(1).get();
  const history = prevSnap.docs.map((doc) => doc.data());
  const report = composeReport(input, uid, history, kb);
  const assessmentRef = userRef.collection("assessments").doc();
  const reportRef = userRef.collection("reports").doc(assessmentRef.id);
  const batch = admin.firestore().batch();
  batch.set(userRef, {
    anonymousId: uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    ageBand: report.profile.lifeStage,
    gender: report.profile.gender,
    birthProfile: {
      lifeStage: report.profile.lifeStage,
      zodiac: report.profile.zodiac,
      chineseZodiac: report.profile.chineseZodiac,
      seasonElement: report.profile.seasonElement,
      lifePath: report.profile.lifePath
    },
    personalityCluster: report.profile.personalityCluster,
    consentVersion: "2026-06-22",
    dataRetentionUntil: report.profile.expiresAt
  }, { merge: true });
  batch.set(assessmentRef, {
    submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    answers: report.answers,
    axisScores: report.external,
    subAxisScores: report.internal,
    leakageCauses: report.leakages.map((x) => ({ id: x.id, score: x.score, title: x.info.title })),
    strengthSignals: report.topAxis,
    diagnosisVersion: report.diagnosisVersion
  });
  batch.set(reportRef, {
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    reportType: "daily_assessment",
    cards: [],
    summary: report.seed.oneLine,
    recommendedRoutineId: report.routine.id,
    shareCardData: {
      displayName: report.profile.displayName,
      keyword: report.seed.keyword,
      oneLine: report.seed.oneLine
    },
    report
  });
  batch.set(userRef.collection("dailyCheckins").doc(todayKey()), {
    mood: input.todayMood,
    need: input.interestMode,
    todaySignal: report.seed.keyword,
    selectedAction: report.prescriptions.m3?.action || null,
    completed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  return report;
});

exports.deleteMyLifeSignalData = onCall({ region: "asia-northeast3", enforceAppCheck: true }, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Anonymous auth required");
  const uid = request.auth.uid;
  const userRef = admin.firestore().collection("users").doc(uid);
  const subcollections = ["assessments", "reports", "dailyCheckins"];
  for (const col of subcollections) {
    const snap = await userRef.collection(col).limit(200).get();
    const batch = admin.firestore().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  await userRef.delete();
  return { ok: true };
});
