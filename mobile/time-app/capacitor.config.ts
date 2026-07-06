import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ezlong.time",
  appName: "ezlong time",
  webDir: "www",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
    iosScheme: "https"
  },
  ios: {
    contentInset: "automatic",
    scrollEnabled: true
  },
  android: {
    allowMixedContent: false,
    captureInput: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1400,
      backgroundColor: "#0f1824",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0f1824",
      overlaysWebView: false
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#0A84FF"
    }
  }
};

export default config;
