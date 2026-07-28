/**
 * locale-bundle.js — ★ 자동 생성 파일. 직접 수정하지 마세요 ★
 *
 * 원본: i18n/locales/*.json
 * 생성: node scripts/build-locales.mjs
 * 생성 시각: 2026-07-28T02:52:11.947Z
 * 포함 로케일: en, ko
 *
 * 이 파일은 클래식 스크립트다 (index.html 이 type="module" 을 쓰지 않음).
 * i18n/index.js 보다 먼저 로드돼야 한다.
 */
(function (root) {
  root.FLIPZEN_LOCALE_CATALOGS = {
  "en": {
    "settings": {
      "title": "Settings",
      "premium": {
        "heading": "Premium",
        "desc": "Remove ads for a calmer, cleaner experience.",
        "cta": "Upgrade to Premium"
      },
      "background": {
        "heading": "Background Photos",
        "season": "Season",
        "weather": "Weather",
        "timeOfDay": "Time of day",
        "activeNotice": "Showing only photos that match {filters}.",
        "matchCriteriaAria": "Photo matching criteria",
        "photoAria": "Background photo {index}",
        "photoMissingAria": "Background photo {index} unavailable"
      },
      "music": {
        "heading": "Music · Playlists",
        "excludeHeading": "Exclude from shuffle all",
        "excludeSuffix": "Exclude {name}",
        "specialNotice": "These stay out of shuffle — they play only when you pick one below.",
        "specialAria": "Special — music for specific moments",
        "specialSelectAria": "Select a Special playlist",
        "playlistSelectAria": "Select a playlist",
        "excludeFilterAria": "Genre exclusion filter",
        "history": "Recently played",
        "historyEmpty": "Nothing played yet.",
        "keepOne": "Keep at least one playlist",
        "excludeAcoustic": "Exclude Acoustic",
        "excludeClassical": "Exclude Classical",
        "excludeVocal": "Exclude Vocal",
        "excludeRock": "Exclude Rock"
      },
      "visualizer": {
        "heading": "Visualizer",
        "desc": "Change the colors and how it reacts.",
        "color": "Color",
        "sensitivity": "Sensitivity",
        "kick": "Bass kick",
        "kickDesc": "Reacts only when the track has a thumping low end.",
        "barShape": "Bar shape",
        "density": "Density",
        "layout": "Layout",
        "contrast": "Contrast",
        "contrastDesc": "Widens the gap between the highs and the lows.",
        "accentBars": "Accent bars",
        "accentDesc": "The two end bars sparkle on hi-hats and vocal highs.",
        "preview": "Preview",
        "colors": {
          "rainbow": "Rainbow",
          "halfRainbow": "Half rainbow",
          "ocean": "Ocean",
          "sunset": "Sunset",
          "purple": "Purple",
          "white": "White"
        },
        "levels": {
          "low": "Low",
          "default": "Default",
          "high": "High"
        },
        "kickLevels": {
          "off": "Off",
          "default": "Default",
          "strong": "Strong"
        },
        "shapes": {
          "capsule": "Capsule",
          "block": "Block",
          "line": "Line"
        },
        "densities": {
          "tight": "Tight",
          "default": "Default",
          "loose": "Loose"
        },
        "layouts": {
          "sweep": "Sweep",
          "mirror": "Mirror"
        },
        "contrasts": {
          "default": "Default",
          "boosted": "Boosted",
          "strong": "Strong"
        },
        "toggle": {
          "off": "Off",
          "on": "On"
        }
      },
      "quotes": {
        "heading": "Quote topics",
        "desc": "Investing quotes by default. You can combine topics.",
        "all": "All topics",
        "confirm": "Done",
        "topics": {
          "investment": "Investing",
          "literature": "Literature",
          "poetry": "Poetry",
          "essay": "Essays",
          "family": "Family & Relationships",
          "selfhelp": "Money & Self-help",
          "science": "Science",
          "history": "History & Humanities",
          "philosophy": "Philosophy & Classics"
        }
      },
      "closeAria": "Close settings"
    },
    "weather": {
      "title": "Weather",
      "titleWithLocation": "{location} weather",
      "detailAria": "Weather details",
      "detailOpenAria": "Open weather details",
      "detailCloseAria": "Close weather details",
      "currentAria": "Current weather",
      "commentAria": "Today's weather note",
      "reloadAria": "Reload weather",
      "locating": "Finding your location",
      "loadingWeather": "Loading weather",
      "reloading": "Reloading…",
      "retry": "Retry",
      "noCurrentData": "No current weather data",
      "defaultLocation": "New York",
      "failed": "Couldn't load the weather. Try again with the button below.",
      "staleNotice": "From {relative} · refresh failed",
      "conditions": {
        "CLEAR": "Clear",
        "PARTLY_CLOUDY": "Partly cloudy",
        "MOSTLY_CLOUDY": "Mostly cloudy",
        "CLOUDY": "Cloudy",
        "FOG": "Fog",
        "RAIN": "Rain",
        "SNOW": "Snow",
        "THUNDER": "Thunderstorm"
      },
      "cloudyWithRainChance": "Cloudy ({label})",
      "rainStopped": "Rain (ended)",
      "thunderShower": "Thunderstorm",
      "detail": {
        "humidity": "Humidity {value}%",
        "sunriseSunset": "🌅 Sunrise {sunrise} · 🌇 Sunset {sunset}",
        "wind": "Wind {label}",
        "highLow": "H:{high} L:{low}"
      },
      "hourly": {
        "heading": "Hourly forecast",
        "unavailable": "Couldn't load the hourly forecast."
      },
      "weekly": {
        "heading": "This week",
        "today": "Today",
        "unavailable": "Couldn't load the weekly forecast."
      },
      "rain": {
        "heading": "Rain this week",
        "none": "No rain expected.",
        "unavailable": "Couldn't load the rain forecast."
      },
      "compare": {
        "heading": "Past 24h · Next 24h",
        "aria": "Comparison of the past 24 hours and the next 24 hours",
        "unavailable": "Couldn't load the comparison."
      },
      "normal": {
        "heading": "Compared with normal",
        "aria": "Difference from the daily average",
        "unavailable": "Not enough data yet to compare with normals."
      },
      "tropicalNight": {
        "heading": "Warm night tonight",
        "officialNormal": "Below the official threshold",
        "feels": "Feels like a warm night",
        "feelsOk": "Should feel comfortable",
        "unavailable": "Couldn't load tonight's temperature info.",
        "official": "Officially a warm night"
      },
      "air": {
        "pm10": "PM10",
        "pm25": "PM2.5",
        "unavailable": "Couldn't load air quality.",
        "grades": {
          "GOOD": "Good",
          "MODERATE": "Moderate",
          "BAD": "Unhealthy",
          "VERY_BAD": "Very unhealthy"
        }
      },
      "advisory": {
        "status": "Active advisories",
        "area": "Affected area",
        "preliminary": "Preliminary advisories",
        "note": "Notes",
        "issuedAt": "Issued",
        "expandAria": "Show advisory details",
        "empty": "No advisory details to show.",
        "active": "Weather advisory in effect",
        "content": "Details",
        "collapseAria": "Hide advisory details"
      },
      "permissionNeeded": "Location permission needed",
      "currentLocation": "Current location",
      "error": "Weather error",
      "lightShowerPossible": "Light showers possible",
      "lightRainPossible": "Light rain possible"
    },
    "music": {
      "bgm": "Background music",
      "info": "Show track info",
      "play": "Play music",
      "next": "Next track",
      "like": "Like this track",
      "dislike": "Dislike this track",
      "waiting": "Ready to play",
      "openSettings": "Open music settings",
      "shuffle": "Shuffle again",
      "autoPaused": "Paused automatically to give your ears a rest.",
      "nowPlayingList": "Now playing the '{name}' playlist",
      "nowPlayingExcluding": "Now playing with {list}",
      "selected": "{name} selected",
      "categories": {
        "acoustic": "Acoustic",
        "classical": "Classical",
        "vocal": "Vocal",
        "rock": "Rock",
        "stressRelief": "Stress relief",
        "sleep": "Sleep",
        "meditation": "Meditation"
      },
      "allShuffle": "Shuffle all",
      "pause": "Pause music",
      "position": "Playback position",
      "nowPlaying": "Now playing",
      "playAction": "Play",
      "categoriesShort": {
        "acoustic": "Acoustic"
      }
    },
    "quote": {
      "aria": "Quote of the day",
      "settingsAria": "Quote settings",
      "settingsOpenAria": "Open quote settings",
      "sourceAria": "Book information",
      "buyOnAladin": "View on Aladin",
      "buyOnAmazon": "Find on Amazon"
    },
    "clock": {
      "aria": "Flip clock",
      "currentTimeAria": "Current time",
      "calendarAria": "Show this month's calendar"
    },
    "webview": {
      "goAria": "Go to ezlong.com",
      "goFromBasecampAria": "Go from Basecamp to ezlong.com",
      "frameAria": "ezlong.com web view",
      "openNewWindowAria": "Open ezlong.com in a new window",
      "backToBasecampAria": "Back to Basecamp",
      "scrollTopHintAria": "Tap to scroll to the top"
    },
    "common": {
      "showAll": "Show all ({count}) ▾",
      "showAllShort": "Show all >",
      "collapse": "Collapse ▴",
      "openInBrowser": "Open in browser",
      "browserNotice": "Open in your browser with the button below so your sign-in and cart are kept.",
      "close": "Close",
      "dontShowAgain": "Don't show again",
      "loadingInfo": "Loading information",
      "loading": "Loading…",
      "retry": "Try again"
    },
    "update": {
      "availableTitle": "A new version is available",
      "body": "Please update to the latest version.",
      "requiredTitle": "Update required",
      "now": "Update now",
      "later": "Later"
    },
    "time": {
      "justNow": "Just now",
      "minutesAgo": "{count, plural, one {# minute ago} other {# minutes ago}}",
      "hoursAgo": "{count, plural, one {# hour ago} other {# hours ago}}",
      "daysAgo": "{count, plural, one {# day ago} other {# days ago}}"
    },
    "fallback": {
      "_note": "Offline fallback content written by the app itself — adapted, not literally translated, because these are our own words rather than book quotes.",
      "sceneSummary": {
        "fresh": "Crisp",
        "starryClear": "Clear and starry"
      },
      "quoteCategories": {
        "mindset": "Investing mindset",
        "compounding": "Compounding",
        "volatility": "Volatility",
        "patience": "Patience",
        "behavioral": "Behavioral finance",
        "retirement": "Retirement"
      },
      "quotes": {
        "dailyDiscipline": {
          "text": "Markets move every day. Your standards don't have to. Before you check today's price, check that your plan can outlive it.",
          "title": "A long-term investor's day"
        },
        "compoundingTime": {
          "text": "Compounding looks slow to the impatient and sudden to those who kept going. What matters isn't speed — it's a structure you never have to stop.",
          "title": "The arithmetic of time"
        },
        "usingVolatility": {
          "text": "Volatility is closer to an admission fee than a defect. Write declines into the plan instead of treating them as exceptions, and the shaking becomes a signal rather than a fright.",
          "title": "Putting volatility to work"
        },
        "artOfWaiting": {
          "text": "Patience isn't doing nothing. It's deciding what you'll do, then actively declining everything else — again today.",
          "title": "The craft of waiting"
        },
        "behavioralNote": {
          "text": "Most of the gap in returns comes not from knowing more, but from what you refrain from doing when you're anxious. Listen to emotion as a signal; decide by rule.",
          "title": "A note on behavior"
        },
        "retirementMath": {
          "text": "Retirement planning isn't a distant assignment — it's what makes today's choices easier. Knowing the number you need removes a surprising amount of comparison and worry.",
          "title": "The feeling of running the numbers"
        },
        "reducingNoise": {
          "text": "The louder the news, the further the trade button should sit. Good investors tend to be better at limiting action than at gathering information.",
          "title": "Turning down the noise"
        },
        "autoInvesting": {
          "text": "Today's contribution looks small, but time treats small money generously. An amount you can sustain beats an amount that strains you.",
          "title": "Notes on automatic investing"
        },
        "bearMarketDiary": {
          "text": "A downturn doesn't only test your assets. It's also the day you find out whether the standards you set can actually hold.",
          "title": "Bear market diary"
        },
        "noComparison": {
          "text": "On days when everyone else looks faster, look at whether your plan survives. Investing that lasts gets sturdy by comparing less.",
          "title": "Investing without comparison"
        }
      }
    }
  },
  "ko": {
    "settings": {
      "title": "설정",
      "premium": {
        "heading": "프리미엄",
        "desc": "광고를 제거하고 더 쾌적하게 이용하세요.",
        "cta": "프리미엄으로 업그레이드"
      },
      "background": {
        "heading": "배경 사진",
        "season": "계절",
        "weather": "날씨",
        "timeOfDay": "시간대",
        "activeNotice": "현재 {filters} 에 맞는 배경 사진만 나옵니다.",
        "matchCriteriaAria": "배경사진 매칭 기준",
        "photoAria": "배경 사진 {index}",
        "photoMissingAria": "배경 사진 {index} 없음"
      },
      "music": {
        "heading": "음악 · 플레이리스트",
        "excludeHeading": "전체 랜덤 재생 시, 제외 플레이 리스트 설정",
        "excludeSuffix": "{name} 제외",
        "specialNotice": "전체 랜덤에는 섞이지 않고, 아래 중 하나를 선택했을 때만 재생됩니다.",
        "specialAria": "Special — 특수 상황별 음악",
        "specialSelectAria": "Special 플레이리스트 선택",
        "playlistSelectAria": "플레이리스트(장르) 선택",
        "excludeFilterAria": "장르 제외 필터",
        "history": "들은 음악",
        "historyEmpty": "아직 재생 기록이 없습니다.",
        "keepOne": "최소 1개 플레이리스트는 남겨두세요",
        "excludeAcoustic": "어쿠스틱 제외",
        "excludeClassical": "클래식 제외",
        "excludeVocal": "보컬 제외",
        "excludeRock": "ROCK 제외"
      },
      "visualizer": {
        "heading": "비주얼라이저",
        "desc": "색상과 반응 스타일을 취향대로 바꿔보세요.",
        "color": "색상",
        "sensitivity": "감도",
        "kick": "쿵쿵 효과(킥 반응)",
        "kickDesc": "곡에 쿵쿵거리는 저음이 있을 때만 반응해요.",
        "barShape": "막대 모양",
        "density": "밀도",
        "layout": "좌우 배치",
        "contrast": "대비",
        "contrastDesc": "고음과 저음의 높낮이 차이를 더 크게 벌려요.",
        "accentBars": "포인트 막대",
        "accentDesc": "맨 끝 막대 2개만 하이햇·보컬 고음 같은 순간에 유독 반짝여요.",
        "preview": "미리보기",
        "colors": {
          "rainbow": "무지개",
          "halfRainbow": "반무지개",
          "ocean": "오션",
          "sunset": "선셋",
          "purple": "퍼플",
          "white": "화이트"
        },
        "levels": {
          "low": "둔감",
          "default": "기본",
          "high": "예민"
        },
        "kickLevels": {
          "off": "끄기",
          "default": "기본",
          "strong": "강하게"
        },
        "shapes": {
          "capsule": "캡슐",
          "block": "블록",
          "line": "라인"
        },
        "densities": {
          "tight": "촘촘히",
          "default": "기본",
          "loose": "넉넉히"
        },
        "layouts": {
          "sweep": "스윕",
          "mirror": "미러"
        },
        "contrasts": {
          "default": "기본",
          "boosted": "강조",
          "strong": "강하게"
        },
        "toggle": {
          "off": "끄기",
          "on": "켜기"
        }
      },
      "quotes": {
        "heading": "문장의 분야",
        "desc": "기본은 투자 문장만 나옵니다. 여러 분야를 함께 고를 수 있어요.",
        "all": "모든 분야",
        "confirm": "확인",
        "topics": {
          "investment": "투자",
          "literature": "문학",
          "poetry": "시",
          "essay": "에세이",
          "family": "가족·관계",
          "selfhelp": "경제·자기계발",
          "science": "과학",
          "history": "인문·역사",
          "philosophy": "철학·고전"
        }
      },
      "closeAria": "설정 닫기"
    },
    "weather": {
      "title": "날씨",
      "titleWithLocation": "{location} 날씨",
      "detailAria": "날씨 상세 정보",
      "detailOpenAria": "날씨 상세 정보 보기",
      "detailCloseAria": "날씨 상세 닫기",
      "currentAria": "현재 날씨",
      "commentAria": "오늘의 날씨 코멘트",
      "reloadAria": "날씨 정보 다시 불러오기",
      "locating": "위치 확인 중",
      "loadingWeather": "날씨 불러오는 중",
      "reloading": "다시 불러오는 중…",
      "retry": "다시",
      "noCurrentData": "현재 날씨 데이터 없음",
      "defaultLocation": "서울",
      "failed": "날씨 정보를 불러오지 못했어요. 아래 버튼으로 다시 시도해보세요.",
      "staleNotice": "{relative} 정보예요 · 새로고침에 실패했어요",
      "conditions": {
        "CLEAR": "맑음",
        "PARTLY_CLOUDY": "구름 조금",
        "MOSTLY_CLOUDY": "구름 많음",
        "CLOUDY": "흐림",
        "FOG": "안개",
        "RAIN": "비",
        "SNOW": "눈",
        "THUNDER": "천둥번개"
      },
      "cloudyWithRainChance": "흐림({label})",
      "rainStopped": "비(그침)",
      "thunderShower": "뇌우",
      "detail": {
        "humidity": "습도 {value}%",
        "sunriseSunset": "🌅 일출 {sunrise} · 🌇 일몰 {sunset}",
        "wind": "바람 {label}",
        "highLow": "최고:{high} 최저:{low}"
      },
      "hourly": {
        "heading": "시간대별 상세 예보",
        "unavailable": "시간대별 예보를 불러올 수 없어요."
      },
      "weekly": {
        "heading": "주간 예보",
        "today": "오늘",
        "unavailable": "주간 예보를 불러올 수 없어요."
      },
      "rain": {
        "heading": "이번 주 강수 예보",
        "none": "비 소식 없어요.",
        "unavailable": "강수 예보를 불러올 수 없어요."
      },
      "compare": {
        "heading": "지난 24시간 · 향후 24시간",
        "aria": "지난 24시간과 향후 24시간 비교",
        "unavailable": "비교 정보를 불러올 수 없어요."
      },
      "normal": {
        "heading": "평년과 비교하면",
        "aria": "일평균 대비 기온차",
        "unavailable": "평년값 비교에 필요한 데이터가 아직 부족해요."
      },
      "tropicalNight": {
        "heading": "오늘 밤 열대야",
        "officialNormal": "공식 기준 정상",
        "feels": "체감 열대야",
        "feelsOk": "체감상 괜찮음",
        "unavailable": "열대야 정보를 불러올 수 없어요.",
        "official": "공식 열대야"
      },
      "air": {
        "pm10": "미세먼지(PM10)",
        "pm25": "초미세먼지(PM2.5)",
        "unavailable": "미세먼지 정보를 불러올 수 없어요.",
        "grades": {
          "GOOD": "좋음",
          "MODERATE": "보통",
          "BAD": "나쁨",
          "VERY_BAD": "매우 나쁨"
        }
      },
      "advisory": {
        "status": "현재 발효 현황",
        "area": "해당구역",
        "preliminary": "예비특보 발효현황",
        "note": "참고사항",
        "issuedAt": "발표시각",
        "expandAria": "기상특보 상세 펼치기",
        "empty": "표시할 특보 상세가 없어요.",
        "active": "기상특보 발효 중",
        "content": "내용",
        "collapseAria": "기상특보 상세 접기"
      },
      "permissionNeeded": "위치 권한 필요",
      "currentLocation": "현재 위치",
      "error": "날씨 오류",
      "lightShowerPossible": "약한 소나기 가능성",
      "lightRainPossible": "약한 비 가능성"
    },
    "music": {
      "bgm": "배경음악",
      "info": "음악 정보 보기",
      "play": "음악 재생",
      "next": "다음 곡",
      "like": "이 곡 좋아요",
      "dislike": "이 곡 싫어요",
      "waiting": "재생 대기 중",
      "openSettings": "음악설정 열기",
      "shuffle": "재생 순서 다시 섞기",
      "autoPaused": "귀의 휴식을 위해 자동 일시정지됐어요.",
      "nowPlayingList": "지금 '{name}' 플레이리스트를 재생 중이에요",
      "nowPlayingExcluding": "지금 {list} 상태로 재생 중이에요",
      "selected": "{name} 선택됨",
      "categories": {
        "acoustic": "어쿠스틱 연주곡",
        "classical": "클래식",
        "vocal": "보컬",
        "rock": "ROCK",
        "stressRelief": "스트레스 해소",
        "sleep": "수면유도",
        "meditation": "명상"
      },
      "allShuffle": "전체 랜덤",
      "pause": "음악 일시정지",
      "position": "재생 위치",
      "nowPlaying": "지금 재생 중",
      "playAction": "재생",
      "categoriesShort": {
        "acoustic": "어쿠스틱"
      }
    },
    "quote": {
      "aria": "오늘의 한 문장",
      "settingsAria": "오늘의 한 문장 설정",
      "settingsOpenAria": "오늘의 한 문장 설정 열기",
      "sourceAria": "알라딘 도서 정보",
      "buyOnAladin": "알라딘에서 이 책 보기",
      "buyOnAmazon": "아마존에서 이 책 보기"
    },
    "clock": {
      "aria": "플립시계",
      "currentTimeAria": "현재 시간",
      "calendarAria": "이번달 달력 보기"
    },
    "webview": {
      "goAria": "ezlong.com 이동",
      "goFromBasecampAria": "ezlong 베이스캠프에서 ezlong.com으로 이동",
      "frameAria": "ezlong.com 웹뷰",
      "openNewWindowAria": "ezlong.com 새창 열기",
      "backToBasecampAria": "ezlong 베이스캠프로 돌아가기",
      "scrollTopHintAria": "탭하면 맨 위로 스크롤됩니다"
    },
    "common": {
      "showAll": "모두 보기 ({count}) ▾",
      "showAllShort": "모두 보기 >",
      "collapse": "접기 ▴",
      "openInBrowser": "기본 브라우저에서 열기",
      "browserNotice": "로그인 · 장바구니 유지를 위해 아래 버튼으로 기본 브라우저에서 열어주세요.",
      "close": "닫기",
      "dontShowAgain": "다시 보지 않기",
      "loadingInfo": "정보를 불러오는 중",
      "loading": "불러오는 중…",
      "retry": "다시 시도"
    },
    "update": {
      "availableTitle": "새 버전이 있어요",
      "body": "새로운 버전으로 업데이트해 주세요.",
      "requiredTitle": "업데이트가 필요합니다",
      "now": "지금 업데이트",
      "later": "나중에"
    },
    "time": {
      "justNow": "방금 전",
      "minutesAgo": "{count, plural, other {#분 전}}",
      "hoursAgo": "{count, plural, other {#시간 전}}",
      "daysAgo": "{count, plural, other {#일 전}}"
    },
    "fallback": {
      "_note": "네트워크 실패 시 쓰는 오프라인 대체 콘텐츠. 앱이 직접 쓴 글이라 번역·현지화가 가능하다(책 인용문과 달리 원문 보존 의무가 없다).",
      "sceneSummary": {
        "fresh": "상쾌함",
        "starryClear": "별빛 맑음"
      },
      "quoteCategories": {
        "mindset": "투자 멘탈",
        "compounding": "복리/시간",
        "volatility": "변동성",
        "patience": "인내",
        "behavioral": "행동경제학",
        "retirement": "은퇴 준비"
      },
      "quotes": {
        "dailyDiscipline": {
          "text": "시장은 매일 흔들리지만, 장기투자자의 기준까지 매일 흔들릴 필요는 없습니다. 오늘의 가격보다 오래 살아남을 계획을 먼저 확인하세요.",
          "title": "장기투자자의 하루"
        },
        "compoundingTime": {
          "text": "복리는 조급한 사람에게는 느려 보이고, 계속하는 사람에게는 어느 날 갑자기 커 보입니다. 중요한 것은 속도가 아니라 중간에 멈추지 않는 구조입니다.",
          "title": "복리의 시간"
        },
        "usingVolatility": {
          "text": "변동성은 장기투자가 내는 입장료에 가깝습니다. 하락을 예외로 두지 않고 계획 안에 넣어두면, 흔들림은 공포가 아니라 점검 신호가 됩니다.",
          "title": "변동성 사용법"
        },
        "artOfWaiting": {
          "text": "인내는 아무것도 하지 않는 태도가 아닙니다. 해야 할 일을 정해두고, 하지 말아야 할 일을 오늘도 참아내는 적극적인 실행입니다.",
          "title": "기다림의 기술"
        },
        "behavioralNote": {
          "text": "투자 성과의 많은 부분은 무엇을 더 아느냐보다, 불안할 때 무엇을 하지 않느냐에서 갈립니다. 감정은 신호로 듣고, 결정은 규칙으로 하세요.",
          "title": "행동경제학 메모"
        },
        "retirementMath": {
          "text": "은퇴 준비는 먼 미래의 숙제가 아니라 오늘의 선택을 편하게 만드는 기준입니다. 필요한 숫자를 알면 불필요한 비교와 불안이 줄어듭니다.",
          "title": "은퇴 계산의 마음"
        },
        "reducingNoise": {
          "text": "뉴스가 커질수록 매매 버튼은 멀리 두는 편이 좋습니다. 좋은 투자자는 정보를 많이 보는 사람보다 행동을 잘 제한하는 사람에 가깝습니다.",
          "title": "소음 줄이기"
        },
        "autoInvesting": {
          "text": "오늘의 적립은 작아 보여도 시간은 작은 돈을 크게 대합니다. 무리한 금액보다 계속 가능한 금액이 장기투자에서는 더 강합니다.",
          "title": "자동 적립 노트"
        },
        "bearMarketDiary": {
          "text": "하락장은 내 자산만 시험하지 않습니다. 내가 세운 기준이 실제로 버틸 수 있는 기준인지 확인하게 해주는 날이기도 합니다.",
          "title": "하락장 일기"
        },
        "noComparison": {
          "text": "남의 속도가 빨라 보이는 날일수록 내 계획의 생존성을 보세요. 오래 가는 투자는 비교를 줄이는 데서부터 단단해집니다.",
          "title": "비교하지 않는 투자"
        }
      }
    }
  }
};
})(typeof self !== "undefined" ? self : this);
