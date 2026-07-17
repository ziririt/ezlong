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

// 2026-07-09 버그 수정: 각 장면(scene)의 로컬 폴백 사진 목록 끝에 다른
// 장면의 사진이 몇 장씩 섞여 들어가 있었다(예: night 목록 끝에
// golden-hour/morning 사진, golden-hour 목록 끝에 night/morning/midday
// 사진). 실제 아카이브에 야간·새벽 사진이 워낙 적어서(수집 자동화가
// 05~23시에만 도는 구조라 그 시간대 사진이 거의 안 쌓임) night 장면은
// 이 로컬 폴백 목록을 쓰는 비중이 매우 높은데, 그 목록 자체에 golden-hour
// 사진이 섞여 있어 "밤인데 노을/낮 사진이 나온다"는 증상으로 이어졌다.
// 각 장면 목록을 그 장면 고유 사진만 남도록 정리한다.
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
    "assets/backgrounds/morning/12.jpg"
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
    "assets/backgrounds/midday/11.jpg"
  ],
  "golden-hour": [
    "assets/bg-golden-hour.jpg",
    "assets/backgrounds/golden-hour/02.jpg",
    "assets/backgrounds/golden-hour/03.jpg",
    "assets/backgrounds/golden-hour/04.jpg",
    "assets/backgrounds/golden-hour/08.jpg",
    "assets/backgrounds/golden-hour/09.jpg",
    "assets/backgrounds/golden-hour/10.jpg"
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
    "assets/backgrounds/night/12.jpg"
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

const genreLabels = {
  investment: "투자서",
  literature: "문학·교양서"
};

function getQuoteGenre(quote) {
  return quote.genre === "literature" ? "literature" : "investment";
}

const quotes = baseQuotes.map((quote) => {
  const genre = getQuoteGenre(quote);
  return {
    ...quote,
    genre,
    // category는 투자서 문장에만 의미 있는 하위 분류다. 문학 문장까지 "mindset"
    // 같은 투자 카테고리로 강제 분류하면 카테고리 필터를 켰을 때 엉뚱하게
    // 섞여 나오므로, 문학 문장은 category를 건드리지 않는다.
    category: genre === "investment" ? getQuoteCategory(quote) : quote.category
  };
});

const app = document.querySelector(".clock-app");
const dots = document.querySelectorAll("[data-scene-button]");
const skyRoom = document.querySelector(".sky-room");
const photoCredit = document.getElementById("photoCredit");
const quotePanel = document.querySelector(".quote-panel");
const quoteProgress = document.getElementById("quoteProgress");
// 2026-07-16: 알라딘 도서 링크 — window.aladinLinks(aladin-links.js)에 매칭된
// 책만 아이콘이 보인다. quoteAladinLink.dataset.url에 현재 문장 책의 알라딘
// 링크를 저장해뒀다가 클릭 시 모달을 연다.
const quoteAladinLink = document.getElementById("quoteAladinLink");
const aladinModalPanel = document.getElementById("aladinModalPanel");
const aladinModalFrame = document.getElementById("aladinModalFrame");
const aladinModalExternalOpenEl = document.getElementById("aladinModalExternalOpen");
const settingsPanel = document.getElementById("quoteSettings");
const settingsOpen = document.getElementById("settingsOpen");
const settingsSave = document.getElementById("settingsSave");
const allCategories = document.getElementById("allCategories");
const categoryOptions = document.getElementById("categoryOptions");
const genreOptions = document.getElementById("genreOptions");
const webviewScale = document.getElementById("ezlongWebviewScale");
const ezlongSection = document.querySelector(".ezlong-webview");
const appBrand = document.querySelector(".app-brand");
const musicSettingsOpen = document.getElementById("musicSettingsOpen");
const musicToggle = document.getElementById("musicToggle");
const musicSkip = document.getElementById("musicSkip");
const musicInfoPanel = document.getElementById("musicInfoPanel");
const musicVizWrap = document.getElementById("musicVizWrap");
const musicProgressBar = document.getElementById("musicProgressBar");
const musicProgressFill = document.getElementById("musicProgressFill");
const musicTrackTitle = document.getElementById("musicTrackTitle");
const musicLikeButton = document.getElementById("musicLikeButton");
const musicDislikeButton = document.getElementById("musicDislikeButton");
const musicShuffleButton = document.getElementById("musicShuffleButton");
const musicGearOpen = document.getElementById("musicGearOpen");
const musicToast = document.getElementById("musicToast");
const musicLeaveWorkEl = document.getElementById("musicLeaveWork");
const musicPlaylistInfo = document.getElementById("musicPlaylistInfo");
const musicPlaylistOptionsEl = document.getElementById("musicPlaylistOptions");
const musicHistoryList = document.getElementById("musicHistoryList");
const musicHistoryBody = document.getElementById("musicHistoryBody");
// 2026-07-16: "Rock 포함"/"Vocal 포함"(체크 시 포함) 방식에서 "Rock 제외"/
// "Vocal 제외"(체크 시 제외) 방식으로 전환 — element id도 의미에 맞춰 변경.
const musicExcludeRockEl = document.getElementById("musicExcludeRock");
const musicExcludeVocalEl = document.getElementById("musicExcludeVocal");
// 2026-07-16: "연주곡 제외" 추가 — 보컬이 있는 카테고리(보컬/걸스록) 외에는
// 전부 연주곡이므로, isVocalCategory()의 반대 조건으로 그대로 재사용한다.
const musicExcludeInstrumentalEl = document.getElementById("musicExcludeInstrumental");
const musicQCPanel = document.getElementById("musicQCPanel");
const musicQCDeleteButton = document.getElementById("musicQCDeleteButton");
const musicQCRemovalList = document.getElementById("musicQCRemovalList");
const musicQCCopyButton = document.getElementById("musicQCCopyButton");
const bgAudio = document.getElementById("bgAudio");
const bgAudioB = document.getElementById("bgAudioB");

// 2026-07-14: 날씨 상세 화면 (flipgen_weather_detail_screen_handoff.md 연동)
const weatherChipOpen = document.getElementById("weatherChipOpen");
const weatherDetailPanel = document.getElementById("weatherDetailPanel");
const wdCurrentTemp = document.getElementById("wdCurrentTemp");
const wdCurrentFeels = document.getElementById("wdCurrentFeels");
const wdCurrentHumidity = document.getElementById("wdCurrentHumidity");
const wdCurrentSub = document.getElementById("wdCurrentSub");
const wdTopComment = document.getElementById("wdTopComment");
const wdRainWindows = document.getElementById("wdRainWindows");
const wd24hComparison = document.getElementById("wd24hComparison");
const wdYesterday = document.getElementById("wdYesterday");
const wdTropicalBadges = document.getElementById("wdTropicalBadges");
const wdTropicalComment = document.getElementById("wdTropicalComment");
const wdAccuracyMessage = document.getElementById("wdAccuracyMessage");
const weatherDetailTitle = document.getElementById("weatherDetailTitle");

const digitElements = [
  document.getElementById("hourTens"),
  document.getElementById("hourOnes"),
  document.getElementById("minuteTens"),
  document.getElementById("minuteOnes")
];

let activeScene = "";
let activeQuoteMinute = "";
let lastQuoteTitle = "";
// 2026-07-16: "가끔 알라딘 아이콘이 무반응이다, 강제 종료 후 재실행하면
// 된다"는 실기기 제보에 대응하기 위해 마지막으로 렌더링한 문장을 기억해
// 둔다 — 앱이 포그라운드로 돌아올 때 아이콘 상태를 이 값 기준으로 다시
// 맞춰준다(resyncAladinUiAfterForeground 참고).
let lastRenderedQuote = null;
let quoteDeck = [];
let selectedCategories = new Set();
let selectedGenres = new Set(["investment"]);
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
const genreStorageKey = "ezlong:selectedGenres";
let weatherState = {
  location: "위치 확인 중",
  temp: "--°",
  summary: "날씨 불러오는 중",
  icon: "sun-icon",
  tag: "clear"
};

// 2026-07-14: 날씨 상세 화면 상태.
// WEATHER_API_BASE는 weather-backend/README.md의 배포 절차대로
// `npm run deploy` 실행 후 출력되는 실제 워커 URL로 반드시 교체해야 한다
// (배포 전까지는 상세 화면을 열어도 각 섹션이 "불러올 수 없어요"로 표시됨 —
// 정상이다, 백엔드가 아직 인터넷에 없다는 뜻이다).
const WEATHER_API_BASE = "https://flipgen-weather-backend.ezlong.workers.dev";
// 위치 권한을 못 받았을 때 쓰는 기본 좌표(인천) — 인수인계서 예시와 동일.
const DEFAULT_WEATHER_COORDS = { lat: 37.4563, lng: 126.7052 };
let userCoords = null;
let weatherDetailFetching = false;
// 2026-07-15: 상세보기를 열 때마다 매번 재요청하지 않고, 마지막 요청 후
// 1시간은 캐시를 재사용한다(유저 요청: "로딩될 때 실시간 업데이트, 이후
// 1시간은 업데이트 안 해도 된다" — 사용자 지역별로 미리 다 갱신해두기는
// 어려우니 상세보기를 누를 때 갱신하는 절충안). 좌표가 바뀌면(위치 갱신 등)
// 캐시를 무시하고 즉시 새로 받는다.
const WEATHER_DETAIL_CACHE_MS = 60 * 60 * 1000;
let weatherDetailLastFetchAt = 0;
let weatherDetailLastCoordsKey = "";

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

// 2026-07-13: "Cool Summer" 사진 풀 — 매년 7/1~8/30, 07~19시(주간), 비/눈/안개가
// 아닌 날씨(맑음/구름조금/흐림)일 때 4장 중 최소 2장을 이 풀(collection ===
// "cool-summer")에서 보장한다. 사무실·도서관에서 여름 더위에 지친 사람들에게
// 청량한 여름 사진(바다/휴가)을 보여주기 위한 유저 요청. 일반 매칭 로직
// (matchingArchivePhotos)은 건드리지 않고, 이 조건일 때만 4장 구성 방식을 바꾼다
// — 다른 계절·시간대·날씨에서는 기존 동작과 완전히 동일하다.
function isCoolSummerWindow(date = new Date()) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return month === 7 || (month === 8 && day <= 30);
}

function isCoolSummerActive() {
  const now = new Date();
  if (!isCoolSummerWindow(now)) return false;
  const hour = now.getHours();
  if (hour < 7 || hour >= 19) return false;
  return ["clear", "partly-cloudy", "cloudy"].includes(weatherState.tag);
}

const coolSummerMinCount = 2;

function pickPhotoSetWithCoolSummer(photos) {
  if (!isCoolSummerActive()) return pickNonRepeatingPhotos(photos, 4);

  const coolPool = photos.filter((image) => image && image.collection === "cool-summer");
  if (coolPool.length === 0) return pickNonRepeatingPhotos(photos, 4);

  const coolCount = Math.min(coolSummerMinCount, coolPool.length);
  const regularPool = photos.filter((image) => !(image && image.collection === "cool-summer"));
  const regularCount = 4 - coolCount;

  const coolPicks = pickNonRepeatingPhotos(coolPool, coolCount);
  const regularPicks = regularPool.length > 0 ? pickNonRepeatingPhotos(regularPool, regularCount) : [];
  return shuffledPhotos([...coolPicks, ...regularPicks]);
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
  activePhotoSet = pickPhotoSetWithCoolSummer(photos);
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
    // 2026-07-13: contain+블러 배경으로 여백을 채우는 방식을 두 차례
    // 시도했으나(무조건 contain → 크롭률 20% 임계값), 둘 다 선명한 사진과
    // 블러 배경 사이 경계가 "위/아래가 반복되는" 이음매로 보이는 문제가
    // 있었고, 유저가 명시적으로 "세로 길이 기준으로 채우고 가로 좌우를
    // 잘라내라"고 지시해 cover 고정으로 되돌렸다. 이음매 없는 화면이
    // 원본 전체를 보여주려다 생기는 부작용보다 우선한다는 판단.
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
    userCoords = DEFAULT_WEATHER_COORDS;
    weatherState = { location: "서울", temp: "--°", summary: "위치 권한 필요", icon: "sun-icon", tag: "clear" };
    weatherResolved = true;
    renderWeather();
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async ({ coords }) => {
      try {
        const { latitude, longitude } = coords;
        userCoords = { lat: latitude, lng: longitude };
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
      userCoords = DEFAULT_WEATHER_COORDS;
      weatherState = { location: "서울", temp: "--°", summary: "위치 권한 필요", icon: "sun-icon", tag: "clear" };
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

// 2026-07-16: "가끔 알라딘 아이콘이 무반응"이 계속 재발한다는 재확인 —
// 기존 resyncAladinUiAfterForeground()로도 못 잡은 걸 보니, 백그라운드
// 타이머 유실보다 더 단순한 원인이 있을 수 있다고 보고 다시 살펴봤다.
// renderQuote()가 760ms 지연 콜백을 매번 새로 예약하는데, 만약 이 콜백이
// 아직 안 끝난 상태에서(예: 수동으로 관심분야/장르를 바꿔서
// applyCategorySelection·applyGenreSelection이 즉시 renderQuote를 다시
// 부르거나, 분(rotateQuote)이 마침 같은 타이밍에 겹치는 경우) renderQuote가
// 또 호출되면, 오래된 콜백이 나중에 실행되면서 최신 문장의 아이콘
// 상태(dataset.url/hidden)를 옛날 문장 기준으로 덮어써버릴 수 있다 —
// 그러면 화면엔 새 문장이 보이는데 아이콘은 그 전 문장 기준으로 멈춰있는
// 상태가 되고, 다음 문장이 바뀌기 전까지는 이 어긋난 상태가 그대로 유지된다.
// pendingQuoteTimeoutId로 이전 예약을 취소해서 항상 "가장 최근에 부른
// renderQuote"만 실제로 반영되게 막는다.
let pendingQuoteTimeoutId = null;
function renderQuote(index) {
  const quote = index;
  lastRenderedQuote = quote;
  quotePanel.classList.add("is-changing");
  if (pendingQuoteTimeoutId !== null) {
    window.clearTimeout(pendingQuoteTimeoutId);
  }

  pendingQuoteTimeoutId = window.setTimeout(() => {
    pendingQuoteTimeoutId = null;
    const englishText = quote.english || "";
    const textLength = quote.text.length + Math.floor(englishText.length * 0.55);
    quotePanel.classList.toggle("quote-long", textLength > 115);
    quotePanel.classList.toggle("quote-dense", textLength > 190);
    quotePanel.classList.toggle("has-english", Boolean(englishText));
    setText("quoteEnglish", englishText);
    setText("quoteText", quote.text);
    setText("quoteSource", `<${quote.title}> ${quote.author}`);
    updateAladinLinkButton(quote);
    quotePanel.classList.remove("is-changing");
    restartQuoteProgress();
  }, 760);
}

// 2026-07-16: 현재 문장의 책이 알라딘과 매칭됐으면 아이콘을 보여주고 링크를
// data-url에 저장, 매칭이 안 됐으면 숨긴다. aladin-links.js 로드 실패/누락
// 시에도(window.aladinLinks === undefined) 에러 없이 그냥 숨김 처리한다.
function updateAladinLinkButton(quote) {
  if (!quoteAladinLink) return;
  const links = window.aladinLinks || {};
  const url = links[`${quote.title}|${quote.author}`];
  if (url) {
    quoteAladinLink.dataset.url = url;
    quoteAladinLink.hidden = false;
  } else {
    delete quoteAladinLink.dataset.url;
    quoteAladinLink.hidden = true;
  }
}

function shuffleQuotes(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

// 2026-07-15: "2030 여성 독자층" 큐레이션 도서(문학·에세이·교양 장르에 한정,
// 투자서는 절대 대상 아님) 노출 가산점 — quote.priority === true인 문장을
// 덱을 새로 채울 때 PRIORITY_WEIGHT배만큼 더 넣어서, 같은 덱 한 바퀴 안에서
// 더 자주 뽑히도록 한다. genre !== "literature"이면 priority 필드가 있어도
// 무시한다(투자서는 절대 가중치 대상이 아니라는 유저 지시를 코드로도 강제).
const PRIORITY_WEIGHT = 3;

function buildWeightedDeckSource(items) {
  const pool = [];
  items.forEach((quote) => {
    const isWeighted = quote.genre === "literature" && quote.priority === true;
    const copies = isWeighted ? PRIORITY_WEIGHT : 1;
    for (let i = 0; i < copies; i += 1) pool.push(quote);
  });
  return pool;
}

function getNextQuote() {
  const eligibleQuotes = getEligibleQuotes();
  if (quoteDeck.length === 0) {
    quoteDeck = shuffleQuotes(buildWeightedDeckSource(eligibleQuotes));
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
  const genreFiltered = quotes.filter((quote) => selectedGenres.has(quote.genre));
  if (selectedCategories.size === 0) return genreFiltered;
  // category(투자 멘탈/복리/변동성 등)는 투자서 문장에만 있는 하위 분류다.
  // 문학·교양서 문장은 이 필터와 무관하게 항상 통과시킨다.
  return genreFiltered.filter(
    (quote) => quote.genre !== "investment" || selectedCategories.has(quote.category)
  );
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

function syncGenreControls() {
  document.querySelectorAll("[data-genre-option]").forEach((input) => {
    input.checked = selectedGenres.has(input.value);
  });
}

function loadSavedGenres() {
  try {
    const saved = JSON.parse(localStorage.getItem(genreStorageKey) || "[\"investment\"]");
    if (Array.isArray(saved) && saved.length > 0) {
      const filtered = saved.filter((value) => Object.prototype.hasOwnProperty.call(genreLabels, value));
      selectedGenres = new Set(filtered.length > 0 ? filtered : ["investment"]);
    }
  } catch (error) {
    selectedGenres = new Set(["investment"]);
  }
  syncGenreControls();
  quoteDeck = [];
}

function saveSelectedGenres() {
  // 최소 하나는 항상 켜져 있어야 한다 (전부 끄면 문장이 안 나옴).
  if (selectedGenres.size === 0) selectedGenres = new Set(["investment"]);
  localStorage.setItem(genreStorageKey, JSON.stringify([...selectedGenres]));
}

// 2026-07-16 4차 개정 — 이 자리에 있던 lockScrollSnap/unlockScrollSnap(html에
// scroll-snap-type:none, 나중엔 overflow:hidden까지 토글하던 방식, 1~3차
// 개정)을 완전히 제거했다. 3차(overflow:hidden)까지 갔는데도 유저 실기기
// 재확인 결과 기존 증상은 그대로였고, 오히려 멀쩡하던 "ezlong.com 텍스트 탭
// → 플립 전환"까지 새로 멈춰버렸다 — html의 scroll-snap 상태를 프로그램적으로
// 건드리는 접근 자체가 이 페이지의 이미 복잡한 스냅/perspective 구조와
// 얽혀 부작용을 낳는 것으로 결론짓는다. 이번엔 html은 전혀 건드리지 않고,
// 실제 누수 지점(스크롤할 내용이 없는 .settings-backdrop 위에서 시작된
// 터치가 그대로 배경 문서로 흘러가는 것)을 touchmove에서 직접
// preventDefault로 끊는다 — 아래 setupModalBackdropScrollGuard() 참조.
// 이제 openSettings/closeSettings는 다시 순수하게 패널 열고 닫는 일만 한다.

// 2026-07-17 6차 개정: 5차까지 시도(overscroll-behavior 단독 → html
// scroll-snap 해제 → html overflow:hidden → backdrop touchmove 차단 →
// 시트 경계 touchmove 가드)가 전부 "스크롤 체이닝 자체를 막는" 접근이었는데,
// 실기기에서 결국 내부 스크롤이 완전히 자유롭게 되진 않았다. 유저 요청으로
// 목표를 재정의한다 — 시트 내부 스크롤이 완벽하지 않아도 상관없고, 오직
// "설정/날씨 상세가 열려있는 동안 화면이 ezlong.com 페이지로 플립되지만
// 않으면" 충분하다. 그래서 원인 규명 대신 결과를 직접 봉쇄한다: 모달이
// 열리는 순간 문서 스크롤 위치(scrollTop)를 그 값으로 고정하고, 모달이
// 열려있는 동안 매 프레임(requestAnimationFrame) 그 값에서 벗어났는지
// 검사해 벗어났으면 즉시 되돌린다. 시트 내부(.settings-sheet 등)는 전혀
// 다른 요소의 별도 scrollTop이라 이 잠금과 무관하게 그대로 동작한다.
let pageScrollLockActive = false;
let pageScrollLockValue = 0;
function startPageScrollLock() {
  const scroller = document.scrollingElement || document.documentElement;
  pageScrollLockValue = scroller.scrollTop;
  if (pageScrollLockActive) return;
  pageScrollLockActive = true;
  const tick = () => {
    if (!pageScrollLockActive) return;
    const scrollerNow = document.scrollingElement || document.documentElement;
    if (scrollerNow.scrollTop !== pageScrollLockValue) {
      scrollerNow.scrollTop = pageScrollLockValue;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function stopPageScrollLock() {
  pageScrollLockActive = false;
}

function openSettings() {
  settingsPanel.classList.add("is-open");
  settingsPanel.setAttribute("aria-hidden", "false");
  settingsOpen.setAttribute("aria-expanded", "true");
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", "true");
  startPageScrollLock();
}

function closeSettings() {
  settingsPanel.classList.remove("is-open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsOpen.setAttribute("aria-expanded", "false");
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", "false");
  stopPageScrollLock();
}

// 2026-07-16: 알라딘 제휴 수수료 추적용 파라미터 — aladin-links.js에 있는
// URL은 자동 매칭 스크립트가 항상 붙여서 저장하지만, gallery-server.js
// 수정 화면에서 사람이 알라딘 URL을 직접 복사+붙여넣기로 고칠 때는 이
// 파라미터를 빠뜨릴 수 있다. 데이터 쪽에서 매번 붙이는 걸 믿기보다,
// 실제로 iframe을 여는 이 순간에 마지막으로 한 번 더 강제로 붙여서 항상
// 보장한다(이미 있으면 덮어쓰기만 하고 중복 추가는 안 함).
const ALADIN_PARTNER_ID = "friedns327";
function withAladinPartnerParam(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("partner", ALADIN_PARTNER_ID);
    return parsed.toString();
  } catch (error) {
    // URL 파싱이 실패하는 예외적인 경우(상대경로 등)엔 원본을 그대로
    // 쓴다 — 깨뜨리는 것보다는 파라미터 없이라도 여는 게 낫다.
    return url;
  }
}

// 2026-07-16 3차 개정: "새 창에서 보기" 버튼을 없앴다 — 네이티브
// WKWebView에는 진짜 "새 탭"이 없어서, 그 버튼을 누르면 사실 앱 화면
// 전체가 알라딘으로 통째로 바뀌어버리고 돌아올 방법이 없었다(유저 실측
// 피드백). 그래서 처음부터 iframe을 풀사이즈(높이 100%)로 보여주고,
// 하단엔 확실하게 앱으로 돌아올 수 있는 큰 "닫기" 버튼만 둔다.
// 2026-07-16 4차 개정: 유저 제보 — 알라딘 로그인/장바구니가 이 iframe
// 안에서 전혀 유지되지 않는다("담기 하면 장바구니로 넘어가는데 비어있다,
// 로그인해도 다음에 열면 또 로그아웃돼있다"). 원인은 이 iframe이 ezlong.com
// 기준으로 "서드파티" 컨텍스트라, iOS WebKit이 여기 심기는 알라딘 쿠키를
// 오래 유지해주지 않기 때문이다(ITP류 정책 — 우리가 쿠키를 지우는 게
// 아니다, WKWebView 데이터스토어는 기본 영구 저장소를 그대로 쓰고 있고
// 코드 어디에도 쿠키를 지우는 로직이 없다). 이걸 근본적으로 우회하려면
// 알라딘을 "퍼스트파티" 컨텍스트로 열어야 한다. 1차로 네이티브에서
// SFSafariViewController(앱 내부에 뜨는 Safari 스타일 시트)를 시도했으나
// 유저 실기기 재확인 결과 그 안에서도 로그인이 유지되지 않았다 —
// SFSafariViewController는 기본 Safari 앱과 쿠키 저장소를 항상 100%
// 공유하는 게 아니다. 2026-07-16 5차 개정: 유저 요청대로 아예 스마트폰의
// 기본 브라우저(Safari) 앱 자체로 내보낸다. 네이티브에선
// ContentView.swift가 이 postMessage를 받아 UIApplication.shared.open()으로
// 처리하고, 일반 브라우저/PWA에서는 그대로 진짜 새 탭(window.open)을 쓴다.
// aladinModalCurrentUrl/aladinModalExternalOpenEl 버튼이 그 진입점이다.
let aladinModalCurrentUrl = null;

function openAladinModal(url) {
  if (!aladinModalPanel || !url) return;
  const finalUrl = withAladinPartnerParam(url);
  aladinModalCurrentUrl = finalUrl;
  if (aladinModalFrame) aladinModalFrame.src = finalUrl;
  aladinModalPanel.classList.add("is-open");
  aladinModalPanel.setAttribute("aria-hidden", "false");
}

if (aladinModalExternalOpenEl) {
  aladinModalExternalOpenEl.addEventListener("click", () => {
    if (!aladinModalCurrentUrl) return;
    if (isNativeWrapper && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.flipzenNativeRadio) {
      window.webkit.messageHandlers.flipzenNativeRadio.postMessage({ action: "openExternalSafari", url: aladinModalCurrentUrl });
      return;
    }
    let opened = null;
    try {
      opened = window.open(aladinModalCurrentUrl, "_blank", "noopener");
    } catch (error) {
      opened = null;
    }
    if (!opened) {
      window.location.href = aladinModalCurrentUrl;
    }
  });
}

// 2026-07-16: "가끔 알라딘 아이콘을 눌러도 모달이 안 뜬다, 앱을 강제
// 종료하고 재실행하면 된다"는 실기기 제보 — iOS WKWebView가 앱을
// 백그라운드로 보냈다가 다시 불러올 때 JS 타이머(특히 renderQuote()의
// 760ms 지연 콜백)가 씹혀서, quotePanel에 "is-changing" 클래스가 계속
// 남아있거나 아이콘 상태(hidden/dataset.url)가 어중간하게 멈춘 채로 남을
// 수 있다고 추정된다. 강제 종료는 이 JS 상태를 통째로 리셋해서 낫는
// 것이므로, 포그라운드로 돌아올 때마다 같은 효과를 내도록 자동으로
// 정리해준다 — 재현을 100% 확인하진 못했지만 가장 유력한 원인에 대한
// 방어 코드다.
function resyncAladinUiAfterForeground() {
  if (quotePanel) quotePanel.classList.remove("is-changing");
  if (lastRenderedQuote) updateAladinLinkButton(lastRenderedQuote);
  closeAladinModal();
}

function closeAladinModal() {
  if (!aladinModalPanel) return;
  aladinModalPanel.classList.remove("is-open");
  aladinModalPanel.setAttribute("aria-hidden", "true");
  if (aladinModalFrame) aladinModalFrame.src = "about:blank";
}

// 2026-07-14: 날씨 상세 화면 열기/닫기 — 기존 설정 패널과 동일한 메커니즘
// (is-open 클래스 토글 + aria-hidden)을 그대로 따른다.
function openWeatherDetail() {
  if (!weatherDetailPanel) return;
  weatherDetailPanel.classList.add("is-open");
  weatherDetailPanel.setAttribute("aria-hidden", "false");
  if (weatherChipOpen) weatherChipOpen.setAttribute("aria-expanded", "true");
  fetchWeatherDetail();
  startPageScrollLock();
}

function closeWeatherDetail() {
  if (!weatherDetailPanel) return;
  weatherDetailPanel.classList.remove("is-open");
  weatherDetailPanel.setAttribute("aria-hidden", "true");
  if (weatherChipOpen) weatherChipOpen.setAttribute("aria-expanded", "false");
  stopPageScrollLock();
}

function weatherDetailCoords() {
  return userCoords || DEFAULT_WEATHER_COORDS;
}

async function fetchWeatherJson(path) {
  const { lat, lng } = weatherDetailCoords();
  const url = `${WEATHER_API_BASE}${path}?lat=${lat}&lng=${lng}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// 2026-07-14: prob(강수확률)을 함께 넘기면 뱃지 안에 라벨+확률을 2줄로 쌓는다
// (유저 피드백: "'약한 비' 딱지에 강수확률도 같이 표시해주자"). 열대야
// 뱃지처럼 확률 개념이 없는 호출은 prob을 생략하면 기존처럼 라벨만 나온다.
function weatherBadgeHtml(grade, label, prob) {
  const probHtml = typeof prob === "number" ? `<span class="weather-badge-prob">${prob}%</span>` : "";
  return `<span class="weather-badge" data-grade="${grade}"><span class="weather-badge-label">${label}</span>${probHtml}</span>`;
}

// 2026-07-14: 헤더의 "지금 날씨"를 "서울 지금 날씨"처럼 지역명을 붙여 표시.
// weatherState.location은 requestCurrentWeather()의 역지오코딩(accept-language=ko)
// 결과라 이미 한글 지명이다 — 별도 API 호출 없이 재사용한다.
function updateWeatherDetailTitle() {
  if (!weatherDetailTitle) return;
  const loc = weatherState.location;
  const isPlaceholder = !loc || loc === "위치 확인 중" || loc === "현재 위치";
  weatherDetailTitle.textContent = isPlaceholder ? "지금 날씨" : `${loc} 지금 날씨`;
}

function renderWeatherCurrent(current) {
  if (!wdCurrentTemp) return;
  updateWeatherDetailTitle();
  if (!current || !current.current) {
    wdCurrentTemp.textContent = "--°";
    wdCurrentFeels.textContent = "";
    if (wdCurrentHumidity) wdCurrentHumidity.textContent = "";
    wdCurrentSub.textContent = "날씨 데이터를 불러올 수 없어요. 백엔드 배포 후 다시 시도해주세요.";
    return;
  }
  const c = current.current;
  wdCurrentTemp.textContent = `${Math.round(c.temp)}°`;
  wdCurrentFeels.textContent = `체감 ${Math.round(c.feelslike)}°`;
  // 2026-07-14: 습도를 체감온도와 같은 줄로 이동(유저 피드백: "2줄인데
  // 습도도 윗줄에 넣어라, 한 줄 width 충분") — 하단 서브 라인은 이제
  // 에러 메시지 전용이라 평상시엔 비워둔다.
  if (wdCurrentHumidity) wdCurrentHumidity.textContent = `습도 ${Math.round(c.humidity)}%`;
  wdCurrentSub.textContent = "";
}

// 2026-07-14 전면 재작성: "이번 주 강수 예보"를 오늘 포함 3일 상세 + 이후
// 4일 요약 + 이번 주말 코멘트 + 다음주 한 줄로 재구성. 백엔드
// buildWeeklyRainOutlook()의 응답 구조를 그대로 렌더링한다.
function renderRainDayCard(day) {
  const todayTag = day.isToday ? `<span class="weather-rain-day-tag">오늘</span>` : "";
  const weekendTag = day.isWeekend
    ? `<span class="weather-rain-day-tag weather-rain-day-tag-weekend">주말</span>`
    : "";
  const windowsHtml =
    day.windows && day.windows.length > 0
      ? day.windows
          .map(
            (w) => `
      <div class="weather-rain-window">
        <div>
          <div class="weather-rain-window-time">${w.timeLabel}</div>
          <div class="weather-rain-window-detail">누적 ${w.totalPrecipMm}mm</div>
        </div>
        ${weatherBadgeHtml(w.intensity.grade, w.intensity.label, w.maxPrecipProb)}
      </div>`
          )
          .join("")
      : `<p class="weather-empty">비 소식 없어요.</p>`;
  return `
    <div class="weather-rain-day">
      <p class="weather-rain-day-label">${day.dateLabel}${todayTag}${weekendTag}</p>
      ${windowsHtml}
    </div>`;
}

// 2026-07-15: 우산조언(umbrellaToday)을 강수예보 카드 안이 아니라 화면
// 맨 위 wdTopComment로 뺀다(유저 피드백: "코멘트 2~3줄은 상단으로, '이번 주
// 강수 예보'는 그 아래로"). 문구 자체는 그대로 재사용 — 두 함수가 같은
// rain-windows API 응답(data.umbrellaToday)을 나눠서 채울 뿐이다.
function renderWeatherTopComment(data) {
  if (!wdTopComment) return;
  if (!data || !data.umbrellaToday) {
    wdTopComment.textContent = "";
    return;
  }
  wdTopComment.textContent = data.umbrellaToday.message;
  wdTopComment.setAttribute("data-needed", String(data.umbrellaToday.needed));
}

function renderWeatherRainWindows(data) {
  if (!wdRainWindows) return;
  if (!data || !Array.isArray(data.detailedDays)) {
    wdRainWindows.innerHTML = `<p class="weather-empty">강수 예보를 불러올 수 없어요.</p>`;
    return;
  }

  const daysHtml = data.detailedDays.map(renderRainDayCard).join("");
  const laterHtml = data.laterSummary ? `<p class="weather-comment">${data.laterSummary.comment}</p>` : "";
  const weekendHtml = data.weekendComment
    ? `<p class="weather-comment weather-rain-outlook-weekend">${data.weekendComment}</p>`
    : "";

  // 2026-07-14: "다음 주는 예보 범위 밖이에요" 같은 무능력 고지는 넣지 않는다
  // (유저 피드백: "예보할 수 없으면 아예 코멘트를 하지 말아야 한다") — 백엔드가
  // 아예 nextWeekComment 필드를 내려주지 않으므로 여기서도 별도 처리 없음.
  wdRainWindows.innerHTML = `
    ${daysHtml}
    <div class="weather-rain-outlook-extra">
      ${laterHtml}
      ${weekendHtml}
    </div>`;
}

// 2026-07-14 재설계: "지난 24시간" 수치 나열이 아니라 "향후 24시간이 지난
// 24시간보다 덥다/춥다/습하다"를 한 줄 코멘트로 먼저 보여주고, 그 아래
// 지난/향후 두 구간을 나란히 대조한다(누적강수는 뺐다 — 유저 피드백:
// "직관적으로 비교해서 말해주려는 것이다. 누적강수는 필요 없다").
// 예전에 따로 있던 "어제와 비교하면" 카드는 이 카드로 흡수돼 삭제됐다.
function renderWeatherYesterday(data) {
  if (wd24hComparison) {
    wd24hComparison.textContent = data && data.comparison ? data.comparison : "";
  }
  if (!wdYesterday) return;
  if (!data || !data.past24h || !data.next24h) {
    wdYesterday.innerHTML = `<p class="weather-empty">비교 정보를 불러올 수 없어요.</p>`;
    return;
  }
  const p = data.past24h;
  const n = data.next24h;
  wdYesterday.innerHTML = `
    <div class="weather-24h-col">
      <p class="weather-24h-col-label">지난 24시간</p>
      <div class="weather-stat-tile"><span class="weather-stat-label">최저기온</span><span class="weather-stat-value">${Math.round(p.tempMin)}°</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">최고기온</span><span class="weather-stat-value">${Math.round(p.tempMax)}°</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">평균습도</span><span class="weather-stat-value">${Math.round(p.humidityAvg)}%</span></div>
    </div>
    <div class="weather-24h-col">
      <p class="weather-24h-col-label">향후 24시간</p>
      <div class="weather-stat-tile"><span class="weather-stat-label">최저기온</span><span class="weather-stat-value">${Math.round(n.tempMin)}°</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">최고기온</span><span class="weather-stat-value">${Math.round(n.tempMax)}°</span></div>
      <div class="weather-stat-tile"><span class="weather-stat-label">평균습도</span><span class="weather-stat-value">${Math.round(n.humidityAvg)}%</span></div>
    </div>`;
}

function renderWeatherTropical(data) {
  if (!wdTropicalBadges) return;
  if (!data) {
    wdTropicalBadges.innerHTML = `<p class="weather-empty">열대야 정보를 불러올 수 없어요.</p>`;
    if (wdTropicalComment) wdTropicalComment.textContent = "";
    return;
  }
  const officialLabel = data.official.isTropicalNight ? "공식 열대야" : "공식 기준 정상";
  const officialGrade = data.official.isTropicalNight ? "VERY_HEAVY" : "OK";
  const sleepLabel = data.sleepWindow.isFeelsLikeTropicalNight ? "체감 열대야" : "체감상 괜찮음";
  const sleepGrade = data.sleepWindow.isFeelsLikeTropicalNight ? "VERY_HEAVY" : "OK";
  wdTropicalBadges.innerHTML =
    weatherBadgeHtml(officialGrade, officialLabel) + weatherBadgeHtml(sleepGrade, sleepLabel);
  if (wdTropicalComment) wdTropicalComment.textContent = data.sleepWindow.comment || "";
}

function renderWeatherAccuracy(data) {
  if (!wdAccuracyMessage) return;
  wdAccuracyMessage.textContent = data?.message || "예보 정확도 정보를 불러올 수 없어요.";
}

async function fetchWeatherDetail() {
  if (weatherDetailFetching) return;

  // 1시간 캐시 — 좌표가 그대로고 마지막 요청이 1시간 안쪽이면 재요청하지
  // 않는다. 패널을 닫아도 DOM 내용은 그대로 남아있어 다시 열면 직전
  // 렌더링이 그대로 보인다(제목만은 항상 최신 위치를 반영하도록 갱신).
  const { lat, lng } = weatherDetailCoords();
  const coordsKey = `${lat},${lng}`;
  const cacheStillFresh =
    coordsKey === weatherDetailLastCoordsKey && Date.now() - weatherDetailLastFetchAt < WEATHER_DETAIL_CACHE_MS;
  if (cacheStillFresh) {
    updateWeatherDetailTitle();
    return;
  }

  weatherDetailFetching = true;

  const [currentR, rainR, yesterdayR, tropicalR, accuracyR] = await Promise.allSettled([
    fetchWeatherJson("/api/weather/current"),
    fetchWeatherJson("/api/weather/rain-windows"),
    fetchWeatherJson("/api/weather/yesterday"),
    fetchWeatherJson("/api/weather/tropical-night"),
    fetchWeatherJson("/api/weather/forecast-accuracy")
  ]);

  const tropicalData = tropicalR.status === "fulfilled" ? tropicalR.value : null;
  const rainData = rainR.status === "fulfilled" ? rainR.value : null;
  const currentData = currentR.status === "fulfilled" ? currentR.value : null;
  renderWeatherCurrent(currentData);
  renderWeatherTopComment(rainData);
  renderWeatherRainWindows(rainData);
  renderWeatherYesterday(yesterdayR.status === "fulfilled" ? yesterdayR.value : null);
  renderWeatherTropical(tropicalData);
  renderWeatherAccuracy(accuracyR.status === "fulfilled" ? accuracyR.value : null);

  // 2026-07-15: 실패한 응답까지 "캐시됨"으로 기록해버리는 버그 수정 — 최초
  // 요청이 서버 콜드스타트 등으로 한 번 실패하면, 그 실패 상태가 1시간 동안
  // 그대로 캐시되어 재시도가 전혀 안 됐다(유저가 앱을 강제종료·재실행해야만
  // JS 메모리가 초기화되며 우연히 재시도됐던 것). current 데이터가 실제로
  // 성공했을 때만 캐시 타임스탬프를 갱신해서, 실패 시 다음에 상세보기를
  // 열면 자동으로 재시도되게 한다.
  if (currentData && currentData.current) {
    weatherDetailLastFetchAt = Date.now();
    weatherDetailLastCoordsKey = coordsKey;
  }
  weatherDetailFetching = false;
}

let musicIndex = 0;
let musicPlaying = false;
// 2026-07-08 버그 수정: 재생/일시정지를 빠르게 연타하면(또는 오디오
// 리소스 준비가 늦어지는 사이 다시 누르면) 먼저 눌렀던 재생 시도가 뒤늦게
// 비동기로 끝나면서, 그 사이 사용자가 이미 일시정지로 바꾼 뒤인데도
// player.play()를 실행해버려 "버튼은 일시정지 상태인데 소리는 계속 남"
// 현상이 발생했다 — 토글을 누를 때마다 토큰을 새로 발급해서, 오래된
// 토큰을 들고 있는 재생 시도는 자기 차례가 아니게 되면 조용히 중단하게
// 한다.
let musicActionToken = 0;

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

// 2026-07-16: "곡 순서가 마음에 안 들 때" 다시 섞기 버튼. musicHistory(이번
// 사이클에 이미 나온 곡 기록)를 통째로 비워서 "한 바퀴 다 돌기 전엔 같은
// 곡이 안 나온다" 제약을 리셋하고, 그 자리에서 바로 다음 곡으로 넘어가
// 체감이 되게 한다. "이 곡이 싫어서"가 아니라 "순서가 마음에 안 들어서"
// 누르는 것이므로 좋아요/싫어요 학습 데이터에는 영향을 주지 않는다.
function reshuffleMusicOrder() {
  saveMusicHistory([]);
  showMusicToast("Shuffled! Fresh order incoming.");
  // 2026-07-16: 성동님 지적 — "셔플만 되어야지 왜 정각 세리모니까지 같이
  // 뜨나?" recordPlayLog(→handleMusicCeremonyOnTrackStart)는 모든 트랙
  // 전환 경로에 공통으로 걸려있어(8항 원칙과 동일하게 재활용), 셔플이
  // 유발한 전환도 "새 곡 시작"으로 똑같이 인식되고 있었다. 셔플은 사용자가
  // 명시적으로 누른 "순서 재배치" 행위지 "마침 정각에 곡이 바뀐 우연"이
  // 아니므로, 이번 트랙 전환 1회에 한해 세리모니 판정을 건너뛰게 플래그를
  // 세운다.
  suppressCeremonyOnNextTrackStart = true;
  playNextTrack();
}

// 2026-07-08: 로그인 없이(디바이스 local storage 기준) "싫어요" 학습 —
// 인덱스가 아니라 파일명(track.file)으로 저장해야 플레이리스트 순서가
// 바뀌어도 안전하다.
// 2026-07-16 개정: 원래는 10초 이상 들은 곡을 수동 스킵('다음곡')하기만
// 해도 이 목록에 자동으로 추가되는 암묵적 휴리스틱이 있었다. 유저 요청으로
// 이 자동 추가 로직(recordDislikeIfWarranted)을 완전히 제거했다 — 지금은
// 아래 musicDislikeButton("싫어요" 버튼)을 명시적으로 눌렀을 때만 이
// 목록에 들어간다. '다음곡'은 순수하게 다음 곡 재생만 한다.
const musicDislikedStorageKey = "ezlong:musicDisliked";

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

// 2026-07-13: 음악 아이콘 탭 시 곧바로 음악설정으로 가지 않고, 지금 재생
// 중인 곡 정보(비주얼라이저+곡명+좋아요/싫어요)를 먼저 보여주는 패널로
// 바꾼다. 톱니바퀴를 눌러야만 음악설정으로 이동한다. 문제가 생기면 이 값만
// false로 바꾸면 아래 새 코드를 지우지 않고도 예전 동작(음악 아이콘 탭 →
// 바로 음악설정 오픈)으로 즉시 돌아간다.
const MUSIC_PANEL_V2_ENABLED = true;

// "좋아요"는 기존에 없던 개념이라 새 키로 저장한다. 2026-07-14: 좋아요한
// 곡은 pickNextTrackIndex()에서 후보 배열에 가중치(복제)를 줘서 다음 곡
// 선정 확률을 높인다(MUSIC_LIKED_WEIGHT, 아래 참조) — "다음에 플레이될
// 가능성을 높여달라"는 요청 반영. "싫어요"는 이미 있던
// musicDislikedStorageKey/loadDislikedTracks/saveDislikedTracks를 그대로
// 재사용한다 — 수동 스킵으로 추론되는 기존 싫어요와 같은 목록이라야
// pickNextTrackIndex()의 제외 로직이 곧바로 적용된다.
const musicLikedStorageKey = "ezlong:musicLiked";

function loadLikedTracks() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicLikedStorageKey) || "[]");
    return Array.isArray(raw) ? raw.filter((value) => typeof value === "string") : [];
  } catch (error) {
    return [];
  }
}

function saveLikedTracks(list) {
  try {
    localStorage.setItem(musicLikedStorageKey, JSON.stringify(list));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

function currentMusicTrack() {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return null;
  return musicPlaylist[musicIndex % musicPlaylist.length] || null;
}

// 패널의 좋아요/싫어요 버튼 상태를 "지금 재생 중인 곡" 기준으로 갱신한다.
function renderMusicReactionButtons() {
  const track = currentMusicTrack();
  const file = track && track.file;
  const liked = file ? loadLikedTracks().includes(file) : false;
  const disliked = file ? loadDislikedTracks().includes(file) : false;
  if (musicLikeButton) musicLikeButton.setAttribute("aria-pressed", String(liked));
  if (musicDislikeButton) musicDislikeButton.setAttribute("aria-pressed", String(disliked));
}

// 2026-07-14: "싫어요" 눌렀을 때 "연기처럼" 나타났다 사라지는 가벼운 피드백
// 토스트. 유머러스한 영어 문구를 매번 무작위로 골라서 단조롭지 않게 한다.
// 총 수명 약 5초: 페이드인(0.35s) → 유지(~3.15s) → 페이드아웃(1.5s).
const MUSIC_DISLIKE_TOAST_MESSAGES = [
  "Noted. Never gonna hear this again. 💨",
  "Poof — vanished from the rotation forever.",
  "RIP this track. Gone but not missed.",
  "Banished. Officially dead to us now.",
  "Yeeted into the void. Never again.",
  "Consider it erased from existence. 💨"
];
let musicToastHideTimer = null;
let musicToastClearTimer = null;
function showMusicToast(text) {
  if (!musicToast) return;
  clearTimeout(musicToastHideTimer);
  clearTimeout(musicToastClearTimer);
  musicToast.textContent = text;
  musicToast.classList.remove("is-leaving");
  musicToast.setAttribute("aria-hidden", "false");
  // 연속 클릭 시 트랜지션이 재트리거되도록 강제 리플로우.
  void musicToast.offsetWidth;
  musicToast.classList.add("is-visible");
  musicToastHideTimer = setTimeout(() => {
    musicToast.classList.remove("is-visible");
    musicToast.classList.add("is-leaving");
  }, 3500);
  musicToastClearTimer = setTimeout(() => {
    musicToast.classList.remove("is-leaving");
    musicToast.setAttribute("aria-hidden", "true");
  }, 5000);
}
function showMusicDislikeToast() {
  const msg = MUSIC_DISLIKE_TOAST_MESSAGES[Math.floor(Math.random() * MUSIC_DISLIKE_TOAST_MESSAGES.length)];
  showMusicToast(msg);
}

function isMusicPanelOpen() {
  return Boolean(musicInfoPanel && musicInfoPanel.classList.contains("is-open"));
}

function setMusicPanelOpen(open) {
  if (!musicInfoPanel) return;
  musicInfoPanel.classList.toggle("is-open", open);
  musicInfoPanel.setAttribute("aria-hidden", String(!open));
  if (musicSettingsOpen) musicSettingsOpen.setAttribute("aria-expanded", String(open));
  if (open) {
    renderMusicReactionButtons();
    ensureMusicVizGraph();
    if (musicVizAnimId) cancelAnimationFrame(musicVizAnimId);
    musicVizAnimId = null;
    drawMusicViz();
  } else if (musicVizAnimId) {
    cancelAnimationFrame(musicVizAnimId);
    musicVizAnimId = null;
  }
}

// 음악 아이콘 탭 동작 — 플래그에 따라 분기(3번 위 주석 참조).
function handleMusicIconTap() {
  if (!MUSIC_PANEL_V2_ENABLED) {
    openSettings(); // 롤백 모드: 예전 그대로 바로 음악설정 오픈
    return;
  }
  setMusicPanelOpen(!isMusicPanelOpen());
}

// 2026-07-12: 원음 자체에 문제가 있는 곡(끊김·클리핑 등)을 골라내기 위한 임시
// QC 전용 도구. URL 끝에 ?musicqc=1 을 한 번 붙여서 열면 이 기기에 플래그가
// 저장되고, 그 이후로는 이 기기에서만 계속 버튼이 보인다 — 일반 방문자에게는
// 노출되지 않는다. "영구 제외" 버튼은 기존 싫어요(disliked) 목록에 즉시
// 추가해 이 기기에서 다시는 안 나오게 하고, 동시에 별도의 "삭제 요청" 목록에도
// 남겨서 나중에 music-playlist.js 원본에서 실제로 빼고 배포할 때 참고한다 —
// 클라이언트 코드만으로는 서버(R2/저장소)의 원본 파일을 직접 지울 수 없기
// 때문에 이 목록을 사람이 확인해서 반영하는 구조다.
const musicQCModeStorageKey = "ezlong:musicQCMode";
const musicRemovalRequestsStorageKey = "ezlong:musicRemovalRequests";

function isMusicQCMode() {
  try {
    if (new URLSearchParams(window.location.search).get("musicqc") === "1") {
      localStorage.setItem(musicQCModeStorageKey, "1");
    }
    return localStorage.getItem(musicQCModeStorageKey) === "1";
  } catch (error) {
    return false;
  }
}

function loadMusicRemovalRequests() {
  try {
    const raw = JSON.parse(localStorage.getItem(musicRemovalRequestsStorageKey) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch (error) {
    return [];
  }
}

function saveMusicRemovalRequests(list) {
  try {
    localStorage.setItem(musicRemovalRequestsStorageKey, JSON.stringify(list));
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

function renderMusicQCPanel() {
  if (!musicQCPanel) return;
  musicQCPanel.hidden = !isMusicQCMode();
  if (!musicQCRemovalList) return;
  const requests = loadMusicRemovalRequests();
  if (requests.length === 0) {
    musicQCRemovalList.innerHTML = '<li class="settings-desc settings-desc-muted">삭제 요청한 곡이 없습니다.</li>';
    return;
  }
  musicQCRemovalList.innerHTML = requests.map((entry) => `<li>${entry.title}</li>`).join("");
}

// 지금 재생 중인 곡을 (1) 기존 싫어요 목록에 즉시 넣어 이 기기에서 다시는
// 안 나오게 하고, (2) 삭제 요청 목록에 남긴 다음, (3) 바로 다음 곡으로 넘어간다.
function permanentlyExcludeCurrentTrack() {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const track = musicPlaylist[musicIndex % musicPlaylist.length];
  if (!track || !track.file) return;
  const label = track.title || track.file;
  if (!window.confirm(`"${label}" 곡을 이 기기에서 영구 제외할까요?`)) return;

  const disliked = loadDislikedTracks();
  if (!disliked.includes(track.file)) {
    disliked.push(track.file);
    saveDislikedTracks(disliked);
  }

  const requests = loadMusicRemovalRequests();
  if (!requests.some((entry) => entry.file === track.file)) {
    requests.push({
      file: track.file,
      title: track.title || track.file,
      category: track.category || null,
      removedAt: Date.now(),
    });
    saveMusicRemovalRequests(requests);
  }

  renderMusicQCPanel();
  playNextTrack();
}

function copyMusicRemovalRequests() {
  const requests = loadMusicRemovalRequests();
  if (requests.length === 0) return;
  const text = requests.map((entry) => `${entry.title} :: ${entry.file}`).join("\n");
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).catch(() => {});
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

// 2026-07-09: "이어듣기"가 날짜 구분 없이 무한정 유지되면서, 앱을 대기화면처럼
// 하루 종일 켜두는 유저에게 "다음날 다시 켜도 항상 어제 그 곡부터 시작"하는
// 지루함을 만들었다 — 유저 피드백: "앱을 실행할 때마다 같은 음악이 나와서
// 지루하다"는 착각이 아니라 이 코드의 실제 동작이었다. 저장 시점의 "기기
// 로컬 날짜"를 함께 남겨서, 되살릴 때 같은 날짜인 경우에만 이어듣기를
// 적용하고, 날짜가 바뀌었으면 새 곡을 고르게 한다(아래 prefetchFirstTrack
// 참조). 같은 날 안에서 앱을 잠깐 껐다 켜는 정상적인 이어듣기 경험은 그대로
// 유지된다.
function localDateStamp(date = new Date()) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
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
      savedOn: localDateStamp(),
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

// 2026-07-12: "여러 장르가 골고루, 질리지 않게, 같은 제목(파트1/2/3...)은
// 연달아 나오지 않게" 요청 반영 — 아래 세 가지를 추가한다.
// (1) 플레이리스트(장르) 선택 — localStorage에 저장, "all"이면 전체 랜덤.
// (2) "all" 모드에서는 카테고리(장르)를 라운드로빈으로 순환해 특정 장르가
//     몰아서 나오는 것을 막는다(장르 내부 곡 선택 자체는 무작위 유지).
// (3) 같은 "그룹"(제목이 같은 part1/2/3... 변주)은 최근 재생분과 최소 간격을
//     두기 전까지 후보에서 제외한다 — 플레이리스트 필터와 무관하게 항상 적용.
const musicPlaylistFilterStorageKey = "ezlong:musicPlaylistFilter";
const ORIGINAL_CATEGORY_KEY = "__original__";
const musicRecentGroupSpacing = 8; // 같은 그룹은 최소 이만큼 곡이 지나야 다시 후보가 됨

const MUSIC_CATEGORY_LABELS = {
  [ORIGINAL_CATEGORY_KEY]: "어쿠스틱 연주곡",
  "My Workspace": "어쿠스틱 연주곡",
  "piano chello": "피아노 · 첼로",
  "BGM": "BGM 시네마틱",
  "vocal - CITY POP": "보컬",
  "vocal - workspace 20260711 1400": "보컬",
  "vocal- girls rock": "걸스록",
};

// 2026-07-16 유저 요청 — 성격이 겹치는 카테고리를 하나로 통합한다.
// "오리지널"(58곡, category 필드 없는 트랙)과 "My Workspace"(199곡)는 둘 다
// 사실상 같은 성격의 연주곡이라 "어쿠스틱 연주곡"(257곡) 하나로 묶는다.
// "vocal - CITY POP"(16곡)과 "vocal - workspace 20260711 1400"(22곡, 기존
// 라벨 "보컬")도 보컬이 있다는 공통점으로 "보컬"(38곡) 하나로 묶는다.
// music-playlist.js의 358개 트랙 데이터(각 트랙의 category 필드)는 건드리지
// 않고, 그룹핑용 "대표 키(canonical key)"로만 매핑한다 — 358개 트랙을 일일이
// 수정하는 것보다 훨씬 안전하고, 수정 범위가 좁아 되돌리기도 쉽다. 이 매핑
// 하나만으로 카테고리 선택 UI(buildMusicPlaylistOptions), "전체" 랜덤 로테이션
// (byCategoryAll), 곡수 집계까지 전부 통합된 것처럼 자동으로 동작한다.
const CATEGORY_CANONICAL_KEY = {
  [ORIGINAL_CATEGORY_KEY]: "My Workspace",
  "vocal - CITY POP": "vocal - workspace 20260711 1400",
};

function trackCategoryKey(track) {
  const rawKey = track && track.category ? track.category : ORIGINAL_CATEGORY_KEY;
  return CATEGORY_CANONICAL_KEY[rawKey] || rawKey;
}

function musicCategoryLabel(key) {
  return MUSIC_CATEGORY_LABELS[key] || key;
}

// 2026-07-13: "Rock 포함" / "Vocal 포함" 체크박스로 시작했었다(기본값 켜짐,
// 끄면 제외). 2026-07-16: 유저 피드백으로 "Rock 제외" / "Vocal 제외"(체크
// 시 제외) 방식으로 전환 — 평소엔 아무것도 제외 안 하는 게 기본이라, "끔"
// 하나만 신경쓰면 되던 것에서 "필요할 때만 체크해서 뺀다"는 더 직관적인
// 필터 UX로 바뀐다. 카테고리명 문자열 기반으로 판정하는 방식은 그대로다
// (예: "vocal- girls rock"은 vocal이면서 동시에 rock이기도 하다 — 둘 중
// 하나라도 제외 체크돼 있으면 걸러진다). 새 카테고리가 추가돼도 이름에
// "vocal"/"rock"이 들어가면 자동으로 인식되므로 이 함수만으로 충분하다.
function isVocalCategory(key) {
  return typeof key === "string" && key.toLowerCase().includes("vocal");
}
function isRockCategory(key) {
  return typeof key === "string" && key.toLowerCase().includes("rock");
}

// 2026-07-16 유저 요청 — 플레이리스트로 특정 장르 "하나만" 선택한 상태에서
// 그 장르 자체를 걸러내는 제외 필터를 동시에 켜면 후보가 0개가 되는 모순이
// 생긴다. 예: '보컬'만 선택 + 'Vocal 제외' 체크 → '보컬' 카테고리 곡은
// 전부 vocal이므로 전부 걸러져 재생할 곡이 하나도 안 남는다. 반대로 '보컬'
// 선택 + 'Rock 제외'는 모순이 아니다 — '보컬' 카테고리 안에 록 성향 곡이
// 섞여 있을 수 있어(예: 걸스록과는 별개로) 실제로 걸러낼 대상이 있을 수
// 있기 때문이다. 이 판정 함수 하나를 재생 로직(pickNextTrackIndex)과 설정
// 화면 체크박스 활성화 여부 둘 다에서 그대로 공유해서 절대 어긋나지 않게
// 한다(8항 공유 함수 동기화 원칙과 동일 적용 — 이 파일 안이라도 로직을
// 중복 작성하지 않는다).
function musicExcludeFilterContradicts(excludeKind, filterKey) {
  if (!filterKey || filterKey === "all") return false;
  if (excludeKind === "vocal") return isVocalCategory(filterKey);
  if (excludeKind === "instrumental") return !isVocalCategory(filterKey);
  if (excludeKind === "rock") return isRockCategory(filterKey);
  return false;
}

// 2026-07-16: 저장 키를 musicInclude*에서 musicExclude*로 새로 분리했다 —
// 기존 include 저장값(체크=포함)을 그대로 재해석하면 "체크 안 함"과 "체크함"의
// 의미가 뒤바뀌어 예전 저장값을 가진 사용자에게 정반대 결과가 나갈 위험이
// 있었다. 새 키로 분리하면 예전 값은 그냥 무시되고, 새 기본값(제외 안 함=
// 체크 해제)에서 깨끗하게 시작한다.
const musicExcludeRockStorageKey = "ezlong:musicExcludeRock";
const musicExcludeVocalStorageKey = "ezlong:musicExcludeVocal";
// 2026-07-16: "연주곡 제외" — 보컬이 있는 카테고리(보컬/걸스록) 외에는 전부
// 연주곡이므로 별도 판정 함수 없이 !isVocalCategory(key)로 그대로 걸러낸다.
const musicExcludeInstrumentalStorageKey = "ezlong:musicExcludeInstrumental";

// defaultValue: 저장된 값이 없을 때 쓸 기본값. "포함" 체크박스 시절엔 항상
// true(기본 켜짐)였지만, "제외" 체크박스는 기본이 false(기본적으로 아무것도
// 제외하지 않음)여야 자연스럽다 — 그래서 두 번째 인자로 받는다.
function loadMusicGenreToggle(storageKey, defaultValue) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? defaultValue : raw === "1";
  } catch (error) {
    return defaultValue;
  }
}

function saveMusicGenreToggle(storageKey, value) {
  try {
    localStorage.setItem(storageKey, value ? "1" : "0");
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체에는 지장이 없어야 한다.
  }
}

function loadMusicPlaylistFilter() {
  try {
    const raw = localStorage.getItem(musicPlaylistFilterStorageKey);
    return typeof raw === "string" && raw ? raw : "all";
  } catch (error) {
    return "all";
  }
}

function saveMusicPlaylistFilter(value) {
  try {
    localStorage.setItem(musicPlaylistFilterStorageKey, value);
  } catch (error) {
    // localStorage를 못 쓰는 환경이어도 재생 자체는 지장이 없어야 한다.
  }
}

function shuffleArray(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

// "all" 모드 전용 — 매 사이클마다 순서를 새로 섞어 순환한다. 새로고침하면
// 초기화되는 가벼운 런타임 상태일 뿐, 하루 단위 이어듣기(musicResume)와는
// 무관하다.
//
// 2026-07-16: 예전엔 카테고리마다 사이클에 정확히 1번씩만 들어갔다(완전히
// 공평한 순번) — 그런데 실제 카테고리 곡수를 세어보니 My Workspace 199곡
// 대 BGM/보컬 계열 16곡처럼 12배 넘게 차이가 나서, "순번은 공평"해도 "곡
// 하나가 뽑힐 확률"로 환산하면 소규모 카테고리 곡이 큰 카테고리 곡보다
// 12배 넘게 자주 나오는 결과가 됐다(유저 제보: "좋아요 안 누른 곡이 자주
// 나오는 느낌" — 실제로 그럴 만했다). 그렇다고 곡수에 정확히 비례해서
// 순번을 주면(완전 비례) My Workspace 혼자 전체 재생의 56%를 차지하게 돼,
// 이번엔 반대로 "같은 카테고리만 계속 나온다"던 2026-07-12의 원래 문제가
// 재발한다. 그래서 절충안으로 각 카테고리가 사이클에 들어가는 횟수를
// 곡수의 제곱근에 비례하게 만든다 — 제곱근은 큰 수는 압축하고 작은 수는
// 상대적으로 덜 압축하는 함수라, 곡수 차이(12배)를 확률 차이(약 3.5배)로
// 완만하게 줄여준다. 정확히는: My Workspace(199)→14회, ORIGINAL(58)→8회,
// piano chello(31)→6회, vocal-workspace(22)→5회, BGM·CITY POP·girls
// rock(16)→4회씩. 한쪽 극단(완전 공평)도 반대쪽 극단(완전 비례)도 아닌
// 중간 지점 — 소규모 카테고리가 완전히 묻히지도, 유저가 느낀 것처럼
// 지나치게 자주 나오지도 않는 균형을 노린다.
let categoryRotationQueue = [];

function categoryRotationWeight(count) {
  if (!Number.isFinite(count) || count <= 0) return 1;
  return Math.max(1, Math.round(Math.sqrt(count)));
}

function nextRotatedCategory(eligibleKeys, sizeByKey) {
  if (eligibleKeys.length === 0) return null;
  categoryRotationQueue = categoryRotationQueue.filter((key) => eligibleKeys.includes(key));
  if (categoryRotationQueue.length === 0) {
    const weightedKeys = [];
    eligibleKeys.forEach((key) => {
      const count = sizeByKey instanceof Map ? sizeByKey.get(key) : undefined;
      const weight = categoryRotationWeight(count);
      for (let n = 0; n < weight; n += 1) weightedKeys.push(key);
    });
    categoryRotationQueue = shuffleArray(weightedKeys);
  }
  return categoryRotationQueue.shift();
}

function pickNextTrackIndex() {
  const total = Array.isArray(musicPlaylist) ? musicPlaylist.length : 0;
  if (total === 0) return 0;

  const filterKey = loadMusicPlaylistFilter();
  const disliked = new Set(loadDislikedTracks());
  const isDisliked = (i) => {
    const track = musicPlaylist[i];
    return Boolean(track && track.file && disliked.has(track.file));
  };
  // 2026-07-14: "좋아요" 누른 곡은 다음 곡 선정 시 뽑힐 확률을 높인다 —
  // 최종 후보 배열에 넣기 직전, 좋아요 곡의 인덱스를 N번 더 복제해서
  // Math.random() 추첨 대상 안에서 차지하는 비중을 키우는 방식(가장
  // 단순하고, 카테고리 로테이션·그룹 간격 제외 로직은 전혀 건드리지
  // 않는다). "내일 한번 더 듣게 해주거나"라는 요청은 완전한 예약 스케줄
  // 대신 이 확률 가중치로 구현 — 후보 풀에 다시 들어오는 순간부터
  // 평소보다 훨씬 잘 뽑힌다.
  const liked = new Set(loadLikedTracks());
  const isLiked = (i) => {
    const track = musicPlaylist[i];
    return Boolean(track && track.file && liked.has(track.file));
  };
  const MUSIC_LIKED_WEIGHT = 4;
  const applyLikedWeight = (arr) => {
    if (!Array.isArray(arr) || arr.length === 0) return arr;
    const weighted = [];
    arr.forEach((i) => {
      weighted.push(i);
      if (isLiked(i)) {
        for (let extra = 1; extra < MUSIC_LIKED_WEIGHT; extra += 1) weighted.push(i);
      }
    });
    return weighted;
  };
  const matchesFilter = (i) => filterKey === "all" || trackCategoryKey(musicPlaylist[i]) === filterKey;
  // 2026-07-16: 포함 체크박스(기본 true)에서 제외 체크박스(기본 false)로
  // 전환 — 체크가 "제외한다"는 뜻이 됐으니 조건도 반전.
  // 2026-07-16 2차: 선택된 장르(filterKey)와 제외 필터가 서로 모순되는
  // 조합이면(예: '보컬'만 선택 + 'Vocal 제외') 저장값이 true여도 여기서
  // 강제로 무시한다 — 설정 화면 체크박스는 이 경우 비활성화돼 있어(위
  // syncMusicExcludeFilterUi) 평소엔 애초에 true로 저장될 일이 없지만,
  // 이 재생 로직 자체도 독립적으로 같은 판정을 하게 해서 후보가 0개가
  // 되는 사고를 이중으로 막는다.
  const excludeRock = loadMusicGenreToggle(musicExcludeRockStorageKey, false) && !musicExcludeFilterContradicts("rock", filterKey);
  const excludeVocal = loadMusicGenreToggle(musicExcludeVocalStorageKey, false) && !musicExcludeFilterContradicts("vocal", filterKey);
  const excludeInstrumental = loadMusicGenreToggle(musicExcludeInstrumentalStorageKey, false) && !musicExcludeFilterContradicts("instrumental", filterKey);
  const matchesGenreToggle = (i) => {
    const key = trackCategoryKey(musicPlaylist[i]);
    if (excludeRock && isRockCategory(key)) return false;
    if (excludeVocal && isVocalCategory(key)) return false;
    if (excludeInstrumental && !isVocalCategory(key)) return false;
    return true;
  };

  const baseIndices = [];
  for (let i = 0; i < total; i += 1) {
    if (matchesFilter(i) && matchesGenreToggle(i) && !isDisliked(i)) baseIndices.push(i);
  }
  // 필터 결과가 통째로 비면(이론상 거의 없음) 안전하게 전체에서 고른다.
  // 주의: 이 최후 폴백은 disliked 필터까지 무시하고 전체 카탈로그로
  // 되돌아간다 — 즉 "현재 필터+장르 조건에 맞는 곡을 전부 싫어요 했을
  // 때"라는 극단적 경우에만 disliked 곡이 다시 나올 수 있다. 반대로
  // 폴백 자체를 없애면 그 경우 재생이 아예 멈춰버리므로, 의도적으로
  // 남겨둔 안전장치다(2026-07-14 재확인 — 평소엔 절대 발동하지 않음).
  const searchBase = baseIndices.length > 0
    ? baseIndices
    : Array.from({ length: total }, (_, i) => i);

  const recentHistory = loadMusicHistory();
  const heard = new Set(recentHistory);

  // 최근 재생한 "그룹"(같은 제목의 다른 파트)은 간격이 찰 때까지 제외한다 —
  // 필터 종류와 무관하게 항상 적용.
  const recentGroups = new Set(
    recentHistory.slice(-musicRecentGroupSpacing)
      .map((i) => musicPlaylist[i] && musicPlaylist[i].group)
      .filter((g) => g !== undefined)
  );
  const isGroupSafe = (i) => {
    const g = musicPlaylist[i] && musicPlaylist[i].group;
    return g === undefined || !recentGroups.has(g);
  };

  if (filterKey !== "all") {
    // 특정 장르만 고르는 중 — 그 장르 안에서만 "한 바퀴 다 돌면 새 사이클"을
    // 적용한다(전체 카탈로그 상태와 무관하게 이 장르 자체가 독립적으로 순환).
    let pool = searchBase.filter((i) => !heard.has(i));
    if (pool.length === 0) pool = searchBase;
    let groupSafe = pool.filter(isGroupSafe);
    if (groupSafe.length === 0) groupSafe = pool; // 후보가 다 걸러지면 간격 제약을 완화
    const weightedGroupSafe = applyLikedWeight(groupSafe);
    return weightedGroupSafe[Math.floor(Math.random() * weightedGroupSafe.length)];
  }

  // 기본(전체) 모드 — 카테고리를 라운드로빈으로 순환해 장르가 골고루 섞이게
  // 한다. 2026-07-12 수정: 처음엔 "아직 안 들은 곡"만 후보로 삼았는데, 카테고리
  // 크기가 8배 이상 차이나다 보니(My Workspace 199곡 vs BGM 17곡) 작은
  // 카테고리가 먼저 다 "들은 곡"이 되어 로테이션에서 통째로 빠지고, 그 뒤로는
  // 가장 큰 카테고리만 연달아 나오는 문제가 실측 시뮬레이션(2000회)에서
  // 확인됐다(같은 카테고리 최대 연속 140회). 그래서 "안 들은 곡" 여부는
  // 카테고리를 고른 *다음에* 그 카테고리 안에서만 따지도록 바꿨다 — 각
  // 카테고리가 자기 곡을 다 들으면 그 카테고리만 독립적으로 새 사이클을
  // 시작하고, 로테이션 순서 자체에는 전혀 영향을 주지 않는다.
  const byCategoryAll = new Map();
  searchBase.forEach((i) => {
    const key = trackCategoryKey(musicPlaylist[i]);
    if (!byCategoryAll.has(key)) byCategoryAll.set(key, []);
    byCategoryAll.get(key).push(i);
  });
  const eligibleKeys = Array.from(byCategoryAll.keys());
  // 2026-07-16: 카테고리별 실제 곡수(제곱근 가중치 계산용) — searchBase
  // 기준이라 현재 필터/장르 제외/싫어요 반영 후의 "실질" 곡수다.
  const categorySizeByKey = new Map(
    eligibleKeys.map((key) => [key, (byCategoryAll.get(key) || []).length])
  );
  const chosenCategory = nextRotatedCategory(eligibleKeys, categorySizeByKey);
  const categoryPool = chosenCategory ? byCategoryAll.get(chosenCategory) : searchBase;

  let candidates = (categoryPool || searchBase).filter(isGroupSafe);
  if (candidates.length === 0) candidates = categoryPool || searchBase;
  let unheardCandidates = candidates.filter((i) => !heard.has(i));
  if (unheardCandidates.length === 0) unheardCandidates = candidates; // 이 카테고리만 새 사이클 시작

  const weightedUnheard = applyLikedWeight(unheardCandidates);
  return weightedUnheard[Math.floor(Math.random() * weightedUnheard.length)];
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
//
// 2026-07-16: 네이티브 크로스페이드용 prefetchNext도 이 시점에 같이 나가는데,
// 실기기 로그로 직접 확인해보니 18초로는 여유가 부족해서 crossfadeStart
// (끝나기 4초 전) 시점에 로컬 캐시가 아직 준비 안 된 채로 원격 스트리밍
// 폴백으로 떨어지는 경우가 실제로 관찰됐다 — 크로스페이드가 매끄럽지 않게
// 느껴지고 초반이 씹히는 원인. 다운로드에 더 여유를 주기 위해 28초로 늘린다.
const musicPrebufferLeadSeconds = 28;

// 두 개의 <audio>를 번갈아 쓴다 — 하나(activePlayer)가 페이드아웃되는 동안
// 다른 하나(standbyPlayer)가 이미 다음 곡을 재생 중이어야 겹치는 소리가
// 난다. 곡이 끝나면 역할만 서로 바꾼다(swap), 새로 로드하지 않는다.
const musicPlayers = [bgAudio, bgAudioB].filter(Boolean);
// 2026-07-12 버그 수정: R2(pub-xxxx.r2.dev)로 옮긴 뒤 "재생은 되는데(진행률은
// 움직이는데) 소리가 전혀 안 남" 증상 — ensureAudioGraph()가 이 <audio>들을
// createMediaElementSource로 Web Audio API(GainNode)에 물려서 재생하는데,
// R2 버킷에 CORS 정책이 없으면 loadMusicTrack의 fetch(url)이 조용히 실패해
// player.src = url(원격 URL 직결) 폴백으로 떨어지고, 이 상태에서 다른 출처
// 미디어를 Web Audio 그래프에 연결하면 브라우저가 보안상 출력을 무음으로
// 만든다(오디오 자체는 정상 재생되는 것처럼 보여도). crossOrigin="anonymous"를
// 미리 지정해두면 fetch가 CORS 모드로 명확히 요청하고, R2 쪽 CORS 정책만
// 맞으면(버킷 Settings > CORS Policy) 이 경로가 정상 작동한다.
musicPlayers.forEach((player) => { player.crossOrigin = "anonymous"; });
// 2026-07-15 2차 시도 후 롤백: masterGainNode 외에 HTMLMediaElement.muted도
// true로 걸어서 iOS가 이 <audio>를 아예 무음 미디어로 인식하게 하려 했으나,
// 실기기 테스트에서 비주얼라이저가 재생 5초 즈음부터 완전히 멈추는 새 증상이
// 나타났다 — iOS WebKit은 (Chrome 등과 달리) createMediaElementSource로 이미
// Web Audio 그래프에 연결된 엘리먼트라도 .muted=true를 걸면 일정 시간 뒤
// AnalyserNode로 가는 실제 신호 자체를 끊어버리는 것으로 실측 확인됐다(사전
// 예상과 다른 실기기 특성). 그런데도 배경전환 시 소리가 끊기는 핵심 증상은
// 해결되지 않아 — 새 회귀만 만들고 실익이 없어 롤백한다. masterGainNode
// 단독 음소거 방식으로 되돌리고, 배경 오디오 문제는 NativeRadioPlayer.swift의
// 오디오 세션 인터럽션(.ended) 처리 쪽에서 다시 접근한다.
let activePlayerIndex = 0;
let crossfadeTriggered = false;
let pendingNextIndex = -1;

// 2026-07-15 구조적 재설계(4차 시도까지 실패 후): 네이티브 앱(isNativeWrapper)
// 에서는 이 <audio> 엘리먼트를 절대로 실제 play()하지 않는다. 실기기에서
// 확인된 결정적 단서 — 제어센터를 열어 음량을 조절하는 순간(=앱이 잠깐
// willResignActive→didBecomeActive를 거치는 순간)에만 죽어있던 비주얼라이저가
// 반짝 살아났다가 다시 죽었다. 이는 WKWebView 내부의 <audio>가(masterGainNode로
// 출력만 죽여놔도) 몇 초 뒤 iOS에 의해 파이프라인 자체가 서스펜드되고,
// 앱 활성 상태가 잠깐 바뀌는 순간(__flipzenNativeTimeSync가 예전엔 그 안에서
// player.play()를 다시 불렀다)에만 우연히 되살아났다는 뜻이다 — 그리고 이
// <audio>가 "재생 중" 상태를 유지하는 것 자체가 iOS 공유 AVAudioSession을
// 놓고 네이티브 AVPlayer와 경합해 배경재생이 끊기는 진짜 원인이었다
// (Swift 쪽 세션 재적용 타이밍 문제가 아니었다). 진짜 소리는 이미 네이티브
// AVPlayer가 전담하고 있고, 크로스페이드도 masterGainNode=0으로 원래부터
// 유저 귀에는 안 들렸으므로(네이티브는 trackChanged 시점에 크로스페이드 없이
// 바로 전환한다 — NativeRadioPlayer.swift 참조), 이 <audio>가 실제로
// "재생"될 필요 자체가 없다 — 다음 곡 전환 타이밍과 화면 진행률만 계산하면
// 충분하다. 그래서 실제 play()를 걸지 않고, 대신 이 가상시계가 currentTime을
// 직접 전진시켜 timeupdate를 발생시킨다(setter로 currentTime을 바꾸면 paused
// 상태에서도 timeupdate가 발생한다) — 그러면 updateMusicProgress/크로스페이드
// 예약 로직을 그대로 재사용할 수 있다. 트레이드오프: 실제 오디오 신호가 없어
// 비주얼라이저는 항상 대기(idle) 애니메이션으로 폴백한다(activeMusicAnalyser
// 참조).
let nativeClockTimerId = null;
let nativeClockLastTs = 0;

function startNativeVirtualClock() {
  if (!isNativeWrapper || nativeClockTimerId !== null) return;
  nativeClockLastTs = performance.now();
  nativeClockTimerId = window.setInterval(tickNativeVirtualClock, 250);
}

function stopNativeVirtualClock() {
  if (nativeClockTimerId !== null) {
    window.clearInterval(nativeClockTimerId);
    nativeClockTimerId = null;
  }
}

function tickNativeVirtualClock() {
  if (!musicPlaying) return;
  const player = activePlayer();
  if (!player) return;
  const now = performance.now();
  const dt = (now - nativeClockLastTs) / 1000;
  nativeClockLastTs = now;
  // 탭이 백그라운드에서 돌아오는 등으로 dt가 비정상적으로 크면(브라우저가
  // 타이머를 오래 쉬었다 몰아서 실행) 그대로 반영하지 않는다 — 이 경우
  // __flipzenNativeTimeSync가 이미 네이티브의 진짜 위치로 currentTime을
  // 다시 맞춰주므로, 여기서는 그냥 이번 tick만 건너뛴다.
  if (!(dt > 0) || dt > 5) return;
  player.currentTime = (player.currentTime || 0) + dt;
  updateMusicProgress({ target: player }); // 진행률/프리버퍼/크로스페이드 예약 로직 재사용
  const liveDuration = player.duration;
  const duration = Number.isFinite(liveDuration) && liveDuration > 0
    ? liveDuration
    : parseFloat(player.dataset.cachedDuration || "NaN");
  if (Number.isFinite(duration) && duration > 0 && player.currentTime >= duration - 0.05) {
    // 실제로 play() 중이 아니므로 브라우저의 "ended" 이벤트가 오지 않는다 —
    // 곡 끝 도달을 직접 감지해서 handleActivePlayerEnded와 동일하게 처리한다.
    handleActivePlayerEnded({ target: player });
  }
}

function activePlayer() {
  return musicPlayers[activePlayerIndex] || bgAudio;
}

function standbyPlayer() {
  if (musicPlayers.length < 2) return null;
  return musicPlayers[1 - activePlayerIndex];
}

// 2026-07-13: 음악 정보 패널의 오디오 비주얼라이저. 실제 트랙 파일이
// same-origin(R2 fetch 후 blob URL로 재생, resolveTrackUrl/loadMusicTrack
// 참조)이라 CORS로 분석 데이터가 막힐 일이 거의 없다 — 그래도 AnalyserNode
// 자체를 못 만드는 예외적 환경(구형 브라우저 등) 대비로 조용한 폴백만 둔다.
// 2026-07-13 8차: 성동님이 첨부한 macOS 스펙트럼 스타일 참고 영상 — 가는
// 막대 다수, 조용할 땐 점처럼 수축, 활성 구간만 봉긋 솟는 모양. 7차의
// "14개, 넓은 폭"이 오히려 어색하다는 피드백으로 다시 늘렸다.
const MUSIC_VIZ_BAR_COUNT = 34;
let musicVizBars = new Array(MUSIC_VIZ_BAR_COUNT).fill(0);
let musicVizBandRanges = null;
let musicVizAnimId = null;
let musicVizIdlePhase = 0;
let musicVizBarEls = null;
// 2026-07-14 18차: "고음/드럼 반응이 약하다, 더 다이나믹하게"라는 피드백 —
// 베이스(저음) 대역의 순간 에너지가 최근 평균보다 확 튀는 순간(=드럼/킥
// 타격)을 감지해 맨 왼쪽 1~2개 막대에 짧고 강한 펀치를 얹는다.
// musicVizBassEnergyAvg = 최근 베이스 에너지의 느린 이동평균(기준선),
// musicVizBassHit = 타격 감지 시 1로 튀었다가 프레임마다 빠르게 감쇠하는 값.
let musicVizBassEnergyAvg = 0;
let musicVizBassHit = 0;

function buildMusicVizBands(binCount, barCount) {
  // 저음역은 좁게, 고음역은 넓게 묶는 로그 스케일 경계 — 균등 step으로 뽑으면
  // 에너지가 저음역 몇 개 bin에 쏠려 왼쪽 몇 바만 크게 움직이고 나머지는
  // 밋밋해 보인다.
  const bounds = [];
  const minLog = Math.log10(1);
  const maxLog = Math.log10(binCount);
  for (let i = 0; i <= barCount; i++) {
    const t = i / barCount;
    const idx = Math.round(Math.pow(10, minLog + t * (maxLog - minLog)));
    bounds.push(Math.min(Math.max(idx, 1), binCount));
  }
  return bounds;
}

// 2026-07-13 3차: 1차(무지개 LED 세그먼트) → 2차(backdrop-filter 블러 유리)를
// 거쳐, "플립시계 디자인과 같은 스타일"이라는 요청에 맞춰 캔버스 자체를
// 걷어내고 실제 DOM 막대 26개로 교체했다. 캔버스 위에서 그라디언트+inset
// shadow를 근사하는 대신, .viz-bar CSS 클래스가 .flip-card와 완전히 같은
// 배경/보더/그림자 값을 그대로 쓰게 해서 "같은 스타일"을 픽셀 단위로
// 보장한다. DOM은 한 번만 만들고, 매 프레임은 각 막대의 style.height만
// 갱신 — 너비는 flex가 자동으로 맞춰주므로 별도 리사이즈 로직도 불필요.
function ensureMusicVizBarsBuilt() {
  if (musicVizBarEls || !musicVizWrap) return;
  const frag = document.createDocumentFragment();
  const els = [];
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    const bar = document.createElement("span");
    bar.className = "viz-bar";
    // 2026-07-14 12차: "밋밋하다 — 첫날처럼 컬러를 넣되 투명하게"라는 요청 —
    // 막대 위치 기준으로 무지개 hue를 한 번만 정해서 CSS 커스텀 프로퍼티로
    // 심어둔다. 실시간 밝기/알파는 --bar-intensity로 매 프레임 따로 갱신
    // (drawMusicViz/drawMusicVizIdle 참조) — hue는 고정, intensity만 움직인다.
    const hue = Math.round((i / (MUSIC_VIZ_BAR_COUNT - 1)) * 300);
    bar.style.setProperty("--bar-hue", hue);
    bar.style.setProperty("--bar-intensity", "0.1");
    els.push(bar);
    frag.appendChild(bar);
  }
  musicVizWrap.appendChild(frag);
  musicVizBarEls = els;
}

function ensureMusicVizGraph() {
  ensureAudioGraph();
  ensureMusicVizBarsBuilt();
}

// 오디오 그래프를 못 쓰는 예외적 환경을 위한 잔잔한 폴백 웨이브. 실제
// 소리는 대부분 정상 분석되므로 이 분기는 안전장치 성격이 강하다.
function drawMusicVizIdle(h) {
  musicVizIdlePhase += 0.045;
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    // 2026-07-14 13차: 아래 drawMusicViz와 같은 "산 모양" 실루엣 곡선을
    // 대기 상태에도 동일하게 적용 — 실제 음악이 안 걸려도 늘 예쁜 모양.
    // 2026-07-14 18차: 실제 재생 중 곡선과 억제 폭(0.75~1.0)을 맞춰 통일.
    const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
    const shapeEnvelope = 0.75 + 0.25 * Math.sin(Math.PI * t);
    const wave = Math.sin(musicVizIdlePhase + i * 0.7) * 0.5 + 0.5;
    const target = (4 + wave * (h * 0.4)) * shapeEnvelope;
    const factor = target > musicVizBars[i] ? 0.4 : 0.12;
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizBarEls[i].style.height = Math.round(musicVizBars[i]) + "px";
    musicVizBarEls[i].style.setProperty("--bar-intensity", Math.min(1, musicVizBars[i] / h).toFixed(3));
  }
}

// 2026-07-15: 네이티브 앱에서 실제 오디오에 반응하는 비주얼라이저.
// NativeRadioPlayer.swift의 MTAudioProcessingTap이 15Hz로 계산해준 저음/
// 중음/고음 3개 대역 에너지(nativeAudioBass/Mid/Treble, 0...1)를 34개 막대에
// 매핑한다 — 실제 34-bin FFT처럼 촘촘한 스펙트럼은 아니지만(3개 대역뿐),
// "진짜 소리에 반응한다"는 체감은 충분히 준다. 기존 drawMusicViz의 "산 모양"
// 실루엣(shapeEnvelope)과 어택/릴리즈 감쇠, 베이스 타격 펀치 연출을 그대로
// 재사용해 실제 FFT 경로와 시각적 언어를 통일한다.
let nativeAudioBass = 0;
let nativeAudioMid = 0;
let nativeAudioTreble = 0;
let nativeAudioLevelReceivedAt = 0;

window.__flipzenNativeAudioLevels = function (bass, mid, treble) {
  if (!isNativeWrapper) return;
  nativeAudioBass = Number.isFinite(bass) ? bass : 0;
  nativeAudioMid = Number.isFinite(mid) ? mid : 0;
  nativeAudioTreble = Number.isFinite(treble) ? treble : 0;
  nativeAudioLevelReceivedAt = Date.now();
};

// 막대마다 고정된(항상 같은) 살짝의 세기 차이를 줘서 평평한 블록처럼
// 보이지 않게 한다 — index 기반 결정적 해시라 프레임마다 흔들리지 않고
// 항상 같은 모양을 유지한다.
function nativeVizBarJitter(i) {
  return 0.82 + 0.36 * Math.abs(Math.sin(i * 12.9898));
}

// 2026-07-15 3차: "빨강/노랑/초록/보라 4덩어리로 뚝뚝 끊겨 보인다"는 재지적 —
// 2차 버전은 0~11/12~23/24~33을 칼같이 3등분해서 그 경계(막대 12번, 24번)에서
// 값이 순간적으로 바뀌었다. 이번엔 막대 위치마다 저음/중음/고음 3개 값을
// 가우시안 형태로 겹쳐서 부드럽게 섞는다(bandWeights) — 그러면 인접한
// 막대끼리 값 차이가 항상 완만해서 "덩어리"가 아니라 하나의 이어진 파형처럼
// 보인다. 또 "반짝임이 너무 촐랑댄다"는 재지적도 반영 — 반짝임의 진폭·속도
// 둘 다 절반 가까이 줄여서 밋밋함과 산만함의 중간 지점을 찾는다.
//
// 2026-07-16: 그런데 이번엔 반대쪽 재지적 — "전체가 너무 골고루/인위적으로
// 평균화돼 보인다"는 것. 원인은 시그마(0.32)가 너무 넓어서 저음/중음/고음
// 3개 값이 화면 거의 전체에서 서로 절반씩 섞였고(예: 막대 30%지점에서도
// 저음:중음이 거의 50:50), 타격(hit)까지 이 넓은 가중치를 그대로 재사용하다
// 보니 킥 하나가 터져도 그 반응이 화면 전반에 얇게 퍼져 "다같이 밋밋하게
// 출렁이는 평균값 파도"처럼 보였다. 두 가지로 나눠 고친다 — ① 대역 색상용
// bandWeights는 시그마를 0.32→0.20으로 좁혀 구역성(왼쪽=저음/가운데=중음/
// 오른쪽=고음 느낌)을 되살리되, 여전히 연속함수라 예전의 "칼같은 3등분"
// 사고는 재발하지 않는다. ② 타격 전용으로 훨씬 좁은 hitWeights(시그마 0.13,
// 정규화 안 함)를 따로 둬서 킥/스네어/하이햇이 각자 구역의 몇 개 막대에만
// 확 튀도록 국지화한다 — 이래야 "쇼"답게 개별적으로 팍팍 튀어 보인다.
function nativeVizBandWeights(i) {
  const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
  const bassW = Math.exp(-Math.pow((t - 0.10) / 0.20, 2));
  const midW = Math.exp(-Math.pow((t - 0.50) / 0.20, 2));
  const trebleW = Math.exp(-Math.pow((t - 0.90) / 0.20, 2));
  const sum = bassW + midW + trebleW;
  return [bassW / sum, midW / sum, trebleW / sum];
}

// 정규화하지 않는다 — 자기 구역 한복판에선 1에 가깝고, 벗어나면 빠르게
// 0으로 떨어져야 "몇 개 막대만 국지적으로 튄다"는 느낌이 산다.
function nativeVizHitWeights(i) {
  const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
  const bassW = Math.exp(-Math.pow((t - 0.10) / 0.13, 2));
  const midW = Math.exp(-Math.pow((t - 0.50) / 0.13, 2));
  const trebleW = Math.exp(-Math.pow((t - 0.90) / 0.13, 2));
  return [bassW, midW, trebleW];
}

let nativeVizShimmerPhase = 0;
let nativeVizBassHit2 = 0;
let nativeVizMidHit2 = 0;
let nativeVizTrebleHit2 = 0;
let nativeVizBassAvg2 = 0;
let nativeVizMidAvg2 = 0;
let nativeVizTrebleAvg2 = 0;

function drawMusicVizNative(h) {
  // 네이티브 레벨이 한동안(1.2초) 안 들어오면(재생 시작 전, 또는 트랙 전환
  // 찰나) 대기 애니메이션으로 자연스럽게 폴백한다.
  if (Date.now() - nativeAudioLevelReceivedAt > 1200) {
    drawMusicVizIdle(h);
    return;
  }
  nativeVizShimmerPhase += 0.12;

  const bassNow = nativeAudioBass;
  const midNow = nativeAudioMid;
  const trebleNow = nativeAudioTreble;

  // 3개 대역 각각에서 독립적으로 "타격"(순간적으로 최근 평균보다 확 튀는
  // 순간 = 킥/스네어/하이햇)을 감지한다 — 저음만 보던 1차 버전과 달리
  // 중음·고음 구역도 각자 펀치를 받아 화면 전체가 신나게 반응한다.
  if (bassNow > nativeVizBassAvg2 * 1.28 + 0.14) { nativeVizBassHit2 = 1; } else { nativeVizBassHit2 *= 0.78; }
  nativeVizBassAvg2 += (bassNow - nativeVizBassAvg2) * 0.12;
  if (midNow > nativeVizMidAvg2 * 1.28 + 0.14) { nativeVizMidHit2 = 1; } else { nativeVizMidHit2 *= 0.78; }
  nativeVizMidAvg2 += (midNow - nativeVizMidAvg2) * 0.12;
  if (trebleNow > nativeVizTrebleAvg2 * 1.22 + 0.12) { nativeVizTrebleHit2 = 1; } else { nativeVizTrebleHit2 *= 0.74; }
  nativeVizTrebleAvg2 += (trebleNow - nativeVizTrebleAvg2) * 0.12;

  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
    const shapeEnvelope = 0.75 + 0.25 * Math.sin(Math.PI * t);
    // 3개 값을 딱 자르지 않고 위치별 가중치로 부드럽게 섞는다 — 경계에서
    // 값이 뚝 끊기지 않아 3~4덩어리로 나뉘어 보이던 문제가 사라진다.
    const [bassW, midW, trebleW] = nativeVizBandWeights(i);
    const band = bassW * bassNow + midW * midNow + trebleW * trebleNow;
    // 2026-07-16: 타격은 대역 색상용 넓은 가중치가 아니라 훨씬 좁은
    // hitWeights로 국지화한다 — 그래야 킥/스네어가 화면 전체를 얇게
    // 출렁이지 않고 자기 구역의 몇 개 막대만 확 튄다.
    const [bassHW, midHW, trebleHW] = nativeVizHitWeights(i);
    const jitter = nativeVizBarJitter(i);
    // 타격에도 막대별 고정 지터를 곱한다(제곱으로 대비를 키움) — 같은 구역
    // 안에서도 막대마다 튀는 크기가 달라져야 "계산된 곡선"이 아니라
    // "제각각 튀는 쇼"처럼 보인다.
    const hitPunch = Math.pow(jitter, 2.2);
    const hit = (bassHW * nativeVizBassHit2 + midHW * nativeVizMidHit2 + trebleHW * nativeVizTrebleHit2) * hitPunch;
    // 막대마다 다른 위상으로 아주 옅은 반짝임 — "너무 촐랑댄다"는 재지적으로
    // 진폭(0.6→0.18)과 속도(band*2.2→band*0.9) 둘 다 크게 낮춰 은은한
    // 정도로만 남긴다(밋밋함과 산만함의 중간).
    const shimmer = 0.5 + 0.5 * Math.sin(nativeVizShimmerPhase * (0.5 + band * 0.9) + i * 1.7);
    const liveliness = 0.82 + 0.18 * shimmer;
    // 2026-07-16: "곡 끝 여음(리버브 꼬리)이 아직 들리는데 비주얼라이저는
    // 벌써 다 가라앉아 보인다"는 재지적 — AGC(피크 대비 정규화)가 최근
    // 시끄러웠던 구간의 피크를 한동안 기억하고 있어서, 꼬리의 조용한 소리는
    // 정규화된 band 값 자체가 매우 작다(예: 0.1 근처). 그런데 지수 1.25(>1)는
    // 작은 값을 더욱더 작게 짓눌러서(0.1^1.25≈0.056) 거의 안 보이게
    // 만들었다 — 지수를 0.7(<1)로 낮춰 작은 값을 오히려 부풀려서(0.1^0.7≈0.2)
    // 조용한 여음도 막대가 눈에 띄게 살아있도록 한다. 큰 값(1 근처)은 거의
    // 그대로라 시끄러운 구간의 다이나믹함은 그대로 유지된다.
    const ratio = Math.pow(Math.max(0, band), 0.7) * jitter;
    let target = Math.max(4, ratio * shapeEnvelope * h * liveliness);
    // 대역별 타격 펀치 — 이제 hitWeights로 국지화된 데다 막대별 지터까지
    // 곱해져서, 같은 킥 한 방에도 막대마다 확연히 다르게 튄다.
    target = Math.max(target, hit * h * 1.05 * shapeEnvelope);
    // 어택은 빠르게(비트에 팍 반응), 릴리즈는 그보다 느리게 — "쇼"답게 대비를 키운다.
    const factor = target > musicVizBars[i] ? 0.8 : 0.2;
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizBarEls[i].style.height = Math.round(musicVizBars[i]) + "px";
    const intensity = Math.min(1, Math.max(musicVizBars[i] / h, hit));
    musicVizBarEls[i].style.setProperty("--bar-intensity", intensity.toFixed(3));
  }
}

function drawMusicViz() {
  if (!isMusicPanelOpen() || !musicVizWrap || !musicVizBarEls) {
    musicVizAnimId = null; // 패널이 닫히면 다음 프레임을 예약하지 않고 루프 종료
    return;
  }
  musicVizAnimId = requestAnimationFrame(drawMusicViz);

  const h = musicVizWrap.clientHeight || 52;

  if (isNativeWrapper) {
    drawMusicVizNative(h);
    return;
  }

  const analyser = activeMusicAnalyser();
  if (!analyser) {
    drawMusicVizIdle(h);
    return;
  }

  if (!musicVizBandRanges) {
    musicVizBandRanges = buildMusicVizBands(analyser.frequencyBinCount, MUSIC_VIZ_BAR_COUNT);
  }
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  // 2026-07-13 7차: "막대쇼처럼 다 같이 움직여야 한다"는 피드백 — 5차는
  // 절대 에너지(avg/255)에 압축을 걸었더니 베이스/미드 대역이 거의 항상
  // 천장 근처에 붙어버려서(실사용 음악은 저음이 절대값 자체가 크다) 왼쪽
  // 대부분이 "가만히 서 있는" 것처럼 보이고, 원래도 에너지가 작은 오른쪽
  // 1~2개 고음역 막대만 눈에 띄게 움직였다. 절대값 기준을 버리고 이번
  // 프레임에서 가장 센 대역을 100%로 놓고 나머지를 그에 비례해 정규화한다
  // — 그 순간 제일 큰 소리가 꼭대기까지 닿고, 어느 막대가 그 "1등"이 될지는
  // 매 프레임 계속 바뀌므로 전체가 다 같이 들썩이는 막대쇼 느낌이 난다.
  const avgs = new Array(MUSIC_VIZ_BAR_COUNT);
  let maxAvg = 24; // 무음에 가까운 순간에 0으로 나누는 걸 막는 바닥값
  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    const start = musicVizBandRanges[i];
    const end = Math.max(musicVizBandRanges[i + 1], start + 1);
    let sum = 0;
    for (let j = start; j < end; j++) sum += data[j];
    let avg = sum / (end - start);
    // 2026-07-14 18차: "고음이나 저음이나 큰 차이가 없다, 고음이 더 솟구쳐야
    // 한다"는 피드백 — 실제 음악은 raw FFT 에너지가 저음에 훨씬 쏠려있어서,
    // 프레임별 최댓값 정규화를 해도 고음역 막대가 "이번 프레임 1등"이 될
    // 기회 자체가 드물었다. 위치(고음역)가 높을수록 미리 이득(gain)을 줘서
    // 하이햇/심벌 같은 고음 타격이 실제로 화면에서 튀어 보이게 보정한다.
    const trebleBoost = 1 + (i / (MUSIC_VIZ_BAR_COUNT - 1)) * 0.7; // 저음 1.0배 → 고음 1.7배
    avg *= trebleBoost;
    avgs[i] = avg;
    if (avg > maxAvg) maxAvg = avg;
  }

  // 드럼(킥) 타격 감지 — 맨 왼쪽 2개 대역(가장 낮은 저음)의 raw 평균을
  // 최근 이동평균과 비교해, 확 튀어오르는 순간만 "타격"으로 잡는다.
  const bassNow = (avgs[0] + avgs[1]) / 2;
  if (bassNow > musicVizBassEnergyAvg * 1.35 + 6) {
    musicVizBassHit = 1;
  } else {
    musicVizBassHit *= 0.8; // 5~6프레임 안에 빠르게 가라앉는 "팍" 펀치감
  }
  musicVizBassEnergyAvg += (bassNow - musicVizBassEnergyAvg) * 0.1;

  for (let i = 0; i < MUSIC_VIZ_BAR_COUNT; i++) {
    // 2026-07-14 13차: "그래프 모양이 좌측만 높고 우측은 낮다 — 실제 신호
    // 세기가 아니라 보기 좋은 과장된 연출이 중요하다"는 피드백. 저음역이
    // 실제로 거의 항상 raw 에너지가 제일 커서, 프레임별 정규화(7차)를
    // 해도 결국 왼쪽이 도드라져 보였다 — 위치 기준 고정 "산" 모양 곡선을
    // 실시간 에너지 비율에 곱해서 실루엣 자체를 항상 예쁜 언덕 모양으로
    // 유도한다.
    // 2026-07-14 18차: 다만 이 고정 곡선이 너무 세게(0.5~1.0 범위) 실제
    // 신호를 눌러버려서 "고음/저음 차이가 안 느껴진다"는 재지적 — 억제
    // 폭을 절반으로 줄여(0.75~1.0) 실제 대역별 에너지 차이가 더 살아나게
    // 하고, 비율 자체도 지수(1.5)를 줘서 이번 프레임 1등만 확실히 솟고
    // 나머지는 더 가라앉는 대비를 키운다.
    const t = i / (MUSIC_VIZ_BAR_COUNT - 1);
    const shapeEnvelope = 0.75 + 0.25 * Math.sin(Math.PI * t);
    const ratio = Math.pow(Math.max(0, avgs[i] / maxAvg), 1.5);
    let target = Math.max(4, ratio * shapeEnvelope * h);
    if (i <= 1) {
      // 드럼 타격 시 맨 왼쪽 1~2개 막대만 별도로 순간 펀치 — 다른 막대의
      // 정규화 로직과 무관하게 항상 눈에 띄게 솟구친다.
      target = Math.max(target, musicVizBassHit * h * 0.96);
    }
    // 어택은 더 빠르게(비트에 팍! 반응), 릴리즈도 조금 더 빠르게 — "더
    // 다이나믹하게, 변동성이 크면 좋겠다"는 피드백으로 어택 0.62→0.72,
    // 릴리즈 0.12→0.18로 올려 오르내림 자체를 더 선명하게 만들었다.
    const factor = target > musicVizBars[i] ? 0.72 : 0.18;
    musicVizBars[i] += (target - musicVizBars[i]) * factor;
    musicVizBarEls[i].style.height = Math.round(musicVizBars[i]) + "px";
    const intensity = i <= 1
      ? Math.min(1, Math.max(musicVizBars[i] / h, musicVizBassHit))
      : Math.min(1, musicVizBars[i] / h);
    musicVizBarEls[i].style.setProperty("--bar-intensity", intensity.toFixed(3));
  }
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
// 2026-07-15: 네이티브 앱(iOS)에서는 실제 스피커 출력을 AVPlayer(네이티브)가
// 전담하고, 여기(WKWebView 내부 Web Audio 그래프)는 크로스페이드 타이밍/
// 비주얼라이저/진행률 계산만 계속 담당한다 — 두 군데서 동시에 소리가 나면
// 안 되므로, 개별 트랙 GainNode 뒤에 이 마스터 GainNode를 하나 더 두고
// isNativeWrapper일 때만 0으로 죽인다. 일반 웹/PWA에서는 항상 1이라 지금까지의
// 크로스페이드 볼륨 동작과 완전히 동일하다.
let masterGainNode = null;
// 2026-07-13: 음악 정보 패널의 오디오 비주얼라이저용 AnalyserNode.
// musicPlayers/playerGainNodes와 같은 순서로 둔다. 기존 gain → destination
// 출력 경로는 그대로 두고, gain에서 분석용으로만 하나 더 분기(fan-out)한다 —
// 소리 출력 경로 자체에는 영향이 없다.
let playerAnalysers = null;

function ensureAudioGraph() {
  if (audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return; // 극히 예외적으로 없는 환경 — setPlayerVolume이 .volume으로 폴백
  try {
    audioContext = new AudioContextClass();
    playerAnalysers = [];
    masterGainNode = audioContext.createGain();
    masterGainNode.gain.value = isNativeWrapper ? 0 : 1;
    masterGainNode.connect(audioContext.destination);
    playerGainNodes = musicPlayers.map((player) => {
      const source = audioContext.createMediaElementSource(player);
      const gain = audioContext.createGain();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;
      source.connect(gain);
      gain.connect(masterGainNode);
      gain.connect(analyser);
      playerAnalysers.push(analyser);
      return gain;
    });
  } catch (error) {
    audioContext = null;
    playerGainNodes = null;
    playerAnalysers = null;
    masterGainNode = null;
  }
}

// 지금 소리가 나오고 있는 쪽(activePlayer)의 AnalyserNode를 돌려준다.
// 크로스페이드 중 잠깐은 standby 쪽도 같이 들리지만, 비주얼라이저는
// "화려할 필요 없이 가벼운" 용도라 근사치로 충분하다.
function activeMusicAnalyser() {
  // 2026-07-15: 네이티브 앱에서는 이 <audio>를 실제로 play()하지 않으므로
  // (위 nativeClockTimerId 관련 주석 참조) AnalyserNode에 흐를 실제 신호
  // 자체가 없다 — 항상 null을 돌려줘서 drawMusicViz()가 매번 drawMusicVizIdle
  // (대기 애니메이션)로 폴백하게 한다. 어설프게 무신호 막대를 보여주는 것보다
  // 의도된 잔잔한 애니메이션이 더 낫다는 판단.
  if (isNativeWrapper) return null;
  if (!playerAnalysers) return null;
  const index = musicPlayers.indexOf(activePlayer());
  return playerAnalysers[index] || null;
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
  if (!base) return track.file;
  // 2026-07-11: R2로 옮긴 새 트랙들은 폴더/파일명에 공백·괄호가 그대로 들어있다
  // (예: "My Workspace/A Pocketful of Noon.m4a"). 세그먼트별로 encodeURIComponent를
  // 적용해 "/" 구분자는 유지하면서 나머지는 안전하게 퍼센트 인코딩한다 — 브라우저의
  // 자동 인코딩에 기대지 않고 명시적으로 처리해 WKWebView에서도 안정적으로 동작하게 함.
  const encodedFileName = fileName.split("/").map(encodeURIComponent).join("/");
  return `${base.replace(/\/$/, "")}/${encodedFileName}`;
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
  // 2026-07-14 15차: 음악 패널 진행률 가로 바 — 위 링 진행률과 같은 값을
  // 그대로 재사용해 폭(%)만 매 프레임 갱신한다(새 계산 없음, 8항 원칙과 동일).
  if (musicProgressFill) musicProgressFill.style.width = (progress * 100).toFixed(2) + "%";

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
    // 2026-07-16: 네이티브 모드에서는 이 시점(끝나기 18초 전)에 다음 곡
    // URL을 네이티브에도 미리 알려줘서 TrackFileCache가 여유있게 로컬로
    // 받아두게 한다 — 예전엔 crossfadeStart(끝나기 4초 전) 시점에야 같은
    // URL을 다시 prefetch()했는데, 그건 이미 그 순간 막 재생을 시작한
    // 파일과 똑같은 파일을 또 받으러 가는 셈이라 대역폭이 두 배로 들어
    // 곡 초반이 끊기는 원인이었다(NativeRadioPlayer.swift 주석 참조). 이제
    // 진짜로 미리(18초 여유) 받아두므로 크로스페이드 시점엔 이미 로컬 파일이다.
    if (isNativeWrapper && Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
      const upcoming = musicPlaylist[pendingNextIndex % musicPlaylist.length];
      if (upcoming) {
        postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(upcoming) });
      }
    }
  }

  // 2단계 — 실제 크로스페이드 시작(끝나기 4초 전). 1단계에서 이미 준비
  // 중이던(또는 이미 완료된) standby를 그대로 쓴다.
  if (!crossfadeTriggered && standby && pendingNextIndex >= 0 && remaining <= musicFadeOutSeconds && remaining > 0.05) {
    crossfadeTriggered = true;
    if (standby._pendingLoad) {
      try { await standby._pendingLoad; } catch (error) { /* 폴백은 loadMusicTrack 내부에서 처리됨 */ }
    }
    setPlayerVolume(standby, 0);
    // 네이티브 앱에서는 이 <audio>를 절대 실제로 play()하지 않는다(파일 상단
    // nativeClockTimerId 관련 주석 참조) — 어차피 masterGainNode=0이라 유저
    // 귀에는 안 들리던 크로스페이드였다. standby는 활성으로 바뀔 때(swap)
    // currentTime 0에서 시작하는 상태 그대로 대기한다.
    if (!isNativeWrapper) {
      standby.play().catch(() => {});
    } else if (Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
      // 2026-07-15: "웹앱 버전처럼 곡 끝과 다음 곡이 자연스럽게 볼륨
      // 믹싱되면서 넘어가야 한다"는 요청 — 네이티브(NativeRadioPlayer)는
      // v1에서 트랙 전환을 크로스페이드 없이 즉시 바꿨는데, 진짜 소리는
      // 항상 네이티브가 내므로 그쪽에서도 실제로 볼륨을 서서히 섞어야만
      // 유저 귀에 자연스러운 전환으로 들린다. 여기서 다음 곡 URL과 함께
      // "이 시간 동안 서서히 믹싱해라"는 신호를 보낸다 — 실제 페이드는
      // NativeRadioPlayer.crossfadeStart()가 두 번째 AVPlayer로 수행한다.
      const nextTrack = musicPlaylist[pendingNextIndex % musicPlaylist.length];
      if (nextTrack) {
        postToNativeRadio({
          action: "crossfadeStart",
          url: resolveTrackAbsoluteUrl(nextTrack),
          title: nextTrack.title || "FlipZen Radio",
          duration: musicFadeOutSeconds,
        });
      }
    }
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
  // 2026-07-15: 네이티브 모드에서는 이 <audio>가 애초에 실제로 play()되지
  // 않으므로(파일 상단 nativeClockTimerId 관련 주석 참조) player.paused가
  // 항상 true라 아래 조기 return에 자연히 걸린다 — 그래도 의도를 명확히
  // 하기 위해 명시적으로도 막아둔다.
  if (isNativeWrapper) return;
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

// 2026-07-08: pause/playing 네이티브 이벤트 디바운스 동기화 — 위
// musicPlayers.forEach 안의 리스너 설명 참조. 여러 이벤트가 겹쳐 도착해도
// 마지막에 한 번, 그 시점의 실제 오디오 상태(player.paused)만 확정 반영한다.
let musicStateSyncTimer = null;
function scheduleMusicStateSync() {
  if (musicStateSyncTimer !== null) return;
  musicStateSyncTimer = window.setTimeout(() => {
    musicStateSyncTimer = null;
    const player = activePlayer();
    if (!player) return;
    const actuallyPlaying = !player.paused && !player.ended;
    if (actuallyPlaying !== musicPlaying) {
      musicPlaying = actuallyPlaying;
      renderMusicToggle();
    }
  }, 120);
}

function renderMusicToggle() {
  if (!musicToggle) return;
  musicToggle.classList.toggle("is-playing", musicPlaying);
  musicToggle.setAttribute("aria-pressed", String(musicPlaying));
  musicToggle.setAttribute("aria-label", musicPlaying ? "음악 일시정지" : "음악 재생");
  renderMusicHistoryList(); // 재생/일시정지에 따라 "바로 듣기"/"재생 중" 라벨도 같이 갱신한다.
  syncNativePlayState(); // 재생/일시정지 상태를 네이티브(잠금화면·오디오세션)에도 즉시 반영.
}

// 에러 이벤트도, ended 이벤트도 없이 재생이 조용히 멈추는 증상이 있었다
// (2026-07-07 유저 리포트: "에러메시지도 안 뜨고 그냥 멈춘다. 재생 버튼
// 눌러도 재생이 안 된다"). 이건 브라우저가 error를 던지지 않고 그냥
// 버퍼링에서 멈춰버리는 경우라, 위 watchdog으로 별도 감지한다.
// 그리고 멈춘 상태에서 재생 버튼을 눌렀을 때 단순히 play()만 다시 부르면
// 똑같이 막힌 상태라 반응이 없었을 것 — 실패하면 load()로 리셋 후 같은
// 위치에서 재시도하도록 바꾼다.
async function playMusic(token) {
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
  // 이 await 도중에 사용자가 다시 눌러 더 최신 토큰이 발급됐다면, 이
  // 재생 시도는 이제 유효하지 않다 — 여기서 조용히 멈춘다.
  if (token !== musicActionToken) return;
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
  if (token !== musicActionToken) return; // fetch 대기 중 다시 눌렀다면 여기서도 중단
  if (isNativeWrapper) {
    // 네이티브 앱에서는 이 <audio>를 절대 실제로 play()하지 않는다 — 진짜
    // 소리는 이미 syncNativeTrackInfo/syncNativePlayState로 네이티브
    // AVPlayer에 전달됐다(renderMusicPlaylistInfo/renderMusicToggle 호출
    // 경로). 여기서는 화면 진행률/다음곡 전환 타이밍을 계산하는 가상시계만
    // 시작한다(파일 상단 nativeClockTimerId 관련 주석 참조).
    startNativeVirtualClock();
    return;
  }
  const resumeFrom = player.currentTime;
  player.play().catch(() => {
    if (token !== musicActionToken) return;
    const savedTime = resumeFrom;
    player.load();
    player.currentTime = savedTime;
    player.play().catch(() => {
      if (token !== musicActionToken) return;
      musicPlaying = false;
      renderMusicToggle();
    });
  });
}

function pauseMusic() {
  maybeSaveMusicResume(true); // 멈추는 순간 위치를 확실히 저장해둔다.
  stopNativeVirtualClock(); // 네이티브 모드가 아니면 애초에 실행 중이 아니므로 무해하다.
  activePlayer()?.pause();
  standbyPlayer()?.pause();
}

// 2026-07-15 재설계: 아래 SilentAudioKeepAlive/그림자 재생(heartbeat) 방식은
// 4차 시도까지 실기기에서 안정적으로 동작하지 않는 것으로 결론 났다
// (NATIVE_APP_STRATEGY.md 참조 — WKWebView는 백그라운드 전환 즉시 내부
// WebContent 프로세스의 HTML5 <audio>를 서스펜드해버려서, "전환되는 그
// 찰나에 네이티브가 바통을 받는" 방식 자체가 타이밍 경쟁을 안고 있었다).
// 이번 방식은 그 경쟁 자체를 없앤다 — 라디오(음악) 소리는 유저가 재생
// 버튼을 누르는 순간부터 끝까지, 포그라운드·백그라운드 구분 없이 항상
// 네이티브 AVPlayer가 낸다. 이 안의 <audio> 엘리먼트/크로스페이드/비주얼
// 라이저/진행률 계산 로직은 전혀 안 건드리고 그대로 "브레인" 역할을 하되,
// 실제 스피커 출력만 masterGainNode로 죽인다(ensureAudioGraph 참조) —
// 네이티브 쪽에 이중으로 소리가 나는 걸 막기 위해서다. 일반 웹/PWA(무료
// 버전)에서는 window.webkit이 없으므로 postToNativeRadio가 조용히 아무
// 일도 안 하고, masterGainNode도 항상 1로 유지된다 — 웹 동작에는 전혀
// 영향이 없다.
function postToNativeRadio(payload) {
  if (!isNativeWrapper) return;
  try {
    window.webkit.messageHandlers.flipzenNativeRadio.postMessage(payload);
  } catch (error) {
    // 네이티브 브릿지가 아직 준비 전이거나 없는 환경 — 조용히 무시(웹 동작 무관).
  }
}

// renderMusicPlaylistInfo()가 트랙이 바뀌는 모든 지점(첫 재생 시작·수동
// 스킵·자동 크로스페이드 완료·플레이리스트/장르 필터 변경)에서 공통으로
// 호출되므로, 여기 한 곳에만 붙여도 트랙 전환을 하나도 놓치지 않고
// 네이티브에 전달할 수 있다.
function syncNativeTrackInfo() {
  if (!isNativeWrapper) return;
  const track = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  if (!track) return;
  const player = activePlayer();
  postToNativeRadio({
    action: "trackChanged",
    url: resolveTrackAbsoluteUrl(track),
    title: track.title || "FlipZen Radio",
    time: player ? (player.currentTime || 0) : 0,
    playing: musicPlaying,
  });
}

// renderMusicToggle()이 재생/일시정지 상태가 바뀌는 유일한 공통 지점이라
// 여기서만 네이티브에 재생 상태를 알린다(곡 자체는 안 바뀌었을 수 있으니
// syncNativeTrackInfo와 분리해둔다).
function syncNativePlayState() {
  postToNativeRadio({ action: "playState", playing: musicPlaying });
}

// 진행률 바를 손가락/마우스/키보드로 옮겼을 때(seekMusicProgressToClientX,
// 화살표키 탐색) 네이티브 재생 위치도 맞춰준다 — 안 그러면 화면 진행률과
// 잠금화면/제어센터 쪽 실제 재생 위치가 어긋난다. 재생 중에만 15초마다도
// 한 번씩 같은 함수로 가볍게 재동기화해서(아래 setInterval), 오랜 시간
// 백그라운드에 있어도 위치가 크게 벌어지지 않게 한다.
function syncNativeSeek() {
  if (!isNativeWrapper) return;
  const player = activePlayer();
  if (!player) return;
  postToNativeRadio({ action: "seek", time: player.currentTime || 0 });
}

// 네이티브(잠금화면/제어센터)에서 재생·일시정지·다음곡 버튼을 눌렀을 때
// 호출된다(ContentView.swift → evaluateJavaScript). "네이티브 전용 로직"을
// 새로 만들지 않고 기존 toggleMusic()/playNextTrack()을 그대로 재사용해서,
// 화면 UI·크로스페이드·재생기록 등 모든 부수효과가 잠금화면 조작에도 똑같이
// 따라오게 한다.
// 앱이 백그라운드에서 돌아올 때 네이티브(ContentView.swift의 didBecomeActive
// 관찰자)가 호출한다. WKWebView는 백그라운드 동안 내부 미디어 파이프라인
// 자체를 멈춰두므로(이 프로젝트에서 반복 확인된 동작), 이 웹 쪽 <audio>는
// 배경 전 마지막 위치에 그대로 멈춰있다 — 실제 소리(네이티브)는 배경 내내
// 정확히 흘러왔으므로, 그 진짜 위치로 화면 진행률·크로스페이드 타이밍을
// 맞춰준다. 이 보정이 없으면 복귀 직후 진행률 바가 잠깐 "거꾸로" 보이거나,
// 15초 재동기화(syncNativeSeek)가 오히려 네이티브를 과거로 되감길 수 있다.
window.__flipzenNativeTimeSync = function (time) {
  if (!isNativeWrapper || !Number.isFinite(time)) return;
  const player = activePlayer();
  if (!player) return;
  player.currentTime = time;
  // 2026-07-15: 예전엔 여기서 player.play()를 다시 불렀는데, 이게 바로
  // "제어센터를 열고 닫을 때만 비주얼라이저가 잠깐 살아났다 죽는" 증상의
  // 정체였다(파일 상단 nativeClockTimerId 관련 주석 참조) — 이 <audio>는
  // 네이티브 모드에서 절대 실제로 play()하지 않는다. 방금 갓 동기화한
  // 시점으로 가상시계의 델타 기준을 리셋하고, 화면 진행률만 즉시 반영한다.
  nativeClockLastTs = performance.now();
  updateMusicProgress({ target: player });
};

window.__flipzenNativeCommand = function (command) {
  if (command === "play") {
    if (!musicPlaying) toggleMusic();
  } else if (command === "pause") {
    if (musicPlaying) toggleMusic();
  } else if (command === "next") {
    playNextTrack();
  }
};

function toggleMusic() {
  musicPlaying = !musicPlaying;
  musicActionToken += 1; // 이 클릭이 "가장 최신 의도"임을 표시 — 이전 재생 시도는 이 값으로 자기 차례가 지났음을 안다.
  if (musicPlaying) playMusic(musicActionToken); else pauseMusic();
  renderMusicToggle();
}

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
  musicActionToken += 1; // 진행 중이던 이전 재생 시도(있었다면)를 무효화한다.
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
  // 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지 않는다(파일 상단
  // nativeClockTimerId 관련 주석 참조) — syncNativeTrackInfo(renderMusicPlaylistInfo
  // 안에서 이미 호출됨)가 네이티브 AVPlayer에 새 트랙을 즉시 전달한다.
  if (musicPlaying && !isNativeWrapper) {
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
    if (isNativeWrapper) {
      // 2026-07-16: 크로스페이드가 끝난 이 순간, 네이티브(AVPlayer)의 새
      // 트랙은 이미 musicFadeOutSeconds(4초)만큼 실제로 재생된 상태다 —
      // crossfadeStart에서 볼륨 0으로 미리 재생을 시작해 fadeDuration에
      // 걸쳐 서서히 페이드했기 때문. 그런데 JS 쪽 "가상시계" 역할을 하는
      // 새 activePlayer(방금 전까지 standby였던 <audio>)는 네이티브
      // 모드에서 한 번도 실제로 play()된 적이 없어(위 nativeClockTimerId
      // 주석 참조) currentTime이 초기값 0에 그대로 멈춰있었다. 이 ~4초
      // 차이가 15초마다 도는 syncNativeSeek()(아래 setInterval)에 그대로
      // 실려 네이티브에 "몇 초 전으로 되돌아가라"는 신호로 전달됐고,
      // 크로스페이드 직후 다음 15초 재동기화 타이밍이 우연히 겹치는
      // 순간마다 곡이 갑자기 되감겼다 정상 재생되는 버그로 이어졌다(유저
      // 제보: "5초 정도에서 2초 정도 되돌림, 두세곡에 한번꼴"). 근본
      // 원인은 이 가상시계가 네이티브의 실제 재생 위치를 반영하지 못했던
      // 것 — 여기서 네이티브의 실제 위치(약 fadeDuration초)로 맞춰준다.
      activePlayer().currentTime = musicFadeOutSeconds;
    }
    recordPlayLog(musicIndex);
    // 2026-07-15: 네이티브 모드에서는 위 renderMusicPlaylistInfo() 주석 참조 —
    // 이 전환은 네이티브가 이미 스스로 크로스페이드로 끝낸 것이라 trackChanged를
    // 다시 보내지 않는다(화면 텍스트만 갱신).
    renderMusicPlaylistInfo(isNativeWrapper ? { skipNativeSync: true } : undefined);
    renderMusicHistoryList();
    crossfadeTriggered = false;
    setPlayerVolume(activePlayer(), 1);
    // 방어 코드(2026-07-07): 위 updateMusicProgress에서 걸었던 standby.play()가
    // 어떤 이유로든(iOS 앱 환경 등) 실제로는 재생을 못 시작했을 경우를 대비해,
    // 역할을 바꾼 새 activePlayer가 확실히 재생 중인 상태로 만든다. 이미
    // 재생 중이면 이 호출은 사실상 아무 효과가 없어 무해하다.
    // 2026-07-15: 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지
    // 않는다(파일 상단 nativeClockTimerId 관련 주석 참조) — 새 activePlayer는
    // currentTime 0에서 대기만 하고, 진짜 소리는 이미 syncNativeTrackInfo로
    // 네이티브 AVPlayer에 전달됐다.
    if (!isNativeWrapper) activePlayer().play().catch(() => {});
    resetActiveWatchState();
    return;
  }
  playNextTrack();
}

// 2026-07-15: "제목에 (1), (2)가 많은데 파일명 중복 흔적이냐"는 질문 —
// 확인해보니 파일명이 아니라 music-playlist.js의 playlist 필드였다.
// scripts/build-music-playlist.js의 parseFileName()이 파일명 끝의
// "_partN" 또는 "_N"에서 변주(같은 곡의 다른 버전) 번호를 뽑아내는데, 이때
// "part"라는 단어는 버리고 숫자만 남긴다 — 그래서 파일명을 "part2"로
// 바꿔도 결과는 여전히 순수 숫자 "2"다(유저가 파일명을 고쳐도 이 증상이
// 그대로였던 이유). 기존 30곡(58트랙) 세트는 A/B 글자 코드라 "(A)"처럼
// 봐줄 만했지만, 숫자만 있으면 "이게 뭔가 잘못된 흔적인가" 싶게 어색하다.
// 데이터를 건드리는 대신(빌드 스크립트는 유저의 실제 Mac 폴더를 스캔해야
// 해서 이 세션에서 재실행 불가) 표시 단계에서만 숫자 코드를 "파트 N"으로
// 풀어써서 훨씬 자연스럽게 보이게 한다. 글자 코드(A/B)는 그대로 둔다.
function formatPlaylistVariant(playlist) {
  if (!playlist || playlist === "SINGLE") return "";
  return /^\d+$/.test(playlist) ? ` (파트 ${playlist})` : ` (${playlist})`;
}

// 2026-07-08: "지금 재생 중인 곡이 뭔지 궁금하다"는 질문에 답할 방법이
// 화면 어디에도 없었다(재생/스킵 버튼만 있고 곡명 표시가 없었음) — 음악
// 설정 패널에 이미 있던 총 곡수 안내에 현재 곡 제목을 덧붙인다.
function renderMusicPlaylistInfo(options) {
  if (!musicPlaylistInfo) return;
  const total = Array.isArray(musicPlaylist) ? musicPlaylist.length : 0;
  const track = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  if (track && track.title) {
    const variant = formatPlaylistVariant(track.playlist);
    musicPlaylistInfo.textContent = `지금 재생 중: ${track.title}${variant} · 전체 ${total}곡`;
  } else {
    musicPlaylistInfo.textContent = `기본 플레이리스트 · 총 ${total}곡`;
  }
  // 2026-07-13: 음악 정보 패널의 곡명 표시 + 좋아요/싫어요 버튼 상태도
  // 트랙이 바뀔 때마다 여기서 함께 갱신한다(호출 지점이 이미 여러 곳이라
  // 이 한 함수에만 붙여두면 전부 자동으로 따라온다).
  if (musicTrackTitle) {
    musicTrackTitle.textContent = track && track.title ? track.title : "재생 대기 중";
  }
  // 트랙이 바뀌는 시점에 이전 곡의 진행률이 잠깐 남아 보이지 않도록 즉시 리셋
  // — 새 값은 곧이어 updateMusicProgress()의 timeupdate가 다시 채운다.
  if (musicProgressFill) musicProgressFill.style.width = "0%";
  renderMusicReactionButtons();
  // 2026-07-15: 네이티브 크로스페이드 완료 시점(handleActivePlayerEnded의
  // crossfadeTriggered 분기)에는 이 트랙 전환 소식을 네이티브에 또 보내면
  // 안 된다 — 네이티브는 이미 자기 자신의 crossfadeStart/tickFade 타이머로
  // 이 전환을 스스로 끝냈고(currentURLString·제목·잠금화면 정보까지 이미
  // NativeRadioPlayer.finishCrossfade()가 갱신함), 여기서 JS가 또 trackChanged를
  // 보내면 두 타이머가 정확히 같은 순간에 끝나지 않는 경우(수십ms 오차)
  // "네이티브는 아직 페이드 중인데 JS는 벌써 끝났다고 판단" 하는 경쟁이
  // 생겨 cancelActiveCrossfade()가 페이드를 도중에 끊고 새 트랙을 처음부터
  // 다시 하드컷하는 사고로 이어질 수 있다. 네이티브가 이미 알아서 처리한
  // 전환이므로 JS 쪽 신호는 생략하고 화면 텍스트 갱신만 한다.
  if (!(options && options.skipNativeSync)) {
    syncNativeTrackInfo(); // 이 함수가 트랙 전환 전부(수동 스킵·자동전환·필터변경 포함)의 공통 지점.
  }
}

// 2026-07-12: "몇 가지 플레이리스트로 나눌 수 있나" 요청 — 실제 존재하는
// category 값(오리지널 포함 7종)을 기준으로 자동으로 옵션을 만든다. 트랙이
// 나중에 더 늘어나거나 카테고리가 추가돼도 이 목록·라디오 버튼은 코드 수정
// 없이 자동으로 따라간다.
function buildMusicPlaylistOptions() {
  const counts = new Map();
  if (Array.isArray(musicPlaylist)) {
    musicPlaylist.forEach((track) => {
      const key = trackCategoryKey(track);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
  }
  const options = [{ key: "all", label: "전체(랜덤·장르 골고루)", count: musicPlaylist.length }];
  Array.from(counts.keys()).forEach((key) => {
    options.push({ key, label: musicCategoryLabel(key), count: counts.get(key) });
  });
  return options;
}

function renderMusicPlaylistFilterOptions() {
  if (!musicPlaylistOptionsEl) return;
  const options = buildMusicPlaylistOptions();
  const current = loadMusicPlaylistFilter();
  musicPlaylistOptionsEl.innerHTML = options.map((option) => {
    const checked = option.key === current ? " checked" : "";
    return `<label class="field-option"><input type="radio" name="musicPlaylistFilter" value="${option.key}"${checked}><span>${option.label} (${option.count}곡)</span></label>`;
  }).join("");
}

// 필터를 바꾸는 순간 라운드로빈 순서를 새로 시작하고, 지금 재생 중이면
// 곧바로 새 필터에 맞는 곡으로 전환한다(라디오를 누르는 즉시 "장르가
// 바뀌는" 체감을 주기 위함). 재생 중이 아니면 다음 재생 때부터 적용된다.
function applyMusicPlaylistFilter(newKey) {
  saveMusicPlaylistFilter(newKey);
  categoryRotationQueue = [];
  syncMusicExcludeFilterUi();
  if (musicPlaying) {
    playTrackAtIndex(pickNextTrackIndex());
  } else {
    renderMusicPlaylistInfo();
  }
}

// 2026-07-16 유저 요청 — 플레이리스트로 선택된 장르 하나와 제외 필터가
// 서로 모순되는 조합(위 musicExcludeFilterContradicts 참조)이면, 그 제외
// 체크박스를 비활성화하고 화면에서도 체크 해제된 것처럼 보여준다. 저장된
// 실제 선호값(localStorage)은 건드리지 않으므로, 나중에 '전체'나 다른
// 장르로 돌아가면 원래 체크해뒀던 제외 설정이 그대로 복원된다.
function syncMusicExcludeFilterUi() {
  const filterKey = loadMusicPlaylistFilter();
  const bindings = [
    { el: musicExcludeVocalEl, kind: "vocal", key: musicExcludeVocalStorageKey },
    { el: musicExcludeInstrumentalEl, kind: "instrumental", key: musicExcludeInstrumentalStorageKey },
    { el: musicExcludeRockEl, kind: "rock", key: musicExcludeRockStorageKey },
  ];
  bindings.forEach(({ el, kind, key }) => {
    if (!el) return;
    const contradicts = musicExcludeFilterContradicts(kind, filterKey);
    el.disabled = contradicts;
    el.checked = contradicts ? false : loadMusicGenreToggle(key, false);
    const chip = el.closest(".exclude-chip");
    if (chip) chip.classList.toggle("is-disabled", contradicts);
  });
}

// Rock/Vocal 포함 체크박스를 바꾼 직후 — 플레이리스트 필터를 바꿀 때와 동일한
// 방식으로 즉시 반영한다(라운드로빈 순서 리셋 + 재생 중이면 바로 전환).
function applyMusicGenreToggle() {
  categoryRotationQueue = [];
  if (musicPlaying) {
    playTrackAtIndex(pickNextTrackIndex());
  } else {
    renderMusicPlaylistInfo();
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

// 2026-07-16: "정각 세리모니" / "퇴근 세리모니" — 성동님 요청("어려우면
// 리스크 감수하지 말고")에 맞춰 기존 오디오/재생 로직은 전혀 건드리지
// 않고, "새 곡이 실제로 시작된 순간"에만 훅을 거는 방식으로 구현한다.
// recordPlayLog(index)는 자동재생/스킵/크로스페이드전환/히스토리 바로듣기/
// 앱 재시작 복원 등 "새 트랙 시작" 경로 전부(위 grep으로 5곳 전체 확인)에서
// 정확히 1회씩만 호출되는 유일한 공통 지점이라, 여기 하나에만 걸어두면
// 모든 경로가 자동으로 커버된다 — 개별 호출부를 일일이 건드릴 필요가 없어
// 실수로 한 경로를 빠뜨릴 위험도 없다.
// 트리거는 어디까지나 "수동적"이다: 정각마다 강제로 곡을 바꾸지 않고,
// 그 순간 마침 새 곡이 시작됐을 때만 시계를 확인한다 — 재생 중이던 곡을
// 세리모니를 위해 억지로 끊는 일은 절대 없다(성동님 요청 원문 "시작되는
// 음악이 있는 경우"에 정확히 맞춘 설계).
// 2026-07-16: 곡이 3분 안팎으로 길 수 있어 "정각+2분"은 너무 타이트하다는
// 재지적 — 실제 서비스 값을 2분 → 5분으로 넓혔다.
// 2026-07-16: 임시 테스트 확대(60분, 사실상 상시 발동)로 인해 "세리모니가
// 항상 켜져있다"는 재지적 발생 — 테스트 목적 달성 후 원래 값 5로 원복.
const MUSIC_HOURLY_CEREMONY_WINDOW_MIN = 5;

// 2026-07-16: reshuffleMusicOrder()가 유발한 트랙 전환 1회만 세리모니
// 판정에서 제외하기 위한 1회성 플래그(아래 handleMusicCeremonyOnTrackStart
// 참조). 셔플 버튼처럼 "사용자가 명시적으로 누른 행위"로 인한 전환은
// "마침 정각에 새 곡이 시작된 우연"이 아니므로 세리모니를 띄우면 안 된다.
let suppressCeremonyOnNextTrackStart = false;

// 비주얼라이저가 패널 박스를 뚫고 위(플립시계 쪽)로 솟구치는 연출.
// 2026-07-16 2차: 10초 고정 타이머는 "너무 짧다"는 재지적으로 완전히
// 제거했다 — 이제 "Leave Work" 문구와 똑같은 생명주기를 쓴다. 즉 그 곡이
// 끝날 때(=다음 곡의 recordPlayLog가 hideMusicHourlyCeremony를 호출할 때)
// 까지 계속 유지되고, 다음 곡이 시작되면 그 곡이 조건에 다시 해당하는지를
// 새로 판단한다. 실제 막대 높이 계산(drawMusicViz 등 오디오 반응 로직)은
// 전혀 건드리지 않고, 이미 그려진 막대 각각을 CSS transform:scaleY로
// 시각적으로만 부풀린다 — 오디오/캔버스 쪽 회귀 위험이 없는 순수 CSS
// 오버레이 효과.
function triggerMusicHourlyCeremony() {
  if (musicInfoPanel) musicInfoPanel.classList.add("ceremony-breakout");
}

function hideMusicHourlyCeremony() {
  if (musicInfoPanel) musicInfoPanel.classList.remove("ceremony-breakout");
}

function showLeaveWorkCeremony() {
  if (musicLeaveWorkEl) musicLeaveWorkEl.classList.add("is-visible");
}

function hideLeaveWorkCeremony() {
  if (musicLeaveWorkEl) musicLeaveWorkEl.classList.remove("is-visible");
}

// recordPlayLog(index)가 호출될 때마다(= 새 곡이 막 시작될 때마다) 실행.
function handleMusicCeremonyOnTrackStart() {
  // 어떤 곡으로 넘어가든 이전 곡의 세리모니는 일단 끈다 — 그 다음 이번
  // 곡이 조건에 맞으면 아래에서 다시 켠다.
  hideLeaveWorkCeremony();
  hideMusicHourlyCeremony();
  if (suppressCeremonyOnNextTrackStart) {
    // 셔플 버튼이 유발한 전환 — 이번 1회만 건너뛰고 플래그를 바로 리셋한다.
    suppressCeremonyOnNextTrackStart = false;
    return;
  }
  const now = new Date();
  if (now.getMinutes() >= MUSIC_HOURLY_CEREMONY_WINDOW_MIN) return; // 정각+5분 지났으면 세리모니 없음
  triggerMusicHourlyCeremony();
  // "퇴근 세리모니": 18시대 또는 19시대에 정각 세리모니 조건까지 겹치면
  // 추가로 텍스트 표시 — 이 곡이 끝날 때까지 유지된다.
  // 2026-07-16: 하루 2번(18시·19시)으로 확대 — "6시에 퇴근 못하는 사람도
  // 7시엔 퇴근하라"는 성동님 요청.
  if (now.getHours() === 18 || now.getHours() === 19) showLeaveWorkCeremony();
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
  handleMusicCeremonyOnTrackStart();
}

function renderMusicHistoryList() {
  const target = musicHistoryBody || musicHistoryList;
  if (!target) return;
  const log = loadMusicPlayLog();
  if (log.length === 0) {
    target.innerHTML = '<tr><td colspan="3" class="settings-desc settings-desc-muted">아직 재생 기록이 없습니다.</td></tr>';
    return;
  }
  const currentTrack = Array.isArray(musicPlaylist) && musicPlaylist.length > 0
    ? musicPlaylist[musicIndex % musicPlaylist.length]
    : null;
  // 2026-07-15: 히스토리 목록에서도 좋아요/싫어요 상태를 보고 바로 고칠 수
  // 있게 신설 — 매 렌더마다 현재 좋아요/싫어요 목록을 한 번만 불러와
  // Set으로 만들어 행마다 반복 조회 비용을 줄인다.
  const likedSet = new Set(loadLikedTracks());
  const dislikedSet = new Set(loadDislikedTracks());
  target.innerHTML = log.map((entry) => {
    const isCurrent = Boolean(currentTrack && currentTrack.file === entry.file);
    const variant = formatPlaylistVariant(entry.playlist);
    const isPlayingNow = isCurrent && musicPlaying;
    const ariaLabel = isPlayingNow ? "지금 재생 중" : "재생";
    const isLiked = Boolean(entry.file && likedSet.has(entry.file));
    const isDisliked = Boolean(entry.file && dislikedSet.has(entry.file));
    return `<tr class="music-history-row${isCurrent ? " is-current" : ""}">`
      + `<td class="music-history-title">${entry.title}${variant}</td>`
      + `<td class="music-history-play-cell"><button type="button" class="music-history-play-btn${isPlayingNow ? " is-playing" : ""}" data-history-file="${entry.file}" aria-label="${ariaLabel}"></button></td>`
      + `<td class="music-history-reaction-cell">`
        + `<button type="button" class="music-history-like-btn" data-history-like="${entry.file}" aria-pressed="${isLiked}" aria-label="이 곡 좋아요"></button>`
        + `<button type="button" class="music-history-dislike-btn" data-history-dislike="${entry.file}" aria-pressed="${isDisliked}" aria-label="이 곡 싫어요"></button>`
      + `</td>`
      + `</tr>`;
  }).join("");
}

// 히스토리 목록의 "바로 듣기" 버튼 — 스킵 버튼과 같은 방식(크로스페이드 없이
// 즉시 전환)으로 유저가 지정한 곡으로 바로 바꾼다. playNextTrack과 전환
// 로직은 같고, 다음 곡을 무작위로 고르는 대신 지정된 파일을 찾아 튼다는
// 점만 다르다 — 기존 playNextTrack은 그대로 두고 별도 함수로 추가해서
// (현재 실기기 검증 대기 중인) 기존 재생 전환 로직에 영향을 주지 않는다.
// 2026-07-12: 원래 playTrackFromHistory(file) 하나뿐이었는데, 플레이리스트
// (장르) 필터를 바꿨을 때도 같은 "즉시 전환" 동작이 필요해져서 인덱스 기반
// 공통 로직을 playTrackAtIndex로 분리했다. 동작은 기존과 완전히 동일하다 —
// playTrackFromHistory는 파일명으로 인덱스만 찾아 그대로 위임한다.
function playTrackAtIndex(index) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  if (index < 0 || index >= musicPlaylist.length) return;
  musicActionToken += 1; // 진행 중이던 이전 재생 시도(있었다면)를 무효화한다.
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
  // 2026-07-15: 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지
  // 않는다(파일 상단 nativeClockTimerId 관련 주석 참조) — 대신 가상시계를
  // 시작한다. 진짜 소리는 renderMusicPlaylistInfo() 안의 syncNativeTrackInfo가
  // 네이티브 AVPlayer에 전달한다.
  if (isNativeWrapper) {
    startNativeVirtualClock();
  } else {
    player.play().catch(() => {});
  }
  renderMusicToggle();
}

function playTrackFromHistory(file) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const index = musicPlaylist.findIndex((track) => track && track.file === file);
  if (index < 0) return;
  playTrackAtIndex(index);
}

// 2026-07-13: 히스토리 목록의 재생 버튼이 "지금 재생 중인 곡"을 다시 누르면
// 무조건 playTrackAtIndex(트랙 재로드 + 목록 맨 위로 재정렬)를 호출해버려서,
// 유저가 일시정지하려고 눌러도 곡이 처음부터 다시 로드되며 잠깐 끊겼다가
// 그대로 계속 재생되는 증상이 있었다(재정렬도 불필요하게 같이 일어남).
// 지금 재생 중인 곡이면 메인 재생/일시정지 버튼과 동일한 toggleMusic()을
// 그대로 재사용한다 — 이미 실기기에서 검증된 pause/resume 경로라 트랙을
// 다시 로드하지 않고 그 자리에서 멈추고/이어서 재생되며, recordPlayLog를
// 거치지 않으므로 목록 순서도 그대로 유지된다. 아직 재생된 적 없는 다른
// 곡을 누르는 경우에만 기존처럼 새로 재생을 시작한다(이때는 "최근 재생"
// 관례대로 맨 위로 오는 게 맞다).
function toggleTrackFromHistory(file) {
  if (!Array.isArray(musicPlaylist) || musicPlaylist.length === 0) return;
  const currentTrack = musicPlaylist[musicIndex % musicPlaylist.length];
  const isCurrent = Boolean(currentTrack && currentTrack.file === file);
  if (isCurrent) {
    toggleMusic();
    return;
  }
  playTrackFromHistory(file);
}

// 2026-07-15: 히스토리 목록의 좋아요/싫어요 버튼 — 메인 패널 버튼과 같은
// 저장 로직(loadLikedTracks/saveLikedTracks, loadDislikedTracks/
// saveDislikedTracks)을 그대로 재사용하되, "이미 눌려있으면 취소, 아니면
// 적용"하는 순수 토글로 만든다("한번 더 누르면 취소, 또 누르면 다시
// 싫어요(토글)" 요청 반영). 재생 중인 곡이 아니라 목록의 임의의 과거
// 트랙에 적용하는 것이므로, 메인 패널의 싫어요 버튼과 달리 playNextTrack()/
// 토스트는 호출하지 않는다 — 재생 중인 곡을 건드리는 게 아니라면 굳이
// 재생을 끊을 이유가 없다.
function toggleLikeFromHistory(file) {
  if (!file) return;
  const liked = loadLikedTracks();
  const idx = liked.indexOf(file);
  if (idx >= 0) liked.splice(idx, 1);
  else liked.push(file);
  saveLikedTracks(liked);
  renderMusicReactionButtons();
  renderMusicHistoryList();
}

function toggleDislikeFromHistory(file) {
  if (!file) return;
  const disliked = loadDislikedTracks();
  const idx = disliked.indexOf(file);
  if (idx >= 0) disliked.splice(idx, 1);
  else disliked.push(file);
  saveDislikedTracks(disliked);
  renderMusicReactionButtons();
  renderMusicHistoryList();
}

if (musicHistoryList) {
  musicHistoryList.addEventListener("click", (event) => {
    const likeBtn = event.target.closest("[data-history-like]");
    if (likeBtn) {
      toggleLikeFromHistory(likeBtn.dataset.historyLike);
      return;
    }
    const dislikeBtn = event.target.closest("[data-history-dislike]");
    if (dislikeBtn) {
      toggleDislikeFromHistory(dislikeBtn.dataset.historyDislike);
      return;
    }
    const button = event.target.closest("[data-history-file]");
    if (!button) return;
    toggleTrackFromHistory(button.dataset.historyFile);
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

function applyGenreSelection() {
  const checked = [...document.querySelectorAll("[data-genre-option]:checked")].map((input) => input.value);
  // 전부 끄는 걸 막는다 — 최소 하나는 항상 켜져 있어야 문장이 계속 나온다.
  selectedGenres = new Set(checked.length > 0 ? checked : ["investment"]);
  syncGenreControls();
  saveSelectedGenres();
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

    // 2026-07-08 버그 수정: "누르면 ezlong.com으로 넘어갔다가 1초 안에
    // 다시 원래 화면으로 튕겨 돌아온다"는 재지적 — 원인은 .sky-room에 걸린
    // scroll-snap-stop:always다. 이 값은 "진짜 유저 스와이프"만 스냅 대상
    // 으로 신뢰하도록 설계돼 있어서, scrollIntoView()로 프로그램이 직접
    // 스크롤을 시키면 WebKit이 이걸 신뢰하지 않고 원래 스냅 위치(sky-room)
    // 로 되돌려버리는 경우가 있다. 스크롤이 실제로 끝날 때까지만 스냅을
    // 잠깐 꺼서 방해받지 않게 하고, 끝나면 원래대로 복구한다(스와이프로
    // 넘기는 기존 동작은 전혀 건드리지 않는다).
    const html = document.documentElement;
    html.style.scrollSnapType = "none";

    window.setTimeout(() => {
      ezlongSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 260); // 회전이 절반쯤 진행됐을 때 스크롤을 시작해 자연스럽게 이어지게 한다.
    window.setTimeout(() => {
      skyRoom.classList.remove("is-flipping-away");
    }, 900); // 화면 밖으로 충분히 벗어난 뒤 원상태로 리셋(다음에 다시 볼 때 정상 모습).
    window.setTimeout(() => {
      html.style.scrollSnapType = ""; // 스크롤이 완전히 끝난 뒤 스냅을 복구한다.
    }, 1300);
  });
}

renderCategoryOptions();
loadSavedCategories();
loadSavedGenres();
renderMusicPlaylistInfo();
renderMusicPlaylistFilterOptions();
syncMusicExcludeFilterUi();
renderMusicQCPanel();
renderMusicToggle();
settingsOpen.addEventListener("click", openSettings);
settingsSave.addEventListener("click", () => {
  saveSelectedCategories();
  closeSettings();
});
document.querySelectorAll("[data-settings-close]").forEach((element) => {
  element.addEventListener("click", closeSettings);
});
if (weatherChipOpen) weatherChipOpen.addEventListener("click", openWeatherDetail);
document.querySelectorAll("[data-weather-detail-close]").forEach((element) => {
  element.addEventListener("click", closeWeatherDetail);
});
if (quoteAladinLink) {
  quoteAladinLink.addEventListener("click", () => {
    const url = quoteAladinLink.dataset.url;
    if (url) openAladinModal(url);
  });
}
// 2026-07-16 3차 개정: 하단 버튼이 이제 링크가 아니라 순수 "닫기" 버튼
// (data-aladin-modal-close)이라, 아래 공통 바인딩에 자동으로 걸린다 —
// 별도 클릭 핸들러가 더 필요 없다. window.open/location.href로 앱 밖으로
// 나가려던 예전 로직은 통째로 제거했다(네이티브 WKWebView에서 진짜 "새
// 탭"이 없어 돌아올 방법이 없었다는 유저 실측 피드백 반영).
document.querySelectorAll("[data-aladin-modal-close]").forEach((element) => {
  element.addEventListener("click", closeAladinModal);
});

// 2026-07-16 4차 개정: '설정'/'날씨 상세'/알라딘 모달 세 곳 모두 같은
// .settings-backdrop 구조를 공유한다(각 모달의 시트는 화면 하단에만 붙어
// 있고 그 위 배경은 스크롤할 내용이 전혀 없는 빈 공간이다). 유저의 스크롤
// 제스처가 시트가 아니라 이 빈 배경 위에서 시작되면 붙잡아줄 스크롤 대상이
// 없어 그대로 배경 문서(html)의 스크롤로 흘러가 버린다. 배경에서 시작된
// 터치는 touchmove에서 직접 preventDefault해서 원천 차단한다.
document.querySelectorAll(".settings-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("touchmove", (event) => {
    event.preventDefault();
  }, { passive: false });
});

// 2026-07-17 5차 개정: 4차(배경 차단)는 "배경에서 시작된 터치"만 막았을 뿐,
// 유저가 실제로 재현한 증상 — "시트가 살짝 움직이다가 끝에서 넘어감" —은
// 전혀 다른 지점이었다. 이건 터치가 시트 위에서 시작돼 시트 내부는 정상
// 스크롤되다가, 시트 스크롤이 맨 위/맨 아래 경계에 닿은 "이후"에도 유저가
// 같은 방향으로 손가락을 계속 움직이면 그 초과분 제스처가 그대로 조상
// 요소(html)의 scroll-snap 스크롤로 흘러넘치는 "스크롤 체이닝"이다.
// CSS `overscroll-behavior: contain`이 이걸 막아줘야 정상이지만(1차 시도),
// WebKit은 scroll-snap 조상 + 중첩 스크롤 컨테이너 조합에서 이 속성이
// 스냅 포인트 재계산까지는 억제하지 못하는 알려진 사례가 있다 — rubber-band
// 튕김은 막아도 "다음 스냅 포인트로 넘어가는 판단" 자체는 별도 로직이라
// 새어나갈 수 있다. 그래서 CSS에 의존하지 않고 touchstart/touchmove로
// 직접 방향과 스크롤 위치를 계산해 경계 초과 제스처를 앱 차원에서
// preventDefault로 원천 차단한다 — overscroll-behavior가 대중화되기 전에
// 널리 쓰이던 표준 수동 기법이라 WebKit 버전 편차와 무관하게 동작한다.
function guardSheetScrollChaining(sheet) {
  if (!sheet) return;
  let startY = 0;
  sheet.addEventListener(
    "touchstart",
    (event) => {
      startY = event.touches[0].clientY;
    },
    { passive: true }
  );
  sheet.addEventListener(
    "touchmove",
    (event) => {
      const currentY = event.touches[0].clientY;
      const deltaY = currentY - startY; // 양수 = 손가락이 아래로(콘텐츠 위쪽 노출), 음수 = 위로(콘텐츠 아래쪽 노출)
      const atTop = sheet.scrollTop <= 0;
      const atBottom = sheet.scrollTop + sheet.clientHeight >= sheet.scrollHeight - 1;
      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
    },
    { passive: false }
  );
}
document
  .querySelectorAll(".settings-sheet, .weather-detail-sheet")
  .forEach(guardSheetScrollChaining);
if (musicSettingsOpen) musicSettingsOpen.addEventListener("click", handleMusicIconTap);
if (musicToggle) musicToggle.addEventListener("click", toggleMusic);
if (musicSkip) musicSkip.addEventListener("click", () => {
  // 2026-07-16 유저 요청: 예전엔 10초 이상 들은 곡을 수동 스킵하면 "싫어요"와
  // 똑같이 disliked 목록에 자동으로 추가됐다(암묵적 학습 휴리스틱). 이제는
  // 명시적인 "싫어요" 버튼이 따로 있으므로, '다음곡'은 그 어떤 감산·학습
  // 효과도 없이 순수하게 다음 곡으로만 넘어간다.
  playNextTrack();
});

// 2026-07-13: 음악 정보 패널 — 톱니바퀴만 음악설정으로 이동, 좋아요/싫어요는
// 로컬 기록(1단계). 패널 토글과 겹치지 않도록 전부 stopPropagation.
if (musicGearOpen) musicGearOpen.addEventListener("click", (event) => {
  event.stopPropagation();
  openSettings();
});
if (musicShuffleButton) musicShuffleButton.addEventListener("click", (event) => {
  event.stopPropagation();
  reshuffleMusicOrder();
});
if (musicLikeButton) musicLikeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const track = currentMusicTrack();
  if (!track || !track.file) return;
  const liked = loadLikedTracks();
  const idx = liked.indexOf(track.file);
  if (idx >= 0) liked.splice(idx, 1); else liked.push(track.file);
  saveLikedTracks(liked);
  renderMusicReactionButtons();
});
if (musicDislikeButton) musicDislikeButton.addEventListener("click", (event) => {
  event.stopPropagation();
  const track = currentMusicTrack();
  if (!track || !track.file) return;
  const disliked = loadDislikedTracks();
  if (!disliked.includes(track.file)) {
    disliked.push(track.file);
    saveDislikedTracks(disliked);
  }
  renderMusicReactionButtons();
  showMusicDislikeToast();
  // 명시적으로 싫어요를 누른 것이므로, 스킵과 마찬가지로 바로 다음 곡으로
  // 넘어간다(이미 disliked에 들어갔으니 다시 뽑히지 않는다).
  playNextTrack();
});
if (musicInfoPanel) musicInfoPanel.addEventListener("click", (event) => event.stopPropagation());

// 2026-07-14 19차: 진행률 바 드래그/클릭 탐색(seek) — 성동님 요청으로 재생
// 위치를 손가락/마우스로 자유롭게 옮길 수 있게 한다. Pointer Events 하나로
// 마우스·터치 모두 처리하고, setPointerCapture로 손가락이 바 바깥으로
// 나가도 드래그가 끊기지 않게 한다.
let musicProgressDragging = false;
function seekMusicProgressToClientX(clientX) {
  if (!musicProgressBar) return;
  const rect = musicProgressBar.getBoundingClientRect();
  if (!rect || rect.width <= 0) return;
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const player = activePlayer();
  if (!player) return;
  const liveDuration = player.duration;
  const duration = Number.isFinite(liveDuration) && liveDuration > 0
    ? liveDuration
    : parseFloat(player.dataset.cachedDuration || "NaN");
  if (!Number.isFinite(duration) || duration <= 0) return;
  player.currentTime = ratio * duration;
  // timeupdate가 다음 프레임에 다시 정확한 값으로 갱신하겠지만, 드래그
  // 중에는 그 전에도 손끝을 그대로 따라가도록 낙관적으로 먼저 채워준다.
  if (musicProgressFill) musicProgressFill.style.width = (ratio * 100).toFixed(2) + "%";
}
if (musicProgressBar) {
  musicProgressBar.setAttribute("aria-hidden", "false");
  musicProgressBar.setAttribute("role", "slider");
  musicProgressBar.setAttribute("aria-label", "재생 위치");
  musicProgressBar.setAttribute("aria-valuemin", "0");
  musicProgressBar.setAttribute("aria-valuemax", "100");
  musicProgressBar.setAttribute("tabindex", "0");
  musicProgressBar.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    musicProgressDragging = true;
    try { musicProgressBar.setPointerCapture(event.pointerId); } catch (error) { /* 구형 브라우저 폴백 없이 그냥 진행 */ }
    seekMusicProgressToClientX(event.clientX);
  });
  musicProgressBar.addEventListener("pointermove", (event) => {
    if (!musicProgressDragging) return;
    event.stopPropagation();
    seekMusicProgressToClientX(event.clientX);
  });
  const endMusicProgressDrag = (event) => {
    if (!musicProgressDragging) return;
    musicProgressDragging = false;
    try { musicProgressBar.releasePointerCapture(event.pointerId); } catch (error) { /* no-op */ }
    syncNativeSeek(); // 드래그가 끝난 최종 위치를 네이티브(잠금화면 재생 위치)에도 반영.
  };
  musicProgressBar.addEventListener("pointerup", endMusicProgressDrag);
  musicProgressBar.addEventListener("pointercancel", endMusicProgressDrag);
  // 키보드로도 5초 단위 탐색 가능(접근성 보너스).
  musicProgressBar.addEventListener("keydown", (event) => {
    const player = activePlayer();
    if (!player) return;
    if (event.key === "ArrowRight") { event.preventDefault(); player.currentTime = Math.min((player.duration || 0), player.currentTime + 5); syncNativeSeek(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); player.currentTime = Math.max(0, player.currentTime - 5); syncNativeSeek(); }
  });
}
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
    // 2026-07-15: 네이티브 모드에서는 이 <audio>를 절대 실제로 play()하지
    // 않으므로(파일 상단 nativeClockTimerId 관련 주석 참조) 재시도도 load()+
    // play() 대신 곧바로 다음 곡으로 넘긴다 — 어차피 소리는 이 엘리먼트가
    // 아니라 네이티브 AVPlayer가 낸다.
    if (isFatal || musicErrorRetryCount >= 1 || isNativeWrapper) {
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
  // 2026-07-08 재수정: pause/playing 이벤트는 브라우저 큐를 거쳐 비동기로
  // 도착한다 — 연타 등으로 재생/일시정지 시도가 겹치면, 먼저 눌렀던
  // 시도의 이벤트가 나중 시도의 이벤트보다 늦게 도착해 최신 상태를
  // 덮어써버리는 경우가 있었다("재생 중인데 버튼은 일시정지 표시" 재발
  // 원인). 이벤트가 올 때마다 바로 반영하지 않고 짧게 모았다가(디바운스)
  // 그 시점의 실제 <audio>.paused 값 하나만 확정적으로 반영하도록 바꾼다 —
  // 이벤트가 몇 개, 어떤 순서로 도착하든 결과는 항상 실제 재생 상태와
  // 일치한다.
  player.addEventListener("pause", () => {
    if (player !== activePlayer()) return; // 크로스페이드 전환 중 옛 active player의 의도된 pause는 무시
    scheduleMusicStateSync();
  });
  player.addEventListener("playing", () => {
    if (player !== activePlayer()) return;
    scheduleMusicStateSync();
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
if (genreOptions) {
  genreOptions.addEventListener("change", (event) => {
    if (event.target.matches("[data-genre-option]")) {
      applyGenreSelection();
    }
  });
}
if (musicPlaylistOptionsEl) {
  musicPlaylistOptionsEl.addEventListener("change", (event) => {
    if (event.target.matches('input[name="musicPlaylistFilter"]') && event.target.checked) {
      applyMusicPlaylistFilter(event.target.value);
    }
  });
}
if (musicExcludeRockEl) {
  musicExcludeRockEl.addEventListener("change", () => {
    saveMusicGenreToggle(musicExcludeRockStorageKey, musicExcludeRockEl.checked);
    applyMusicGenreToggle();
  });
}
if (musicExcludeVocalEl) {
  musicExcludeVocalEl.addEventListener("change", () => {
    saveMusicGenreToggle(musicExcludeVocalStorageKey, musicExcludeVocalEl.checked);
    applyMusicGenreToggle();
  });
}
if (musicExcludeInstrumentalEl) {
  musicExcludeInstrumentalEl.addEventListener("change", () => {
    saveMusicGenreToggle(musicExcludeInstrumentalStorageKey, musicExcludeInstrumentalEl.checked);
    applyMusicGenreToggle();
  });
}
if (musicQCDeleteButton) {
  musicQCDeleteButton.addEventListener("click", permanentlyExcludeCurrentTrack);
}
if (musicQCCopyButton) {
  musicQCCopyButton.addEventListener("click", copyMusicRemovalRequests);
}
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSettings();
    closeWeatherDetail();
  }
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
// 2026-07-16: 이 15초 주기 재동기화를 폐기한다 — 유저가 겪은 "곡 중간에
// 갑자기 몇 초 되감겼다 정상 재생됨"(5초 지점 2초 되돌림, 3~5초·65% 지점
// 씹힘, 에어팟이 25~50% 지점에서 끊긴 것처럼 보인 사고 전부)의 공통 원인이
// 바로 이 한 줄이었던 것으로 최종 판단했다(유저 제보 "웹앱에서는 이런 문제가
// 한 번도 없었다"가 결정적 단서 — syncNativeSeek()은 네이티브 모드에서만
// 존재하는 경로다). 문제는 방향이 거꾸로였다는 것: 네이티브(AVPlayer)가
// 실제로 소리를 내는 "진짜 재생 위치"의 원본(source of truth)인데, 이 줄은
// 거꾸로 JS의 가상시계(tickNativeVirtualClock, 250ms 주기 setInterval — 메인
// 스레드가 잠깐이라도 밀리면 자연히 실제 위치보다 뒤처질 수 있음)의 값을
// 네이티브에 "이 시간으로 맞춰라"라고 떠밀었다. 밀린 값과 실제 위치가 1초
// 넘게 벌어지면(NativeRadioPlayer.seek()의 1초 허용오차) 네이티브가 강제로
// seek()당하는데, 아직 전부 버퍼링되지 않은 스트리밍 파일이면 이 seek 자체가
// 순간 버퍼링 정지를 유발해 "끊김"·"되감김"·"멈춰서 재생버튼 눌러야 함"처럼
// 들렸다. 방향을 바로잡으면(네이티브→JS로 시계를 맞추는 것) 이런 부작용
// 자체가 원천 차단된다 — 그리고 그 "네이티브→JS 동기화"는 이미
// __flipzenNativeTimeSync(앱이 백그라운드에서 돌아올 때 호출됨)가 정확히
// 담당하고 있으므로, 오랜 시간 재생 후에도 화면 진행률이 크게 벌어지는
// 문제는 이미 다른 경로로 방지돼 있다. syncNativeSeek() 함수 자체는 지우지
// 않는다 — 유저가 진행률 바를 직접 드래그하거나 화살표키로 탐색했을 때는
// "지금 이 위치로 실제로 이동하라"는 의도가 분명한 진짜 seek 요청이라
// 네이티브가 따라가는 게 맞다(아래 이벤트 리스너들에서 호출).

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
  // 2026-07-09: 저장된 날짜(savedOn)가 "오늘"과 같을 때만 이어듣기를 적용한다.
  // savedOn이 아예 없는 예전 저장값(이 수정 이전에 저장된 것)은 날짜를 알 수
  // 없으므로 안전하게 "오늘 아님"으로 취급해 새 곡을 고르게 한다 — 유저
  // 입장에선 이 업데이트 이후 첫 실행 한 번만 새 곡으로 시작하고, 그 다음부터는
  // 정상적으로 하루 단위 이어듣기가 자리잡는다.
  if (resume && Array.isArray(musicPlaylist) && resume.savedOn === localDateStamp()) {
    const idx = musicPlaylist.findIndex((track) => track && track.file === resume.file);
    if (idx >= 0) resumeIndex = idx;
  }
  musicIndex = resumeIndex >= 0 ? resumeIndex : pickNextTrackIndex();
  recordTrackHeard(musicIndex);
  recordPlayLog(musicIndex);
  renderMusicPlaylistInfo();
  renderMusicHistoryList();
  player._pendingLoad = loadMusicTrack(player, musicIndex, { prebuffer: true });
  // 2026-07-16: "3~5초쯤 한 번씩 씹힌다"는 재지적 — 네이티브 모드에서는
  // 위 JS쪽 blob 프리버퍼가 아무 의미가 없다(어차피 이 <audio>를 실제로
  // 재생하지 않으므로). 정작 소리를 내는 NativeRadioPlayer의 TrackFileCache는
  // 지금까지 "곡이 끝나갈 때"만 다음 곡을 미리 받아뒀지, 앱을 막 열어서
  // 재생 버튼을 처음 누르는 "첫 곡"은 미리 받아둘 기회 자체가 없어서 항상
  // 콜드 스트리밍으로 시작했다 — 이게 초반 몇 초가 씹히는 진짜 원인이었다.
  // 앱이 뜨자마자(재생 버튼을 누르기 전부터) 네이티브에도 첫 곡을 미리
  // 받아두라고 알려준다.
  if (isNativeWrapper && Array.isArray(musicPlaylist) && musicPlaylist.length > 0) {
    const firstTrack = musicPlaylist[musicIndex % musicPlaylist.length];
    if (firstTrack) {
      postToNativeRadio({ action: "prefetchNext", url: resolveTrackAbsoluteUrl(firstTrack) });
    }
  }
})();

// 2026-07-08: 앱이 백그라운드로 가거나(다른 앱 전환) 아예 종료될 때도 마지막
// 재생 위치를 놓치지 않도록 강제 저장한다. timeupdate 기반 저장(5초 간격)만
// 믿으면 그 사이에 앱이 꺼질 경우 최대 5초 분량이 유실될 수 있다.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    maybeSaveMusicResume(true);
    // 2026-07-15: 이제 백그라운드 전환 시점에 뭔가를 새로 트리거할 필요가
    // 없다 — 네이티브 AVPlayer가 재생 시작부터 이미 소리를 내고 있으므로,
    // 여기서는 예전과 같이 재생 위치 저장만 하면 된다.
  } else if (document.visibilityState === "visible") {
    // 2026-07-16: 포그라운드 복귀 시 알라딘 아이콘/모달 상태 재동기화(위
    // resyncAladinUiAfterForeground 주석 참고).
    resyncAladinUiAfterForeground();
  }
});
window.addEventListener("pagehide", () => maybeSaveMusicResume(true));
