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

let quotes = baseQuotes.map((quote) => ({
  ...quote,
  category: getQuoteCategory(quote)
}));

const app = document.querySelector(".clock-app");
const dots = document.querySelectorAll("[data-scene-button]");
const photoCredit = document.getElementById("photoCredit");
const quotePanel = document.querySelector(".quote-panel");
const quoteProgress = document.getElementById("quoteProgress");
const settingsPanel = document.getElementById("quoteSettings");
const settingsOpen = document.getElementById("settingsOpen");
const settingsSave = document.getElementById("settingsSave");
const allCategories = document.getElementById("allCategories");
const categoryOptions = document.getElementById("categoryOptions");
const webviewScale = document.getElementById("ezlongWebviewScale");
const digitElements = [
  document.getElementById("hourTens"),
  document.getElementById("hourOnes"),
  document.getElementById("minuteTens"),
  document.getElementById("minuteOnes")
];

let activeScene = "";
let activeQuoteMinute = "";
let lastQuoteTitle = "";
let recentQuoteAuthors = [];
let quoteDeck = [];
let selectedCategories = new Set();
let lastScenePhoto = {};
let lastDigits = ["", "", "", ""];
let timeHasRendered = false;
let manualSceneUntil = 0;
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
  if ([51, 56, 61, 80].includes(code)) return "light-rain";
  if ([53, 63, 81].includes(code) && precipitation < 0.5) return "light-rain";
  if ([53, 63, 81].includes(code)) return "rain";
  if ([55, 57, 65, 66, 67, 82].includes(code)) return "heavy-rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([3].includes(code)) return "cloudy";
  if ([1, 2].includes(code)) return "partly-cloudy";
  return "clear";
}

function weatherTagGroup(tag) {
  if (["light-rain", "rain", "heavy-rain"].includes(tag)) return "rain";
  if (["partly-cloudy", "cloudy", "mist"].includes(tag)) return "cloudy";
  return tag;
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

function pickScenePhoto(sceneId) {
  const timeBuckets = getSceneTimeBuckets(sceneId);
  const currentTag = weatherState.tag;
  const groupedTag = weatherTagGroup(currentTag);
  const currentSeason = getCurrentSeason();
  const seasonMatches = (image) => image.seasonTags?.includes(currentSeason);
  const archivePhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const timeMatch = image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket));
      const exactWeatherMatch = image.weatherTags?.includes(currentTag);
      return seasonMatch && timeMatch && exactWeatherMatch && imageUrl(image);
    })
    .map((image) => image);
  const groupedArchivePhotos = backgroundArchive
    .filter((image) => {
      const seasonMatch = seasonMatches(image);
      const timeMatch = image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket));
      const weatherMatch = image.weatherTags?.includes(groupedTag);
      return seasonMatch && timeMatch && weatherMatch && imageUrl(image);
    })
    .map((image) => image);
  const fallbackArchivePhotos = backgroundArchive
    .filter((image) => seasonMatches(image) && image.timeBuckets?.some((bucket) => timeBuckets.includes(bucket)) && imageUrl(image))
    .map((image) => image);
  const photos = archivePhotos.length > 0
    ? archivePhotos
    : groupedArchivePhotos.length > 0
      ? groupedArchivePhotos
      : fallbackArchivePhotos.length > 0
        ? fallbackArchivePhotos
        : scenePhotos[sceneId] || [];
  if (photos.length === 0) return "";

  let photo = photos[Math.floor(Math.random() * photos.length)];
  if (photos.length > 1 && imageUrl(photo) === lastScenePhoto[sceneId]) {
    const nextIndex = (photos.indexOf(photo) + 1) % photos.length;
    photo = photos[nextIndex];
  }

  lastScenePhoto[sceneId] = imageUrl(photo);
  return photo;
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
    setScene(getSceneForHour(now.getHours()), { syncDots: true });
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
  app.style.setProperty("--photo", `url("${imageUrl(photo)}")`);
  renderPhotoCredit(photo);

  renderWeather();

  if (options.syncDots) {
    dots.forEach((dot) => {
      dot.classList.toggle("active", dot.dataset.sceneButton === sceneId);
    });
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
  if ([0].includes(code)) return "맑음";
  if ([1, 2].includes(code)) return "구름 조금";
  if ([3].includes(code)) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 56].includes(code)) return "약한 이슬비";
  if ([53].includes(code)) return "이슬비";
  if ([55, 57].includes(code)) return "강한 이슬비";
  if ([61, 80].includes(code)) return "약한 비";
  if ([63, 81].includes(code) && precipitation <= 0) return "가끔 약한 비";
  if ([63, 81].includes(code) && precipitation < 0.5) return "약한 비";
  if ([63, 81].includes(code)) return "비";
  if ([65, 66, 67, 82].includes(code)) return "강한 비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return "날씨";
}

function requestCurrentWeather() {
  if (!navigator.geolocation) {
    weatherState = { location: "Seoul", temp: "--°", summary: "위치 권한 필요", icon: "sun-icon", tag: "clear" };
    renderWeather();
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

        weatherState = {
          location,
          temp: Number.isFinite(current.temperature_2m) ? `${Math.round(current.temperature_2m)}°` : "--°",
          summary: weatherCodeToSummary(current.weather_code, current),
          icon: current.is_day === 0 ? "moon-icon" : "sun-icon",
          tag: weatherCodeToTag(current.weather_code, current)
        };
      } catch (error) {
        weatherState = { location: "현재 위치", temp: "--°", summary: "날씨 오류", icon: "sun-icon", tag: "clear" };
      }
      renderWeather();
      if (activeScene) setScene(activeScene, { syncDots: true, force: true });
    },
    () => {
      weatherState = { location: "Seoul", temp: "--°", summary: "위치 권한 필요", icon: "sun-icon", tag: "clear" };
      renderWeather();
    },
    { enableHighAccuracy: false, timeout: 9000, maximumAge: 10 * 60 * 1000 }
  );
}

async function loadBackgroundArchive() {
  try {
    const response = await fetch("data/background-manifest.json", { cache: "no-cache" });
    if (!response.ok) return;
    const data = await response.json();
    backgroundArchive = Array.isArray(data.images) ? data.images : [];
    if (activeScene) setScene(activeScene, { syncDots: true, force: true });
  } catch (error) {
    backgroundArchive = [];
  }
}

function normalizeQuote(quote) {
  if (!quote?.text || !quote?.title || !quote?.author) return null;
  return {
    english: quote.english || "",
    text: quote.text,
    title: quote.title,
    author: quote.author,
    category: getQuoteCategory(quote),
    sourceUrl: quote.sourceUrl || "",
    rights: quote.rights || "short-quote"
  };
}

async function loadQuoteArchive() {
  try {
    const response = await fetch("data/quote-archive-manifest.json", { cache: "no-cache" });
    if (!response.ok) return;
    const data = await response.json();
    const archivedQuotes = Array.isArray(data.quotes)
      ? data.quotes.map(normalizeQuote).filter(Boolean)
      : [];
    if (archivedQuotes.length === 0) return;

    const seen = new Set();
    quotes = [...baseQuotes, ...archivedQuotes]
      .map(normalizeQuote)
      .filter(Boolean)
      .filter((quote) => {
        const key = `${quote.title}|${quote.author}|${quote.text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    quoteDeck = [];
    lastQuoteTitle = "";
    recentQuoteAuthors = [];
    renderQuote(getNextQuote());
  } catch (error) {
    // Keep bundled quotes if archive loading fails.
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

  if (quoteDeck.length > 1) {
    const shouldAvoidFirst =
      quoteDeck[0].title === lastQuoteTitle || recentQuoteAuthors.includes(quoteDeck[0].author);
    const idealAlternativeIndex = quoteDeck.findIndex(
      (quote) => quote.title !== lastQuoteTitle && !recentQuoteAuthors.includes(quote.author)
    );
    const fallbackAlternativeIndex = quoteDeck.findIndex(
      (quote) => quote.title !== lastQuoteTitle || !recentQuoteAuthors.includes(quote.author)
    );
    const alternativeIndex = idealAlternativeIndex > 0 ? idealAlternativeIndex : fallbackAlternativeIndex;

    if (shouldAvoidFirst && alternativeIndex > 0) {
      [quoteDeck[0], quoteDeck[alternativeIndex]] = [quoteDeck[alternativeIndex], quoteDeck[0]];
    }
  }

  if (quoteDeck.length > 1 && quoteDeck[0].title === lastQuoteTitle) {
    const alternativeIndex = quoteDeck.findIndex((quote) => quote.title !== lastQuoteTitle);
    if (alternativeIndex > 0) {
      [quoteDeck[0], quoteDeck[alternativeIndex]] = [quoteDeck[alternativeIndex], quoteDeck[0]];
    }
  }

  const quote = quoteDeck.shift();
  lastQuoteTitle = quote.title;
  recentQuoteAuthors = [quote.author, ...recentQuoteAuthors.filter((author) => author !== quote.author)].slice(0, 3);
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
}

function closeSettings() {
  settingsPanel.classList.remove("is-open");
  settingsPanel.setAttribute("aria-hidden", "true");
  settingsOpen.setAttribute("aria-expanded", "false");
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
  dot.addEventListener("click", () => {
    manualSceneUntil = Date.now() + 60 * 1000;
    setScene(dot.dataset.sceneButton, { syncDots: true, force: true });
  });
});

renderCategoryOptions();
loadSavedCategories();
settingsOpen.addEventListener("click", openSettings);
settingsSave.addEventListener("click", () => {
  saveSelectedCategories();
  closeSettings();
});
document.querySelectorAll("[data-settings-close]").forEach((element) => {
  element.addEventListener("click", closeSettings);
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
window.addEventListener("resize", resizeEzlongWebview);

resizeEzlongWebview();
loadBackgroundArchive();
loadQuoteArchive();
tick();
requestCurrentWeather();
window.setInterval(tick, 1000);
