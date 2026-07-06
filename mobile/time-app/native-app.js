const bridge = window.Capacitor;
const plugins = bridge?.Plugins || {};
const { App, Device, Haptics, LocalNotifications, Preferences, SplashScreen, StatusBar } = plugins;

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
    await StatusBar?.setBackgroundColor({ color: "#0f1824" });
    await SplashScreen?.hide();
  } catch {
    // Native chrome setup should never block the clock.
  }
}

async function getPreference(key) {
  const result = await Preferences?.get?.({ key });
  return result?.value || "";
}

async function setPreference(key, value) {
  await Preferences?.set?.({ key, value });
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
  await setPreference(notificationKey, "true");
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
    if (navigator.share) {
      await navigator.share({
        title: "ezlong time",
        text: "투자 멘탈을 잡아주는 날씨 플립시계",
        url: "https://ezlong.com/time/"
      });
    }
  });
}

async function annotateDevice() {
  if (!isNativeApp() || !Device) return;
  try {
    const info = await Device.getInfo();
    document.documentElement.dataset.nativePlatform = info.platform || "native";
  } catch {
    document.documentElement.dataset.nativePlatform = "native";
  }
}

function wireNativeInteractions() {
  document.querySelectorAll("[data-scene-button], #settingsOpen, #settingsSave, [data-settings-close]").forEach((element) => {
    element.addEventListener("click", lightTap);
  });

  App?.addListener?.("appStateChange", ({ isActive }) => {
    document.documentElement.classList.toggle("app-paused", !isActive);
  });
}

async function restoreNotificationState() {
  if ((await getPreference(notificationKey)) === "true") {
    document.querySelector(".native-dock")?.classList.add("is-notified");
  }
}

async function start() {
  await setupSystemChrome();
  await annotateDevice();
  createNativeDock();
  wireNativeInteractions();
  await restoreNotificationState();
}

start();
