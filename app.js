const STORAGE_KEY = "taurus-record-app:v3";
const OLD_KEYS = ["taurus-record-app:v2", "taurus-record-app:v1"];
const TEAM_NAME = "충북대 타우루스";
const POSITIONS = ["투수", "포수", "1루수", "2루수", "3루수", "유격수", "좌익수", "중견수", "우익수", "지명타자", "대타"];

const DEFAULT_ROSTER = [
  { name: "김민준", position: "" }, { name: "이서준", position: "" }, { name: "박도윤", position: "" },
  { name: "최지호", position: "" }, { name: "정하준", position: "" }, { name: "강민재", position: "" }
];

const batterFields = [
  "order", "name", "position", "pa", "ab", "hits", "single", "double", "triple", "hr", "bb", "hbp", "sf", "sac",
  "so", "rbi", "run", "sb", "cs", "gdp", "avg", "obp", "slg", "ops", "woba"
];
const opponentFields = ["order", "name", "pa", "ab", "hits", "single", "double", "triple", "hr", "bb", "hbp", "sf", "sac", "so", "rbi", "run", "sb", "cs", "gdp"];
const pitcherFields = ["name", "outs", "innings", "pitches", "hitsAllowed", "hrAllowed", "bb", "hbp", "so", "runs", "er", "era", "whip"];

const labels = {
  order: "타순", name: "이름", position: "포지션", pa: "타석", ab: "타수", hits: "안타", single: "단타", double: "2루타",
  triple: "3루타", hr: "홈런", bb: "볼넷", hbp: "사구", sf: "희플", sac: "희번", so: "삼진", rbi: "타점",
  run: "득점", sb: "도루", cs: "도실", gdp: "병살", avg: "타율", obp: "출루율", slg: "장타율", ops: "OPS", woba: "wOBA",
  outs: "아웃카운트", innings: "이닝", pitches: "투구수", hitsAllowed: "피안타", hrAllowed: "피홈런", runs: "실점",
  er: "자책점", era: "ERA", whip: "WHIP", games: "경기수", totalOuts: "총 아웃카운트", totalInnings: "총 이닝", orderName: "배치타순"
};

const resultTypes = [
  { key: "single", label: "안타", group: "hit", ab: true, hit: "single", pitcherHit: true },
  { key: "double", label: "2루타", group: "hit", ab: true, hit: "double", pitcherHit: true },
  { key: "triple", label: "3루타", group: "hit", ab: true, hit: "triple", pitcherHit: true },
  { key: "hr", label: "홈런", group: "hit", ab: true, hit: "hr", pitcherHit: true, pitcherHr: true },
  { key: "bb", label: "볼넷", group: "onbase", bb: true },
  { key: "hbp", label: "사구", group: "onbase", hbp: true },
  { key: "sf", label: "희생플라이", group: "out", sf: true, outs: 1 },
  { key: "sac", label: "희생번트", group: "out", sac: true, outs: 1 },
  { key: "so", label: "삼진", group: "out", ab: true, so: true, outs: 1 },
  { key: "groundout", label: "땅볼아웃", group: "out", ab: true, outs: 1 },
  { key: "flyout", label: "뜬공아웃", group: "out", ab: true, outs: 1 },
  { key: "lineout", label: "직선타", group: "out", ab: true, outs: 1 },
  { key: "gdp", label: "병살타", group: "out", ab: true, gdp: true, outs: 2 },
  { key: "fc", label: "야수선택", group: "onbase", ab: true },
  { key: "error", label: "실책출루", group: "onbase", ab: true },
  { key: "sb", label: "도루", group: "run", noPa: true, sb: true },
  { key: "cs", label: "도루실패", group: "out", noPa: true, cs: true, outs: 1 }
];

const state = {
  currentGame: createEmptyGame(),
  games: [],
  roster: [...DEFAULT_ROSTER],
  players: DEFAULT_ROSTER.map(player => player.name),
  undoStack: []
};

document.addEventListener("DOMContentLoaded", async () => {
  loadStore();
  await loadPlayers();
  bindEvents();
  renderAll();
});

function createEmptyGame() {
  return {
    id: "",
    date: new Date().toISOString().slice(0, 10),
    team: TEAM_NAME,
    opponent: "",
    stadium: "",
    venueSide: "away",
    score: { ours: 0, opponent: 0 },
    live: {
      inning: 1, half: "top", outs: 0, ourBatterIndex: 0, opponentBatterIndex: 0,
      ourOrder: 1, opponentOrder: 1,
      ourPitcherIndex: 0, opponentPitcherIndex: 0,
      counts: { our: { balls: 0, strikes: 0 }, opponent: { balls: 0, strikes: 0 } }
    },
    runners: { first: "", second: "", third: "" },
    innings: [],
    plays: [],
    batters: Array.from({ length: 9 }, (_, i) => createBatter(i + 1, `우리선수${i + 1}`)),
    opponentBatters: Array.from({ length: 9 }, (_, i) => createBatter(i + 1, "", false)),
    pitchers: [createPitcher("선발투수")],
    opponentPitchers: [createPitcher("상대 선발")]
  };
}

function createBatter(order, name = "", isOurTeam = true) {
  return {
    order, name, position: isOurTeam ? "지명타자" : "", isSub: false,
    pa: 0, ab: 0, single: 0, double: 0, triple: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sac: 0, so: 0,
    rbi: 0, run: 0, sb: 0, cs: 0, gdp: 0
  };
}

function createPitcher(name = "") {
  return { name, outs: 0, pitches: 0, hitsAllowed: 0, hrAllowed: 0, bb: 0, hbp: 0, so: 0, runs: 0, er: 0 };
}

async function loadPlayers() {
  try {
    const response = await fetch("data/players.json", { cache: "no-store" });
    if (!response.ok) throw new Error("no players");
    const roster = normalizePlayers(await response.json());
    if (roster.length) setRoster(roster);
  } catch {
    setRoster([...state.roster, ...collectNamesFromGames().map(name => ({ name }))]);
  }
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => showTab(button.dataset.tab)));
  ["gameDate", "opponent", "stadium", "ourScore", "opponentScore", "homeAway"].forEach(id => document.getElementById(id).addEventListener("input", syncGameMeta));
  byId("homeAway").addEventListener("change", () => {
    syncGameMeta();
    state.currentGame.live.half = "top";
    showTab(sideForHalf("top") === "our" ? "our" : "opponent");
    renderAll();
  });

  byId("saveGameBtn").addEventListener("click", saveCurrentGame);
  byId("resetBtn").addEventListener("click", resetCurrentGame);
  byId("exportJsonBtn").addEventListener("click", exportJson);
  byId("exportDetailJsonBtn").addEventListener("click", exportDetailJson);
  byId("previewDetailBtn").addEventListener("click", previewDetailJson);
  byId("validateGameBtn").addEventListener("click", validateGame);
  byId("exportCsvBtn").addEventListener("click", exportCsv);
  byId("loadPlayersBtn").addEventListener("click", () => byId("playersFileInput").click());
  byId("playersFileInput").addEventListener("change", importPlayersJson);
  byId("loadJsonBtn").addEventListener("click", () => byId("jsonFileInput").click());
  byId("jsonFileInput").addEventListener("change", importJson);

  byId("addOurStarterBtn").addEventListener("click", () => addBatterRow("our", false));
  byId("addOurSubBtn").addEventListener("click", () => addBatterRow("our", true));
  byId("addOppStarterBtn").addEventListener("click", () => addBatterRow("opponent", false));
  byId("addOppSubBtn").addEventListener("click", () => addBatterRow("opponent", true));
  ["addPitcherBtn", "addPitcherBtn2"].forEach(id => byId(id).addEventListener("click", () => addPitcher("our")));
  ["addOpponentPitcherBtn", "addOpponentPitcherBtn2"].forEach(id => byId(id).addEventListener("click", () => addPitcher("opponent")));
  byId("undoOurEventBtn").addEventListener("click", undoEvent);
  byId("undoOpponentEventBtn").addEventListener("click", undoEvent);
  byId("applyRunnersBtn").addEventListener("click", applyRunnersFromInputs);
  byId("clearRunnersBtn").addEventListener("click", clearRunners);
  byId("runnerStealBtn").addEventListener("click", () => applyRunnerAction("sb"));
  byId("runnerCaughtBtn").addEventListener("click", () => applyRunnerAction("cs"));
  byId("runnerOutBtn").addEventListener("click", () => applyRunnerAction("runnerOut"));
  byId("runnerPickoffBtn").addEventListener("click", () => applyRunnerAction("pickoff"));
  byId("runnerScoreBtn").addEventListener("click", () => applyRunnerAction("run"));
  byId("saveLineupBtn").addEventListener("click", saveLineup);
  byId("loadLineupBtn").addEventListener("click", loadLineup);
  byId("addInningBtn").addEventListener("click", addInningRow);
  byId("applyPlaysBtn").addEventListener("click", applyPlaysFromEditor);

  renderResultButtons("ourResultButtons", "our");
  renderResultButtons("opponentResultButtons", "opponent");
  document.querySelectorAll("[data-pitch]").forEach(button => {
    button.addEventListener("click", () => applyPitch(button.dataset.side, button.dataset.pitch));
  });
  ["careerNameFilter", "careerOpponentFilter", "careerStadiumFilter", "orderFilter", "orderNameFilter"].forEach(id => {
    byId(id).addEventListener("input", renderStats);
    byId(id).addEventListener("change", renderStats);
  });
}

function renderResultButtons(containerId, side) {
  byId(containerId).innerHTML = resultTypes.map(result => (
    `<button class="result-btn ${result.group}" data-result="${result.key}" data-side="${side}">${result.label}</button>`
  )).join("");
  byId(containerId).querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => applyPlateResult(button.dataset.side, button.dataset.result));
  });
}

function renderAll() {
  byId("teamName").value = TEAM_NAME;
  byId("gameDate").value = state.currentGame.date;
  byId("opponent").value = state.currentGame.opponent;
  byId("stadium").value = state.currentGame.stadium;
  byId("homeAway").value = state.currentGame.venueSide || "away";
  byId("ourScore").value = state.currentGame.score.ours;
  byId("opponentScore").value = state.currentGame.score.opponent;
  renderGameState();
  renderCounts();
  renderRunners();
  renderInningsTable();
  renderPlaysEditor();
  renderPlayerList();
  renderPitcherSelectors();
  renderLiveBoard();
  renderOurBatters();
  renderOpponentBatters();
  renderPitchers();
  renderGames();
  renderStats();
}

function renderGameState() {
  const { inning, half, outs } = state.currentGame.live;
  byId("gameStateText").textContent = `${inning}회${half === "top" ? "초" : "말"} · ${sideForHalf(half) === "our" ? "우리 공격" : "상대 공격"} · ${outs}아웃`;
}

function renderCounts() {
  const our = getCount("our");
  const opponent = getCount("opponent");
  byId("ourCountText").textContent = `B ${our.balls} · S ${our.strikes}`;
  byId("oppCountText").textContent = `B ${opponent.balls} · S ${opponent.strikes}`;
}

function renderPitcherSelectors() {
  setSelectOptions("ourPitcherSelect", state.currentGame.pitchers, state.currentGame.live.ourPitcherIndex);
  setSelectOptions("opponentPitcherSelect", state.currentGame.opponentPitchers, state.currentGame.live.opponentPitcherIndex);
  byId("ourPitcherSelect").onchange = event => { state.currentGame.live.ourPitcherIndex = Number(event.target.value); };
  byId("opponentPitcherSelect").onchange = event => { state.currentGame.live.opponentPitcherIndex = Number(event.target.value); };
}

function setSelectOptions(id, rows, selectedIndex) {
  byId(id).innerHTML = rows.map((row, index) => `<option value="${index}"${index === selectedIndex ? " selected" : ""}>${escapeHtml(row.name || `${index + 1}번 투수`)}</option>`).join("");
}

function renderLiveBoard() {
  const our = getCurrentBatter("our");
  const opp = getCurrentBatter("opponent");
  byId("currentOurBatter").textContent = our ? `${our.order}번 ${our.name || "이름 없음"}` : "선수 없음";
  byId("currentOpponentBatter").textContent = opp ? `${opp.order}번 ${opp.name || "이름 없음"}` : "선수 없음";
}

function renderOurBatters() {
  renderEditableTable("ourBattersTable", batterFields, state.currentGame.batters, "batter", getCurrentBatterIndex("our"));
}

function renderOpponentBatters() {
  renderEditableTable("opponentBattersTable", opponentFields, state.currentGame.opponentBatters, "opponentBatter", getCurrentBatterIndex("opponent"));
}

function renderPitchers() {
  renderEditableTable("pitchersTable", pitcherFields, state.currentGame.pitchers, "pitcher", state.currentGame.live.ourPitcherIndex);
  renderEditableTable("opponentPitchersTable", pitcherFields, state.currentGame.opponentPitchers, "opponentPitcher", state.currentGame.live.opponentPitcherIndex);
}

function renderEditableTable(tableId, fields, rows, kind, activeIndex = -1) {
  const table = byId(tableId);
  table.innerHTML = `<thead><tr>${fields.map(field => `<th>${labels[field]}</th>`).join("")}<th>작업</th></tr></thead><tbody>${rows.map((row, index) => {
    const stats = fields.includes("era") ? calcPitcher(row) : calcBatter(row);
    return `<tr class="${row.isSub ? "sub-row" : ""}${index === activeIndex ? " active-row" : ""}">
      ${fields.map(field => renderCell(row, index, field, stats, kind)).join("")}
      <td><button class="btn danger small" data-delete="${index}">삭제</button></td>
    </tr>`;
  }).join("")}</tbody>`;
  table.querySelectorAll("input, select").forEach(input => {
    if (input.type === "number") input.addEventListener("input", event => updateRow(kind, event.target));
    input.addEventListener("change", event => updateRow(kind, event.target));
  });
  table.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteRow(kind, Number(button.dataset.delete))));
}

function renderCell(row, index, field, stats, kind) {
  if (field === "order") return `<td>${row.isSub ? "↳ 교체" : row.order}</td>`;
  if (field === "position") return `<td>${selectHtml(index, field, row.position, POSITIONS, kind)}</td>`;
  if (["pa", "hits", "avg", "obp", "slg", "ops", "woba", "innings", "era", "whip"].includes(field)) return `<td class="calculated">${stats[field] ?? row[field] ?? ""}</td>`;
  if (field === "name") return `<td>${inputHtml(index, field, row[field], "text", kind, "name-input", kind.includes("Batter") || kind === "batter" || kind === "pitcher" ? "playerList" : "")}</td>`;
  return `<td>${inputHtml(index, field, row[field], "number", kind)}</td>`;
}

function applyPitch(side, pitchType) {
  if (pitchType === "reset") {
    resetCount(side);
    renderCounts();
    return;
  }

  const pitcher = getCurrentPitcher(side === "our" ? "opponent" : "our");
  if (!pitcher) return showToast("선택된 투수가 없습니다.");
  state.undoStack.push(structuredClone(state.currentGame));
  pitcher.pitches += 1;

  const count = getCount(side);
  if (pitchType === "ball") {
    count.balls += 1;
    if (count.balls >= 4) {
      applyPlateResult(side, "bb", { pitchAlreadyCounted: true, descSuffix: "자동 볼넷" });
      return;
    }
  }
  if (pitchType === "strike") {
    count.strikes += 1;
    if (count.strikes >= 3) {
      applyPlateResult(side, "so", { pitchAlreadyCounted: true, descSuffix: "루킹/스윙 삼진" });
      return;
    }
  }
  if (pitchType === "foul") {
    count.strikes = Math.min(2, count.strikes + 1);
  }
  renderPitchers();
  renderCounts();
}

function applyPlateResult(side, resultKey, options = {}) {
  const result = resultTypes.find(item => item.key === resultKey);
  const batter = getCurrentBatter(side);
  const pitcher = getCurrentPitcher(side === "our" ? "opponent" : "our");
  if (!result || !batter || !pitcher) return showToast("입력할 선수나 투수가 없습니다.");
  if (!options.pitchAlreadyCounted) state.undoStack.push(structuredClone(state.currentGame));

  const prefix = side === "our" ? "our" : "opp";
  const runs = toInt(byId(`${prefix}RunsScored`).value);
  const rbi = toInt(byId(`${prefix}RbiAdded`).value);
  const manualOuts = toInt(byId(`${prefix}OutsOnPlay`).value);
  const pitches = options.pitchAlreadyCounted ? 0 : toInt(byId(`${prefix}PitchCount`).value);
  const automaticPitch = shouldAutoCountPitch(result, options, pitches) ? 1 : 0;
  const batterScored = byId(`${prefix}BatterScored`).checked;
  const earnedRun = byId(`${prefix}EarnedRun`).checked;
  const outs = Math.min(3, manualOuts || result.outs || 0);

  if (!result.noPa) batter.pa += 1;
  if (result.ab) batter.ab += 1;
  if (result.hit) batter[result.hit] += 1;
  if (result.bb) batter.bb += 1;
  if (result.hbp) batter.hbp += 1;
  if (result.sf) batter.sf += 1;
  if (result.sac) batter.sac += 1;
  if (result.so) batter.so += 1;
  if (result.sb) batter.sb += 1;
  if (result.cs) batter.cs += 1;
  if (result.gdp) batter.gdp += 1;
  batter.rbi += rbi;
  if (batterScored) batter.run += 1;

  pitcher.pitches += pitches + automaticPitch;
  pitcher.outs += outs;
  if (result.pitcherHit) pitcher.hitsAllowed += 1;
  if (result.pitcherHr) pitcher.hrAllowed += 1;
  if (result.bb) pitcher.bb += 1;
  if (result.hbp) pitcher.hbp += 1;
  if (result.so) pitcher.so += 1;
  pitcher.runs += runs;
  if (earnedRun) pitcher.er += runs;

  if (side === "our") state.currentGame.score.ours += runs;
  else state.currentGame.score.opponent += runs;
  addInningRuns(side, runs);
  appendPlay(side, result, batter, { runs, rbi, outs, batterScored, suffix: options.descSuffix });

  if (!result.noPa) {
    advanceBatter(side);
    resetCount(side);
  }
  addOutsAndMaybeSwitch(side, outs);
  clearLiveInputs(prefix);
  renderAll();
  showToast(`${result.label} 기록을 반영했습니다.`);
}

function shouldAutoCountPitch(result, options, manualPitches = 0) {
  if (options.pitchAlreadyCounted || result.noPa) return false;
  return manualPitches === 0;
}

function getCount(side) {
  if (!state.currentGame.live.counts) state.currentGame.live.counts = { our: { balls: 0, strikes: 0 }, opponent: { balls: 0, strikes: 0 } };
  if (!state.currentGame.live.counts[side]) state.currentGame.live.counts[side] = { balls: 0, strikes: 0 };
  return state.currentGame.live.counts[side];
}

function resetCount(side) {
  const count = getCount(side);
  count.balls = 0;
  count.strikes = 0;
}

function addInningRuns(side, runs) {
  if (!runs) return;
  const inning = state.currentGame.live.inning;
  let row = state.currentGame.innings.find(item => item.inning === inning);
  if (!row) {
    row = { inning, home: 0, away: 0 };
    state.currentGame.innings.push(row);
    state.currentGame.innings.sort((a, b) => a.inning - b.inning);
  }
  const key = side === "our" ? ourScoreKey() : opponentScoreKey();
  row[key] += runs;
}

function appendPlay(side, result, batter, meta) {
  const parts = [];
  if (meta.rbi) parts.push(`${meta.rbi}타점`);
  if (meta.runs) parts.push(`${meta.runs}득점`);
  if (batter.sb) parts.push(`도루 ${batter.sb}`);
  if (meta.batterScored) parts.push("타자득점");
  if (meta.suffix) parts.push(meta.suffix);
  const desc = `${batter.name || `${batter.order}번타자`} ${result.label}${parts.length ? ` (${parts.join(", ")})` : ""}`;
  state.currentGame.plays.push({ inning: state.currentGame.live.inning, half: side === "our" ? "top" : "bottom", desc });
}

function addOutsAndMaybeSwitch(side, outs) {
  state.currentGame.live.outs += outs;
  if (state.currentGame.live.outs < 3) return;
  state.currentGame.live.outs = 0;
  if (state.currentGame.live.half === "top") {
    state.currentGame.live.half = "bottom";
  } else {
    state.currentGame.live.half = "top";
    state.currentGame.live.inning += 1;
  }
  const nextSide = sideForHalf(state.currentGame.live.half);
  showTab(nextSide === "our" ? "our" : "opponent");
  showToast(`3아웃입니다. ${nextSide === "our" ? "우리" : "상대"} 공격으로 전환했습니다.`);
}

function clearLiveInputs(prefix) {
  [`${prefix}RunsScored`, `${prefix}RbiAdded`, `${prefix}OutsOnPlay`, `${prefix}PitchCount`].forEach(id => byId(id).value = 0);
  byId(`${prefix}BatterScored`).checked = false;
}

function getCurrentBatter(side) {
  const rows = side === "our" ? state.currentGame.batters : state.currentGame.opponentBatters;
  if (!rows.length) return null;
  const index = getCurrentBatterIndex(side);
  return rows[index] || rows[0];
}

function getCurrentBatterIndex(side) {
  const rows = side === "our" ? state.currentGame.batters : state.currentGame.opponentBatters;
  if (!rows.length) return -1;
  const orderKey = side === "our" ? "ourOrder" : "opponentOrder";
  if (!state.currentGame.live[orderKey]) {
    const indexKey = side === "our" ? "ourBatterIndex" : "opponentBatterIndex";
    state.currentGame.live[orderKey] = rows[state.currentGame.live[indexKey] || 0]?.order || 1;
  }
  const order = state.currentGame.live[orderKey];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (Number(rows[i].order) === Number(order)) return i;
  }
  const firstIndex = rows.findIndex(row => Number(row.order) === Number(order));
  return firstIndex >= 0 ? firstIndex : 0;
}

function getCurrentPitcher(side) {
  const rows = side === "our" ? state.currentGame.pitchers : state.currentGame.opponentPitchers;
  const key = side === "our" ? "ourPitcherIndex" : "opponentPitcherIndex";
  if (!rows.length) return null;
  state.currentGame.live[key] = Math.min(state.currentGame.live[key], rows.length - 1);
  return rows[state.currentGame.live[key]];
}

function advanceBatter(side) {
  const key = side === "our" ? "ourOrder" : "opponentOrder";
  const current = Number(state.currentGame.live[key] || 1);
  state.currentGame.live[key] = current >= 9 ? 1 : current + 1;
}

function undoEvent() {
  const previous = state.undoStack.pop();
  if (!previous) return showToast("취소할 입력이 없습니다.");
  state.currentGame = normalizeGame(previous);
  renderAll();
  showToast("마지막 입력을 취소했습니다.");
}

function syncGameMeta() {
  state.currentGame.date = byId("gameDate").value;
  state.currentGame.opponent = byId("opponent").value.trim();
  state.currentGame.stadium = byId("stadium").value.trim();
  state.currentGame.venueSide = byId("homeAway").value || "away";
  state.currentGame.score.ours = toInt(byId("ourScore").value);
  state.currentGame.score.opponent = toInt(byId("opponentScore").value);
}

function updateRow(kind, input) {
  const row = getRowsByKind(kind)[Number(input.dataset.index)];
  row[input.dataset.field] = input.type === "number" ? toInt(input.value) : input.value.trim();
  if (input.dataset.field === "name") {
    rememberPlayerName(row.name);
    applyRosterDefaults(kind, row);
  }
  renderAll();
}

function getRowsByKind(kind) {
  if (kind === "batter") return state.currentGame.batters;
  if (kind === "opponentBatter") return state.currentGame.opponentBatters;
  if (kind === "pitcher") return state.currentGame.pitchers;
  return state.currentGame.opponentPitchers;
}

function deleteRow(kind, index) {
  const rows = getRowsByKind(kind);
  if (rows.length <= 1) return showToast("최소 1개 행은 남겨야 합니다.");
  rows.splice(index, 1);
  renderAll();
}

function addBatterRow(side, isSub) {
  const rows = side === "our" ? state.currentGame.batters : state.currentGame.opponentBatters;
  const order = isSub ? askOrder("교체 선수를 추가할 타순") : nextOrder(rows);
  if (!order) return;
  const row = createBatter(order, "", side === "our");
  row.isSub = isSub;
  rows.push(row);
  sortLineup(rows);
  if (isSub) state.currentGame.live[side === "our" ? "ourOrder" : "opponentOrder"] = order;
  renderAll();
}

function addPitcher(side) {
  const rows = side === "our" ? state.currentGame.pitchers : state.currentGame.opponentPitchers;
  rows.push(createPitcher(""));
  renderAll();
}

function showTab(tabName) {
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.tab === tabName));
  document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active", panel.id === `tab-${tabName}`));
  renderStats();
}

function saveCurrentGame() {
  syncGameMeta();
  if (!state.currentGame.date || !state.currentGame.opponent) return showToast("날짜와 상대팀은 필수입니다.");
  const game = normalizeGame(structuredClone(state.currentGame));
  game.id = `${game.date}-vs-${(game.opponent || "상대팀").replace(/\s+/g, "-")}`;
  const index = state.games.findIndex(saved => saved.id === game.id);
  if (index >= 0) state.games[index] = game;
  else state.games.push(game);
  saveStore();
  renderAll();
  showToast("현재 경기를 저장했습니다.");
}

function renderGames() {
  const table = byId("gamesTable");
  if (!state.games.length) {
    table.innerHTML = `<tbody><tr><td class="empty-note">저장된 경기가 없습니다.</td></tr></tbody>`;
    return;
  }
  table.innerHTML = `<thead><tr><th>ID</th><th>날짜</th><th>상대팀</th><th>구장</th><th>스코어</th><th>작업</th></tr></thead><tbody>
    ${state.games.map((game, index) => `<tr>
      <td>${game.id}</td><td>${game.date}</td><td>${game.opponent}</td><td>${game.stadium}</td><td>${game.score.ours}:${game.score.opponent}</td>
      <td><button class="btn primary small" data-load="${index}">불러오기</button> <button class="btn danger small" data-delete="${index}">삭제</button></td>
    </tr>`).join("")}</tbody>`;
  table.querySelectorAll("[data-load]").forEach(button => button.addEventListener("click", () => loadGame(Number(button.dataset.load))));
  table.querySelectorAll("[data-delete]").forEach(button => button.addEventListener("click", () => deleteGame(Number(button.dataset.delete))));
}

function loadGame(index) {
  state.currentGame = normalizeGame(structuredClone(state.games[index]));
  state.undoStack = [];
  renderAll();
  showTab("our");
}

function deleteGame(index) {
  if (!confirm("선택한 경기 기록을 삭제할까요?")) return;
  state.games.splice(index, 1);
  saveStore();
  renderAll();
}

function resetCurrentGame() {
  if (!confirm("현재 입력 내용을 초기화할까요?")) return;
  state.currentGame = createEmptyGame();
  state.undoStack = [];
  renderAll();
}

function renderStats() {
  renderCareerStats();
  renderOrderStats();
}

function renderCareerStats() {
  const nameFilter = byId("careerNameFilter").value.trim();
  const opponentFilter = byId("careerOpponentFilter").value.trim();
  const stadiumFilter = byId("careerStadiumFilter").value.trim();
  const batterTotals = new Map();
  const pitcherTotals = new Map();
  state.games.filter(game => (!opponentFilter || game.opponent.includes(opponentFilter)) && (!stadiumFilter || game.stadium.includes(stadiumFilter))).forEach(game => {
    game.batters.forEach(row => {
      if (!validName(row.name) || (nameFilter && !row.name.includes(nameFilter))) return;
      const total = getBatterTotal(batterTotals, row.name);
      total.games.add(game.id);
      addBatterStats(total, row);
    });
    game.pitchers.forEach(row => {
      if (!validName(row.name) || (nameFilter && !row.name.includes(nameFilter))) return;
      const total = getPitcherTotal(pitcherTotals, row.name);
      total.games.add(game.id);
      addPitcherStats(total, row);
    });
  });
  renderStaticTable("careerBattersTable", ["name", "games", "pa", "ab", "hits", "double", "triple", "hr", "bb", "hbp", "sf", "sac", "so", "rbi", "run", "sb", "cs", "gdp", "avg", "obp", "slg", "ops", "woba"], [...batterTotals.values()].map(total => ({ ...total, games: total.games.size, ...calcBatter(total) })));
  renderStaticTable("careerPitchersTable", ["name", "games", "totalOuts", "totalInnings", "pitches", "hitsAllowed", "hrAllowed", "bb", "hbp", "so", "runs", "er", "era", "whip"], [...pitcherTotals.values()].map(total => ({ ...total, games: total.games.size, totalOuts: total.outs, totalInnings: formatOuts(total.outs), ...calcPitcher(total) })));
}

function renderOrderStats() {
  const targetOrder = byId("orderFilter").value;
  const nameFilter = byId("orderNameFilter").value.trim();
  const totals = new Map();
  state.games.forEach(game => game.batters.forEach(row => {
    if (!validName(row.name)) return;
    if (targetOrder !== "전체 타순" && Number(targetOrder) !== Number(row.order)) return;
    if (nameFilter && !row.name.includes(nameFilter)) return;
    const key = `${row.name}__${row.order}`;
    if (!totals.has(key)) totals.set(key, emptyBatterTotal(row.name, row.order));
    totals.get(key).games.add(game.id);
    addBatterStats(totals.get(key), row);
  }));
  renderStaticTable("orderStatsTable", ["name", "orderName", "games", "ab", "hits", "hr", "bb", "so", "rbi", "sb", "cs", "gdp", "avg", "obp", "slg", "ops", "woba"], [...totals.values()].map(total => ({ ...total, orderName: `${total.order}번`, games: total.games.size, ...calcBatter(total) })));
}

function renderStaticTable(id, fields, rows) {
  byId(id).innerHTML = `<thead><tr>${fields.map(field => `<th>${labels[field]}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${fields.map(field => `<td>${row[field] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>`;
}

function calcBatter(row) {
  const hits = toInt(row.single) + toInt(row.double) + toInt(row.triple) + toInt(row.hr);
  const ab = toInt(row.ab);
  const obpDen = ab + toInt(row.bb) + toInt(row.hbp) + toInt(row.sf);
  const totalBases = toInt(row.single) + toInt(row.double) * 2 + toInt(row.triple) * 3 + toInt(row.hr) * 4;
  const avg = ab ? hits / ab : 0;
  const obp = obpDen ? (hits + toInt(row.bb) + toInt(row.hbp)) / obpDen : 0;
  const slg = ab ? totalBases / ab : 0;
  const woba = obpDen ? (0.7 * toInt(row.bb) + 0.72 * toInt(row.hbp) + 0.88 * toInt(row.single) + 1.24 * toInt(row.double) + 1.56 * toInt(row.triple) + 2.05 * toInt(row.hr)) / obpDen : 0;
  return { pa: toInt(row.pa) || obpDen + toInt(row.sac), hits, avg: fmt3(avg), obp: fmt3(obp), slg: fmt3(slg), ops: fmt3(obp + slg), woba: fmt3(woba) };
}

function calcPitcher(row) {
  const innings = toInt(row.outs) / 3;
  return { innings: formatOuts(row.outs), era: fmt2(innings ? (toInt(row.er) * 7) / innings : 0), whip: fmt2(innings ? (toInt(row.hitsAllowed) + toInt(row.bb) + toInt(row.hbp)) / innings : 0) };
}

function emptyBatterTotal(name, order = null) {
  return { name, order, games: new Set(), pa: 0, ab: 0, single: 0, double: 0, triple: 0, hr: 0, bb: 0, hbp: 0, sf: 0, sac: 0, so: 0, rbi: 0, run: 0, sb: 0, cs: 0, gdp: 0 };
}

function emptyPitcherTotal(name) {
  return { name, games: new Set(), outs: 0, pitches: 0, hitsAllowed: 0, hrAllowed: 0, bb: 0, hbp: 0, so: 0, runs: 0, er: 0 };
}

function getBatterTotal(map, name) {
  if (!map.has(name)) map.set(name, emptyBatterTotal(name));
  return map.get(name);
}

function getPitcherTotal(map, name) {
  if (!map.has(name)) map.set(name, emptyPitcherTotal(name));
  return map.get(name);
}

function addBatterStats(total, row) {
  ["pa", "ab", "single", "double", "triple", "hr", "bb", "hbp", "sf", "sac", "so", "rbi", "run", "sb", "cs", "gdp"].forEach(field => total[field] += toInt(row[field]));
}

function addPitcherStats(total, row) {
  ["outs", "pitches", "hitsAllowed", "hrAllowed", "bb", "hbp", "so", "runs", "er"].forEach(field => total[field] += toInt(row[field]));
}

function normalizeGame(game) {
  const fallback = createEmptyGame();
  return {
    ...fallback,
    ...game,
    score: { ours: toInt(game.score?.ours), opponent: toInt(game.score?.opponent) },
    live: { ...fallback.live, ...(game.live || {}), counts: { ...fallback.live.counts, ...(game.live?.counts || {}) } },
    runners: { ...fallback.runners, ...(game.runners || {}) },
    innings: Array.isArray(game.innings) ? game.innings : [],
    plays: Array.isArray(game.plays) ? game.plays : [],
    batters: Array.isArray(game.batters) && game.batters.length ? game.batters.map(row => ({ ...createBatter(row.order || 1), ...row })) : fallback.batters,
    opponentBatters: Array.isArray(game.opponentBatters) && game.opponentBatters.length ? game.opponentBatters.map(row => ({ ...createBatter(row.order || 1, "", false), ...row })) : fallback.opponentBatters,
    pitchers: Array.isArray(game.pitchers) && game.pitchers.length ? game.pitchers.map(row => ({ ...createPitcher(), ...row })) : fallback.pitchers,
    opponentPitchers: Array.isArray(game.opponentPitchers) && game.opponentPitchers.length ? game.opponentPitchers.map(row => ({ ...createPitcher(), ...row })) : fallback.opponentPitchers
  };
}

function normalizePlayers(data) {
  const source = Array.isArray(data) ? data : Array.isArray(data.players) ? data.players : Array.isArray(data.roster) ? data.roster : [];
  const byName = new Map();
  source.forEach(item => {
    const player = typeof item === "string" ? { name: item } : item;
    const name = String(player.name || player.이름 || player.playerName || "").trim();
    if (!name) return;
    byName.set(name, { id: player.id ?? player.backNumber ?? player.number ?? "", name, birth: player.birth || "", highschool: player.highschool || "", major: player.major || "", position: player.position || player.포지션 || "" });
  });
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "ko"));
}

function setRoster(roster) {
  state.roster = normalizePlayers(roster);
  state.players = state.roster.map(player => player.name);
}

function collectNamesFromGames() {
  return [...new Set(state.games.flatMap(game => [...game.batters, ...game.pitchers].map(row => row.name).filter(validName)))];
}

function renderPlayerList() {
  byId("playerList").innerHTML = state.roster.map(player => {
    const detail = [player.id !== "" ? `#${player.id}` : "", player.position, player.major].filter(Boolean).join(" / ");
    return `<option value="${escapeHtml(player.name)}" label="${escapeHtml(detail)}"></option>`;
  }).join("");
}

function rememberPlayerName(name) {
  if (validName(name) && !state.players.includes(name)) setRoster([...state.roster, { name }]);
}

function applyRosterDefaults(kind, row) {
  const player = state.roster.find(item => item.name === row.name);
  if (kind === "batter" && player && (!row.position || row.position === "지명타자")) row.position = mapRosterPosition(player.position);
}

function mapRosterPosition(position = "") {
  if (position.includes("투수")) return "투수";
  if (position.includes("포수")) return "포수";
  if (position.includes("내야")) return "유격수";
  if (position.includes("외야")) return "중견수";
  return "지명타자";
}

function renderRunners() {
  const runners = state.currentGame.runners || { first: "", second: "", third: "" };
  byId("runner1").value = runners.first || "";
  byId("runner2").value = runners.second || "";
  byId("runner3").value = runners.third || "";
}

function applyRunnersFromInputs() {
  state.currentGame.runners = {
    first: byId("runner1").value.trim(),
    second: byId("runner2").value.trim(),
    third: byId("runner3").value.trim()
  };
  showToast("주자 상황을 반영했습니다.");
}

function clearRunners() {
  state.currentGame.runners = { first: "", second: "", third: "" };
  renderRunners();
}

function applyRunnerAction(action) {
  applyRunnersFromInputs();
  const base = byId("runnerBase").value;
  const runnerName = state.currentGame.runners?.[base];
  if (!runnerName) return showToast("선택한 베이스에 주자가 없습니다.");
  state.undoStack.push(structuredClone(state.currentGame));
  const side = sideForHalf(state.currentGame.live.half);
  const runner = findBatterByName(side, runnerName);
  const inning = state.currentGame.live.inning;
  const half = state.currentGame.live.half;

  if (action === "sb" && runner) {
    runner.sb += 1;
    moveRunnerForward(base);
    state.currentGame.plays.push({ inning, half, desc: `${runnerName} 도루` });
  }
  if (action === "cs" || action === "runnerOut" || action === "pickoff") {
    if (runner && action === "cs") runner.cs += 1;
    state.currentGame.runners[base] = "";
    addOutsAndMaybeSwitch(side, 1);
    const label = action === "cs" ? "도루실패" : action === "pickoff" ? "견제사" : "주루사";
    state.currentGame.plays.push({ inning, half, desc: `${runnerName} ${label}` });
  }
  if (action === "run") {
    if (runner) runner.run += 1;
    state.currentGame.runners[base] = "";
    if (side === "our") state.currentGame.score.ours += 1;
    else state.currentGame.score.opponent += 1;
    addInningRuns(side, 1);
    state.currentGame.plays.push({ inning, half, desc: `${runnerName} 득점` });
  }
  renderAll();
}

function moveRunnerForward(base) {
  const runners = state.currentGame.runners;
  if (base === "first") {
    runners.second = runners.first;
    runners.first = "";
  } else if (base === "second") {
    runners.third = runners.second;
    runners.second = "";
  } else if (base === "third") {
    runners.third = "";
  }
}

function findBatterByName(side, name) {
  const rows = side === "our" ? state.currentGame.batters : state.currentGame.opponentBatters;
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].name === name) return rows[i];
  }
  return null;
}

function renderInningsTable() {
  ensureCurrentInningRow();
  byId("inningsTable").innerHTML = `<thead><tr><th>이닝</th><th>초</th><th>말</th></tr></thead><tbody>${state.currentGame.innings.map(row => `
    <tr>
      <td>${row.inning}</td>
      <td><input type="number" min="0" data-inning="${row.inning}" data-half="away" value="${toInt(row.away)}"></td>
      <td><input type="number" min="0" data-inning="${row.inning}" data-half="home" value="${toInt(row.home)}"></td>
    </tr>`).join("")}</tbody>`;
  byId("inningsTable").querySelectorAll("input").forEach(input => {
    input.addEventListener("input", () => {
      const row = state.currentGame.innings.find(item => item.inning === Number(input.dataset.inning));
      if (row) row[input.dataset.half] = toInt(input.value);
    });
  });
}

function ensureCurrentInningRow() {
  const inning = state.currentGame.live?.inning || 1;
  if (!state.currentGame.innings.some(row => row.inning === inning)) {
    state.currentGame.innings.push({ inning, away: 0, home: 0 });
    state.currentGame.innings.sort((a, b) => a.inning - b.inning);
  }
}

function addInningRow() {
  const next = Math.max(0, ...state.currentGame.innings.map(row => row.inning)) + 1;
  state.currentGame.innings.push({ inning: next, away: 0, home: 0 });
  renderInningsTable();
}

function renderPlaysEditor() {
  const editor = byId("playsEditor");
  if (document.activeElement === editor) return;
  editor.value = (state.currentGame.plays || []).map(play => `${play.inning} ${play.half} ${play.desc}`).join("\n");
}

function applyPlaysFromEditor() {
  state.currentGame.plays = byId("playsEditor").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(\d+)\s+(top|bottom)\s+(.+)$/i);
    if (!match) return { inning: state.currentGame.live.inning, half: state.currentGame.live.half === "top" ? "top" : "bottom", desc: line };
    return { inning: Number(match[1]), half: match[2].toLowerCase(), desc: match[3] };
  });
  showToast("상세 기록 문구를 반영했습니다.");
}

function saveLineup() {
  localStorage.setItem("taurus-record-app:lineup", JSON.stringify({
    batters: state.currentGame.batters.map(row => ({ order: row.order, name: row.name, position: row.position, isSub: row.isSub })),
    opponentBatters: state.currentGame.opponentBatters.map(row => ({ order: row.order, name: row.name, isSub: row.isSub }))
  }));
  showToast("라인업을 저장했습니다.");
}

function loadLineup() {
  const raw = localStorage.getItem("taurus-record-app:lineup");
  if (!raw) return showToast("저장된 라인업이 없습니다.");
  try {
    const lineup = JSON.parse(raw);
    if (Array.isArray(lineup.batters)) state.currentGame.batters = lineup.batters.map(row => ({ ...createBatter(row.order || 1), ...row }));
    if (Array.isArray(lineup.opponentBatters)) state.currentGame.opponentBatters = lineup.opponentBatters.map(row => ({ ...createBatter(row.order || 1, "", false), ...row }));
    renderAll();
    showToast("라인업을 불러왔습니다.");
  } catch {
    showToast("라인업을 불러오지 못했습니다.");
  }
}

function validateGame() {
  syncGameMeta();
  const issues = [];
  [...state.currentGame.batters, ...state.currentGame.opponentBatters].forEach(row => {
    const stats = calcBatter(row);
    if (stats.hits > toInt(row.ab)) issues.push(`${row.name || row.order + "번"}: 안타가 타수보다 많습니다.`);
    if (toInt(row.bb) + toInt(row.hbp) + toInt(row.sf) + toInt(row.sac) > stats.pa) issues.push(`${row.name || row.order + "번"}: 타석 수를 확인하세요.`);
  });
  const awayRuns = state.currentGame.innings.reduce((sum, row) => sum + toInt(row.away), 0);
  const homeRuns = state.currentGame.innings.reduce((sum, row) => sum + toInt(row.home), 0);
  const ourRunsByInning = state.currentGame.innings.reduce((sum, row) => sum + toInt(row[ourScoreKey()]), 0);
  const opponentRunsByInning = state.currentGame.innings.reduce((sum, row) => sum + toInt(row[opponentScoreKey()]), 0);
  if (ourRunsByInning !== toInt(state.currentGame.score.ours)) issues.push(`우리 점수(${state.currentGame.score.ours})와 이닝 합계(${ourRunsByInning})가 다릅니다.`);
  if (opponentRunsByInning !== toInt(state.currentGame.score.opponent)) issues.push(`상대 점수(${state.currentGame.score.opponent})와 이닝 합계(${opponentRunsByInning})가 다릅니다.`);
  if (!state.currentGame.plays.length) issues.push("상세 기록 문구가 비어 있습니다.");
  byId("validationBox").innerHTML = issues.length ? issues.map(item => `- ${escapeHtml(item)}`).join("<br>") : "검증 통과: 큰 이상이 없습니다.";
}

function saveStore() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ games: state.games, roster: state.roster }));
}

function loadStore() {
  const raw = localStorage.getItem(STORAGE_KEY) || OLD_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    state.games = Array.isArray(parsed.games) ? parsed.games.map(normalizeGame) : [];
    if (Array.isArray(parsed.roster)) setRoster(parsed.roster);
    if (Array.isArray(parsed.players)) setRoster(parsed.players);
  } catch {
    state.games = [];
  }
}

function exportJson() {
  saveCurrentGame();
  downloadFile(`taurus-records-${todayKey()}.json`, JSON.stringify({ games: state.games, roster: state.roster }, null, 2), "application/json");
}

function exportDetailJson() {
  syncGameMeta();
  const game = normalizeGame(structuredClone(state.currentGame));
  const detailId = prompt("taurus web detailId를 입력하세요.", makeDefaultDetailId(game));
  if (!detailId) return;
  const status = prompt("대회/경기 상태 문구를 입력하세요.", "");
  const detail = buildDetailJson(game, detailId, status || "");
  downloadFile(`detail-${detailId}.json`, JSON.stringify(detail, null, 2), "application/json");
  showToast("taurus web용 detail.json을 내보냈습니다.");
}

function previewDetailJson() {
  syncGameMeta();
  const game = normalizeGame(structuredClone(state.currentGame));
  const detailId = makeDefaultDetailId(game);
  byId("detailPreview").value = JSON.stringify(buildDetailJson(game, detailId, ""), null, 2);
  validateGame();
}

function buildDetailJson(game, detailId, status = "") {
  const opponentName = game.opponent || "상대팀";
  const ourAway = (game.venueSide || "away") === "away";
  const teams = ourAway
    ? { away: { name: TEAM_NAME, abbr: "CBNU" }, home: { name: opponentName, abbr: makeAbbr(opponentName) } }
    : { away: { name: opponentName, abbr: makeAbbr(opponentName) }, home: { name: TEAM_NAME, abbr: "CBNU" } };
  const batting = ourAway
    ? { away: game.batters.map(toDetailBatter), home: game.opponentBatters.map(toDetailBatter) }
    : { away: game.opponentBatters.map(toDetailBatter), home: game.batters.map(toDetailBatter) };
  const pitching = ourAway
    ? { away: game.pitchers.map(toDetailPitcher), home: game.opponentPitchers.map(toDetailPitcher) }
    : { away: game.opponentPitchers.map(toDetailPitcher), home: game.pitchers.map(toDetailPitcher) };
  return {
    [detailId]: {
      detailId,
      date: formatDetailDate(game.date),
      venue: game.stadium,
      status,
      teams,
      innings: normalizeDetailInnings(game),
      batting,
      pitching,
      plays: game.plays || []
    }
  };
}

function makeDefaultDetailId(game) {
  const year = (game.date || new Date().toISOString().slice(0, 10)).slice(0, 4);
  return `${year}-${String(state.games.length + 1).padStart(2, "0")}`;
}

function formatDetailDate(dateText) {
  if (!dateText || !dateText.includes("-")) return dateText || "";
  const [, month, day] = dateText.split("-");
  return `${month}/${day}`;
}

function makeAbbr(name) {
  return String(name || "OPP").replace(/\s+/g, "").slice(0, 4).toUpperCase() || "OPP";
}

function normalizeDetailInnings(game) {
  const maxInning = Math.max(
    1,
    ...((game.innings || []).map(row => row.inning)),
    game.live?.inning || 1
  );
  return Array.from({ length: maxInning }, (_, index) => {
    const inning = index + 1;
    const row = (game.innings || []).find(item => item.inning === inning) || { inning, home: 0, away: 0 };
    return { inning, home: toInt(row.home), away: toInt(row.away) };
  });
}

function toDetailBatter(row) {
  const stats = calcBatter(row);
  const detail = {
    bo: row.order,
    name: row.name,
    pos: toPosCode(row.position),
    pa: stats.pa,
    ab: toInt(row.ab),
    hits: stats.hits,
    rbi: toInt(row.rbi),
    r: toInt(row.run),
    sb: toInt(row.sb),
    bb: toInt(row.bb),
    hbp: toInt(row.hbp),
    so: toInt(row.so)
  };
  if (row.isSub) detail.role = "대타";
  if (toInt(row.double)) detail.double = toInt(row.double);
  if (toInt(row.triple)) detail.triple = toInt(row.triple);
  if (toInt(row.hr)) detail.hr = toInt(row.hr);
  return detail;
}

function toDetailPitcher(row) {
  return {
    name: row.name,
    pos: "P",
    ip: formatOuts(row.outs),
    h: toInt(row.hitsAllowed),
    r: toInt(row.runs),
    er: toInt(row.er),
    bb: toInt(row.bb),
    hbp: toInt(row.hbp),
    so: toInt(row.so),
    hr: toInt(row.hrAllowed)
  };
}

function toPosCode(position = "") {
  const map = {
    "투수": "P", "포수": "C", "1루수": "1B", "2루수": "2B", "3루수": "3B", "유격수": "SS",
    "좌익수": "LF", "중견수": "CF", "우익수": "RF", "지명타자": "DH", "대타": "PH"
  };
  return map[position] || position || "";
}

function importJson(event) {
  readJsonFile(event, parsed => {
    state.games = (Array.isArray(parsed.games) ? parsed.games : Array.isArray(parsed) ? parsed : []).map(normalizeGame);
    if (Array.isArray(parsed.roster) || Array.isArray(parsed.players)) setRoster(parsed.roster || parsed.players);
    saveStore();
    renderAll();
    showToast("JSON 데이터를 불러왔습니다.");
  });
}

function importPlayersJson(event) {
  readJsonFile(event, parsed => {
    const roster = normalizePlayers(parsed);
    if (!roster.length) return showToast("선수 이름을 찾지 못했습니다.");
    setRoster(roster);
    saveStore();
    renderAll();
    showToast(`선수 ${state.players.length}명을 불러왔습니다.`);
  });
}

function readJsonFile(event, onSuccess) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try { onSuccess(JSON.parse(reader.result)); }
    catch { showToast("JSON 파일을 읽지 못했습니다."); }
  };
  reader.readAsText(file, "utf-8");
  event.target.value = "";
}

function exportCsv() {
  saveCurrentGame();
  const lines = [];
  state.games.forEach(game => {
    lines.push(["=== 경기 개요 ==="]);
    lines.push(["날짜", game.date, "우리팀", game.team, "상대팀", game.opponent, "구장", game.stadium, "우리점수", game.score.ours, "상대점수", game.score.opponent]);
    addCsvSection(lines, "우리 팀 타자 기록", batterFields, game.batters, calcBatter);
    addCsvSection(lines, "상대 팀 타자 기록", opponentFields, game.opponentBatters, calcBatter);
    addCsvSection(lines, "우리 팀 투수 기록", pitcherFields, game.pitchers, calcPitcher);
    addCsvSection(lines, "상대 팀 투수 기록", pitcherFields, game.opponentPitchers, calcPitcher);
  });
  downloadFile(`taurus-records-${todayKey()}.csv`, "\ufeff" + lines.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8");
}

function addCsvSection(lines, title, fields, rows, calc) {
  lines.push([], [`=== ${title} ===`], fields.map(field => labels[field]));
  rows.forEach(row => {
    const stats = calc(row);
    lines.push(fields.map(field => stats[field] ?? row[field] ?? ""));
  });
}

function inputHtml(index, field, value, type, kind, extraClass = "", listId = "") {
  return `<input class="${kind} ${extraClass}" data-index="${index}" data-field="${field}" type="${type}" value="${escapeHtml(String(value ?? ""))}"${type === "number" ? ' min="0"' : ""}${listId ? ` list="${listId}"` : ""}>`;
}

function selectHtml(index, field, value, options, kind) {
  return `<select class="${kind}" data-index="${index}" data-field="${field}">${options.map(option => `<option${option === value ? " selected" : ""}>${option}</option>`).join("")}</select>`;
}

function askOrder(message) {
  const order = Number(prompt(`${message}을 입력하세요.`, "1"));
  return order >= 1 && order <= 9 ? order : null;
}

function nextOrder(rows) {
  const used = new Set(rows.filter(row => !row.isSub).map(row => row.order));
  for (let i = 1; i <= 9; i += 1) if (!used.has(i)) return i;
  return askOrder("추가할 타순");
}

function sortLineup(rows) {
  rows.sort((a, b) => a.order - b.order || Number(a.isSub) - Number(b.isSub));
}

function isOurAway() {
  return (state.currentGame.venueSide || "away") === "away";
}

function sideForHalf(half) {
  return (half === "top") === isOurAway() ? "our" : "opponent";
}

function ourScoreKey() {
  return isOurAway() ? "away" : "home";
}

function opponentScoreKey() {
  return isOurAway() ? "home" : "away";
}

function byId(id) { return document.getElementById(id); }
function toInt(value) { const number = parseInt(value, 10); return Number.isFinite(number) && number > 0 ? number : 0; }
function fmt3(value) { return Number(value || 0).toFixed(3); }
function fmt2(value) { return Number(value || 0).toFixed(2); }
function formatOuts(outs) { const value = toInt(outs); return `${Math.floor(value / 3)}.${value % 3}`; }
function validName(name) { return name && !String(name).startsWith("우리선수") && !String(name).startsWith("과거선수"); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function escapeHtml(value) { return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char])); }

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}
