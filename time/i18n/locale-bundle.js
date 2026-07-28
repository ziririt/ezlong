/**
 * locale-bundle.js — ★ 자동 생성 파일. 직접 수정하지 마세요 ★
 *
 * 원본: i18n/locales/*.json
 * 생성: node scripts/build-locales.mjs
 * 생성 시각: 2026-07-28T17:23:22.549Z
 * 포함 로케일: en, es, ja, ko, pt, zh
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
  "es": {
    "settings": {
      "title": "Ajustes",
      "premium": {
        "heading": "Premium",
        "desc": "Quita los anuncios para una experiencia más tranquila.",
        "cta": "Pasar a Premium"
      },
      "background": {
        "heading": "Fotos de fondo",
        "season": "Estación",
        "weather": "Tiempo",
        "timeOfDay": "Franja del día",
        "activeNotice": "Mostrando solo fotos que coinciden con {filters}.",
        "matchCriteriaAria": "Criterios de coincidencia de fotos",
        "photoAria": "Foto de fondo {index}",
        "photoMissingAria": "La foto de fondo {index} no está disponible"
      },
      "music": {
        "heading": "Música · Listas",
        "excludeHeading": "Excluir del modo aleatorio",
        "excludeSuffix": "Excluir {name}",
        "specialNotice": "No entran en el modo aleatorio: solo suenan si eliges una abajo.",
        "specialAria": "Especiales — música para momentos concretos",
        "specialSelectAria": "Elegir una lista especial",
        "playlistSelectAria": "Elegir una lista",
        "excludeFilterAria": "Filtro de exclusión por género",
        "history": "Escuchado hace poco",
        "historyEmpty": "Todavía no se ha reproducido nada.",
        "keepOne": "Deja al menos una lista",
        "excludeAcoustic": "Excluir acústica",
        "excludeClassical": "Excluir clásica",
        "excludeVocal": "Excluir voces",
        "excludeRock": "Excluir rock"
      },
      "visualizer": {
        "heading": "Visualizador",
        "desc": "Cambia los colores y la forma en que reacciona.",
        "color": "Color",
        "sensitivity": "Sensibilidad",
        "kick": "Golpe de graves",
        "kickDesc": "Reacciona solo cuando la pista tiene graves marcados.",
        "barShape": "Forma de barra",
        "density": "Densidad",
        "layout": "Disposición",
        "contrast": "Contraste",
        "contrastDesc": "Aumenta la diferencia entre los agudos y los graves.",
        "accentBars": "Barras de acento",
        "accentDesc": "Las dos barras de los extremos brillan con los hi-hats y las voces agudas.",
        "preview": "Vista previa",
        "colors": {
          "rainbow": "Arcoíris",
          "halfRainbow": "Medio arcoíris",
          "ocean": "Océano",
          "sunset": "Atardecer",
          "purple": "Morado",
          "white": "Blanco"
        },
        "levels": {
          "low": "Baja",
          "default": "Normal",
          "high": "Alta"
        },
        "kickLevels": {
          "off": "Desactivado",
          "default": "Normal",
          "strong": "Fuerte"
        },
        "shapes": {
          "capsule": "Cápsula",
          "block": "Bloque",
          "line": "Línea"
        },
        "densities": {
          "tight": "Densa",
          "default": "Normal",
          "loose": "Amplia"
        },
        "layouts": {
          "sweep": "Barrido",
          "mirror": "Espejo"
        },
        "contrasts": {
          "default": "Normal",
          "boosted": "Realzado",
          "strong": "Fuerte"
        },
        "toggle": {
          "off": "Desactivado",
          "on": "Activado"
        }
      },
      "quotes": {
        "heading": "Temas de las frases",
        "desc": "Por defecto salen frases sobre inversión. Se pueden combinar varios temas.",
        "all": "Todos los temas",
        "confirm": "Listo",
        "topics": {
          "investment": "Inversión",
          "literature": "Literatura",
          "poetry": "Poesía",
          "essay": "Ensayo",
          "family": "Familia y relaciones",
          "selfhelp": "Dinero y crecimiento personal",
          "science": "Ciencia",
          "history": "Historia y humanidades",
          "philosophy": "Filosofía y clásicos"
        }
      },
      "closeAria": "Cerrar los ajustes"
    },
    "weather": {
      "title": "Tiempo",
      "titleWithLocation": "Tiempo en {location}",
      "detailAria": "Detalles del tiempo",
      "detailOpenAria": "Abrir los detalles del tiempo",
      "detailCloseAria": "Cerrar los detalles del tiempo",
      "currentAria": "Tiempo actual",
      "commentAria": "Nota del tiempo de hoy",
      "reloadAria": "Recargar el tiempo",
      "locating": "Buscando la ubicación",
      "loadingWeather": "Cargando el tiempo",
      "reloading": "Recargando…",
      "retry": "Reintentar",
      "noCurrentData": "No hay datos del tiempo actual",
      "defaultLocation": "Madrid",
      "failed": "No se pudo cargar el tiempo. Inténtalo otra vez con el botón de abajo.",
      "staleNotice": "Datos de {relative} · falló la actualización",
      "conditions": {
        "CLEAR": "Despejado",
        "PARTLY_CLOUDY": "Poco nuboso",
        "MOSTLY_CLOUDY": "Muy nuboso",
        "CLOUDY": "Nublado",
        "FOG": "Niebla",
        "RAIN": "Lluvia",
        "SNOW": "Nieve",
        "THUNDER": "Tormenta"
      },
      "cloudyWithRainChance": "Nublado ({label})",
      "rainStopped": "Lluvia (ya paró)",
      "thunderShower": "Tormenta",
      "detail": {
        "humidity": "Humedad {value}%",
        "sunriseSunset": "🌅 Amanecer {sunrise} · 🌇 Atardecer {sunset}",
        "wind": "Viento {label}",
        "highLow": "Máx:{high} Mín:{low}"
      },
      "hourly": {
        "heading": "Previsión por horas",
        "unavailable": "No se pudo cargar la previsión por horas."
      },
      "weekly": {
        "heading": "Esta semana",
        "today": "Hoy",
        "unavailable": "No se pudo cargar la previsión semanal."
      },
      "rain": {
        "heading": "Lluvia esta semana",
        "none": "No se espera lluvia.",
        "unavailable": "No se pudo cargar la previsión de lluvia."
      },
      "compare": {
        "heading": "Últimas 24 h · Próximas 24 h",
        "aria": "Comparación entre las últimas 24 horas y las próximas 24 horas",
        "unavailable": "No se pudo cargar la comparación."
      },
      "normal": {
        "heading": "Comparado con lo normal",
        "aria": "Diferencia respecto a la media",
        "unavailable": "Aún no hay datos suficientes para comparar con la media."
      },
      "tropicalNight": {
        "heading": "Noche cálida esta noche",
        "officialNormal": "Por debajo del umbral oficial",
        "feels": "Se sentirá como una noche cálida",
        "feelsOk": "La noche debería ser agradable",
        "unavailable": "No se pudo cargar la temperatura de esta noche.",
        "official": "Oficialmente una noche cálida"
      },
      "air": {
        "pm10": "PM10",
        "pm25": "PM2,5",
        "unavailable": "No se pudo cargar la calidad del aire.",
        "grades": {
          "GOOD": "Buena",
          "MODERATE": "Moderada",
          "BAD": "Mala",
          "VERY_BAD": "Muy mala"
        }
      },
      "advisory": {
        "status": "Avisos en vigor",
        "area": "Zona afectada",
        "preliminary": "Avisos preliminares",
        "note": "Notas",
        "issuedAt": "Emitido",
        "expandAria": "Mostrar los detalles del aviso",
        "empty": "No hay detalles de avisos que mostrar.",
        "active": "Aviso meteorológico en vigor",
        "content": "Detalles",
        "collapseAria": "Ocultar los detalles del aviso"
      },
      "permissionNeeded": "Hace falta permiso de ubicación",
      "currentLocation": "Ubicación actual",
      "error": "Error del tiempo",
      "lightShowerPossible": "Posibles chubascos débiles",
      "lightRainPossible": "Posible lluvia débil"
    },
    "music": {
      "bgm": "Música de fondo",
      "info": "Ver información de la pista",
      "play": "Reproducir música",
      "next": "Pista siguiente",
      "like": "Me gusta esta pista",
      "dislike": "No me gusta esta pista",
      "waiting": "Listo para reproducir",
      "openSettings": "Abrir los ajustes de música",
      "shuffle": "Volver a mezclar",
      "autoPaused": "Se pausó automáticamente para dar un descanso a los oídos.",
      "nowPlayingList": "Sonando la lista «{name}»",
      "nowPlayingExcluding": "Sonando con {list}",
      "selected": "{name} seleccionado",
      "categories": {
        "acoustic": "Acústica",
        "classical": "Clásica",
        "vocal": "Voces",
        "rock": "Rock",
        "stressRelief": "Alivio del estrés",
        "sleep": "Dormir",
        "meditation": "Meditación"
      },
      "allShuffle": "Mezclar todo",
      "pause": "Pausar la música",
      "position": "Posición de reproducción",
      "nowPlaying": "Sonando ahora",
      "playAction": "Reproducir",
      "categoriesShort": {
        "acoustic": "Acústica"
      }
    },
    "quote": {
      "aria": "Frase del día",
      "settingsAria": "Ajustes de las frases",
      "settingsOpenAria": "Abrir los ajustes de las frases",
      "sourceAria": "Información del libro",
      "buyOnAladin": "Ver este libro en Aladin",
      "buyOnAmazon": "Buscar este libro en Amazon"
    },
    "clock": {
      "aria": "Reloj de solapas",
      "currentTimeAria": "Hora actual",
      "calendarAria": "Ver el calendario de este mes"
    },
    "webview": {
      "goAria": "Ir a ezlong.com",
      "goFromBasecampAria": "Ir del Campamento base a ezlong.com",
      "frameAria": "Vista web de ezlong.com",
      "openNewWindowAria": "Abrir ezlong.com en una ventana nueva",
      "backToBasecampAria": "Volver al Campamento base",
      "scrollTopHintAria": "Toca para subir al principio"
    },
    "common": {
      "showAll": "Ver todo ({count}) ▾",
      "showAllShort": "Ver todo >",
      "collapse": "Contraer ▴",
      "openInBrowser": "Abrir en el navegador",
      "browserNotice": "Ábrelo en el navegador con el botón de abajo para conservar la sesión y el carrito.",
      "close": "Cerrar",
      "dontShowAgain": "No volver a mostrar",
      "loadingInfo": "Cargando la información",
      "loading": "Cargando…",
      "retry": "Intentar de nuevo"
    },
    "update": {
      "availableTitle": "Hay una versión nueva",
      "body": "Actualiza a la última versión.",
      "requiredTitle": "Actualización necesaria",
      "now": "Actualizar ahora",
      "later": "Más tarde"
    },
    "time": {
      "justNow": "Ahora mismo",
      "minutesAgo": "{count, plural, one {hace # minuto} other {hace # minutos}}",
      "hoursAgo": "{count, plural, one {hace # hora} other {hace # horas}}",
      "daysAgo": "{count, plural, one {hace # día} other {hace # días}}"
    },
    "fallback": {
      "_note": "Contenido de reserva sin conexión, escrito por la propia app. Son palabras nuestras, no citas de libros, así que están adaptadas y no traducidas literalmente.",
      "sceneSummary": {
        "fresh": "Fresco",
        "starryClear": "Despejado y estrellado"
      },
      "quoteCategories": {
        "mindset": "Mentalidad inversora",
        "compounding": "Interés compuesto",
        "volatility": "Volatilidad",
        "patience": "Paciencia",
        "behavioral": "Finanzas del comportamiento",
        "retirement": "Jubilación"
      },
      "quotes": {
        "dailyDiscipline": {
          "text": "El mercado se mueve cada día; tus criterios no tienen por qué hacerlo. Antes de mirar el precio de hoy, comprueba que tu plan pueda sobrevivirlo.",
          "title": "Un día de quien invierte a largo plazo"
        },
        "compoundingTime": {
          "text": "El interés compuesto parece lento a quien tiene prisa y repentino a quien siguió adelante. Lo que importa no es la velocidad, sino una estructura que nunca haya que interrumpir.",
          "title": "La aritmética del tiempo"
        },
        "usingVolatility": {
          "text": "La volatilidad se parece más a una entrada que a un defecto. Si escribes las caídas dentro del plan en vez de tratarlas como excepciones, el temblor pasa de susto a señal.",
          "title": "Poner la volatilidad a trabajar"
        },
        "artOfWaiting": {
          "text": "La paciencia no es no hacer nada. Es decidir qué vas a hacer y luego rechazar activamente todo lo demás — otra vez hoy.",
          "title": "El oficio de esperar"
        },
        "behavioralNote": {
          "text": "La mayor parte de la diferencia en los resultados no viene de saber más, sino de lo que uno deja de hacer cuando está inquieto. Escucha la emoción como señal; decide con reglas.",
          "title": "Una nota sobre el comportamiento"
        },
        "retirementMath": {
          "text": "Planificar la jubilación no es una tarea lejana: es lo que vuelve más fáciles las decisiones de hoy. Saber la cifra que necesitas quita una cantidad sorprendente de comparación y de preocupación.",
          "title": "La calma de hacer los números"
        },
        "reducingNoise": {
          "text": "Cuanto más ruido hacen las noticias, más lejos conviene tener el botón de operar. Quien invierte bien suele ser mejor limitando actos que reuniendo información.",
          "title": "Bajarle el volumen al ruido"
        },
        "autoInvesting": {
          "text": "La aportación de hoy parece pequeña, pero el tiempo es generoso con el dinero pequeño. Una cantidad que puedas sostener gana a una que te ahogue.",
          "title": "Apuntes sobre la inversión automática"
        },
        "bearMarketDiary": {
          "text": "Una caída no solo pone a prueba tus activos. Es también el día en que descubres si los criterios que fijaste aguantan de verdad.",
          "title": "Diario de un mercado bajista"
        },
        "noComparison": {
          "text": "Los días en que todos los demás parecen ir más rápido, mira si tu plan sobrevive. La inversión que dura se vuelve firme comparándose menos.",
          "title": "Invertir sin comparar"
        }
      }
    }
  },
  "ja": {
    "settings": {
      "title": "設定",
      "premium": {
        "heading": "プレミアム",
        "desc": "広告を消して、もっと静かに使えます。",
        "cta": "プレミアムにアップグレード"
      },
      "background": {
        "heading": "背景写真",
        "season": "季節",
        "weather": "天気",
        "timeOfDay": "時間帯",
        "activeNotice": "{filters}に合う写真だけを表示しています。",
        "matchCriteriaAria": "写真の一致条件",
        "photoAria": "背景写真 {index}",
        "photoMissingAria": "背景写真 {index} は読み込めません"
      },
      "music": {
        "heading": "音楽 · プレイリスト",
        "excludeHeading": "全曲シャッフルから除外",
        "excludeSuffix": "{name}を除外",
        "specialNotice": "シャッフルには混ざりません。下から選んだときだけ再生されます。",
        "specialAria": "スペシャル — 場面に合わせた音楽",
        "specialSelectAria": "スペシャルのプレイリストを選ぶ",
        "playlistSelectAria": "プレイリストを選ぶ",
        "excludeFilterAria": "ジャンル除外フィルター",
        "history": "聴いた曲",
        "historyEmpty": "まだ再生していません。",
        "keepOne": "プレイリストは1つ以上残してください",
        "excludeAcoustic": "アコースティックを除外",
        "excludeClassical": "クラシックを除外",
        "excludeVocal": "ボーカルを除外",
        "excludeRock": "ロックを除外"
      },
      "visualizer": {
        "heading": "ビジュアライザー",
        "desc": "色と反応の仕方をお好みで変えられます。",
        "color": "色",
        "sensitivity": "感度",
        "kick": "重低音の反応",
        "kickDesc": "曲に響く低音があるときだけ反応します。",
        "barShape": "バーの形",
        "density": "密度",
        "layout": "配置",
        "contrast": "コントラスト",
        "contrastDesc": "高音と低音の高低差を大きくします。",
        "accentBars": "アクセントバー",
        "accentDesc": "両端の2本がハイハットやボーカルの高音で光ります。",
        "preview": "プレビュー",
        "colors": {
          "rainbow": "レインボー",
          "halfRainbow": "ハーフレインボー",
          "ocean": "オーシャン",
          "sunset": "サンセット",
          "purple": "パープル",
          "white": "ホワイト"
        },
        "levels": {
          "low": "低め",
          "default": "標準",
          "high": "高め"
        },
        "kickLevels": {
          "off": "オフ",
          "default": "標準",
          "strong": "強め"
        },
        "shapes": {
          "capsule": "カプセル",
          "block": "ブロック",
          "line": "ライン"
        },
        "densities": {
          "tight": "密",
          "default": "標準",
          "loose": "ゆったり"
        },
        "layouts": {
          "sweep": "スイープ",
          "mirror": "ミラー"
        },
        "contrasts": {
          "default": "標準",
          "boosted": "強調",
          "strong": "強め"
        },
        "toggle": {
          "off": "オフ",
          "on": "オン"
        }
      },
      "quotes": {
        "heading": "言葉のジャンル",
        "desc": "標準では投資の言葉が出ます。複数のジャンルを選べます。",
        "all": "すべてのジャンル",
        "confirm": "決定",
        "topics": {
          "investment": "投資",
          "literature": "文学",
          "poetry": "詩",
          "essay": "エッセイ",
          "family": "家族·人間関係",
          "selfhelp": "お金·自己啓発",
          "science": "科学",
          "history": "歴史·人文",
          "philosophy": "哲学·古典"
        }
      },
      "closeAria": "設定を閉じる"
    },
    "weather": {
      "title": "天気",
      "titleWithLocation": "{location}の天気",
      "detailAria": "天気の詳細",
      "detailOpenAria": "天気の詳細を開く",
      "detailCloseAria": "天気の詳細を閉じる",
      "currentAria": "現在の天気",
      "commentAria": "今日の天気メモ",
      "reloadAria": "天気を再読み込み",
      "locating": "現在地を確認しています",
      "loadingWeather": "天気を読み込んでいます",
      "reloading": "再読み込み中…",
      "retry": "再試行",
      "noCurrentData": "現在の天気データがありません",
      "defaultLocation": "東京",
      "failed": "天気を読み込めませんでした。下のボタンでもう一度お試しください。",
      "staleNotice": "{relative}の情報 · 更新に失敗しました",
      "conditions": {
        "CLEAR": "晴れ",
        "PARTLY_CLOUDY": "晴れ時々くもり",
        "MOSTLY_CLOUDY": "くもり時々晴れ",
        "CLOUDY": "くもり",
        "FOG": "霧",
        "RAIN": "雨",
        "SNOW": "雪",
        "THUNDER": "雷雨"
      },
      "cloudyWithRainChance": "くもり({label})",
      "rainStopped": "雨(やみました)",
      "thunderShower": "雷雨",
      "detail": {
        "humidity": "湿度 {value}%",
        "sunriseSunset": "🌅 日の出 {sunrise} · 🌇 日の入り {sunset}",
        "wind": "風 {label}",
        "highLow": "最高:{high} 最低:{low}"
      },
      "hourly": {
        "heading": "時間別予報",
        "unavailable": "時間別予報を読み込めませんでした。"
      },
      "weekly": {
        "heading": "今週",
        "today": "今日",
        "unavailable": "週間予報を読み込めませんでした。"
      },
      "rain": {
        "heading": "今週の雨",
        "none": "雨の予報はありません。",
        "unavailable": "雨の予報を読み込めませんでした。"
      },
      "compare": {
        "heading": "過去24時間 · 今後24時間",
        "aria": "過去24時間と今後24時間の比較",
        "unavailable": "比較データを読み込めませんでした。"
      },
      "normal": {
        "heading": "平年と比べると",
        "aria": "平年値との差",
        "unavailable": "平年と比べるにはデータが足りません。"
      },
      "tropicalNight": {
        "heading": "今夜の熱帯夜",
        "officialNormal": "公式の基準は下回っています",
        "feels": "熱帯夜のように感じられます",
        "feelsOk": "過ごしやすい夜になりそうです",
        "unavailable": "今夜の気温情報を読み込めませんでした。",
        "official": "公式に熱帯夜です"
      },
      "air": {
        "pm10": "PM10",
        "pm25": "PM2.5",
        "unavailable": "大気質を読み込めませんでした。",
        "grades": {
          "GOOD": "良い",
          "MODERATE": "普通",
          "BAD": "悪い",
          "VERY_BAD": "非常に悪い"
        }
      },
      "advisory": {
        "status": "発表中の警報·注意報",
        "area": "対象地域",
        "preliminary": "予備の警報·注意報",
        "note": "参考事項",
        "issuedAt": "発表時刻",
        "expandAria": "警報の詳細を表示",
        "empty": "表示する警報の詳細はありません。",
        "active": "気象警報が発表中です",
        "content": "内容",
        "collapseAria": "警報の詳細を隠す"
      },
      "permissionNeeded": "位置情報の許可が必要です",
      "currentLocation": "現在地",
      "error": "天気エラー",
      "lightShowerPossible": "弱いにわか雨の可能性",
      "lightRainPossible": "弱い雨の可能性"
    },
    "music": {
      "bgm": "BGM",
      "info": "曲の情報を表示",
      "play": "音楽を再生",
      "next": "次の曲",
      "like": "この曲が好き",
      "dislike": "この曲は好みではない",
      "waiting": "再生待機中",
      "openSettings": "音楽の設定を開く",
      "shuffle": "もう一度シャッフル",
      "autoPaused": "耳を休ませるため自動で一時停止しました。",
      "nowPlayingList": "「{name}」のプレイリストを再生中",
      "nowPlayingExcluding": "{list}で再生中",
      "selected": "{name}を選びました",
      "categories": {
        "acoustic": "アコースティック",
        "classical": "クラシック",
        "vocal": "ボーカル",
        "rock": "ロック",
        "stressRelief": "ストレス解消",
        "sleep": "快眠",
        "meditation": "瞑想"
      },
      "allShuffle": "全曲シャッフル",
      "pause": "音楽を一時停止",
      "position": "再生位置",
      "nowPlaying": "再生中",
      "playAction": "再生",
      "categoriesShort": {
        "acoustic": "アコースティック"
      }
    },
    "quote": {
      "aria": "今日の言葉",
      "settingsAria": "言葉の設定",
      "settingsOpenAria": "言葉の設定を開く",
      "sourceAria": "書籍の情報",
      "buyOnAladin": "アラジンでこの本を見る",
      "buyOnAmazon": "Amazonでこの本を探す"
    },
    "clock": {
      "aria": "フリップ時計",
      "currentTimeAria": "現在時刻",
      "calendarAria": "今月のカレンダーを表示"
    },
    "webview": {
      "goAria": "ezlong.com へ移動",
      "goFromBasecampAria": "ベースキャンプから ezlong.com へ移動",
      "frameAria": "ezlong.com ウェブビュー",
      "openNewWindowAria": "ezlong.com を新しいウィンドウで開く",
      "backToBasecampAria": "ベースキャンプに戻る",
      "scrollTopHintAria": "タップすると一番上までスクロールします"
    },
    "common": {
      "showAll": "すべて表示({count}) ▾",
      "showAllShort": "すべて表示 >",
      "collapse": "折りたたむ ▴",
      "openInBrowser": "ブラウザで開く",
      "browserNotice": "ログインとカートを保つため、下のボタンからブラウザで開いてください。",
      "close": "閉じる",
      "dontShowAgain": "今後表示しない",
      "loadingInfo": "情報を読み込んでいます",
      "loading": "読み込み中…",
      "retry": "もう一度試す"
    },
    "update": {
      "availableTitle": "新しいバージョンがあります",
      "body": "最新バージョンに更新してください。",
      "requiredTitle": "更新が必要です",
      "now": "今すぐ更新",
      "later": "あとで"
    },
    "time": {
      "justNow": "たった今",
      "minutesAgo": "{count, plural, other {#分前}}",
      "hoursAgo": "{count, plural, other {#時間前}}",
      "daysAgo": "{count, plural, other {#日前}}"
    },
    "fallback": {
      "_note": "オフライン時のフォールバック文。アプリ自身の言葉なので、書籍の引用とは違い直訳ではなく日本語として自然に書き直している。",
      "sceneSummary": {
        "fresh": "さわやか",
        "starryClear": "星がきれいな快晴"
      },
      "quoteCategories": {
        "mindset": "投資のマインド",
        "compounding": "複利",
        "volatility": "変動",
        "patience": "忍耐",
        "behavioral": "行動経済学",
        "retirement": "老後"
      },
      "quotes": {
        "dailyDiscipline": {
          "text": "相場は毎日動きます。あなたの基準まで動く必要はありません。今日の値段を見る前に、その値動きより長く生き残る計画かどうかを確かめてください。",
          "title": "長期投資家の一日"
        },
        "compoundingTime": {
          "text": "複利は、待てない人には遅く見え、続けた人には突然に見えます。大事なのは速さではなく、途中でやめずに済む仕組みです。",
          "title": "時間という計算"
        },
        "usingVolatility": {
          "text": "変動は欠陥というより入場料に近いものです。下落を例外ではなく計画の一部として書き込んでおくと、揺れは恐怖ではなく合図に変わります。",
          "title": "変動を味方にする"
        },
        "artOfWaiting": {
          "text": "忍耐とは何もしないことではありません。何をするかを決めたうえで、それ以外を積極的に断ること — 今日もまた。",
          "title": "待つという技術"
        },
        "behavioralNote": {
          "text": "収益の差の多くは、より多く知っていたかではなく、不安なときに何をしなかったかで決まります。感情は合図として聞き、判断はルールで下してください。",
          "title": "行動についての覚え書き"
        },
        "retirementMath": {
          "text": "老後の計画は遠い宿題ではなく、今日の選択を楽にしてくれるものです。必要な金額を知るだけで、比較と不安がずいぶん減ります。",
          "title": "数字にしてみる安心"
        },
        "reducingNoise": {
          "text": "ニュースが大きいほど、取引ボタンは遠くに置いておきましょう。良い投資家は、情報を集めるのがうまい人よりも、動かずにいられる人であることが多いのです。",
          "title": "ノイズを下げる"
        },
        "autoInvesting": {
          "text": "今日の積立は小さく見えますが、時間は小さなお金に寛大です。無理のある金額より、続けられる金額が勝ちます。",
          "title": "積立についてのメモ"
        },
        "bearMarketDiary": {
          "text": "下落相場が試すのは資産だけではありません。自分で決めた基準が本当に持ちこたえるのかを知る日でもあります。",
          "title": "下落相場の日記"
        },
        "noComparison": {
          "text": "まわりが速く見える日ほど、自分の計画が生き残るかを見てください。長く続く投資は、比べる回数が減るほど丈夫になります。",
          "title": "比べない投資"
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
  },
  "pt": {
    "settings": {
      "title": "Configurações",
      "premium": {
        "heading": "Premium",
        "desc": "Tire os anúncios para uma experiência mais tranquila.",
        "cta": "Assinar o Premium"
      },
      "background": {
        "heading": "Fotos de fundo",
        "season": "Estação",
        "weather": "Tempo",
        "timeOfDay": "Hora do dia",
        "activeNotice": "Mostrando apenas fotos que combinam com {filters}.",
        "matchCriteriaAria": "Critérios de correspondência das fotos",
        "photoAria": "Foto de fundo {index}",
        "photoMissingAria": "A foto de fundo {index} não está disponível"
      },
      "music": {
        "heading": "Música · Playlists",
        "excludeHeading": "Excluir do modo aleatório",
        "excludeSuffix": "Excluir {name}",
        "specialNotice": "Não entram no modo aleatório: só tocam quando você escolhe uma abaixo.",
        "specialAria": "Especiais — música para momentos específicos",
        "specialSelectAria": "Escolher uma playlist especial",
        "playlistSelectAria": "Escolher uma playlist",
        "excludeFilterAria": "Filtro de exclusão por gênero",
        "history": "Ouvidas recentemente",
        "historyEmpty": "Nada tocou ainda.",
        "keepOne": "Deixe pelo menos uma playlist",
        "excludeAcoustic": "Excluir acústica",
        "excludeClassical": "Excluir clássica",
        "excludeVocal": "Excluir vocais",
        "excludeRock": "Excluir rock"
      },
      "visualizer": {
        "heading": "Visualizador",
        "desc": "Mude as cores e o jeito como ele reage.",
        "color": "Cor",
        "sensitivity": "Sensibilidade",
        "kick": "Batida grave",
        "kickDesc": "Reage só quando a faixa tem graves marcados.",
        "barShape": "Formato da barra",
        "density": "Densidade",
        "layout": "Disposição",
        "contrast": "Contraste",
        "contrastDesc": "Aumenta a diferença entre os agudos e os graves.",
        "accentBars": "Barras de destaque",
        "accentDesc": "As duas barras das pontas brilham nos chimbais e nos vocais agudos.",
        "preview": "Prévia",
        "colors": {
          "rainbow": "Arco-íris",
          "halfRainbow": "Meio arco-íris",
          "ocean": "Oceano",
          "sunset": "Pôr do sol",
          "purple": "Roxo",
          "white": "Branco"
        },
        "levels": {
          "low": "Baixa",
          "default": "Padrão",
          "high": "Alta"
        },
        "kickLevels": {
          "off": "Desligado",
          "default": "Padrão",
          "strong": "Forte"
        },
        "shapes": {
          "capsule": "Cápsula",
          "block": "Bloco",
          "line": "Linha"
        },
        "densities": {
          "tight": "Densa",
          "default": "Padrão",
          "loose": "Espaçada"
        },
        "layouts": {
          "sweep": "Varredura",
          "mirror": "Espelho"
        },
        "contrasts": {
          "default": "Padrão",
          "boosted": "Realçado",
          "strong": "Forte"
        },
        "toggle": {
          "off": "Desligado",
          "on": "Ligado"
        }
      },
      "quotes": {
        "heading": "Temas das frases",
        "desc": "Por padrão aparecem frases sobre investimento. Dá para combinar vários temas.",
        "all": "Todos os temas",
        "confirm": "Pronto",
        "topics": {
          "investment": "Investimento",
          "literature": "Literatura",
          "poetry": "Poesia",
          "essay": "Ensaio",
          "family": "Família e relações",
          "selfhelp": "Dinheiro e desenvolvimento pessoal",
          "science": "Ciência",
          "history": "História e humanidades",
          "philosophy": "Filosofia e clássicos"
        }
      },
      "closeAria": "Fechar as configurações"
    },
    "weather": {
      "title": "Tempo",
      "titleWithLocation": "Tempo em {location}",
      "detailAria": "Detalhes do tempo",
      "detailOpenAria": "Abrir os detalhes do tempo",
      "detailCloseAria": "Fechar os detalhes do tempo",
      "currentAria": "Tempo agora",
      "commentAria": "Nota do tempo de hoje",
      "reloadAria": "Recarregar o tempo",
      "locating": "Procurando a localização",
      "loadingWeather": "Carregando o tempo",
      "reloading": "Recarregando…",
      "retry": "Tentar de novo",
      "noCurrentData": "Sem dados do tempo atual",
      "defaultLocation": "São Paulo",
      "failed": "Não foi possível carregar o tempo. Tente de novo com o botão abaixo.",
      "staleNotice": "Dados de {relative} · a atualização falhou",
      "conditions": {
        "CLEAR": "Céu limpo",
        "PARTLY_CLOUDY": "Parcialmente nublado",
        "MOSTLY_CLOUDY": "Muito nublado",
        "CLOUDY": "Nublado",
        "FOG": "Neblina",
        "RAIN": "Chuva",
        "SNOW": "Neve",
        "THUNDER": "Tempestade"
      },
      "cloudyWithRainChance": "Nublado ({label})",
      "rainStopped": "Chuva (já parou)",
      "thunderShower": "Tempestade",
      "detail": {
        "humidity": "Umidade {value}%",
        "sunriseSunset": "🌅 Nascer do sol {sunrise} · 🌇 Pôr do sol {sunset}",
        "wind": "Vento {label}",
        "highLow": "Máx:{high} Mín:{low}"
      },
      "hourly": {
        "heading": "Previsão por hora",
        "unavailable": "Não foi possível carregar a previsão por hora."
      },
      "weekly": {
        "heading": "Esta semana",
        "today": "Hoje",
        "unavailable": "Não foi possível carregar a previsão da semana."
      },
      "rain": {
        "heading": "Chuva esta semana",
        "none": "Não há previsão de chuva.",
        "unavailable": "Não foi possível carregar a previsão de chuva."
      },
      "compare": {
        "heading": "Últimas 24 h · Próximas 24 h",
        "aria": "Comparação entre as últimas 24 horas e as próximas 24 horas",
        "unavailable": "Não foi possível carregar a comparação."
      },
      "normal": {
        "heading": "Comparado com o normal",
        "aria": "Diferença em relação à média",
        "unavailable": "Ainda não há dados suficientes para comparar com a média."
      },
      "tropicalNight": {
        "heading": "Noite quente hoje",
        "officialNormal": "Abaixo do limite oficial",
        "feels": "Deve parecer uma noite quente",
        "feelsOk": "A noite deve ser agradável",
        "unavailable": "Não foi possível carregar a temperatura desta noite.",
        "official": "Oficialmente uma noite quente"
      },
      "air": {
        "pm10": "PM10",
        "pm25": "PM2,5",
        "unavailable": "Não foi possível carregar a qualidade do ar.",
        "grades": {
          "GOOD": "Boa",
          "MODERATE": "Moderada",
          "BAD": "Ruim",
          "VERY_BAD": "Muito ruim"
        }
      },
      "advisory": {
        "status": "Alertas em vigor",
        "area": "Área afetada",
        "preliminary": "Alertas preliminares",
        "note": "Observações",
        "issuedAt": "Emitido",
        "expandAria": "Mostrar os detalhes do alerta",
        "empty": "Não há detalhes de alerta para mostrar.",
        "active": "Alerta meteorológico em vigor",
        "content": "Detalhes",
        "collapseAria": "Ocultar os detalhes do alerta"
      },
      "permissionNeeded": "É preciso permitir a localização",
      "currentLocation": "Localização atual",
      "error": "Erro do tempo",
      "lightShowerPossible": "Possíveis pancadas fracas",
      "lightRainPossible": "Possível chuva fraca"
    },
    "music": {
      "bgm": "Música de fundo",
      "info": "Ver informações da faixa",
      "play": "Tocar música",
      "next": "Próxima faixa",
      "like": "Gostei desta faixa",
      "dislike": "Não gostei desta faixa",
      "waiting": "Pronto para tocar",
      "openSettings": "Abrir as configurações de música",
      "shuffle": "Embaralhar de novo",
      "autoPaused": "Pausou sozinho para dar um descanso aos ouvidos.",
      "nowPlayingList": "Tocando a playlist «{name}»",
      "nowPlayingExcluding": "Tocando com {list}",
      "selected": "{name} selecionado",
      "categories": {
        "acoustic": "Acústica",
        "classical": "Clássica",
        "vocal": "Vocais",
        "rock": "Rock",
        "stressRelief": "Alívio do estresse",
        "sleep": "Sono",
        "meditation": "Meditação"
      },
      "allShuffle": "Embaralhar tudo",
      "pause": "Pausar a música",
      "position": "Posição da reprodução",
      "nowPlaying": "Tocando agora",
      "playAction": "Tocar",
      "categoriesShort": {
        "acoustic": "Acústica"
      }
    },
    "quote": {
      "aria": "Frase do dia",
      "settingsAria": "Configurações das frases",
      "settingsOpenAria": "Abrir as configurações das frases",
      "sourceAria": "Informações do livro",
      "buyOnAladin": "Ver este livro na Aladin",
      "buyOnAmazon": "Procurar este livro na Amazon"
    },
    "clock": {
      "aria": "Relógio de abas",
      "currentTimeAria": "Hora atual",
      "calendarAria": "Ver o calendário deste mês"
    },
    "webview": {
      "goAria": "Ir para ezlong.com",
      "goFromBasecampAria": "Ir do Acampamento-base para ezlong.com",
      "frameAria": "Visualização web de ezlong.com",
      "openNewWindowAria": "Abrir ezlong.com em uma nova janela",
      "backToBasecampAria": "Voltar ao Acampamento-base",
      "scrollTopHintAria": "Toque para subir ao topo"
    },
    "common": {
      "showAll": "Ver tudo ({count}) ▾",
      "showAllShort": "Ver tudo >",
      "collapse": "Recolher ▴",
      "openInBrowser": "Abrir no navegador",
      "browserNotice": "Abra no navegador com o botão abaixo para manter o login e o carrinho.",
      "close": "Fechar",
      "dontShowAgain": "Não mostrar de novo",
      "loadingInfo": "Carregando as informações",
      "loading": "Carregando…",
      "retry": "Tentar de novo"
    },
    "update": {
      "availableTitle": "Há uma versão nova",
      "body": "Atualize para a versão mais recente.",
      "requiredTitle": "Atualização necessária",
      "now": "Atualizar agora",
      "later": "Depois"
    },
    "time": {
      "justNow": "Agora mesmo",
      "minutesAgo": "{count, plural, one {há # minuto} other {há # minutos}}",
      "hoursAgo": "{count, plural, one {há # hora} other {há # horas}}",
      "daysAgo": "{count, plural, one {há # dia} other {há # dias}}"
    },
    "fallback": {
      "_note": "Conteúdo de reserva para quando não há conexão, escrito pelo próprio app. São palavras nossas, não citações de livros, então foram adaptadas e não traduzidas ao pé da letra.",
      "sceneSummary": {
        "fresh": "Refrescante",
        "starryClear": "Limpo e estrelado"
      },
      "quoteCategories": {
        "mindset": "Mentalidade de investimento",
        "compounding": "Juros compostos",
        "volatility": "Volatilidade",
        "patience": "Paciência",
        "behavioral": "Finanças comportamentais",
        "retirement": "Aposentadoria"
      },
      "quotes": {
        "dailyDiscipline": {
          "text": "O mercado se mexe todo dia; seus critérios não precisam. Antes de olhar o preço de hoje, confira se o seu plano consegue sobreviver a ele.",
          "title": "Um dia de quem investe no longo prazo"
        },
        "compoundingTime": {
          "text": "Os juros compostos parecem lentos para quem tem pressa e repentinos para quem continuou. O que importa não é a velocidade, e sim uma estrutura que nunca precise ser interrompida.",
          "title": "A aritmética do tempo"
        },
        "usingVolatility": {
          "text": "A volatilidade é mais um ingresso do que um defeito. Se você escrever as quedas dentro do plano em vez de tratá-las como exceção, o tremor deixa de ser susto e vira sinal.",
          "title": "Colocar a volatilidade para trabalhar"
        },
        "artOfWaiting": {
          "text": "Paciência não é ficar sem fazer nada. É decidir o que você vai fazer e então recusar ativamente todo o resto — hoje também.",
          "title": "O ofício de esperar"
        },
        "behavioralNote": {
          "text": "A maior parte da diferença nos resultados não vem de saber mais, e sim do que a pessoa deixa de fazer quando está ansiosa. Ouça a emoção como sinal; decida por regra.",
          "title": "Uma nota sobre comportamento"
        },
        "retirementMath": {
          "text": "Planejar a aposentadoria não é uma tarefa distante: é o que deixa as escolhas de hoje mais leves. Saber o número de que você precisa tira uma quantidade surpreendente de comparação e de preocupação.",
          "title": "A calma de fazer as contas"
        },
        "reducingNoise": {
          "text": "Quanto mais barulhenta a notícia, mais longe convém deixar o botão de operar. Quem investe bem costuma ser melhor em limitar ações do que em reunir informação.",
          "title": "Baixar o volume do ruído"
        },
        "autoInvesting": {
          "text": "O aporte de hoje parece pequeno, mas o tempo é generoso com dinheiro pequeno. Um valor que você consegue sustentar vence um valor que aperta.",
          "title": "Anotações sobre o aporte automático"
        },
        "bearMarketDiary": {
          "text": "Uma queda não testa só os seus ativos. É também o dia em que você descobre se os critérios que definiu aguentam de verdade.",
          "title": "Diário de mercado em baixa"
        },
        "noComparison": {
          "text": "Nos dias em que todo mundo parece mais rápido, veja se o seu plano sobrevive. O investimento que dura fica firme comparando menos.",
          "title": "Investir sem comparar"
        }
      }
    }
  },
  "zh": {
    "settings": {
      "title": "设置",
      "premium": {
        "heading": "高级版",
        "desc": "去除广告，用得更清爽。",
        "cta": "升级到高级版"
      },
      "background": {
        "heading": "背景照片",
        "season": "季节",
        "weather": "天气",
        "timeOfDay": "时段",
        "activeNotice": "只显示符合{filters}的照片。",
        "matchCriteriaAria": "照片匹配条件",
        "photoAria": "背景照片 {index}",
        "photoMissingAria": "背景照片 {index} 无法加载"
      },
      "music": {
        "heading": "音乐 · 播放列表",
        "excludeHeading": "从全部随机播放中排除",
        "excludeSuffix": "排除{name}",
        "specialNotice": "不会混入随机播放，只有在下面选中时才播放。",
        "specialAria": "特辑 — 适合特定场景的音乐",
        "specialSelectAria": "选择特辑播放列表",
        "playlistSelectAria": "选择播放列表",
        "excludeFilterAria": "风格排除筛选",
        "history": "听过的音乐",
        "historyEmpty": "还没有播放记录。",
        "keepOne": "请至少保留一个播放列表",
        "excludeAcoustic": "排除原声",
        "excludeClassical": "排除古典",
        "excludeVocal": "排除人声",
        "excludeRock": "排除摇滚"
      },
      "visualizer": {
        "heading": "音频可视化",
        "desc": "颜色和反应方式都可以按喜好调整。",
        "color": "颜色",
        "sensitivity": "灵敏度",
        "kick": "低音反应",
        "kickDesc": "只在乐曲有厚重低音时才有反应。",
        "barShape": "柱形",
        "density": "密度",
        "layout": "排列",
        "contrast": "对比度",
        "contrastDesc": "拉大高音和低音之间的高低差。",
        "accentBars": "点缀柱",
        "accentDesc": "两端的两根会在踩镲和人声高音时闪动。",
        "preview": "预览",
        "colors": {
          "rainbow": "彩虹",
          "halfRainbow": "半彩虹",
          "ocean": "海洋",
          "sunset": "日落",
          "purple": "紫色",
          "white": "白色"
        },
        "levels": {
          "low": "低",
          "default": "默认",
          "high": "高"
        },
        "kickLevels": {
          "off": "关闭",
          "default": "默认",
          "strong": "强"
        },
        "shapes": {
          "capsule": "胶囊",
          "block": "方块",
          "line": "线条"
        },
        "densities": {
          "tight": "紧密",
          "default": "默认",
          "loose": "宽松"
        },
        "layouts": {
          "sweep": "扫掠",
          "mirror": "镜像"
        },
        "contrasts": {
          "default": "默认",
          "boosted": "增强",
          "strong": "强"
        },
        "toggle": {
          "off": "关闭",
          "on": "开启"
        }
      },
      "quotes": {
        "heading": "语句的领域",
        "desc": "默认只显示投资类语句。可以同时选择多个领域。",
        "all": "全部领域",
        "confirm": "确定",
        "topics": {
          "investment": "投资",
          "literature": "文学",
          "poetry": "诗",
          "essay": "随笔",
          "family": "家庭·人际",
          "selfhelp": "理财·自我提升",
          "science": "科学",
          "history": "历史·人文",
          "philosophy": "哲学·经典"
        }
      },
      "closeAria": "关闭设置"
    },
    "weather": {
      "title": "天气",
      "titleWithLocation": "{location}的天气",
      "detailAria": "天气详情",
      "detailOpenAria": "打开天气详情",
      "detailCloseAria": "关闭天气详情",
      "currentAria": "当前天气",
      "commentAria": "今日天气备注",
      "reloadAria": "重新加载天气",
      "locating": "正在获取当前位置",
      "loadingWeather": "正在加载天气",
      "reloading": "重新加载中…",
      "retry": "重试",
      "noCurrentData": "没有当前天气数据",
      "defaultLocation": "北京",
      "failed": "天气加载失败。请用下方按钮再试一次。",
      "staleNotice": "{relative}的数据 · 更新失败",
      "conditions": {
        "CLEAR": "晴",
        "PARTLY_CLOUDY": "晴间多云",
        "MOSTLY_CLOUDY": "多云间晴",
        "CLOUDY": "阴",
        "FOG": "雾",
        "RAIN": "雨",
        "SNOW": "雪",
        "THUNDER": "雷阵雨"
      },
      "cloudyWithRainChance": "阴（{label}）",
      "rainStopped": "雨（已停）",
      "thunderShower": "雷阵雨",
      "detail": {
        "humidity": "湿度 {value}%",
        "sunriseSunset": "🌅 日出 {sunrise} · 🌇 日落 {sunset}",
        "wind": "风 {label}",
        "highLow": "最高:{high} 最低:{low}"
      },
      "hourly": {
        "heading": "逐小时预报",
        "unavailable": "逐小时预报加载失败。"
      },
      "weekly": {
        "heading": "本周",
        "today": "今天",
        "unavailable": "一周预报加载失败。"
      },
      "rain": {
        "heading": "本周降雨",
        "none": "预计没有降雨。",
        "unavailable": "降雨预报加载失败。"
      },
      "compare": {
        "heading": "过去24小时 · 未来24小时",
        "aria": "过去24小时与未来24小时的对比",
        "unavailable": "对比数据加载失败。"
      },
      "normal": {
        "heading": "与常年相比",
        "aria": "与常年平均值的差异",
        "unavailable": "数据还不足以与常年比较。"
      },
      "tropicalNight": {
        "heading": "今夜的闷热夜",
        "officialNormal": "低于官方标准",
        "feels": "体感像闷热的夜晚",
        "feelsOk": "今晚应该比较舒适",
        "unavailable": "今夜气温信息加载失败。",
        "official": "官方认定的闷热夜"
      },
      "air": {
        "pm10": "PM10",
        "pm25": "PM2.5",
        "unavailable": "空气质量加载失败。",
        "grades": {
          "GOOD": "优",
          "MODERATE": "良",
          "BAD": "差",
          "VERY_BAD": "很差"
        }
      },
      "advisory": {
        "status": "生效中的预警",
        "area": "影响区域",
        "preliminary": "预备预警",
        "note": "参考事项",
        "issuedAt": "发布时间",
        "expandAria": "显示预警详情",
        "empty": "没有可显示的预警详情。",
        "active": "气象预警生效中",
        "content": "内容",
        "collapseAria": "隐藏预警详情"
      },
      "permissionNeeded": "需要位置权限",
      "currentLocation": "当前位置",
      "error": "天气错误",
      "lightShowerPossible": "可能有小阵雨",
      "lightRainPossible": "可能有小雨"
    },
    "music": {
      "bgm": "背景音乐",
      "info": "显示曲目信息",
      "play": "播放音乐",
      "next": "下一首",
      "like": "喜欢这首",
      "dislike": "不喜欢这首",
      "waiting": "等待播放",
      "openSettings": "打开音乐设置",
      "shuffle": "重新随机播放",
      "autoPaused": "已自动暂停，让耳朵休息一下。",
      "nowPlayingList": "正在播放「{name}」播放列表",
      "nowPlayingExcluding": "正在以{list}播放",
      "selected": "已选择{name}",
      "categories": {
        "acoustic": "原声",
        "classical": "古典",
        "vocal": "人声",
        "rock": "摇滚",
        "stressRelief": "解压",
        "sleep": "助眠",
        "meditation": "冥想"
      },
      "allShuffle": "全部随机播放",
      "pause": "暂停音乐",
      "position": "播放位置",
      "nowPlaying": "正在播放",
      "playAction": "播放",
      "categoriesShort": {
        "acoustic": "原声"
      }
    },
    "quote": {
      "aria": "今日语句",
      "settingsAria": "语句设置",
      "settingsOpenAria": "打开语句设置",
      "sourceAria": "书籍信息",
      "buyOnAladin": "在 Aladin 查看这本书",
      "buyOnAmazon": "在亚马逊查找这本书"
    },
    "clock": {
      "aria": "翻页时钟",
      "currentTimeAria": "当前时间",
      "calendarAria": "显示本月日历"
    },
    "webview": {
      "goAria": "前往 ezlong.com",
      "goFromBasecampAria": "从大本营前往 ezlong.com",
      "frameAria": "ezlong.com 网页视图",
      "openNewWindowAria": "在新窗口打开 ezlong.com",
      "backToBasecampAria": "返回大本营",
      "scrollTopHintAria": "点击可滚动到顶部"
    },
    "common": {
      "showAll": "查看全部（{count}） ▾",
      "showAllShort": "查看全部 >",
      "collapse": "收起 ▴",
      "openInBrowser": "在浏览器中打开",
      "browserNotice": "为了保留登录和购物车，请用下方按钮在浏览器中打开。",
      "close": "关闭",
      "dontShowAgain": "不再显示",
      "loadingInfo": "正在加载信息",
      "loading": "加载中…",
      "retry": "再试一次"
    },
    "update": {
      "availableTitle": "有新版本可用",
      "body": "请更新到最新版本。",
      "requiredTitle": "需要更新",
      "now": "立即更新",
      "later": "稍后"
    },
    "time": {
      "justNow": "刚刚",
      "minutesAgo": "{count, plural, other {#分钟前}}",
      "hoursAgo": "{count, plural, other {#小时前}}",
      "daysAgo": "{count, plural, other {#天前}}"
    },
    "fallback": {
      "_note": "离线时的备用文案。这是应用自己的话，不是书中引文，所以按中文习惯改写而非直译。",
      "sceneSummary": {
        "fresh": "清爽",
        "starryClear": "星光清朗"
      },
      "quoteCategories": {
        "mindset": "投资心态",
        "compounding": "复利",
        "volatility": "波动",
        "patience": "耐心",
        "behavioral": "行为金融",
        "retirement": "退休"
      },
      "quotes": {
        "dailyDiscipline": {
          "text": "市场每天都在动，你的标准不必跟着动。看今天价格之前，先确认你的计划能活得比这段波动更久。",
          "title": "长期投资者的一天"
        },
        "compoundingTime": {
          "text": "复利在急躁的人眼里很慢，在坚持下来的人眼里却来得突然。关键不是快，而是一个不必中途停下的结构。",
          "title": "时间这道算术"
        },
        "usingVolatility": {
          "text": "波动与其说是缺陷，不如说是入场费。把下跌写进计划而不是当成例外，摇晃就从惊吓变成了信号。",
          "title": "让波动为你所用"
        },
        "artOfWaiting": {
          "text": "耐心不是什么都不做。而是先决定要做什么，然后主动拒绝其余的一切 — 今天也一样。",
          "title": "等待这门手艺"
        },
        "behavioralNote": {
          "text": "收益的差距，多半不来自知道得更多，而来自不安时忍住没做什么。把情绪当信号听，用规则来决定。",
          "title": "关于行为的笔记"
        },
        "retirementMath": {
          "text": "退休规划不是遥远的作业，而是让今天的选择变轻松的东西。只要知道自己需要的数字，比较和担忧就会少很多。",
          "title": "把数字算出来的踏实"
        },
        "reducingNoise": {
          "text": "新闻越吵，交易按钮就该放得越远。好的投资者，往往不是更会收集信息，而是更能克制动作。",
          "title": "把噪音调小"
        },
        "autoInvesting": {
          "text": "今天的定投看着很小，但时间对小钱一向慷慨。能坚持下去的金额，胜过让你吃力的金额。",
          "title": "关于定投的备忘"
        },
        "bearMarketDiary": {
          "text": "下跌考验的不只是资产。它也是你发现自己定下的标准到底扛不扛得住的那一天。",
          "title": "熊市日记"
        },
        "noComparison": {
          "text": "别人看起来都更快的日子里，先看看自己的计划能不能活下来。走得久的投资，是靠少比较才结实起来的。",
          "title": "不比较的投资"
        }
      }
    }
  }
};
})(typeof self !== "undefined" ? self : this);
