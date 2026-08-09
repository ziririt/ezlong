'use strict';

/**
 * watchdog.js — ezlong.com 데이터 업데이트 감시견
 *
 * 역할:
 *   - 각 데이터 파일의 타임스탬프를 30분마다 체크
 *   - 정해진 허용 시간을 초과한 파일이 있으면 해당 워크플로를 자동 트리거
 *   - 워크플로가 이미 실행 중이면 중복 트리거 하지 않음
 *   - 결과를 data/watchdog-status.json에 기록
 *
 * 실행 방법: node scripts/watchdog.js
 * 환경변수: GITHUB_TOKEN (GitHub Actions 내에서 자동 주입)
 */

const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── 설정 ─────────────────────────────────────────────────────────────────
const OWNER     = 'ziririt';
const REPO      = 'ezlong';
const GH_TOKEN  = process.env.GITHUB_TOKEN;
const DATA_DIR  = path.join(__dirname, '..', 'data');

if (!GH_TOKEN) {
  console.error('오류: GITHUB_TOKEN 환경변수가 없습니다.');
  process.exit(1);
}

// ─── 모니터링 대상 정의 ────────────────────────────────────────────────────
//
// isActive(now) → true 이면 해당 시간대에 체크를 수행함
// maxAgeHours   → 이 시간(h)보다 오래된 데이터는 stale로 판단해 워크플로 트리거
//
const MONITORS = [
  {
    id:             'us-chart',
    name:           '미국주식 차트분석',
    workflow:       'fetch-us-chart-analysis.yml',
    checkFile:      'analysis-TSLA.json',   // 대표 파일 (가장 중요)
    timestampField: 'updatedAt',
    maxAgeHours:    2.5,
    // 미국 프리마켓~포스트마켓: KST 17:00~익일 07:00 = UTC 08:00~22:00, 평일
    isActive: (now) => {
      const day = now.getUTCDay();          // 0=일, 6=토
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 8.0 && h <= 23.99;
    }
  },
  {
    id:             'kr-chart',
    name:           '한국주식 차트분석',
    workflow:       'fetch-kr-crypto-analysis.yml',
    checkFile:      'analysis-069500_KS.json',
    timestampField: 'updatedAt',
    maxAgeHours:    2.5,
    // 한국 장: KST 09:00~16:00 = UTC 00:00~07:00, 평일
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 0.0 && h <= 7.0;
    }
  },
  {
    id:             'crypto-chart',
    name:           '크립토 차트분석',
    workflow:       'fetch-crypto-analysis.yml',
    checkFile:      'analysis-BTC_USD.json',
    timestampField: 'updatedAt',
    maxAgeHours:    5.0,
    isActive: () => true   // 크립토는 24/7
  },
  {
    id:             'market-data',
    name:           'ATMR 시장데이터',
    workflow:       'fetch-market-data.yml',
    checkFile:      'market-signals.json',
    timestampField: 'generatedAt',
    maxAgeHours:    1.5,
    // 미국 시장 시간 + 전후 1시간: UTC 평일 12:00~22:00
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 12.0 && h <= 22.0;
    }
  },
  {
    id:             'options',
    name:           'FlashAlpha 옵션데이터',
    workflow:       'fetch-options-data.yml',
    checkFile:      'options-latest.json',
    timestampField: 'fetchedAt',
    maxAgeHours:    6.0,
    // 미국 장중: UTC 평일 13:30~21:00
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 13.5 && h <= 21.0;
    }
  },

  // ─── 2026-07-03 확장: 감시 사각지대 5개 편입 ─────────────────────────────
  // 배경: market-cycle 19일 정지, scorecard 야간 실패, stocks-prices가
  // GitHub cron 지연으로 10분 주기가 실제 1~3시간이 되는 문제를 전부 감시망에 넣는다.

  {
    id:             'scorecard',
    name:           '긍정vs부정 스코어카드',
    workflow:       'market-scorecard.yml',
    checkFile:      'market-scorecard-data.json',
    timestampField: 'updated_at',
    // 설계상 최대 공백 7.5h(23:30→익일 06:50). 8.0h로 새벽 오탐 없이
    // "하루 중 어떤 회차든 누락되면 다음 라운드에 재트리거"를 보장.
    maxAgeHours:    8.0,
    isActive: () => true   // 매일 5회 (주말 포함 설계)
  },
  {
    id:             'stocks-prices',
    name:           '심플 주가 실시간',
    workflow:       'fetch-stocks-prices.yml',
    checkFile:      'stocks-prices.json',
    timestampField: 'updatedAt',
    // 설계 10분 주기지만 GitHub cron이 1~3h씩 밀리는 실측(2026-07-02) →
    // 45분 넘게 낡으면 재트리거해 체감 최대 지연을 ~1h 이내로 억제.
    maxAgeHours:    0.75,
    // cron 활성 구간: UTC 평일 08:00~23:59 (KST 17:00~익일 08:59)
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 8.0;
    }
  },
  {
    id:             'stocks-data',
    name:           '심플 주가 일간(스파크라인)',
    workflow:       'fetch-stocks-data.yml',
    checkFile:      'stocks-data.json',
    timestampField: 'generatedAt',
    // 일 1회(평일 UTC 22:00). 26h 초과 = 하루 누락. 월요일 새벽엔 주말 공백으로
    // 조기 1회 트리거되지만 금요 종가 데이터 재생성일 뿐이라 무해.
    maxAgeHours:    26.0,
    isActive: (now) => { const day = now.getUTCDay(); return day >= 1 && day <= 5; }
  },
  {
    id:             'market-cycle',
    name:           '마켓 사이클 주봉',
    workflow:       'fetch-market-cycle.yml',
    checkFile:      'mc-ohlcv-SPY-weekly.json',
    timestampField: 'updatedAt',
    // 일 1회(평일 UTC 21:10). 19일 정지 사고(6/13~7/2)의 직접 재발 방지 항목.
    maxAgeHours:    30.0,
    isActive: (now) => { const day = now.getUTCDay(); return day >= 1 && day <= 5; }
  },
  {
    // 2026-08-07 추가 — 오늘 새벽 01:09 KST 에 화면이 20:15 KST(프리마켓)
    // 논평을 그대로 걸고 있었다. 22:45·23:45·23:50 KST 슬롯이 전부 안 돌았는데
    // 아무도 몰랐다. 감시 대상 10개 중에 정작 방문자가 가장 먼저 읽는 판단
    // 코멘트가 빠져 있었던 것. 신선도를 재려면 ISO 시각이 필요해서 생성기에
    // generatedAt(UTC) 필드를 같이 추가했다.
    id:             'swing-view',
    name:           '스윙 시그널 판단',
    workflow:       'swing-view.yml',
    checkFile:      'swing-view.json',
    timestampField: 'generatedAt',
    // 설계상 가장 긴 슬롯 간격은 07:37→18:00 KST 의 야간 공백(10h)이라
    // 그 구간은 아래 isActive 로 아예 제외한다. 활성 구간 안에서는 2.5h.
    maxAgeHours:    2.5,
    // 미국 프리마켓~마감 후: KST 18:00~익일 07:40 = UTC 09:00~22:40, 평일
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 9.0 && h <= 22.6;
    }
  },
  {
    // 2026-08-08 추가 — 모델 포트폴리오는 주 1회(일요일 밤) 갱신이라 빈도가
    // 낮은 만큼 한 번 걸러지면 일주일이 통째로 묵는다. 파이프라인을 만들면
    // 감시견 등록까지가 한 세트다(CLAUDE.md 40항).
    // 활성 구간은 월요일 낮(KST) 한나절뿐 — 그때까지 갱신이 안 됐으면 밀린 것이다.
    id:             'model-portfolio',
    name:           '모델 포트폴리오',
    workflow:       'model-portfolio.yml',
    checkFile:      'model-portfolio.json',
    timestampField: 'generatedAt',
    maxAgeHours:    30.0,
    // UTC 월 00:00~06:00 = KST 월 09:00~15:00
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day === 1 && h >= 0.0 && h <= 6.0;
    }
  },
  {
    // 2026-08-09 추가 — 네이버 채널 동기화. 이 파이프라인이 멎으면 소사
    // (brief-history)의 최신 글이 조용히 안 올라온다. 화면은 멀쩡하고
    // 며칠 전 글까지만 보이는 종류의 고장이라 아무도 눈치채지 못한다.
    // 트리거가 cron-job.org 한 곳에 몰려 있던 것도 같이 푼다(워크플로에
    // 깃허브 자체 예약 슬롯 추가 + 여기 감시 등록).
    id:             'naver-sync',
    name:           '네이버 채널 동기화',
    workflow:       'naver-sync.yml',
    checkFile:      'naver-content.json',
    timestampField: 'updatedAt',
    // 하루 한 번만 돌아도 정상인 파이프라인이라 26h. 그보다 묵었으면 밀린 것.
    maxAgeHours:    26.0,
    // KST 10:00~18:00 = UTC 01:00~09:00. 아침 슬롯(09:05 KST)이 지난 뒤부터
    // 재는 창. 새 글은 대개 오전에 올라오므로 낮 동안 확인하면 충분하다.
    isActive: (now) => {
      const h = now.getUTCHours() + now.getUTCMinutes() / 60;
      return h >= 1.0 && h <= 9.0;
    }
  },
  {
    // 2026-08-09 추가 — 주간 위험 진단. 주 1회(한국시각 일요일 아침)라
    // 한 번 걸러지면 일주일이 통째로 묵는다. 화면은 멀쩡하고 '지난주 대비'만
    // 두 주 전 값이 되는 종류의 고장이라 눈에 띄지 않는다.
    // 파이프라인을 만들면 감시견 등록까지가 한 세트다(CLAUDE.md 40항).
    id:             'weekly-risk',
    name:           '주간 위험 진단',
    workflow:       'weekly-risk.yml',
    checkFile:      'weekly-risk.json',
    timestampField: 'generatedAt',
    // 본실행 07:00 KST · 보조 10:00 KST. 아래 창(일 13:00~21:00 KST)에서
    // 20h 을 넘겼다면 이번 주 두 슬롯이 다 건너뛴 것이다.
    maxAgeHours:    20.0,
    // UTC 일 04:00~12:00 = KST 일 13:00~21:00
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day === 0 && h >= 4.0 && h <= 12.0;
    }
  },
  {
    // 2026-08-10 추가 — AI 과매수·과매도 진단. 주 1회(일요일 아침)라 한 번
    // 걸러지면 일주일이 묵는다. 파이프라인을 만들면 감시견 등록까지가
    // 한 세트다(CLAUDE.md 40항).
    id:             'swing-ai',
    name:           'AI 과매수·과매도 진단',
    workflow:       'swing-ai.yml',
    checkFile:      'swing-ai.json',
    timestampField: 'generatedAt',
    // 본실행 07:10 KST · 보조 10:10 KST. 아래 창(일 13:00~21:00 KST)에서
    // 20h 을 넘겼다면 이번 주 두 슬롯이 다 건너뛴 것.
    maxAgeHours:    20.0,
    // UTC 일 04:00~12:00 = KST 일 13:00~21:00
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day === 0 && h >= 4.0 && h <= 12.0;
    }
  },
  {
    id:             'kr-prices',
    name:           '한국 주가',
    workflow:       'fetch-kr-prices.yml',
    checkFile:      'kr-prices.json',
    timestampField: 'updatedAt',
    maxAgeHours:    1.0,
    // 한국 장중: UTC 평일 00:00~07:00 (KST 09:00~16:00)
    isActive: (now) => {
      const day = now.getUTCDay();
      const h   = now.getUTCHours() + now.getUTCMinutes() / 60;
      return day >= 1 && day <= 5 && h >= 0.0 && h <= 7.0;
    }
  }
];

// ─── GitHub API 헬퍼 ──────────────────────────────────────────────────────
function githubFetch(apiPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path:     apiPath,
      method,
      headers: {
        'Authorization':        `Bearer ${GH_TOKEN}`,
        'Accept':               'application/vnd.github+json',
        'User-Agent':           'ezlong-watchdog/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      }
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(raw ? JSON.parse(raw) : { _statusCode: res.statusCode });
          } else {
            reject(new Error(`GitHub API ${res.statusCode} @ ${apiPath}: ${raw.slice(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`JSON 파싱 실패: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 특정 워크플로가 현재 실행 중인지 확인
async function isWorkflowInProgress(workflowFile) {
  try {
    const data = await githubFetch(
      `/repos/${OWNER}/${REPO}/actions/workflows/${workflowFile}/runs?per_page=3&status=in_progress`
    );
    const runs = data.workflow_runs || [];
    if (runs.length > 0) {
      console.log(`  → ${workflowFile} 이미 실행 중 (run #${runs[0].id})`);
      return true;
    }
    return false;
  } catch (e) {
    console.warn(`  [경고] 워크플로 상태 확인 실패 (${workflowFile}): ${e.message}`);
    return false; // 확인 실패 시 트리거 허용 (안전하게 시도)
  }
}

// 워크플로 수동 트리거
async function triggerWorkflow(workflowFile) {
  await githubFetch(
    `/repos/${OWNER}/${REPO}/actions/workflows/${workflowFile}/dispatches`,
    'POST',
    { ref: 'main' }
  );
  console.log(`  → [트리거 완료] ${workflowFile}`);
}

// ─── 메인 로직 ────────────────────────────────────────────────────────────
async function main() {
  const now = new Date();
  const nowISO = now.toISOString();
  const nowKST = new Date(now.getTime() + 9 * 3600000)
    .toISOString().replace('T', ' ').slice(0, 19) + ' KST';

  console.log(`\n${'='.repeat(60)}`);
  console.log(`감시견 실행: ${nowISO} (${nowKST})`);
  console.log(`${'='.repeat(60)}\n`);

  const results = [];
  // 동일 워크플로 중복 트리거 방지용 집합
  const triggeredWorkflows = new Set();

  for (const monitor of MONITORS) {
    const result = {
      id:        monitor.id,
      name:      monitor.name,
      workflow:  monitor.workflow,
      checkedAt: nowISO,
    };

    console.log(`[체크] ${monitor.name}`);

    try {
      // ① 활성 시간대 확인
      if (!monitor.isActive(now)) {
        result.status = 'SKIP';
        result.reason = '비활성 시간대';
        results.push(result);
        console.log(`  → SKIP (비활성 시간대)\n`);
        continue;
      }

      // ② 데이터 파일 존재 확인
      const filePath = path.join(DATA_DIR, monitor.checkFile);
      if (!fs.existsSync(filePath)) {
        result.status = 'FILE_MISSING';
        result.reason = `${monitor.checkFile} 파일 없음`;
        results.push(result);
        console.log(`  → FILE_MISSING\n`);
        continue;
      }

      // ③ 타임스탬프 읽기
      const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const tsRaw   = content[monitor.timestampField];

      if (!tsRaw) {
        result.status = 'NO_TIMESTAMP';
        result.reason = `${monitor.timestampField} 필드 없음`;
        results.push(result);
        console.log(`  → NO_TIMESTAMP\n`);
        continue;
      }

      const lastUpdate = new Date(tsRaw);
      const ageHours   = (now - lastUpdate) / 3_600_000;
      result.lastUpdate    = tsRaw;
      result.ageHours      = Math.round(ageHours * 10) / 10;
      result.maxAgeHours   = monitor.maxAgeHours;

      // ④ 신선도 판단
      if (ageHours <= monitor.maxAgeHours) {
        result.status = 'OK';
        result.reason = `최신 (${result.ageHours}h 전 업데이트)`;
        results.push(result);
        console.log(`  → OK (${result.ageHours}h 전)\n`);
        continue;
      }

      // ⑤ 오래된 데이터 감지
      console.log(`  → STALE: ${result.ageHours}h 경과 (허용: ${monitor.maxAgeHours}h)`);
      result.status = 'STALE';

      // ⑥ 동일 워크플로 이미 트리거했으면 스킵
      if (triggeredWorkflows.has(monitor.workflow)) {
        result.status = 'DEDUP_SKIP';
        result.reason = '같은 워크플로를 이번 라운드에 이미 트리거함';
        results.push(result);
        console.log(`  → DEDUP_SKIP (같은 워크플로 이미 트리거)\n`);
        continue;
      }

      // ⑦ 워크플로 실행 중 여부 확인
      const running = await isWorkflowInProgress(monitor.workflow);
      if (running) {
        result.status = 'ALREADY_RUNNING';
        result.reason  = '워크플로 이미 실행 중';
        results.push(result);
        console.log(`  → ALREADY_RUNNING\n`);
        continue;
      }

      // ⑧ 워크플로 트리거!
      await triggerWorkflow(monitor.workflow);
      triggeredWorkflows.add(monitor.workflow);
      result.status = 'TRIGGERED';
      result.reason = `${result.ageHours}h 지연 감지 → 자동 트리거`;
      results.push(result);
      console.log(`  → TRIGGERED!\n`);

      // 연속 트리거 사이 잠시 대기
      await new Promise(r => setTimeout(r, 3000));

    } catch (e) {
      result.status = 'ERROR';
      result.error  = e.message;
      results.push(result);
      console.error(`  → ERROR: ${e.message}\n`);
    }
  }

  // ─── 결과 요약 ────────────────────────────────────────────────────────
  const summary = {
    ok:          results.filter(r => r.status === 'OK').length,
    triggered:   results.filter(r => r.status === 'TRIGGERED').length,
    alreadyRunning: results.filter(r => r.status === 'ALREADY_RUNNING').length,
    stale:       results.filter(r => r.status === 'STALE').length,
    skipped:     results.filter(r => ['SKIP', 'DEDUP_SKIP'].includes(r.status)).length,
    errors:      results.filter(r => ['ERROR', 'FILE_MISSING', 'NO_TIMESTAMP'].includes(r.status)).length,
  };

  const statusData = {
    lastRun:    nowISO,
    lastRunKST: nowKST,
    summary,
    results,
  };

  // status 파일 저장
  const statusPath = path.join(DATA_DIR, 'watchdog-status.json');
  fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2), 'utf8');

  console.log('='.repeat(60));
  console.log('감시견 완료:', JSON.stringify(summary));
  console.log('='.repeat(60));

  // 에러가 있어도 exit 0 (에러가 있어도 워크플로 자체를 fail시키지 않음)
  // 단, TRIGGERED > 0 이면 로그에서 확인 가능
  process.exit(0);
}

main().catch(e => {
  console.error('감시견 치명적 오류:', e);
  process.exit(1);
});
