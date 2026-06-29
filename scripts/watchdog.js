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
