/* 스토어 문 — 이 파일이 유일한 스위치다.
 *
 * 2026-08-19. 앱이 아직 심사 중이라 주소가 없다. 그렇다고 단추를 안 그리면
 * '이 앱은 아직 없구나'로 읽히고, 그리기만 하고 아무 데도 안 가게 두면
 * 눌러 본 사람이 고장으로 읽는다. 그래서 **자리는 지키되 상태를 말한다.**
 *
 * 출시하는 날 아래 두 줄에 주소를 넣으면 두 쪽(소개·웹앱)의 단추가 동시에
 * 열린다. 스위치가 두 곳에 있으면 언젠가 한 쪽만 켜진 채로 남는다.
 */
window.SKYBLUE_STORE = {
  ios: '',
  android: ''
};

(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var box = window.SKYBLUE_STORE || {};
    var els = document.querySelectorAll('[data-store]');
    for (var i = 0; i < els.length; i++) {
      (function (el) {
        var which = el.getAttribute('data-store');
        var url = box[which] || '';
        var note = el.querySelector('small');

        if (!url) {
          // 아직 안 열린 문. 눌러도 아무 일이 없다는 것을 손끝에도 알린다.
          el.setAttribute('aria-disabled', 'true');
          el.classList.add('soon');
          el.addEventListener('click', function (e) { e.preventDefault(); });
          return;
        }

        el.setAttribute('href', url);
        el.setAttribute('rel', 'noopener');
        if (note) note.textContent = el.getAttribute('data-open') || '내려받기';
        el.addEventListener('click', function () {
          if (window.gtag) gtag('event', 'store_click', { store: which });
        });
      })(els[i]);
    }
  });
})();
