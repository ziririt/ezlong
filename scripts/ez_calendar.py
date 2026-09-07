"""NYSE 거래일 캘린더 (88항). 단일 출처는 data/nyse-calendar.json.

왜 있나: 2026-09-07(노동절 휴장)에 스윙 뷰가 '오늘 장(9월7일) 장중'이라고 썼다.
요일만 보고 세션을 판정해서 평일 공휴일을 몰랐다. 세션·기준일 판정은 전부 여기를 거친다.

쓰는 법:
    from ez_calendar import session_phase, last_trading_day, is_trading_day, et_now
    session_phase()            -> 'pre' | 'open' | 'post' | 'closed'   (휴장일·주말은 'closed')
    last_trading_day()         -> date  마지막 실제 거래일(오늘이 거래일이고 개장 후면 오늘)
    is_trading_day(date)       -> bool
    holiday_name(date)         -> str | None
    calendar_warning()         -> str | None  validUntil 60일 안이면 경고문
"""
import json
import os
from datetime import datetime, timezone, timedelta, date as _date

try:
    from zoneinfo import ZoneInfo
    _ET = ZoneInfo('America/New_York')
except Exception:  # pragma: no cover
    _ET = None

_HERE = os.path.dirname(os.path.abspath(__file__))
_PATH = os.path.join(_HERE, '..', 'data', 'nyse-calendar.json')
_CAL = None


def _load():
    global _CAL
    if _CAL is None:
        with open(_PATH, encoding='utf-8') as f:
            _CAL = json.load(f)
        _CAL['_h'] = set(_CAL.get('holidays', []))
        _CAL['_e'] = set(_CAL.get('earlyClose', []))
    return _CAL


def et_now(now_utc=None):
    u = now_utc or datetime.now(timezone.utc)
    if _ET is not None:
        return u.astimezone(_ET)
    # zoneinfo 없을 때 어림: 3월 둘째 일요일~11월 첫째 일요일 EDT
    y = u.year
    def nth_sun(m, n):
        d = datetime(y, m, 1, tzinfo=timezone.utc)
        d += timedelta(days=(6 - d.weekday()) % 7)
        return d + timedelta(days=7 * (n - 1))
    edt = nth_sun(3, 2) <= u < nth_sun(11, 1)
    return u.astimezone(timezone(timedelta(hours=-4 if edt else -5)))


def _as_date(d):
    if isinstance(d, datetime):
        return d.date()
    if isinstance(d, str):
        return _date.fromisoformat(d[:10])
    return d


def is_holiday(d):
    return _as_date(d).isoformat() in _load()['_h']


def holiday_name(d):
    return _load().get('holidayNames', {}).get(_as_date(d).isoformat())


def is_early_close(d):
    return _as_date(d).isoformat() in _load()['_e']


def is_trading_day(d):
    d = _as_date(d)
    return d.weekday() < 5 and not is_holiday(d)


def last_trading_day(now_utc=None):
    """마지막 실제 거래일. 오늘이 거래일이고 개장(09:30 ET) 후면 오늘, 아니면 그 전 거래일."""
    et = et_now(now_utc)
    d = et.date()
    if not (is_trading_day(d) and (et.hour * 60 + et.minute) >= 570):
        d -= timedelta(days=1)
    while not is_trading_day(d):
        d -= timedelta(days=1)
    return d


def next_trading_day(d=None):
    d = _as_date(d) if d else et_now().date()
    d += timedelta(days=1)
    while not is_trading_day(d):
        d += timedelta(days=1)
    return d


def session_phase(now_utc=None):
    """'pre' | 'open' | 'post' | 'closed'. 주말·휴장일은 언제나 'closed'.
    조기 폐장일은 13:00 ET에 정규장이 끝난다."""
    et = et_now(now_utc)
    if not is_trading_day(et.date()):
        return 'closed'
    m = et.hour * 60 + et.minute
    close = 13 * 60 if is_early_close(et.date()) else 16 * 60
    if 240 <= m < 570:
        return 'pre'
    if 570 <= m < close:
        return 'open'
    if close <= m < 1200:
        return 'post'
    return 'closed'


def closed_reason(now_utc=None):
    """'closed'일 때 왜 닫혔는지: 'weekend' | 'holiday' | 'night'."""
    et = et_now(now_utc)
    if et.weekday() >= 5:
        return 'weekend'
    if is_holiday(et.date()):
        return 'holiday'
    return 'night'


def calendar_warning(now_utc=None):
    vu = _load().get('validUntil')
    if not vu:
        return None
    left = (_date.fromisoformat(vu) - et_now(now_utc).date()).days
    if left <= 60:
        return f'[ez_calendar] data/nyse-calendar.json 유효기간이 {left}일 남았다({vu}). 다음 해 휴장일을 채워라.'
    return None


if __name__ == '__main__':
    import sys
    et = et_now()
    print('ET now        :', et.strftime('%Y-%m-%d %H:%M %a'))
    print('trading day?  :', is_trading_day(et.date()), holiday_name(et.date()) or '')
    print('session_phase :', session_phase(), '(' + closed_reason() + ')' if session_phase() == 'closed' else '')
    print('last trading  :', last_trading_day())
    print('next trading  :', next_trading_day())
    w = calendar_warning()
    if w:
        print(w)
    # 자가 검사: 2026-09-07 노동절은 거래일이 아니어야 한다
    assert not is_trading_day(_date(2026, 9, 7)), '노동절이 거래일로 잡힌다'
    assert is_trading_day(_date(2026, 9, 8))
    assert last_trading_day(datetime(2026, 9, 7, 18, 0, tzinfo=timezone.utc)) == _date(2026, 9, 4)
    print('selftest OK')
    sys.exit(0)
