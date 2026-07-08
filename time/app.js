const scenes = {
  morning: {
    location: "Seoul",
    temp: "21°",
    summary: "상쾌함",
    icon: "sun-icon"
  },
  midday: {
    location: "Seoul",
    temp: "28°",
    summary: "맑음",
    icon: "sun-icon"
  },
  "golden-hour": {
    location: "Seoul",
    temp: "26°",
    summary: "맑음",
    icon: "sun-icon"
  },
  night: {
    location: "Seoul",
    temp: "22°",
    summary: "별빛 맑음",
    icon: "moon-icon"
  }
};

const scenePhotos = {
  morning: [
    "assets/bg-morning.jpg",
    "assets/backgrounds/morning/01.jpg",
    "assets/backgrounds/morning/03.jpg",
    "assets/backgrounds/morning/04.jpg",
    "assets/backgrounds/morning/05.jpg",
    "assets/backgrounds/morning/07.jpg",
    "assets/backgrounds/morning/08.jpg",
    "assets/backgrounds/morning/09.jpg",
    "assets/backgrounds/morning/10.jpg",
    "assets/backgrounds/morning/11.jpg",
    "assets/backgrounds/morning/12.jpg",
    "assets/bg-midday.jpg"
  ],
  midday: [
    "assets/bg-midday.jpg",
    "assets/backgrounds/midday/01.jpg",
    "assets/backgrounds/midday/02.jpg",
    "assets/backgrounds/midday/03.jpg",
    "assets/backgrounds/midday/04.jpg",
    "assets/backgrounds/midday/05.jpg",
    "assets/backgrounds/midday/06.jpg",
    "assets/backgrounds/midday/07.jpg",
    "assets/backgrounds/midday/08.jpg",
    "assets/backgrounds/midday/11.jpg",
    "assets/bg-morning.jpg",
    "assets/bg-golden-hour.jpg"
  ],
  "golden-hour": [
    "assets/bg-golden-hour.jpg",
    "assets/backgrounds/golden-hour/02.jpg",
    "assets/backgrounds/golden-hour/03.jpg",
    "assets/backgrounds/golden-hour/04.jpg",
    "assets/backgrounds/golden-hour/08.jpg",
    "assets/backgrounds/golden-hour/09.jpg",
    "assets/backgrounds/golden-hour/10.jpg",
    "assets/backgrounds/golden-hour/12.jpg",
    "assets/backgrounds/night/06.jpg",
    "assets/backgrounds/morning/04.jpg",
    "assets/bg-midday.jpg",
    "assets/bg-morning.jpg"
  ],
  night: [
    "assets/bg-night.jpg",
    "assets/backgrounds/night/02.jpg",
    "assets/backgrounds/night/03.jpg",
    "assets/backgrounds/night/05.jpg",
    "assets/backgrounds/night/06.jpg",
    "assets/backgrounds/night/07.jpg",
    "assets/backgrounds/night/08.jpg",
    "assets/backgrounds/night/10.jpg",
    "assets/backgrounds/night/12.jpg",
    "assets/backgrounds/golden-hour/02.jpg",
    "assets/backgrounds/golden-hour/04.jpg",
    "assets/backgrounds/morning/04.jpg"
  ]
};

let backgroundArchive = [];

const baseQuotes = window.investmentQuotes || [
  {
    text: "시장은 매일 흔들리지만, 장기투자자의 기준까지 매일 흔들릴 필요는 없습니다. 오늘의 가격보다 오래 살아남을 계획을 먼저 확인하세요.",
    title: "장기투자자의 하루",
    author: "ezlong.com",
    category: "mindset"
  },
  {
    text: "복리는 조급한 사람에게는 느려 보이고, 계속하는 사람에게는 어느 날 갑자기 커 보입니다. 중요한 것은 속도가 아니라 중간에 멈추지 않는 구조입니다.",
    title: "복리의 시간",
    author: "ezlong.com",
    category: "compound"
  },
  {
    text: "변동성은 장기투자가 내는 입장료에 가깝습니다. 하락을 예외로 두지 않고 계획 안에 넣어두면, 흔들림은 공포가 아니라 점검 신호가 됩니다.",
    title: "변동성 사용법",
    author: "ezlong.com",
    category: "volatility"
  },
  {
    text: "인내는 아무것도 하지 않는 태도가 아닙니다. 해야 할 일을 정해두고, 하지 말아야 할 일을 오늘도 참아내는 적극적인 실행입니다.",
    title: "기다림의 기술",
    author: "ezlong.com",
    category: "patience"
  },
  {
    text: "투자 성과의 많은 부분은 무엇을 더 아느냐보다, 불안할 때 무엇을 하지 않느냐에서 갈립니다. 감정은 신호로 듣고, 결정은 규칙으로 하세요.",
    title: "행동경제학 메모",
    author: "ezlong.com",
    category: "behavior"
  },
  {
    text: "은퇴 준비는 먼 미래의 숙제가 아니라 오늘의 선택을 편하게 만드는 기준입니다. 필요한 숫자를 알면 불필요한 비교와 불안이 줄어듭니다.",
    title: "은퇴 계산의 마음",
    author: "ezlong.com",
    category: "retirement"
  },
  {
    text: "뉴스가 커질수록 매매 버튼은 멀리 두는 편이 좋습니다. 좋은 투자자는 정보를 많이 보는 사람보다 행동을 잘 제한하는 사람에 가깝습니다.",
    title: "소음 줄이기",
    author: "ezlong.com",
    category: "behavior"
  },
  {
    text: "오늘의 적립은 작아 보여도 시간은 작은 돈을 크게 대합니다. 무리한 금액보다 계속 가능한 금액이 장기투자에서는 더 강합니다.",
    title: "자동 적립 노트",
    author: "ezlong.com",
    category: "compound"
  },
  {
    text: "하락장은 내 자산만 시험하지 않습니다. 내가 세운 기준이 실제로 버틸 수 있는 기준인지 확인하게 해주는 날이기도 합니다.",
    title: "하락장 일기",
    author: "ezlong.com",
    category: "volatility"
  },
  {
    text: "남의 속도가 빨라 보이는 날일수록 내 계획의 생존성을 보세요. 오래 가는 투자는 비교를 줄이는 데서부터 단단해집니다.",
    title: "비교하지 않는 투자",
    author: "ezlong.com",
    category: "mindset"
  }
];

const categoryLabels = {
  mindset: "투자 멘탈",
  compound: "복리/시간",
  volatility: "변동성",
  patience: "인내",
  behavior: "행동경제학",
  retirement: "은퇴 준비"
};

const quotes = baseQuotes.map((quote) => ({
  ...quote,
  category: getQuoteCategory(quote)
}));

const app = document.querySelector(".clock-app");
const dots = document.querySelectorAll("[data-scene-button]");
const skyRoom = document.querySelector(".sky-room");
const photoCredit = document.getElementById("photoCredit");
const quotePanel = document.querySelector(".quote-panel");
const quoteProgress = document.getElementById("quoteProgress");
const settingsPanel = document.getElementById("quoteSettings");
const settingsOpen = document.getElementById("settingsOpen");
const settingsSave = document.getElementById("settingsSave");
const allCategories = document.getElementById("allCategories");
const categoryOptions = document.getElementById("categoryOptions");
const webviewScale = document.getElementById("ezlongWebviewScale");
const ezlongSection = document.querySelector(".ezlong-webview");
const appBrand = document.querySelector(".app-brand");
const musicSettingsOpen = document.getElementById("musicSettingsOpen");
const musicToggle = document.getElementById("musicToggle");
const musicSkip = document.getElementById("musicSkip");
const musicPlaylistInfo = document.getElementById("musicPlaylistInfo");
const musicHistoryList = document.getElementById("musicHistoryList");
const bgAudio = document.getElementById("bgAudio");
const bgAudioB = document.getElementById("bgAudioB");
const digitElements = [
  document.getElementById("hourTens"),
  document.getElementById("hourOnes"),
  document.getElementById("minuteTens"),
  document.getElementById("minuteOnes")
];

let activeScene = "";
let activeQuoteMinute = "";
let lastQuoteTitle = "";
let quoteDeck = [];
let selectedCategories = new Set();
let lastScenePhoto = {};
let lastDigits = ["", "", "", ""];
let timeHasRendered = false;
let manualSceneUntil = 0;
let backgroundArchiveLoaded = false;
let weatherResolved = false;
let activePhotoSet = [];
let activePhotoSetKey = "";
let activePhotoIndex = 0;
let activePhotoSlot = "";
let manualPhotoUntil = 0;
let swipeStart = null;
const categoryStorageKey = "ezlong:selectedCategories";
let weatherState = {
  location: "위치 확인 중",
  temp: "--°",
  summary: "날씨 불러오는 중",
  icon: "sun-icon",
  tag: "clear"
};

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function resizeEzlongWebview() {
  if (!webviewScale) return;
  const mobileViewportWidth = 390;
  const width = webviewScale.clientWidth || mobileViewportWidth;
  const height = webviewScale.clientHeight || window.innerHeight;
  const scale = Math.max(1, width / mobileViewportWidth);
  webviewScale.style.setProperty("--webview-scale", String(scale));
  webviewScale.style.setProperty("--webview-frame-height", `${Math.ceil(height / scale)}px`);
}

let lastAppliedScreenHeight = 0;

// 2026-07-07: iOS 네이티브 앱(WKWebView)에서 문장박스 하단 및 점4개 줄이
// 화면 밖으로 잘리는 버그의 원인을 찾음 — 아래 safariBottomGuard/
// browserBottomLift는 "모바일 사파리 주소창이 접혔다 폈다 하는 상황"을
// 대비해 실제 화면 높이보다 최대 143px 더 크게 --first-screen-height를
// 잡아주는 보정값인데, 네이티브 앱은 주소창 자체가 아예 없는 풀스크린
// WKWebView라서 이 보정이 전혀 필요 없다. 그런데 `standalone` 판정이
// PWA(홈화면 추가) 여부만 보고, "브라우저 chrome이 없는 네이티브 래퍼"는
// 구분하지 못해서 일반 모바일 사파리 탭과 똑같이 취급되어 실제 화면보다
// 143px(852pt 기준 약 17%)나 더 큰 높이로 grid를 계산 — 그 초과분만큼
// scene-dots·quote-panel 하단이 화면 밖으로 밀려났다. iOS 앱(ContentView.swift)이
// URL 뒤에 붙여주는 ?native=ios 쿼리스트링으로 "이건 chrome 없는 네이티브
// 래퍼다"를 구분해서 이 보정을 건너뛴다.
const isNativeWrapper = new URLSearchParams(window.location.search).get("native") === "ios";

function syncFirstScreenHeight() {
  if (!app) return;
  const viewportHeight = Math.ceil(Math.max(
    window.innerHeight || 0,
    window.visualViewport?.height || 0
  ));
  // 뷰포트 높이가 1~2px 수준으로만 흔들리는 경우(서브픽셀 반올림, 스크롤바 유무 등)는
  // 무시한다 — 실제 모바일 사파리 주소창 접힘처럼 의미 있는 변화일 때만 다시 세팅해서
  // 불필요한 재조정(및 그로 인한 사진 영역 리사이즈 체감)을 줄인다.
  if (Math.abs(viewportHeight - lastAppliedScreenHeight) <= 2 && lastAppliedScreenHeight > 0) return;
  lastAppliedScreenHeight = viewportHeight;
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const standalone = isNativeWrapper || window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const safariBottomGuard = touchDevice && !standalone
    ? Math.min(164, Math.max(96, Math.round(viewportHeight * 0.09)))
    : 0;
  const userAgent = navigator.userAgent || "";
  const iOSSafari = touchDevice && /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(userAgent);
  const browserBottomLift = iOSSafari && !standalone
    ? Math.min(72, Math.max(46, Math.round(viewportHeight * 0.055)))
    : 0;

  app.style.setProperty("--first-screen-height", `${viewportHeight + safariBottomGuard}px`);
  app.style.setProperty("--first-screen-tail", `${safariBottomGuard}px`);
  app.style.setProperty("--browser-bottom-lift", `${browserBottomLift}px`);
}

function padTime(value) {
  return String(value).padStart(2, "0");
}

function getSceneForHour(hour) {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "midday";
  if (hour >= 17 && hour < 20) return "golden-hour";
  return "night";
}

function getTimeBucketForHour(hour) {
  if (hour >= 5 && hour < 6) return "dawn";
  if (hour >= 6 && hour < 8) return "early-morning";
  if (hour >= 8 && hour < 10) return "morning";
  if (hour >= 10 && hour < 12) return "late-morning";
  if (hour >= 12 && hour < 14) return "midday";
  if (hour >= 14 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 18) return "late-afternoon";
  if (hour >= 18 && hour < 20) return "sunset";
  if (hour >= 20 && hour < 22) return "evening";
  if (hour >= 22) return "night";
  if (hour < 3) return "midnight";
  return "pre-dawn";
}

function currentPrecipitation(current = {}) {
  const values = [current.precipitation, current.rain, current.showers].map(Number).filter(Number.isFinite);
  return values.length > 0 ? Math.max(...values) : 0;
}

function weatherCodeToTag(code, current = {}) {
  const precipitation = currentPrecipitation(current);
  if ([45, 48].includes(code)) return "mist";
  if ([51, 55, 56, 57, 61, 80].includes(code)) return "light-rain";
  if ([53].includes(code)) return "light-rain";
  if ([63, 81].includes(code) && precipitation < 0.5) return "light-rain";
  if ([63, 81].includes(code)) return "rain";
  if ([65, 66, 67, 82].includes(code)) return "heavy-rain";
  if ([95, 96, 99].includes(code)) return "heavy-rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  // Open-Meteo의 weather_code는 격자모델 기반 종합판정이라 국지성 장마비를
  // 놓칠 때가 있다. code가 맑음/약간흐림/흐림이어도 실측 강수량이 있으면 비로 덮어쓴다.
  if ([0, 1, 2, 3].includes(code)) {
    if (precipitation >= 0.5) return "rain";
    if (precipitation > 0) return "light-rain";
  }
  if ([3].includes(code)) return "cloudy";
  if ([1, 2].includes(code)) return "partly-cloudy";
  return "clear";
}

function weatherTagGroup(tag) {
  if (["light-rain", "rain", "heavy-rain"].includes(tag)) return "rain";
  if (["partly-cloudy", "cloudy", "mist"].includes(tag)) return "cloudy";
  return tag;
}

function weatherIconFor(tag, isDay) {
  // partly-cloudy(구름 약간)는 해+구름 아이콘으로, cloudy/mist(흐림·안개)는
  // 구름만 있는 아이콘으로 구분한다 — 유저 디자인 세트에 둘 다 있어서 세분화.
  if (tag === "partly-cloudy") return "sun-cloud-icon";
  const group = weatherTagGroup(tag);
  if (group === "rain") return "rain-icon";
  if (group === "snow") return "snow-icon";
  if (group === "cloudy") return "cloud-icon";
  return isDay === false ? "moon-icon" : "sun-icon";
}

function photoRotationSlot() {
  return String(Math.floor(Date.now() / (15 * 60 * 1000)));
}

function photoBatchSlot() {
  // 활성 4장 후보군 자체를 2시간마다 새로 뽑는다. 장마처럼 같은 날씨/계절/시간대가
  // 며칠씩 이어져도 대기화면 사진이 계속 바뀌도록 하기 위함 (photoSetKey에 사용).
  return String(Math.floor(Date.now() / (2 * 60 * 60 * 1000)));
}

const photoHistoryStorageKey = "ezlong:photoHistory";
const photoHistoryMaxPerContext = 400;

function loadPhotoHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(photoHistoryStorageKey) || "{}");
    return raw && typeof raw === "object" ? raw : {};
  } catch (error) {
    return {};
  }
}

function savePhotoHistory(history) {
  try {
    localStorage.setItem(photoHistoryStorageKey, JSON.stringify(history));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 앱 동작에는 지장이 없어야 한다.
  }
}

function photoHistoryContextKey() {
  // 정확한 weather tag(예: light-rain/rain/heavy-rain) 대신 그룹 단위(rain/cloudy/snow/clear)로
  // 묶어서 히스토리를 공유한다. 장마 기간처럼 세부 태그가 오가도 "비 계열" 전체 사진 풀을
  // 하나의 순환 대상으로 취급해야 실제로 겹치지 않는 효과가 난다.
  return [getCurrentSeason(), weatherTagGroup(weatherState.tag)].join("|");
}

function pickNonRepeatingPhotos(pool, count) {
  if (pool.length <= count) return shuffledPhotos(pool);

  const historyKey = photoHistoryContextKey();
  const history = loadPhotoHistory();
  const recentUrls = new Set(history[historyKey] || []);

  // 최근에 보여준 적 없는 사진을 우선 사용하고, 그것만으로 부족할 때만(=이미 거의
  // 다 순환했을 때) 전체 후보군에서 다시 뽑는다. 그래서 같은 날씨가 오래 이어져도
  // 전체 사진을 다 보여주기 전까지는 반복되지 않는다.
  const unseen = pool.filter((image) => !recentUrls.has(imageUrl(image)));
  const source = unseen.length >= count ? unseen : pool;
  const picked = shuffledPhotos(source).slice(0, count);

  const updatedHistory = [...(history[historyKey] || []), ...picked.map(imageUrl)].slice(-photoHistoryMaxPerContext);
  history[historyKey] = updatedHistory;
  savePhotoHistory(history);

  return picked;
}

function getCurrentSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function getSceneTimeBuckets(sceneId) {
  if (Date.now() >= manualSceneUntil) return [getTimeBucketForHour(new Date().getHours())];
  if (sceneId === "morning") return ["dawn", "early-morning", "morning"];
  if (sceneId === "midday") return ["late-morning", "midday", "afternoon"];
  if (sceneId === "golden-hour") return ["late-afternoon", "sunset", "evening"];
  if (sceneId === "night") return ["night", "midnight", "pre-dawn"];
  return [getTimeBucketForHour(new Date().getHours())];
}

function getQuoteCategory(quote) {
  return Object.prototype.hasOwnProperty.call(categoryLabels, quote.category) ? quote.category : "mindset";
}

function buildScenePhotos(sceneId) {
  return Array.from({ length: 12 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0");
    return `assets/backgrounds/${sceneId}/${number}.jpg`;
  });
}

function imageUrl(image) {
  if (typeof image === "string") return image;
  return image?.publicUrl || image?.src || "";
}

function photoCreditText(image) {
  if (!image || typeof image === "string" || image.source === "local") return "Photo: ezlong archive";
  const author = image.attribution || image.author || (image.source === "wikimedia-commons" ? "Wikimedia Commons" : "Photo archive");
  return image.license ? `${author} · ${image.license}` : author;
}

function renderPhotoCredit(image) {
  if (!photoCredit) return;
  photoCredit.textContent = photoCreditText(image);
  const url = image?.sourceUrl || image?.publicUrl || "#";
  photoCredit.href = url;
  photoCredit.toggleAttribute("aria-hidden", !url || url === "#");
}

function photoSetKey(sceneId) {
  const timeBuckets = getSceneTimeBuckets(sceneId);
  const currentTag = weatherState.tag;
  const currentSeason = getCurrentSeason();
  return [currentSeason, currentTag, timeBuckets.join("-"), photoBatchSlot()].join("|");
}

function matchingArchivePhotos(sceneId) {
  const timeBuckets = getSceneTimeBuckets(sceneId);
  const currentTag = weatherState.tag;
  const groupedTag = weatherTagGroup(currentTag);
  const currentSeason = getCurrentSeason();
  const seasonMatches = (image) => image.seasonTags?.includes(currentSeason);
  // 2026-07-07 재발 방지: 예전엔 currentTag === "light-rain"일 때만 heavy-rain/
  // 폭풍 이미지를 걸러냈다 — 그런데 "흐림(cloudy)"인데 번개 치는 사진이 나온
  // 실제 사고가 있었다. 원인은 사진 데이터(background-manifest.json)에서
  // 벼락/폭풍 사진 일부가 weatherTags에 "cloudy"를 부가 태그로 같이 갖고
  // 있었던 것 — 태그 자체는 고쳤지만(2026-07-08), 앞으로 자동 수집
  // 파이프라인이 비슷하게 잘못 태깅해도 화면에 안 나오도록 로직도 같이
  // 강화한다. "극적인 폭풍/번개" 성격의 사진은 실제 날씨가 진짜
  // heavy-rain(폭우/뇌우)급일 때만 허용하고, 그 외 모든 날씨(맑음/흐림/
  // 옅은 비 등)에서는 무조건 제외한다.
  const dramaticStormMoodTags = ["storm-front", "dramatic-sky", "lightning", "night-storm", "summer-thunderstorm"];
  const moodSafe = (image) => {
    const weatherTags = image.weatherTags || [];
    const moodTags = image.moodTags || [];
    const isDramaticStorm = weatherTags.includes("heavy-rain")
      || weatherTags.includes("thunderstorm")
      || moodTags.some((tag) => dramaticStormMoodTags.includes(tag));
    if (!isDramaticStorm) return true;
    return currentTag === "heavy-rain";
  };
  const uniquePhotos = (items) => {
    const seen = new Set();
    return items.filter((image) => {
      const url = imageUrl(image);
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  };
  const archivePhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const timeMatch = image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket));
      const exactWeatherMatch = image.weatherTags?.includes(currentTag);
      return seasonMatch && timeMatch && exactWeatherMatch && moodSafe(image) && imageUrl(image);
    })
    .map((image) => image);

  // 정확한 날씨 태그(예: light-rain) 매칭 사진이 이미 충분하면(4장 이상) 그것만 쓴다.
  // 예전 코드는 매칭 수와 무관하게 그룹/폴백 티어를 항상 합쳐버려서, 비가 오는데도
  // 맑음/흐림 태그의 무관한 사진이 후보에 섞여 4장 중 1장만 비 사진으로 보이는 문제가 있었다.
  const exactPhotos = uniquePhotos(archivePhotos);
  if (exactPhotos.length >= 4) return exactPhotos;

  const groupedArchivePhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const timeMatch = image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket));
      const weatherMatch = image.weatherTags?.includes(groupedTag);
      return seasonMatch && timeMatch && weatherMatch && moodSafe(image) && imageUrl(image);
    })
    .map((image) => image);
  const groupedPhotos = uniquePhotos([...exactPhotos, ...groupedArchivePhotos]);
  if (groupedPhotos.length >= 4) return groupedPhotos;

  // 같은 시간대에 날씨가 맞는 사진이 부족할 때, 다음 우선순위는 "시간대 무관하지만
  // 날씨는 맞는 사진"이다. 시간대가 살짝 어긋난 비 사진 쪽이, 시간대는 맞지만
  // 맑은 하늘이 나오는 사진보다 사용자에게 덜 어색하다(오늘 사용자 피드백 반영).
  const weatherOnlyPhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const weatherMatch = image.weatherTags?.includes(groupedTag);
      return seasonMatch && weatherMatch && moodSafe(image) && imageUrl(image);
    })
    .map((image) => image);
  const weatherPriorityPhotos = uniquePhotos([...groupedPhotos, ...weatherOnlyPhotos]);
  if (weatherPriorityPhotos.length >= 4) return weatherPriorityPhotos;

  // 계절까지 맞는 날씨 사진이 4장이 안 될 때, 다음 우선순위는 "계절/시간대는 달라도
  // 날씨(비/눈/맑음 등)만은 맞는 사진"이다. 유저가 반복적으로 지적한 건 항상
  // "날씨가 안 맞는다"였지 "계절이 안 맞는다"가 아니었다 — 그래서 날씨 정확도를
  // 계절 정확도보다 우선한다. 이 단계는 아직 실제 아카이브 사진(태그 있음)이라
  // 완전 무관 사진(로컬 제네릭 폴백)보다는 훨씬 낫다.
  const weatherAnySeasonPhotos = backgroundArchive
    .filter((image) => image.weatherTags?.includes(groupedTag) && moodSafe(image) && imageUrl(image))
    .map((image) => image);
  const weatherOverSeasonPhotos = uniquePhotos([...weatherPriorityPhotos, ...weatherAnySeasonPhotos]);
  if (weatherOverSeasonPhotos.length >= 4) return weatherOverSeasonPhotos;

  const fallbackArchivePhotos = backgroundArchive
    .filter((image) => seasonMatches(image) && image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket)) && moodSafe(image) && imageUrl(image))
    .map((image) => image);

  return uniquePhotos([...weatherOverSeasonPhotos, ...fallbackArchivePhotos]);
}

function shuffledPhotos(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

const preloadedPhotoUrls = new Set();

// 점(dot)으로 다른 배경사진으로 넘길 때 ~1초 로딩 지연이 있었다 — 그 사진을
// 처음 화면에 쓸 때가 되어서야 브라우저가 다운로드를 시작했기 때문이다.
// 4장 세트가 정해지는 시점(ensurePhotoSet)에 바로 전부 미리 받아두면,
// 실제로 그 사진으로 전환될 땐 이미 브라우저 캐시에 있어 지연이 없다.
function preloadPhotoSet(photos) {
  photos.forEach((photo) => {
    const url = imageUrl(photo);
    if (!url || preloadedPhotoUrls.has(url)) return;
    preloadedPhotoUrls.add(url);
    const preloadImage = new Image();
    preloadImage.src = url;
  });
}

function ensurePhotoSet(sceneId) {
  const nextKey = photoSetKey(sceneId);
  if (activePhotoSetKey === nextKey && activePhotoSet.length > 0) return;

  const candidates = matchingArchivePhotos(sceneId);
  const fallbackCandidates = scenePhotos[sceneId] || [];
  // 실제 아카이브 매칭 사진이 4장 미만이면(예: 새벽/야간처럼 촬영분이 아직 적은 시간대)
  // 로컬 기본 사진으로 채워서 항상 최대 4장 후보가 나오도록 한다.
  const seenUrls = new Set(candidates.map((image) => imageUrl(image)));
  const photos = candidates.length >= 4
    ? candidates
    : [...candidates, ...fallbackCandidates.filter((image) => !seenUrls.has(imageUrl(image)))];
  activePhotoSet = pickNonRepeatingPhotos(photos, 4);
  activePhotoSetKey = nextKey;
  activePhotoIndex = activePhotoSet.length > 0 ? Math.floor(Date.now() / (15 * 60 * 1000)) % activePhotoSet.length : 0;
  activePhotoSlot = "";
  manualPhotoUntil = 0;
  preloadPhotoSet(activePhotoSet);
}

function syncPhotoDots() {
  dots.forEach((dot, index) => {
    const hasPhoto = index < activePhotoSet.length;
    dot.classList.toggle("active", index === activePhotoIndex && hasPhoto);
    dot.disabled = !hasPhoto;
    dot.setAttribute("aria-label", hasPhoto ? `배경 사진 ${index + 1}` : `배경 사진 ${index + 1} 없음`);
  });
}

function pickScenePhoto(sceneId) {
  if (!backgroundArchiveLoaded || !weatherResolved) return "";

  ensurePhotoSet(sceneId);
  if (activePhotoSet.length === 0) return "";

  if (Date.now() >= manualPhotoUntil) {
    const nextSlot = photoRotationSlot();
    if (activePhotoSlot !== nextSlot) {
      activePhotoIndex = Number(nextSlot) % activePhotoSet.length;
      activePhotoSlot = nextSlot;
    }
  }

  const photo = activePhotoSet[activePhotoIndex];
  lastScenePhoto[sceneId] = imageUrl(photo);
  return photo;
}

function selectPhotoIndex(index) {
  if (!activePhotoSet.length) return;
  activePhotoIndex = (index + activePhotoSet.length) % activePhotoSet.length;
  manualPhotoUntil = Date.now() + 15 * 60 * 1000;
  activePhotoSlot = photoRotationSlot();
  setScene(activeScene || getSceneForHour(new Date().getHours()), { syncDots: true, force: true });
}

function movePhoto(direction) {
  selectPhotoIndex(activePhotoIndex + direction);
}

function shouldRotatePhoto() {
  return Date.now() >= manualPhotoUntil && activePhotoSet.length > 0 && activePhotoSlot !== photoRotationSlot();
}

function animateDigit(element) {
  window.clearTimeout(element.flipTimer);
  element.classList.remove("is-flipping");
  element.offsetHeight;
  element.classList.add("is-flipping");
  element.flipTimer = window.setTimeout(() => {
    element.classList.remove("is-flipping");
  }, 640);
}

function renderTime(now = new Date()) {
  const hour = padTime(now.getHours());
  const minute = padTime(now.getMinutes());
  const nextDigits = [hour[0], hour[1], minute[0], minute[1]];

  nextDigits.forEach((digit, index) => {
    if (lastDigits[index] !== digit) {
      const previousDigit = lastDigits[index] || digit;
      digitElements[index].dataset.prev = previousDigit;
      digitElements[index].dataset.next = digit;
      digitElements[index].textContent = digit;
      if (timeHasRendered) {
        animateDigit(digitElements[index]);
      }
    }
  });

  lastDigits = nextDigits;
  timeHasRendered = true;
  renderDate(now);
  if (Date.now() >= manualSceneUntil) {
    const nextScene = getSceneForHour(now.getHours());
    setScene(nextScene, { syncDots: true, force: activeScene === nextScene && shouldRotatePhoto() });
  }
}

function renderDate(now) {
  const monthDay = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric"
  }).format(now);
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    weekday: "short"
  }).format(now).replace("요일", "");
  setText("dateLabel", `${monthDay} (${weekday})`);
}

function setScene(sceneId, options = {}) {
  if (!scenes[sceneId] || (activeScene === sceneId && !options.force)) return;

  const scene = scenes[sceneId];
  activeScene = sceneId;
  app.dataset.scene = sceneId;
  const photo = pickScenePhoto(sceneId);
  const photoUrl = imageUrl(photo);
  app.classList.toggle("is-photo-ready", Boolean(photoUrl));
  if (photoUrl) {
    app.style.setProperty("--photo", `url("${photoUrl}")`);
    app.style.setProperty("--photo-position", photo?.photoPosition || "center center");
    app.style.setProperty("--photo-size", photo?.photoSize || "cover");
  }
  renderPhotoCredit(photo);
  syncPhotoDots();

  renderWeather();

  if (options.syncDots) {
    syncPhotoDots();
  }
}

function renderWeather() {
  app.dataset.weather = weatherState.tag;
  setText("tempLabel", weatherState.temp);
  setText("weatherSummary", weatherState.summary);

  const icon = document.getElementById("weatherIcon");
  icon.className = `mini-weather ${weatherState.icon}`;
}

function weatherCodeToSummary(code, current = {}) {
  const precipitation = currentPrecipitation(current);
  if ([45, 48].includes(code)) return "안개";
  if ([51].includes(code)) return "옅은 이슬비";
  if ([53].includes(code)) return "이슬비";
  if ([55].includes(code)) return "짙은 이슬비";
  if ([56].includes(code)) return "살짝 어는 이슬비";
  if ([57].includes(code)) return "어는 이슬비";
  if ([61, 80].includes(code)) return "약한 비";
  if ([63, 81].includes(code) && precipitation <= 0) return "간간이 약한 비";
  if ([63, 81].includes(code) && precipitation < 0.5) return "약한 비";
  if ([63, 81].includes(code)) return "비";
  if ([65, 66, 67, 82].includes(code)) return "강한 비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  // weatherCodeToTag와 동일한 실측 강수량 덮어쓰기: code가 맑음/흐림 계열이어도
  // 실제 내리는 비가 감지되면 텍스트도 비로 보여준다.
  if ([0, 1, 2, 3].includes(code)) {
    if (precipitation >= 0.5) return "비";
    if (precipitation > 0) return "약한 비";
  }
  if ([0].includes(code)) return "맑음";
  if ([1, 2].includes(code)) return "구름 약간";
  if ([3].includes(code)) return "흐림";
  return "날씨";
}

function requestCurrentWeather() {
  if (!navigator.geolocation) {
    weatherState = { location: "Seoul", temp: "--°", summary: "위치 권한 필요", icon: "sun-icon", tag: "clear" };
    weatherResolved = true;
    renderWeather();
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const { latitude, longitude } = coords;
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day,precipitation,rain,showers&timezone=auto`;
        const weatherResponse = await fetch(weatherUrl);
        const weather = await weatherResponse.json();
        const current = weather.current || {};
        const location = await reverseGeocode(latitude, longitude);

        const tag = weatherCodeToTag(current.weather_code, current);
        weatherState = {
          location,
          temp: Number.isFinite(current.temperature_2m) ? `${Math.round(current.temperature_2m)}°` : "--°",
          summary: weatherCodeToSummary(current.weather_code, current),
          icon: weatherIconFor(tag, current.is_day !== 0),
          tag
        };
      } catch (error) {
        weatherState = { location: "현재 위치", temp: "--°", summary: "날씨 오류", icon: "sun-icon", tag: "clear" };
      }
      weatherResolved = true;
      renderWeather();
      if (activeScene) setScene(activeScene, { syncDots: true, force: true });
    },
    () => {
      weatherState = { location: "Seoul", temp: "--°", summary: "위치 권한 필요", icon: "sun-icon", tag: "clear" };
      weatherResolved = true;
      renderWeather();
      if (activeScene) setScene(activeScene, { syncDots: true, force: true });
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 10 * 60 * 1000 }
  );
}

async function loadBackgroundArchive() {
  try {
    const response = await fetch("data/background-manifest.json", { cache: "no-cache" });
    if (!response.ok) {
      backgroundArchiveLoaded = true;
      return;
    }
    const data = await response.json();
    backgroundArchive = Array.isArray(data.images) ? data.images : [];
    backgroundArchiveLoaded = true;
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  } catch (error) {
    backgroundArchive = [];
    backgroundArchiveLoaded = true;
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  }
}

async function reverseGeocode(latitude, longitude) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=ko`;
    const response = await fetch(url);
    const data = await response.json();
    const address = data.address || {};
    return address.city || address.town || address.county || address.borough || address.village || "현재 위치";
  } catch (error) {
    return "현재 위치";
  }
}

function restartQuoteProgress() {
  quoteProgress.style.animation = "none";
  quoteProgress.offsetHeight;
  quoteProgress.style.animation = "";
}

function renderQuote(index) {
  const quote = index;
  quotePanel.classList.add("is-changing");

  window.setTimeout(() => {
    const englishText = quote.english || "";
    const textLength = quote.text.length + Math.floor(englishText.length * 0.55);
    quotePanel.classList.toggle("quote-long", textLength > 115);
    quotePanel.classList.toggle("quote-dense", textLength > 190);
    quotePanel.classList.toggle("has-english", Boolean(englishText));
    setText("quoteEnglish", englishText);
    setText("quoteText", quote.text);
    setText("quoteSource", `<${quote.title}> ${quote.author}`);
    quotePanel.classList.remove("is-changing");
    restartQuoteProgress();
  }, 760);
}

function shuffleQuotes(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getNextQuote() {
  const eligibleQuotes = getEligibleQuotes();
  if (quoteDeck.length === 0) {
    quoteDeck = shuffleQuotes(eligibleQuotes);
  }

  if (quoteDeck.length > 1 && quoteDeck[0].title === lastQuoteTitle) {
    const alternativeIndex = quoteDeck.findIndex((quote) => quote.title !== lastQuoteTitle);
    if (alternativeIndex > 0) {
      [quoteDeck[0], quoteDeck[alternativeIndex]] = [quoteDeck[alternativeIndex], quoteDeck[0]];
    }
  }

  const quote = quoteDeck.shift();
  lastQuoteTitle = quote.title;
  return quote;
}

function getEligibleQuotes() {
  if (selectedCategories.size === 0) return quotes;
  return quotes.filter((quote) => selectedCategories.has(quote.category));
}

function renderCategoryOptions() {
  categoryOptions.innerHTML = "";
  Object.entries(categoryLabels).forEach(([value, label]) => {
    const option = document.createElement("label");
    option.className = "field-option";
    option.innerHTML = `<input type="checkbox" value="${value}" data-category-option><span>${label}</span>`;
    categoryOptions.appendChild(option);
  });
}

function syncCategoryControls() {
  document.querySelectorAll("[data-category-option]").forEach((input) => {
    input.checked = selectedCategories.has(input.value);
  });
  allCategories.checked = selectedCategories.size === 0;
}

function loadSavedCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(categoryStorageKey) || "[]");
    if (Array.isArray(saved)) {
      selectedCategories = new Set(
        saved.filter((value) => Object.prototype.hasOwnProperty.call(categoryLabels, value))
      );
    }
  } catch (error) {
    selectedCategories = new Set();
  }
  syncCategoryControls();
  quoteDeck = [];
}

function saveSelectedCategories() {
  localStorage.setItem(categoryStorageKey, JSON.stringify([...selectedCategories]));
}

function openSettings() {
  settingsPanel.classList.add("is-open");
  settingsPanel.setAttribute("aria-hidden", "false");
  settingsOpen.setAttribute("aria-expanded", "true");
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", "true");
}

function closeSettings() {
  settingsPanel.classList.remove("is-open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsOpen.setAttribute("aria-expanded", "false");
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", "false");
}

let musicIndex = 0;
let musicPlaying = false;

const musicHistoryStorageKey = "ezlong:musicHistory";

function loadMusicHistory() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicHistoryStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((value) => Number.isInteger(value)) : [];
  } catch (error) {
    return [];
  }
}

function saveMusicHistory(history) {
  try {
    localStorage.setItem(musicHistoryStorageKey, JSON.stringify(history));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

// 재생했든(끝까지) 스킵했든 "들었다"로 기록한다. 전체 곡을 한 바퀴 다 돌기
// 전까지는 같은 곡이 다시 나오지 않도록 하기 위함(같은 곡이 자주 반복된다는 피드백 반영).
// 곡 수만큼 채워지면(=한 바퀴 완주) 다음 곡부터 새 사이클로 리셋한다.
function recordTrackHeard(index) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  let history = loadMusicHistory().filter((value) => value !== index);
  history.push(index);
  if (history.length >= musicPlaylist.length) history = [index];
  saveMusicHistory(history);
}

// 2026-07-08: 로그인 없이(디바이스 local storage 기준) "싫어요" 학습 —
// 10초 이상 들은 곡을 수동 스킵하면 그 곡을 다시 안 틀어준다. 인덱스가
// 아니라 파일명(track.file)으로 저장해야 플레이리스트 순서가 바뀌어도
// 안전하다.
const musicDislikedStorageKey = "ezlong:musicDisliked";
const musicDislikeMinSeconds = 10;

function loadDislikedTracks() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicDislikedStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((value) => typeof value === "string") : [];
  } catch (error) {
    return [];
  }
}

function saveDislikedTracks(list) {
  try {
    localStorage.setItem(musicDislikedStorageKey, JSON.stringify(list));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

// 스킵 버튼(수동)을 누른 시점에만 호출한다 — 자동 크로스페이드/종료 전환은
// "싫어요" 신호로 보지 않는다(유저가 직접 넘긴 게 아니므로).
function recordDislikeIfWarranted(player, index) {
  if (!player || !Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  if (!Number.isFinite(player.currentTime) || player.currentTime < musicDislikeMinSeconds) return;
  const track = musicPlaylist[index % musicPlaylist.length];
  if (!track || !track.file) return;
  const disliked = loadDislikedTracks();
  if (!disliked.includes(track.file)) {
    disliked.push(track.file);
    saveDislikedTracks(disliked);
  }
}

// 2026-07-08: 로그인 없이 "마지막 재생 곡/위치"를 기억해서 앱을 다시 켰을 때
// 이어들을 수 있게 한다. 이것도 파일명 기준으로 저장한다.
const musicResumeStorageKey = "ezlong:musicResume";
let lastResumeSaveAt = 0;

function loadMusicResume() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicResumeStorageKey) || "null");
    if (raw && typeof raw.file === "string" && Number.isFinite(raw.time)) return raw;
  } catch (error) {
    // 무시 — 복원 없이 그냥 새로 고른다.
  }
  return null;
}

function saveMusicResume() {
  try {
    const player = activePlayer();
    if (!player || !Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
    const track = musicPlaylist[musicIndex % musicPlaylist.length];
    if (!track || !track.file) return;
    localStorage.setItem(musicResumeStorageKey, JSON.stringify({
      file: track.file,
      time: player.currentTime || 0,
    }));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

// timeupdate마다(초당 여러 번) 매번 쓰지 않도록 5초에 한 번으로 제한한다.
// force=true는 일시정지/스킵/화면 전환처럼 "지금 확실히 저장해야 하는"
// 시점에 제한을 무시하고 즉시 저장한다.
function maybeSaveMusicResume(force = false) {
  const now = Date.now();
  if (!force && now - lastResumeSaveAt < 5000) return;
  lastResumeSaveAt = now;
  saveMusicResume();
}

function pickNextTrackIndex() {
  const total = Array.isArray(musicPlaylist) ? musicPlaylist.length : 0;
  if (total === 0) return 0;
  const heard = new Set(loadMusicHistory());
  const disliked = new Set(loadDislikedTracks());
  const isDisliked = (i) => {
    const track = musicPlaylist[i];
    return Boolean(track && track.file && disliked.has(track.file));
  };
  const unheard = [];
  for (let i = 0; i < total; i += 1) {
    if (!heard.has(i) && !isDisliked(i)) unheard.push(i);
  }
  let pool = unheard;
  if (pool.length === 0) {
    // 안 들은 곡 중 싫어요 아닌 게 없으면, 싫어요만 제외하고 전체에서 고른다.
    pool = Array.from({ length: total }, (_, i) => i).filter((i) => !isDisliked(i));
  }
  if (pool.length === 0) {
    // 모든 곡이 싫어요 처리된 극단적 경우 — 그래도 뭔가는 재생돼야 한다.
    pool = Array.from({ length: total }, (_, i) => i);
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

let musicErrorRetryCount = 0;
let stallRetryCount = 0;
let stallWatchCurrentTime = -1;
let stallWatchSince = Date.now();

// 곡 끝나기 이만큼(초) 전부터 다음 곡을 미리 재생 시작해서 겹치게(크로스페이드)
// 넘긴다. 2026-07-07: 처음엔 페이드아웃만(무음 구간 있음) 2.5초로 넣었는데
// 유저가 "그래도 끊긴다, 3.5초로 하고 바로 다음곡으로 연결해야 할 듯"이라고
// 재지적 — 페이드만 하는 게 아니라 이 시점에 실제로 다음 곡을 미리 재생
// 시작해서 무음 구간 자체가 없도록 구조를 바꿨다(ffmpeg 완전디코드로 파일
// 자체가 그 지점에서 끝나는 것 자체는 이미 확인됨 — 버그가 아니라 편집).
// 2026-07-07 재조정: iOS 앱에서 페이드 없이 뚝 끊긴다는 재지적 — 0.5초
// 앞당겨 4초로 늘려서 크로스페이드가 트리거될 여유를 더 준다.
const musicFadeOutSeconds = 4;

// 2026-07-07 추가: "정말 한 번도 볼륨이 줄어드는 느낌이 없었다"는 재지적을
// 계속 받아서 재조사한 결과, 볼륨 자체(GainNode)는 문제가 아니라 크로스페이드
// 트리거 조건(remaining <= musicFadeOutSeconds)이 애초에 걸리지 않았을
// 가능성이 가장 유력하다는 결론에 도달했다 — player.duration이 네트워크
// 스트리밍 도중 안정적으로 잡히지 않으면(hasDuration=false) 이 함수가 매번
// 조기 return되어 크로스페이드 자체가 시작도 못 한다. 이번엔 다음 곡을 훨씬
// 여유 있게(끝나기 18초 전) 통째로 미리 받아두는 방식으로 바꿔서, 그 시점의
// duration은 완전히 로컬에 있는 blob 기준이라 네트워크와 무관하게 확실히
// 잡힌다. musicFadeOutSeconds(4초)는 여전히 "언제부터 볼륨을 실제로 줄이기
// 시작할지"의 타이밍으로 그대로 쓰고, 이 값은 "언제부터 다음 곡을 미리
// 받기 시작할지"를 가리키는 별도의, 더 이른 시점이다.
const musicPrebufferLeadSeconds = 18;

// 두 개의 <audio>를 번갈아 쓴다 — 하나(activePlayer)가 페이드아웃되는 동안
// 다른 하나(standbyPlayer)가 이미 다음 곡을 재생 중이어야 겹치는 소리가
// 난다. 곡이 끝나면 역할만 서로 바꾼다(swap), 새로 로드하지 않는다.
const musicPlayers = [bgAudio, bgAudioB].filter(Boolean);
let activePlayerIndex = 0;
let crossfadeTriggered = false;
let pendingNextIndex = -1;

function activePlayer() {
  return musicPlayers[activePlayerIndex] || bgAudio;
}

function standbyPlayer() {
  if (musicPlayers.length < 2) return null;
  return musicPlayers[1 - activePlayerIndex];
}

// 2026-07-07: "크로스페이드가 볼륨이 줄어드는 느낌이 전혀 없이 뚝 끊긴다"는
// 반복된 재지적의 진짜 원인 — iOS Safari/WKWebView는 HTMLMediaElement의
// .volume 프로퍼티를 조용히 무시한다(하드웨어 볼륨 버튼만 존중하도록 iOS 5
// 시절부터 의도된 플랫폼 제약. 에러도 안 뜨고 그냥 아무 효과가 없다).
// 그래서 지금까지 player.volume = t로 아무리 값을 바꿔도 두 트랙이 항상
// 풀볼륨으로 겹쳐 재생되다가 첫 트랙이 ended되며 뚝 끊기는 것처럼 들렸던
// 것이다. Web Audio API의 GainNode는 iOS에서도 정상적으로 볼륨을 조절하는
// 표준 우회법이라, 볼륨 제어를 전부 여기로 옮긴다.
let audioContext = null;
let playerGainNodes = null; // musicPlayers와 같은 순서의 GainNode 배열

function ensureAudioGraph() {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return; // 극히 예외적으로 없는 환경 — setPlayerVolume이 .volume으로 폴백
  try {
    audioContext = new AudioContextClass();
    playerGainNodes = musicPlayers.map((player) => {
      const source = audioContext.createMediaElementSource(player);
      const gain = audioContext.createGain();
      source.connect(gain);
      gain.connect(audioContext.destination);
      return gain;
    });
  } catch (error) {
    audioContext = null;
    playerGainNodes = null;
  }
}

function setPlayerVolume(player, value) {
  const index = musicPlayers.indexOf(player);
  if (playerGainNodes && playerGainNodes[index]) {
    playerGainNodes[index].gain.value = value;
    return;
  }
  player.volume = value; // Web Audio API를 못 쓰는 환경(구형 브라우저 등)의 폴백
}

function resetActiveWatchState() {
  musicErrorRetryCount = 0;
  stallRetryCount = 0;
  stallWatchCurrentTime = -1;
  stallWatchSince = Date.now();
}

// 2026-07-07 재작성: 진행형 스트리밍(player.src = url)은 네트워크 상황에 따라
// (1) 재생 20초 지점에서 몇 초씩 멈추는 버퍼링 정지, (2) duration/loadedmetadata가
// 안정적으로 안 잡혀 크로스페이드 트리거 자체가 못 걸리는 문제, 두 가지의
// 공통 원인으로 보인다. 파일 전체를 fetch로 통째로 받아 Blob URL로 재생하면
// 재생 시작 이후로는 완전히 로컬 데이터라 두 문제 모두 원천적으로 사라진다.
// prebuffer:false는 옛 방식(즉시 스트리밍) 폴백 — 지금은 모든 호출부가
// prebuffer:true를 쓴다.
// 트랙 하나의 실제 재생 URL을 계산한다(상대경로 또는 musicSourceBaseUrl
// 기준 CDN 경로). 네이티브 브릿지(백그라운드 그림자 재생기)에도 그대로
// 재사용한다 — 두 군데서 URL 계산 방식이 어긋나지 않게 여기 한 곳에만 둔다.
function resolveTrackUrl(track) {
  const base = typeof musicSourceBaseUrl === "string" ? musicSourceBaseUrl.trim() : "";
  const fileName = track.file.replace(/^assets\/music\//, "");
  return base ? `${base.replace(/\/$/, "")}/${fileName}` : track.file;
}

// 네이티브 쪽(별도 프로세스)은 페이지의 상대경로 개념이 없으므로, 반드시
// 완전한 절대 URL(https://...)로 변환해서 넘겨줘야 한다.
function resolveTrackAbsoluteUrl(track) {
  try {
    return new URL(resolveTrackUrl(track), window.location.href).href;
  } catch (error) {
    return resolveTrackUrl(track);
  }
}

async function loadMusicTrack(player, index, { prebuffer = true } = {}) {
  if (!player || !Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  setPlayerVolume(player, 1);
  const track = musicPlaylist[index % musicPlaylist.length];
  const url = resolveTrackUrl(track);

  delete player.dataset.cachedDuration;
  player.addEventListener("loadedmetadata", function onCacheDuration() {
    if (Number.isFinite(player.duration) && player.duration > 0) {
      player.dataset.cachedDuration = String(player.duration);
    }
  }, { once: true });

  if (!prebuffer) {
    player.src = url;
    return;
  }

  player.dataset.pendingUrl = url;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`music fetch failed: ${response.status}`);
    const blob = await response.blob();
    // fetch가 진행되는 동안 같은 player에 더 최신 로드 요청이 들어왔다면
    // (예: 스킵을 연타) 이 결과는 버리고 최신 요청 결과만 반영되게 한다.
    if (player.dataset.pendingUrl !== url) return;
    const objectUrl = URL.createObjectURL(blob);
    if (player.dataset.blobUrl) URL.revokeObjectURL(player.dataset.blobUrl);
    player.dataset.blobUrl = objectUrl;
    player.src = objectUrl;
  } catch (error) {
    // fetch 실패(오프라인 등) 시 예전처럼 직접 스트리밍 URL로 폴백 —
    // 최소한 재생 자체는 되게 한다.
    if (player.dataset.pendingUrl === url) player.src = url;
  }
}

async function updateMusicProgress(event) {
  const player = event ? event.target : activePlayer();
  if (player !== activePlayer()) return; // standby(미리 준비 중인 다음곡)의 timeupdate는 무시
  if (!musicToggle || !player) return;
  maybeSaveMusicResume(); // 5초에 한 번, 재생 위치를 로그인 없이 기억해둔다.
  // player.duration이 일시적으로 NaN/Infinity가 되는 환경 대비 — loadMusicTrack의
  // loadedmetadata 시점에 캐싱해둔 값을 폴백으로 쓴다(위 loadMusicTrack 주석 참조).
  const liveDuration = player.duration;
  const duration = Number.isFinite(liveDuration) && liveDuration > 0
    ? liveDuration
    : parseFloat(player.dataset.cachedDuration || "NaN");
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const progress = hasDuration
    ? Math.min(1, Math.max(0, player.currentTime / duration))
    : 0;
  // 5차 수정(2026-07-07): border-width 두께 변화(2~4차 시도)가 실기기에서
  // 여전히 안 보인다는 재지적 — border 두께 조절 자체를 버리고, 프로그레스
  // 링에 흔히 쓰는 conic-gradient 채움 방식으로 교체(styles.css 참조).
  // 여긴 0~1 진행률 숫자만 넘기면 된다.
  musicToggle.style.setProperty("--progress", String(progress));

  if (!hasDuration) return;
  const remaining = duration - player.currentTime;
  const standby = standbyPlayer();

  // 1단계 — 여유 있게(끝나기 18초 전) 다음 곡 전체를 미리 통째로 받아둔다.
  // 이렇게 받은 blob은 그 자체가 완전한 로컬 파일이라 duration/loadedmetadata가
  // 네트워크 상태와 무관하게 즉시, 확실하게 잡힌다 — 아래 2단계 크로스페이드
  // 트리거가 "duration을 못 믿어서 아예 안 걸리는" 문제 자체를 없앤다.
  if (pendingNextIndex < 0 && standby && remaining <= musicPrebufferLeadSeconds) {
    pendingNextIndex = pickNextTrackIndex();
    recordTrackHeard(pendingNextIndex);
    standby._pendingLoad = loadMusicTrack(standby, pendingNextIndex, { prebuffer: true });
  }

  // 2단계 — 실제 크로스페이드 시작(끝나기 4초 전). 1단계에서 이미 준비
  // 중이던(또는 이미 완료된) standby를 그대로 쓴다.
  if (!crossfadeTriggered && standby && pendingNextIndex >= 0 && remaining <= musicFadeOutSeconds && remaining > 0.05) {
    crossfadeTriggered = true;
    if (standby._pendingLoad) {
      try { await standby._pendingLoad; } catch (error) { /* 폴백은 loadMusicTrack 내부에서 처리됨 */ }
    }
    setPlayerVolume(standby, 0);
    standby.play().catch(() => {});
  }

  if (crossfadeTriggered && standby) {
    const t = Math.max(0, Math.min(1, remaining / musicFadeOutSeconds)); // 1 → 0으로 줄어듦
    setPlayerVolume(player, t);
    setPlayerVolume(standby, 1 - t);
  } else {
    setPlayerVolume(player, 1);
  }
}

// error/ended 어느 쪽도 안 뜨고 재생위치가 그대로 멈춰있는 "조용한 정지"를
// 잡아내는 watchdog. 6초 동안 currentTime이 안 움직이면 멈춘 것으로 보고
// 먼저 load()+같은 위치 재생을 두 번까지 시도하고, 그래도 안 되면 다음
// 곡으로 넘긴다(무한정 멈춰있는 것보단 낫다).
function musicStallWatchdog() {
  const player = activePlayer();
  if (!player || !musicPlaying || player.paused) {
    stallRetryCount = 0;
    stallWatchCurrentTime = -1;
    return;
  }
  const now = Date.now();
  const current = player.currentTime;
  if (Math.abs(current - stallWatchCurrentTime) > 0.4) {
    stallWatchCurrentTime = current;
    stallWatchSince = now;
    stallRetryCount = 0;
    return;
  }
  if (now - stallWatchSince < 6000) return;
  stallWatchSince = now;
  if (stallRetryCount >= 2) {
    stallRetryCount = 0;
    playNextTrack();
    return;
  }
  stallRetryCount += 1;
  const savedTime = current;
  player.load();
  player.currentTime = savedTime;
  player.play().catch(() => {});
}

function renderMusicToggle() {
  if (!musicToggle) return;
  musicToggle.classList.toggle("is-playing", musicPlaying);
  musicToggle.setAttribute("aria-pressed", String(musicPlaying));
  musicToggle.setAttribute("aria-label", musicPlaying ? "음악 일시정지" : "음악 재생");
  renderMusicHistoryList(); // 재생/일시정지에 따라 "바로 듣기"/"재생 중" 라벨도 같이 갱신한다.
  sendNativeHeartbeat(); // 재생 상태가 바뀌는 즉시 네이티브 쪽 캐시도 최신으로 — 2초 주기를 기다리지 않는다.
}

// 에러 이벤트도, ended 이벤트도 없이 재생이 조용히 멈추는 증상이 있었다
// (2026-07-07 유저 리포트: "에러메시지도 안 뜨고 그냥 멈춘다. 재생 버튼
// 눌러도 재생이 안 된다"). 이건 브라우저가 error를 던지지 않고 그냥
// 버퍼링에서 멈춰버리는 경우라, 위 watchdog으로 별도 감지한다.
// 그리고 멈춘 상태에서 재생 버튼을 눌렀을 때 단순히 play()만 다시 부르면
// 똑같이 막힌 상태라 반응이 없었을 것 — 실패하면 load()로 리셋 후 같은
// 위치에서 재시도하도록 바꾼다.
async function playMusic() {
  // 유저의 실제 탭(toggleMusic 클릭)으로만 호출되는 지점이라, iOS가 요구하는
  // "사용자 제스처 안에서" AudioContext를 만들고 깨우는 조건을 만족한다.
  ensureAudioGraph();
  // 2026-07-08 버그 수정: 에어팟을 뺐다 다시 끼우는 등 오디오 라우트가
  // 바뀐 직후엔 AudioContext가 suspended 상태로 남아있는 경우가 있다.
  // 예전엔 resume()을 기다리지 않고(fire-and-forget) 곧바로 player.play()를
  // 불렀는데, resume()이 아직 끝나기 전에 재생이 시작되면 <audio> 엘리먼트
  // 자체는 "재생 중"이 되지만 GainNode(볼륨 담당) 뒤쪽 AudioContext가 아직
  // 안 살아있어서 소리가 전혀 안 나는 상태가 됐다 — 버튼은 "일시정지"로
  // 바뀌는데 실제 소리는 없어서 다시 눌러야만 재생되는 증상의 원인이었다.
  // resume()을 확실히 기다린 뒤에 play()를 호출한다.
  // 2026-07-08 재수정: 에어팟을 뺐다 다시 끼우는 재검증에서 "재생 버튼을
  // 눌러도 소리가 전혀 안 나고, 일시정지→재생을 몇 번 반복해야 겨우
  // 소리가 난다"는 증상이 남아있었다 — state === "suspended"만 체크했는데,
  // iOS WebKit은 오디오 라우트가 끊겼다가 복구되는 구간에서 AudioContext를
  // "suspended"가 아닌 다른 비-running 상태로 두는 경우가 있어(예:
  // "interrupted") 이 조건에 안 걸려 resume()이 호출되지 않았다. "running"이
  // 아니면 무조건 resume을 시도하도록 조건을 넓힌다 — resume()은 이미
  // running인 컨텍스트에 불러도 안전하므로 넓혀도 부작용이 없다.
  if (audioContext && audioContext.state !== "running") {
    try { await audioContext.resume(); } catch (error) { /* 실패해도 아래에서 play 자체는 시도한다 */ }
  }
  const player = activePlayer();
  if (!player) return;
  if (!player.src && !player._pendingLoad) {
    // 앱 실행 직후 prefetchFirstTrack()이 이미 이 트랙을 미리 받고 있는
    // 중이라면(_pendingLoad) 여기서 새로 고르지 않고 그 결과를 그대로 쓴다.
    musicIndex = pickNextTrackIndex();
    recordTrackHeard(musicIndex);
    recordPlayLog(musicIndex);
    renderMusicPlaylistInfo();
    renderMusicHistoryList();
    player._pendingLoad = loadMusicTrack(player, musicIndex, { prebuffer: true });
  }
  resetActiveWatchState();
  if (musicToggle) musicToggle.style.setProperty("--progress", "0");
  if (player._pendingLoad) {
    try { await player._pendingLoad; } catch (error) { /* 폴백은 loadMusicTrack 내부에서 처리됨 */ }
  }
  const resumeFrom = player.currentTime;
  player.play().catch(() => {
    const savedTime = resumeFrom;
    player.load();
    player.currentTime = savedTime;
    player.play().catch(() => {
      musicPlaying = false;
      renderMusicToggle();
    });
  });
}

function pauseMusic() {
  maybeSaveMusicResume(true); // 멈추는 순간 위치를 확실히 저장해둔다.
  activePlayer()?.pause();
  standbyPlayer()?.pause();
}

// 2026-07-08: iOS 네이티브 래퍼(WKWebView)에서 "다른 앱으로 전환하면 음악이
// 멈춘다"는 문제 대응. WKWebView 내부 HTML5 <audio>는 AVAudioSession
// 카테고리/백그라운드 모드를 앱 쪽에서 아무리 올바르게 설정해도, 앱이
// 백그라운드로 가는 순간 오디오 자체가 조용히 정지되는 경우가 있다(WebKit이
// 자체적으로 미디어를 서스펜드하는 알려진 동작). 이를 우회하기 위해 네이티브
// 쪽에 무음 오디오를 계속 흘려보내 오디오 세션을 "재생 중" 상태로 유지시키는
// 트릭을 쓴다 — 실제 음악 재생/정지 상태와 동기화해서 켜고 끈다(유저가
// 재생을 누르지 않았는데도 앱이 오디오를 재생 중인 것처럼 보이는 걸 막기
// 위해). 일반 브라우저(웹)에서는 window.webkit이 없으므로 아무 동작도
// 하지 않는다 — 웹 동작에는 영향 없음.
function notifyNativeAudioKeepAlive(isPlaying) {
  try {
    window.webkit.messageHandlers.flipzenAudioKeepAlive.postMessage(
      isPlaying ? "start" : "stop"
    );
  } catch (error) {
    // 네이티브 래퍼가 아니면(일반 웹) 핸들러가 없어 여기로 떨어진다 — 정상.
  }
}

function toggleMusic() {
  musicPlaying = !musicPlaying;
  if (musicPlaying) playMusic(); else pauseMusic();
  renderMusicToggle();
  notifyNativeAudioKeepAlive(musicPlaying);
}

// 2026-07-08 재설계: 무음 킵얼라이브 트릭만으로는 실기기 테스트 결과
// 백그라운드 음악이 계속 재생되지 않는 것으로 확인됐다 — WKWebView가 앱
// 백그라운드 전환 시 HTML5 <audio> 자체를 정지시키는 구조적 한계로 보인다.
// 처음엔 visibilitychange 시점에 JS가 네이티브로 "지금 곡/위치"를 보내
// 그림자 재생(BackgroundShadowPlayer)을 그 순간에 새로 시작시키려 했는데,
// 실기기 재테스트 결과 여전히 백그라운드 전환 즉시 소리가 끊겼다 — 앱이
// 백그라운드로 넘어가는 순간 WKWebView의 WebContent 프로세스 자체가
// 거의 즉시 멈춰버려서, 그 타이밍에 새로 보내는 postMessage가 네이티브에
// 도착하기도 전에 오디오가 이미 끊긴 것으로 보인다(JS 왕복에 의존한 게
// 원인). 그래서 트리거 방식을 바꾼다 — 재생 중인 동안 2초마다 "지금 곡
// URL/위치"를 네이티브에 미리 흘려보내두고(heartbeat), 네이티브 쪽이 앱
// 생명주기 알림(didEnterBackground)을 직접 감지해서 그 시점에 가장 최근
// heartbeat 값으로 즉시 그림자 재생을 시작한다 — 이제 그 순간에 JS 왕복을
// 기다릴 필요가 없어서 타이밍 경쟁 자체가 사라진다. 기존 크로스페이드·
// 다음곡 선택·싫어요 학습 로직은 전혀 건드리지 않는다.
function sendNativeHeartbeat() {
  try {
    if (!musicPlaying || !Array.isArray(musicPlaylist) || musicPlaylist.length === 0) {
      window.webkit.messageHandlers.flipzenShadowPlayer.postMessage({ action: "heartbeat", playing: false });
      return;
    }
    const player = activePlayer();
    const track = musicPlaylist[musicIndex % musicPlaylist.length];
    if (!player || !track) return;
    window.webkit.messageHandlers.flipzenShadowPlayer.postMessage({
      action: "heartbeat",
      playing: true,
      url: resolveTrackAbsoluteUrl(track),
      time: player.currentTime || 0,
    });
  } catch (error) {
    // 네이티브 래퍼가 아니면(일반 웹) 핸들러가 없어 여기로 떨어진다 — 정상.
  }
}

// 네이티브가 그림자 재생을 끝내면서(포그라운드 복귀 시) 마지막으로 재생
// 중이던 위치를 알려준다 — HTML5 오디오를 그 근처로 맞춰서 이어받는다.
// 백그라운드 앰비언트 성격이라 초 단위까지 정확히 맞을 필요는 없다.
// 2026-07-08 버그 수정: 이 콜백이 자동으로 seek+play를 실행했는데, 그림자
// 재생이 사실상 제대로 시작도 못 한 채 바로 종료되는 경우가 대부분이라
// finalTime 자체가 신뢰할 만한 위치가 아니었다. 게다가 유저가 포그라운드로
// 돌아와 직접 재생 버튼을 누르는 시점과 이 콜백이 거의 동시에 실행되면서,
// 서로 다른 위치로 seek하고 각자 play()를 부르는 두 흐름이 충돌해 소리가
// 겹치며 씹히는 새 버그가 생겼다. 그림자 재생 기능 자체가 아직 안정적으로
// 동작하지 않는 상태이므로, 이 콜백은 당분간 아무 것도 하지 않는다 — 재생
// 시작은 항상 유저의 명시적 탭에서만 일어나게 한다(네이티브는 여전히 이
// 함수를 호출하지만, 정의돼 있으니 에러 없이 조용히 무시된다).
window.__flipzenShadowStopped = function () {};

// 스킵 버튼(수동)은 크로스페이드 없이 즉시 곡을 바꾼다 — 유저가 직접 누른
// 즉각 반응이 우선이고, 곡이 끝나기 전 자동 전환과는 성격이 다르다.
//
// 2026-07-08 버그 수정: "재생 중에는 스킵이 안 먹힌다(멈춤 상태에서는
// 먹힌다)" — 예전 코드는 전체 파일을 fetch로 통째로 받는(prebuffer)
// 작업이 끝나길 await한 뒤에야 player.play()를 불렀다. 그 await(네트워크
// 요청, 파일 크기에 따라 수백ms~수초) 동안 iOS는 이 클릭을 "유저 제스처"로
// 인정하는 유효 구간을 지나쳐버려서, 이후의 play() 호출이 아무 에러 없이
// 조용히 무시됐다. 멈춤 상태에서 스킵을 누르면 재생 자체는 안 하고 다음
// 트랙만 준비해두고 끝나서, 나중에 재생 버튼을 누르는 "새로운" 제스처가
// play()를 불러 문제가 없었던 것 — 그래서 딱 "재생 중에만" 증상이 있었다.
// 고친 방법: loadMusicTrack을 prebuffer:false로 불러 await 없이(같은 함수
// 안에서 네트워크를 기다리지 않고) 곧바로 player.src를 스트리밍 URL로
// 세팅하고, 그 즉시(제스처가 아직 살아있는 채로) player.play()를 부른다.
async function playNextTrack() {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  crossfadeTriggered = false;
  pendingNextIndex = -1;
  const standby = standbyPlayer();
  if (standby) {
    standby.pause();
    standby.removeAttribute("src");
    // 백그라운드로 이 standby를 향해 이미 날아가고 있던 prebuffer fetch가
    // 있었다면, 그 결과가 나중에 도착했을 때 방금 지운 src를 도로 채워
    // 넣지 못하도록 대상 URL 표식을 함께 지운다.
    delete standby.dataset.pendingUrl;
  }
  const player = activePlayer();
  musicIndex = pickNextTrackIndex();
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  renderMusicHistoryList();
  resetActiveWatchState();
  if (musicToggle) musicToggle.style.setProperty("--progress", "0");
  if (player.dataset.blobUrl) {
    URL.revokeObjectURL(player.dataset.blobUrl);
    delete player.dataset.blobUrl;
  }
  delete player.dataset.pendingUrl;
  player._pendingLoad = null;
  loadMusicTrack(player, musicIndex, { prebuffer: false });
  if (musicPlaying) {
    player.play().catch(() => {});
  }
}

// 자동 종료(곡이 끝) 처리 — 크로스페이드가 이미 걸려서 standby가 겹쳐
// 재생 중이었다면 역할만 바꾼다(새로 로드하지 않으니 무음 구간이 없다).
// 크로스페이드가 못 걸린 예외적인 경우(길이 정보를 못 받았거나 페이드
// 구간을 놓친 경우)에만 기존처럼 즉시 다음 곡을 새로 로드한다.
function handleActivePlayerEnded(event) {
  const player = event.target;
  if (player !== activePlayer()) return;
  const standby = standbyPlayer();
  if (crossfadeTriggered && standby && pendingNextIndex >= 0) {
    player.pause();
    player.currentTime = 0;
    activePlayerIndex = 1 - activePlayerIndex;
    musicIndex = pendingNextIndex;
    pendingNextIndex = -1;
    recordPlayLog(musicIndex);
    renderMusicPlaylistInfo();
    renderMusicHistoryList();
    crossfadeTriggered = false;
    setPlayerVolume(activePlayer(), 1);
    // 방어 코드(2026-07-07): 위 updateMusicProgress에서 걸었던 standby.play()가
    // 어떤 이유로든(iOS 앱 환경 등) 실제로는 재생을 못 시작했을 경우를 대비해,
    // 역할을 바꾼 새 activePlayer가 확실히 재생 중인 상태로 만든다. 이미
    // 재생 중이면 이 호출은 사실상 아무 효과가 없어 무해하다.
    activePlayer().play().catch(() => {});
    resetActiveWatchState();
    return;
  }
  playNextTrack();
}

// 2026-07-08: "지금 재생 중인 곡이 뭔지 궁금하다"는 질문에 답할 방법이
// 화면 어디에도 없었다(재생/스킵 버튼만 있고 곡명 표시가 없었음) — 음악
// 설정 패널에 이미 있던 총 곡수 안내에 현재 곡 제목을 덧붙인다.
function renderMusicPlaylistInfo() {
  if (!musicPlaylistInfo) return;
  const total = Array.isArray(musicPlaylist) ? musicPlaylist.length : 0;
  const track = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  if (track && track.title) {
    const variant = track.playlist && track.playlist !== "SINGLE" ? ` (${track.playlist})` : "";
    musicPlaylistInfo.textContent = `지금 재생 중: ${track.title}${variant} · 전체 ${total}곡`;
  } else {
    musicPlaylistInfo.textContent = `기본 플레이리스트 · 총 ${total}곡`;
  }
}

// 2026-07-08: "지금 재생 중" 표시만으로는 방금 지나간 곡을 다시 찾아 듣기
// 어렵다는 요청 — 실제로 재생 대상이 된 곡을 최신순으로 기록해두고, 음악
// 설정 패널에 목록으로 보여주며 곡마다 "바로 듣기" 버튼을 붙인다.
const musicPlayLogStorageKey = "ezlong:musicPlayLog";
const musicPlayLogMax = 30;

function loadMusicPlayLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicPlayLogStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((entry) => entry && typeof entry.file === "string") : [];
  } catch (error) {
    return [];
  }
}

function saveMusicPlayLog(log) {
  try {
    localStorage.setItem(musicPlayLogStorageKey, JSON.stringify(log));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체에는 지장이 없어야 한다.
  }
}

// 같은 곡을 다시 들으면 중복으로 쌓지 않고 맨 위로 올린다(흔한 "최근 재생" UX 관례).
function recordPlayLog(index) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const track = musicPlaylist[index % musicPlaylist.length];
  if (!track || !track.file) return;
  let log = loadMusicPlayLog().filter((entry) => entry.file !== track.file);
  log.unshift({ file: track.file, title: track.title || track.file, playlist: track.playlist || "", at: Date.now() });
  if (log.length > musicPlayLogMax) log = log.slice(0, musicPlayLogMax);
  saveMusicPlayLog(log);
}

function renderMusicHistoryList() {
  if (!musicHistoryList) return;
  const log = loadMusicPlayLog();
  if (log.length === 0) {
    musicHistoryList.innerHTML = '<li class="settings-desc settings-desc-muted">아직 재생 기록이 없습니다.</li>';
    return;
  }
  const currentTrack = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  musicHistoryList.innerHTML = log.map((entry) => {
    const isCurrent = Boolean(currentTrack && currentTrack.file === entry.file);
    const variant = entry.playlist && entry.playlist !== "SINGLE" ? ` (${entry.playlist})` : "";
    const buttonLabel = isCurrent && musicPlaying ? "재생 중" : "바로 듣기";
    return `<li class="music-history-item${isCurrent ? " is-current" : ""}">`
      + `<span class="music-history-title">${entry.title}${variant}</span>`
      + `<button type="button" class="music-history-play" data-history-file="${entry.file}">${buttonLabel}</button>`
      + `</li>`;
  }).join("");
}

// 히스토리 목록의 "바로 듣기" 버튼 — 스킵 버튼과 같은 방식(크로스페이드 없이
// 즉시 전환)으로 유저가 지정한 곡으로 바로 바꾼다. playNextTrack과 전환
// 로직은 같고, 다음 곡을 무작위로 고르는 대신 지정된 파일을 찾아 튼다는
// 점만 다르다 — 기존 playNextTrack은 그대로 두고 별도 함수로 추가해서
// (현재 실기기 검증 대기 중인) 기존 재생 전환 로직에 영향을 주지 않는다.
function playTrackFromHistory(file) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const index = musicPlaylist.findIndex((track) => track && track.file === file);
  if (index < 0) return;
  crossfadeTriggered = false;
  pendingNextIndex = -1;
  const standby = standbyPlayer();
  if (standby) {
    standby.pause();
    standby.removeAttribute("src");
    delete standby.dataset.pendingUrl;
  }
  const player = activePlayer();
  musicIndex = index;
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  resetActiveWatchState();
  if (musicToggle) musicToggle.style.setProperty("--progress", "0");
  if (player.dataset.blobUrl) {
    URL.revokeObjectURL(player.dataset.blobUrl);
    delete player.dataset.blobUrl;
  }
  delete player.dataset.pendingUrl;
  player._pendingLoad = null;
  loadMusicTrack(player, musicIndex, { prebuffer: false });
  musicPlaying = true;
  player.play().catch(() => {});
  renderMusicToggle();
  notifyNativeAudioKeepAlive(true);
}

if (musicHistoryList) {
  musicHistoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-file]");
    if (!button) return;
    playTrackFromHistory(button.dataset.historyFile);
  });
}

function applyCategorySelection() {
  selectedCategories = new Set(
    [...document.querySelectorAll("[data-category-option]:checked")].map((input) => input.value)
  );
  allCategories.checked = selectedCategories.size === 0;
  quoteDeck = [];
  lastQuoteTitle = "";
  renderQuote(getNextQuote());
}

function rotateQuote(now = new Date()) {
  const minuteKey = Math.floor(now.getTime() / 60000);
  if (minuteKey === activeQuoteMinute) return;

  activeQuoteMinute = minuteKey;
  renderQuote(getNextQuote());
}

function tick() {
  const now = new Date();
  renderTime(now);
  rotateQuote(now);
}

dots.forEach((dot) => {
  dot.addEventListener("click", () => selectPhotoIndex([...dots].indexOf(dot)));
});

if (skyRoom) {
  skyRoom.addEventListener("touchstart", (event) => {
    const touch = event.touches[0];
    swipeStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });

  skyRoom.addEventListener("touchend", (event) => {
    if (!swipeStart) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - swipeStart.x;
    const dy = touch.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    movePhoto(dx < 0 ? 1 : -1);
  }, { passive: true });
}

// 2026-07-08: 우측 상단 "ezlong.com" 글자를 탭하면, 위로 스와이프했을 때와
// 같은 목적지(ezlong-webview 섹션)로 이동하되 플립시계 컨셉에 맞는 "위로
// 플립" 연출을 더해서 이동한다. 실제 페이지 전환은 이미 있는 scroll-snap
// 스크롤을 그대로 쓰고(styles.css .clock-app/.sky-room 참조), 그 위에
// sky-room을 카드처럼 위로 젖히는 3D 회전 애니메이션만 얹는다.
if (appBrand && skyRoom && ezlongSection) {
  appBrand.addEventListener("click", () => {
    if (skyRoom.classList.contains("is-flipping-away")) return; // 연타 방지
    skyRoom.classList.add("is-flipping-away");
    window.setTimeout(() => {
      ezlongSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 260); // 회전이 절반쯤 진행됐을 때 스크롤을 시작해 자연스럽게 이어지게 한다.
    window.setTimeout(() => {
      skyRoom.classList.remove("is-flipping-away");
    }, 900); // 화면 밖으로 충분히 벗어난 뒤 원상태로 리셋(다음에 다시 볼 때 정상 모습).
  });
}

renderCategoryOptions();
loadSavedCategories();
renderMusicPlaylistInfo();
renderMusicToggle();
settingsOpen.addEventListener("click", openSettings);
settingsSave.addEventListener("click", () => {
  saveSelectedCategories();
  closeSettings();
});
document.querySelectorAll("[data-settings-close]").forEach((element) => {
  element.addEventListener("click", closeSettings);
});
if (musicSettingsOpen) musicSettingsOpen.addEventListener("click", openSettings);
if (musicToggle) musicToggle.addEventListener("click", toggleMusic);
if (musicSkip) musicSkip.addEventListener("click", () => {
  // playNextTrack()이 musicIndex/activePlayer를 바꿔버리기 전에, "지금 듣던
  // 곡"을 기준으로 싫어요 여부를 판단해야 한다.
  recordDislikeIfWarranted(activePlayer(), musicIndex);
  playNextTrack();
});
// 2026-07-07: "곡이 중간에 뚝 끊긴다"는 신고는 ffmpeg 완전디코드로 확인한
// 결과 버그가 아니었다(파일이 정말 그 지점에서 끝남) — 대신 크로스페이드로
// 무음 구간 자체를 없앴다(위 musicFadeOutSeconds 설명 참조). 두 <audio>
// 모두에 리스너를 걸고, 각 핸들러 안에서 activePlayer인지 standby인지
// 구분해서 처리한다.
musicPlayers.forEach((player) => {
  player.addEventListener("timeupdate", updateMusicProgress);
  player.addEventListener("ended", handleActivePlayerEnded);
  player.addEventListener("error", () => {
    if (player !== activePlayer()) {
      // 미리 준비 중이던 다음 곡(standby)이 로드/재생에 실패한 경우 —
      // 크로스페이드를 취소하고, 곡이 끝나는 시점에 기존 방식(즉시 새로
      // 고르기)으로 자연스럽게 되돌아가게 한다.
      crossfadeTriggered = false;
      pendingNextIndex = -1;
      return;
    }
    if (!musicPlaying) return;
    const code = player.error ? player.error.code : 0;
    const isFatal = code === 3 || code === 4; // MEDIA_ERR_DECODE / MEDIA_ERR_SRC_NOT_SUPPORTED
    if (isFatal || musicErrorRetryCount >= 1) {
      playNextTrack();
      return;
    }
    musicErrorRetryCount += 1;
    player.load();
    player.play().catch(() => playNextTrack());
  });
  // 2026-07-08 버그 수정: 에어팟을 뺐다 다시 끼우면 iOS/WKWebView가
  // <audio>를 우리 코드 호출 없이 강제로 일시정지시킨다(라우트 변경 시
  // 표준 동작). 그런데 musicPlaying 변수는 toggleMusic()을 눌렀을 때만
  // 바뀌는 구조라, 이렇게 "코드가 모르는 사이에" 멈춘 경우 musicPlaying은
  // 계속 true로 남아 재생 버튼이 계속 "일시정지" 아이콘으로 표시됐다 —
  // 그 상태에서 버튼을 눌러도 실제로는 (일시정지→재생) 순서가 아니라
  // (재생 의도인데 UI는 이미 멈춤 아이콘) 순서로 꼬여서 여러 번 눌러야
  // 겨우 재생되는 원인이 됐다. <audio> 엘리먼트가 실제로 멈추거나
  // 재생되는 순간(원인 불문)을 그대로 반영해 항상 실제 상태와 동기화한다.
  player.addEventListener("pause", () => {
    if (player !== activePlayer()) return; // 크로스페이드 전환 중 옛 active player의 의도된 pause는 무시
    if (musicPlaying) {
      musicPlaying = false;
      renderMusicToggle();
    }
  });
  player.addEventListener("playing", () => {
    if (player !== activePlayer()) return;
    if (!musicPlaying) {
      musicPlaying = true;
      renderMusicToggle();
    }
  });
});
allCategories.addEventListener("change", () => {
  if (allCategories.checked) {
    document.querySelectorAll("[data-category-option]").forEach((input) => {
      input.checked = false;
    });
    applyCategorySelection();
  } else if (selectedCategories.size === 0) {
    allCategories.checked = true;
  }
});
categoryOptions.addEventListener("change", (event) => {
  if (event.target.matches("[data-category-option]")) {
    if (event.target.checked) allCategories.checked = false;
    applyCategorySelection();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSettings();
});
window.addEventListener("resize", () => {
  syncFirstScreenHeight();
  resizeEzlongWebview();
});
window.visualViewport?.addEventListener("resize", syncFirstScreenHeight);

syncFirstScreenHeight();
resizeEzlongWebview();
loadBackgroundArchive();
tick();
requestCurrentWeather();
window.setInterval(tick, 1000);
window.setInterval(musicStallWatchdog, 2000);
window.setInterval(sendNativeHeartbeat, 2000); // 백그라운드 그림자 재생용 heartbeat — 위 sendNativeHeartbeat 주석 참조.

// 2026-07-07: 앱을 켜고 첫 곡을 재생할 때 초반 몇 초간 짧게 끊기는 증상 —
// 재생 버튼을 누른 그 순간에야 트랙 파일을 받기 시작해서 벌어지는 지연으로
// 판단, 앱이 뜨자마자(재생 버튼을 누르기 전부터) 첫 곡을 미리 로드해서
// preload="auto"가 백그라운드로 버퍼링을 시작하게 한다. 나중에 playMusic()이
// 실행될 때 player.src가 이미 채워져 있으면 새로 로드하지 않고 바로
// play()만 호출하므로, 이미 버퍼링된 상태에서 재생을 시작하게 된다.
(function prefetchFirstTrack() {
  const player = activePlayer();
  if (!player || player.src) return;
  // 2026-07-08: 로그인 없이 저장해둔 "마지막으로 듣던 곡"이 있으면 같은 곡을
  // 이어서 준비한다 — 단, 듣던 "초"까지는 맞추지 않고 항상 처음부터 재생한다.
  // (버그 수정: 예전엔 정확한 초까지 seek했는데, loadedmetadata가 늦게 와서
  // 재생 시작 후 몇 초간 진행바가 안 움직이다가 갑자기 그 지점으로 뚝
  // 끊기며 점프하는 불쾌한 증상이 있었다. 유저 피드백: "굳이 직전에 50초까지
  // 들었으면 51초부터 이어서 들을 필요는 없고, 해당 곡이면 된다" — 곡 단위
  // 이어듣기만 남기고 초 단위 탐색은 완전히 제거한다.)
  const resume = loadMusicResume();
  let resumeIndex = -1;
  if (resume && Array.isArray(musicPlaylist)) {
    const idx = musicPlaylist.findIndex((track) => track && track.file === resume.file);
    if (idx >= 0) resumeIndex = idx;
  }
  musicIndex = resumeIndex >= 0 ? resumeIndex : pickNextTrackIndex();
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  renderMusicHistoryList();
  player._pendingLoad = loadMusicTrack(player, musicIndex, { prebuffer: true });
})();

// 2026-07-08: 앱이 백그라운드로 가거나(다른 앱 전환) 아예 종료될 때도 마지막
// 재생 위치를 놓치지 않도록 강제 저장한다. timeupdate 기반 저장(5초 간격)만
// 믿으면 그 사이에 앱이 꺼질 경우 최대 5초 분량이 유실될 수 있다.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    maybeSaveMusicResume(true);
    // 그림자 재생 시작은 더 이상 여기서 트리거하지 않는다 — 네이티브가
    // 앱 생명주기 알림으로 직접 감지해서 heartbeat 캐시로 시작한다(위
    // sendNativeHeartbeat 주석 참조). 이 시점엔 위치 저장만 하면 된다.
  }
});
window.addEventListener("pagehide", () => maybeSaveMusicResume(true));
