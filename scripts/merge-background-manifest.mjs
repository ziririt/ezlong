#!/usr/bin/env node
/**
 * scripts/merge-background-manifest.mjs
 *
 * time/data/background-manifest.json 전용 git 커스텀 병합 드라이버.
 *
 * 2026-07-25 신설 배경: 이 파일은 두 곳에서 동시에 계속 바뀐다 —
 *   (a) 30분마다 도는 자동 수집 봇(collect-time-background-photos.js)이
 *       계속 새 사진을 append하고,
 *   (b) 유저가 갤러리 관리툴(localhost:8787)에서 실시간으로 사진을
 *       삭제·태그수정한다.
 * git의 기본 텍스트 3-way 병합은 이 파일에서 두 가지로 실패했다:
 *   1) 정말 애매하면 통째로 conflict 마커를 박아버려 사람이 JSON을
 *      손으로 풀어야 했다(2026-07-25 낮 사고, vi 에디터까지 얽혀 30분+ 소요).
 *   2) 더 위험한 건, 애매하지 않다고 "확신"할 때도 있는데 그 확신이
 *      틀려서 아무 conflict 표시 없이 34장을 조용히 삭제해버린 적도
 *      있었다(같은 날 실측 확인) — 텍스트 줄 단위 diff가 구조적으로
 *      비슷비슷한 JSON 배열 항목들 사이에서 컨텍스트를 잘못 정렬한 것으로
 *      추정. 두 실패 모두 "이 파일은 배열 안의 오브젝트 단위로 병합해야
 *      한다"는 게 핵심 교훈이라, 텍스트 diff가 아니라 JSON 구조를 직접
 *      이해하는 이 드라이버로 대체한다.
 *
 * 병합 규칙 (src 필드를 고유키로 취급):
 *   - base에는 있는데 ours(로컬)에서 없어졌다 → 로컬이 삭제한 것 → 존중,
 *     결과에서 제외.
 *   - base에는 있는데 theirs(원격)에서 없어졌다 → 원격이 삭제한 것(자동
 *     수집 봇은 원래 삭제를 안 하지만, 사람이 원격에 직접 push한 삭제도
 *     있을 수 있으니 대칭적으로 존중) → 결과에서 제외.
 *   - 양쪽 다 있다 → base 대비 ours가 바뀌었으면(태그 수정 등) ours 값
 *     사용, 아니면 theirs 값 사용(원격이 최신일 가능성 존중).
 *   - ours에만 새로 생긴 항목(관리툴에서 사진을 추가하는 경우는 없지만
 *     방어적으로 처리) → 포함.
 *   - theirs에만 새로 생긴 항목(봇이 수집한 새 사진) → 포함.
 * 순서는 theirs(원격) 배열 순서를 기본으로 하고, ours에만 있는 신규
 * 항목은 뒤에 덧붙인다 — 순서 자체는 앱 동작에 영향 없다(app.js는
 * 배열을 필터링만 하지 순서에 의존하지 않는다).
 *
 * git이 호출하는 방식(.gitattributes의 `merge=flipzen-manifest` +
 * git config로 등록된 `merge.flipzen-manifest.driver`):
 *   node scripts/merge-background-manifest.mjs %O %A %B
 *   %O = 공통 조상(base), %A = 현재 브랜치 버전(ours) — 이 드라이버가
 *   결과를 다시 이 파일에 써야 한다, %B = 병합해오는 브랜치 버전(theirs).
 * exit 0 = 병합 성공(git이 그대로 커밋에 반영). exit 1 = 실패로 처리해
 * git이 평소처럼 conflict 마커를 박게 한다(이 드라이버가 다루기 애매한
 * 형태의 JSON을 만나면 조용히 틀리는 것보다 사람이 보게 하는 게 낫다).
 *
 * 등록 방법(한 번만, 로컬 .git/config는 버전관리 대상이 아니라 각자
 * 실행해야 함 — gallery-server.js의 "반영하기" 스크립트가 매번 자동으로
 * (멱등하게) 이 등록 명령을 포함시키므로 보통은 신경 쓸 필요 없다):
 *   git config merge.flipzen-manifest.driver \
 *     "node scripts/merge-background-manifest.mjs %O %A %B"
 * 그리고 .gitattributes에 아래 한 줄이 있어야 한다:
 *   time/data/background-manifest.json merge=flipzen-manifest
 */

import fs from "node:fs";

function readJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    if (!text.trim()) return { images: [] }; // 빈 파일(생성 직후 등) — 빈 매니페스트로 취급
    return JSON.parse(text);
  } catch (error) {
    return null; // 못 읽었거나 JSON이 아님 — 호출부에서 실패 처리
  }
}

function indexBySrc(manifest) {
  const map = new Map();
  for (const img of manifest?.images || []) {
    if (img && typeof img.src === "string") map.set(img.src, img);
  }
  return map;
}

function main() {
  const [, , baseFile, oursFile, theirsFile] = process.argv;
  if (!baseFile || !oursFile || !theirsFile) {
    console.error("merge-background-manifest: 인자 3개(base ours theirs) 필요");
    process.exit(1);
  }

  const base = readJson(baseFile) || { images: [] }; // base가 없을 수도 있음(신규 파일 병합) — 빈 것으로 취급
  const ours = readJson(oursFile);
  const theirs = readJson(theirsFile);

  if (!ours || !theirs || !Array.isArray(ours.images) || !Array.isArray(theirs.images)) {
    console.error("merge-background-manifest: ours/theirs가 유효한 매니페스트 JSON이 아님 — 기본 병합으로 폴백");
    process.exit(1);
  }

  const baseMap = indexBySrc(base);
  const oursMap = indexBySrc(ours);
  const theirsMap = indexBySrc(theirs);

  const resultImages = [];
  const used = new Set();

  // theirs(원격) 순서를 기본 뼈대로 사용.
  for (const img of theirs.images) {
    const src = img.src;
    if (used.has(src)) continue;
    used.add(src);
    const inBase = baseMap.has(src);
    const inOurs = oursMap.has(src);

    if (inBase && !inOurs) continue; // 로컬이 삭제 — 존중

    if (inOurs) {
      const oursImg = oursMap.get(src);
      const baseImg = baseMap.get(src);
      const oursChanged = !baseImg || JSON.stringify(oursImg) !== JSON.stringify(baseImg);
      resultImages.push(oursChanged ? oursImg : img);
    } else {
      resultImages.push(img); // 원격 신규 사진
    }
  }

  // ours에만 있고 theirs에는 아예 없는 항목(원격이 삭제했거나, 로컬에서만
  // 새로 생긴 항목) 처리.
  for (const img of ours.images) {
    const src = img.src;
    if (used.has(src)) continue;
    used.add(src);
    const inBase = baseMap.has(src);
    const inTheirs = theirsMap.has(src);
    if (inBase && !inTheirs) continue; // 원격이 삭제 — 존중
    if (!inBase && !inTheirs) resultImages.push(img); // 로컬에서만 생긴 신규 항목
  }

  const oursTs = typeof ours.updatedAtKST === "string" ? ours.updatedAtKST : "";
  const theirsTs = typeof theirs.updatedAtKST === "string" ? theirs.updatedAtKST : "";
  const updatedAtKST = [oursTs, theirsTs].filter(Boolean).sort().pop() || theirsTs || oursTs;

  const result = {
    ...theirs,
    updatedAtKST,
    images: resultImages,
  };

  fs.writeFileSync(oursFile, JSON.stringify(result, null, 2) + "\n");
  console.error(
    `merge-background-manifest: 자동 병합 완료 (base=${base.images?.length ?? 0} ours=${ours.images.length} theirs=${theirs.images.length} → result=${resultImages.length})`
  );
  process.exit(0);
}

main();
