const bridge = window.Capacitor;
const plugins = bridge?.Plugins || {};
const { Haptics, LocalNotifications, Share, SplashScreen, StatusBar } = plugins;

const notificationKey = "dailyQuoteNotificationEnabled";
const quoteHour = 8;
const quoteMinute = 30;

function isNativeApp() {
  return Boolean(bridge?.isNativePlatform?.());
}

async function lightTap() {
  if (!isNativeApp() || !Haptics) return;
  try {
    await Haptics.impact({ style: "LIGHT" });
  } catch {
    // Haptics are optional per device.
  }
}

async function setupSystemChrome() {
  if (!isNativeApp()) return;
  try {
    await StatusBar?.setStyle({ style: "DARK" });
    await StatusBar?.setBackgroundColor({ color: "#121b2a" });
    await SplashScreen?.hide();
  } catch {
    // Native chrome setup should never block the clock.
  }
}

function getPreference(key) {
  return window.localStorage.getItem(key) || "";
}

function setPreference(key, value) {
  window.localStorage.setItem(key, value);
}

async function enableDailyQuoteNotification() {
  if (!isNativeApp() || !LocalNotifications) return false;

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return false;

  await LocalNotifications.cancel({ notifications: [{ id: 830 }] });
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 830,
        title: "오늘의 투자 멘탈",
        body: "오늘도 오래 살아남는 쪽으로 천천히 가요.",
        schedule: {
          on: { hour: quoteHour, minute: quoteMinute },
          repeats: true
        },
        sound: null
      }
    ]
  });
  setPreference(notificationKey, "true");
  return true;
}

function createNativeDock() {
  if (!isNativeApp()) return;
  const dock = document.createElement("div");
  dock.className = "native-dock";
  dock.innerHTML = `
    <button class="native-action" type="button" data-native-notify>
      <span>매일 8:30</span>
    </button>
    <button class="native-action" type="button" data-native-share>
      <span>공유</span>
    </button>
  `;
  document.querySelector(".sky-room")?.appendChild(dock);

  dock.querySelector("[data-native-notify]")?.addEventListener("click", async () => {
    await lightTap();
    const enabled = await enableDailyQuoteNotification();
    dock.classList.toggle("is-notified", enabled);
  });

  dock.querySelector("[data-native-share]")?.addEventListener("click", async () => {
    await lightTap();
    const sharePayload = {
      title: "ezlong time",
      text: "투자 멘탈을 잡아주는 날씨 플립시계",
      url: "https://ezlong.com/time/"
    };

    if (isNativeApp() && Share) {
      await Share.share(sharePayload);
    } else if (navigator.share) {
      await navigator.share(sharePayload);
    }
  });
}

function wireNativeInteractions() {
  document.querySelectorAll("[data-scene-button], #settingsOpen, #settingsSave, [data-settings-close]").forEach((element) => {
    element.addEventListener("click", lightTap);
  });

  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("app-paused", document.hidden);
  });
}

function restoreNotificationState() {
  if (getPreference(notificationKey) === "true") {
    document.querySelector(".native-dock")?.classList.add("is-notified");
  }
}

async function start() {
  await setupSystemChrome();
  document.documentElement.dataset.nativePlatform = bridge?.getPlatform?.() || "native";
  createNativeDock();
  wireNativeInteractions();
  restoreNotificationState();
}

start();
