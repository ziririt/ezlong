import type { CapacitorConfig } from "@capacitor/cli";

// TODO(확정 필요): appId는 App Store Connect / Play Console에 등록할 최종 bundle id로 교체.
// 가등록 후보: com.ezlong.time (변경 시 iOS/Android 네이티브 프로젝트를 재생성해야 하므로
// 실제 스토어 등록 전에 반드시 한 번에 확정할 것).
const config: CapacitorConfig = {
  appId: "com.ezlong.time",
  appName: "ezlong time",
  webDir: "www",
  backgroundColor: "#121b2a",
  ios: {
    contentInset: "always",
    backgroundColor: "#121b2a",
    // Safari/Chrome 웹과 동일하게 자연 배경 사진이 노치/홈 인디케이터까지 꽉 차 보이도록 한다.
    // index.html의 viewport-fit=cover + styles.css의 env(safe-area-inset-*) 처리와 짝을 이룬다.
    scrollEnabled: false
  },
  android: {
    backgroundColor: "#121b2a"
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      backgroundColor: "#121b2a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP"
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: true
    },
    LocalNotifications: {
      // 첫 실행 즉시 권한을 요청하지 않는다. 사용자가 설정 화면에서 알림을 켤 때만 요청한다.
      // (요청 트리거는 www 쪽 앱 전용 설정 UI에서 LocalNotifications.requestPermissions()를 호출)
      smallIcon: "ic_stat_ezlong",
      iconColor: "#f4b942"
    }
  }
};

export default config;
