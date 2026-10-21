const STORAGE_KEY = "caseflow:cases";
const INITIAL_STATE = "NEW";
const TRANSITION_FIELDS = ["state", "blocker", "nextAction", "reason"];

const state = {
  anna: null,
  cases: [],
  currentView: "dashboard",
  activeCaseId: null,
  pendingTransition: null,
  busy: false
};

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function formatDate(value, withTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, withTime
    ? { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "short", day: "numeric" });
}

function makeId() {
  return globalThis.crypto?.randomUUID?.()
    || `cf-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCurrentCase() {
  return state.cases.find((item) => item.id === state.activeCaseId) || null;
}

function setRuntimeState(message, status = "ready") {
  const statusElement = $("status");
  const label = $("runtime-label");
  const dot = $("status-dot");

  if (statusElement) statusElement.textContent = message;

  if (label) {
    label.textContent = status === "connected" ? "Anna AI connected"
      : status === "error" ? "Local mode"
      : status === "working" ? "Processing"
      : "CASEFLOW";
  }

  if (dot) {
    dot.dataset.status = status;
    dot.style.background = status === "connected" ? "#24a06b"
      : status === "error" ? "#c34b58"
      : status === "working" ? "#d49b2a" : "#7c8798";
  }
}

function showNotice(message, type = "warning") {
  const container = $("cases-container");
  if (!container) return;

  let notice = $("cf-global-notice");
  if (!notice) {
    notice = document.createElement("div");
    notice.id = "cf-global-notice";
    container.prepend(notice);
  }

  notice.className = `cf-notice cf-notice-${type}`;
  notice.setAttribute("role", "status");
  notice.textContent = message;
}

function saveCases() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.cases));
    return true;
  } catch (error) {
    console.error("CASEFLOW: Could not save cases.", error);
    setRuntimeState("Could not save changes in this browser.", "error");
    showNotice("Browser storage failed. Your latest change may not persist after refresh.", "error");
    return false;
  }
}

function loadCases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    state.cases = Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.id === "string" && typeof item.title === "string")
      : [];
  } catch (error) {
    console.error("CASEFLOW: Could not load saved cases.", error);
    state.cases = [];
    setRuntimeState("Saved data could not be read. Starting with an empty list.", "error");
  }
}

function makeHistoryEntry(type, note, details = {}) {
  return {
    id: makeId(),
    type,
    timestamp: new Date().toISOString(),
    note,
    ...details
  };
}

function updateCase(item, updates = {}) {
  Object.assign(item, updates, { updatedAt: new Date().toISOString() });
}

function injectStyles() {
  if ($("caseflow-dynamic-styles")) return;

  const style = document.createElement("style");
  style.id = "caseflow-dynamic-styles";
  style.textContent = `
    #cases-container{width:100%;min-width:0}
    .cf-page{width:100%;max-width:1040px;margin:0 auto;padding:8px 0 40px;color:var(--text,#172033);font-family:inherit}
    .cf-topline{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:24px}
    .cf-eyebrow{margin:0 0 8px;color:#7a8496;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase}
    .cf-title{margin:0;font-size:clamp(25px,4vw,36px);font-weight:800;letter-spacing:-1px;line-height:1.15;overflow-wrap:anywhere}
    .cf-subtitle{margin:10px 0 0;color:#687386;font-size:14px;line-height:1.65;max-width:680px}
    .cf-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #dfe4ec;border-radius:10px;padding:10px 15px;background:#fff;color:#172033;font:inherit;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .15s ease,transform .15s ease}
    .cf-button:hover{opacity:.88;transform:translateY(-1px)}
    .cf-button:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .cf-button-primary{color:#fff;background:#6255e7;border-color:#6255e7}
    .cf-button-danger{color:#a52f3b;border-color:#e4b9bf}
    .cf-button-small{padding:7px 10px;font-size:12px}
    .cf-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:22px 0}
    .cf-stat,.cf-card{min-width:0;border:1px solid #e4e8ef;border-radius:14px;background:#fff;padding:18px}
    .cf-stat-label,.cf-muted{color:#7a8496;font-size:12px;line-height:1.65}
    .cf-stat-number{margin-top:8px;font-size:27px;font-weight:800}
    .cf-section-heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:28px 0 14px}
    .cf-section-heading h2{margin:0;font-size:17px;font-weight:750}
    .cf-case-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
    .cf-case-card{display:flex;flex-direction:column;align-items:stretch;gap:12px;width:100%;text-align:left;color:inherit;font:inherit;cursor:pointer}
    .cf-case-card:hover{border-color:#6255e7}
    .cf-case-card h3{margin:0;font-size:16px;line-height:1.5;overflow-wrap:anywhere}
    .cf-state{display:inline-flex;align-self:flex-start;max-width:100%;padding:5px 9px;border-radius:999px;background:#eeecff;color:#5546c9;font-size:11px;font-weight:800;overflow-wrap:anywhere}
    .cf-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:20px 0}
    .cf-detail-grid .cf-card{overflow-wrap:anywhere}
    .cf-card h3{margin:0 0 12px;font-size:14px}
    .cf-card p{margin:0;line-height:1.7;overflow-wrap:anywhere;white-space:pre-wrap}
    .cf-form{display:grid;gap:16px;margin-top:22px}
    .cf-field{display:grid;gap:7px}
    .cf-field label{font-size:13px;font-weight:700}
    .cf-field input,.cf-field textarea{box-sizing:border-box;width:100%;min-width:0;border:1px solid #dfe4ec;border-radius:10px;padding:12px;color:#172033;background:#fff;font:inherit;font-size:14px;outline:none}
    .cf-field input:focus,.cf-field textarea:focus{border-color:#8175ff}
    .cf-field textarea{min-height:125px;resize:vertical;line-height:1.6}
    .cf-field .cf-help{color:#7a8496;font-size:12px;line-height:1.6}
    .cf-form-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:2px}
    .cf-empty{padding:32px 18px;text-align:center;border:1px dashed #dfe4ec;border-radius:14px;background:#fff}
    .cf-empty h3{margin:0 0 8px;font-size:16px}
    .cf-empty p{max-width:460px;margin:0 auto 18px;color:#7a8496;font-size:13px;line-height:1.7}
    .cf-list{display:grid;gap:10px}
    .cf-list-item{min-width:0;border:1px solid #e4e8ef;border-radius:12px;padding:14px;overflow-wrap:anywhere;background:#fff}
    .cf-list-item p{margin:7px 0 0;font-size:13px;line-height:1.65;white-space:pre-wrap}
    .cf-list-item .cf-muted{margin-top:6px}
    .cf-divider{height:1px;margin:18px 0;background:#e4e8ef}
    .cf-notice{margin:14px 0;padding:13px 14px;border:1px solid #dfe4ec;border-radius:10px;font-size:13px;line-height:1.7;overflow-wrap:anywhere;background:#fff}
    .cf-notice-warning{border-color:#d7b75f;background:#fffaf0}
    .cf-notice-success{border-color:#8bc5a8;background:#f2fbf6}
    .cf-notice-error{border-color:#dfa2aa;background:#fff5f6}
    .cf-pending{margin-top:20px;border:1px solid #7567e8;border-radius:14px;padding:18px;background:#f8f7ff}
    .cf-pending h3{margin:0 0 12px;font-size:16px}
    .cf-pending .cf-card{margin-top:10px;padding:13px}
    .cf-pending-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .cf-history-type{color:#5546c9;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.5px}
    .cf-footer-note{margin-top:24px;color:#7a8496;font-size:11px;line-height:1.7}
    @media(max-width:650px){.cf-stats{grid-template-columns:1fr}.cf-case-list,.cf-detail-grid{grid-template-columns:1fr}.cf-page{padding-left:0;padding-right:0}}

    /* Premium CASEFLOW visual system */
    .cf-page { max-width: 1160px; padding: 8px 0 46px; color: #17233f; }
    .cf-eyebrow { color: #6b5ce7; letter-spacing: 2px; }
    .cf-title { color: #17233f; font-size: clamp(29px, 4vw, 42px); letter-spacing: -1.5px; }
    .cf-subtitle { color: #69758e; font-size: 14px; max-width: 720px; }
    .cf-topline { margin-bottom: 26px; }
    .cf-button { border-color: #e1e5f1; border-radius: 12px; padding: 11px 16px; color: #33405d; background: rgba(255,255,255,.92); box-shadow: 0 2px 5px rgba(25,35,75,.025); }
    .cf-button:hover { border-color: #b9b0ff; box-shadow: 0 8px 20px rgba(47,43,105,.08); }
    .cf-button-primary { color: #fff; background: linear-gradient(135deg,#7668f2,#5546d8); border-color: transparent; box-shadow: 0 8px 20px rgba(94,77,220,.22); }
    .cf-button-primary:hover { background: linear-gradient(135deg,#6e60ec,#4e40cd); box-shadow: 0 10px 24px rgba(94,77,220,.3); }
    .cf-button-danger { color: #a33c53; background: #fff8fa; border-color: #f1d6df; }
    .cf-stats { gap: 16px; margin: 28px 0 34px; }
    .cf-stat { position: relative; overflow: hidden; border: 1px solid #e6e9f5; border-radius: 18px; padding: 22px; background: linear-gradient(145deg,rgba(255,255,255,.98),rgba(249,249,255,.92)); box-shadow: 0 10px 30px rgba(33,43,88,.045); }
    .cf-stat:after { content: ""; position: absolute; right: -20px; top: -26px; width: 88px; height: 88px; border-radius: 50%; background: rgba(111,94,240,.07); }
    .cf-stat-label { color: #78829c; font-weight: 650; }
    .cf-stat-number { color: #25274f; font-size: 32px; letter-spacing: -1px; }
    .cf-section-heading { margin: 32px 0 16px; }
    .cf-section-heading h2 { color: #202b49; font-size: 18px; letter-spacing: -.35px; }
    .cf-case-list { gap: 16px; }
    .cf-card, .cf-list-item, .cf-empty { border-color: #e5e9f4; border-radius: 17px; background: rgba(255,255,255,.93); box-shadow: 0 8px 24px rgba(34,43,87,.035); }
    .cf-case-card { padding: 21px; gap: 13px; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
    .cf-case-card:hover { border-color: #b7afff; transform: translateY(-2px); box-shadow: 0 15px 32px rgba(46,43,112,.09); }
    .cf-case-card h3 { color: #202b49; font-size: 17px; letter-spacing: -.25px; }
    .cf-state { padding: 6px 10px; background: #efedff; color: #5a4bd5; border: 1px solid #e2ddff; letter-spacing: .04em; }
    .cf-muted { color: #78829a; }
    .cf-detail-grid { gap: 16px; margin: 24px 0; }
    .cf-detail-grid .cf-card { padding: 22px; }
    .cf-card h3 { color: #4c5672; font-size: 12px; text-transform: uppercase; letter-spacing: .09em; }
    .cf-card p { color: #293653; font-size: 14px; line-height: 1.8; }
    .cf-form { gap: 19px; margin-top: 26px; }
    .cf-field label { color: #35415f; font-size: 13px; }
    .cf-field input, .cf-field textarea { border-color: #dfe4f1; border-radius: 12px; padding: 13px 14px; background: #fff; box-shadow: inset 0 1px 2px rgba(28,38,80,.02); }
    .cf-field input:focus, .cf-field textarea:focus { border-color: #897cff; box-shadow: 0 0 0 4px rgba(117,102,242,.11); }
    .cf-field .cf-help { color: #828ba1; }
    .cf-empty { padding: 40px 22px; border-style: dashed; }
    .cf-empty h3 { color: #252e4b; }
    .cf-list { gap: 12px; }
    .cf-list-item { padding: 17px; }
    .cf-divider { background: #e8ebf5; }
    .cf-notice { border-radius: 13px; box-shadow: 0 5px 18px rgba(33,43,88,.035); }
    .cf-pending { margin-top: 24px; border: 1px solid #d8d1ff; border-radius: 18px; padding: 22px; background: linear-gradient(145deg,#fbfaff,#f5f3ff); box-shadow: 0 10px 28px rgba(79,65,185,.07); }
    .cf-pending h3 { color: #25274f; }
    .cf-pending .cf-card { background: #fff; }
    .cf-history-type { color: #6656df; }
    .cf-footer-note { color: #858da3; border-top: 1px solid #e7eaf4; padding-top: 15px; }
    @media(max-width:650px) {
      .cf-stats { grid-template-columns: 1fr; }
      .cf-case-list, .cf-detail-grid { grid-template-columns: 1fr; }
      .cf-page { padding-left: 0; padding-right: 0; }
      .cf-topline { align-items: flex-start; }
      .cf-stat { padding: 18px; }
    }
  `;

  document.head.appendChild(style);
}

function renderStats() {
  const total = state.cases.length;
  const blocked = state.cases.filter((item) =>
    item.blocker && !["None recorded", "Not yet assessed"].includes(item.blocker)
  ).length;
  const evidenceCount = state.cases.reduce(
    (sum, item) => sum + (Array.isArray(item.evidence) ? item.evidence.length : 0),
    0
  );

  return `<div class="cf-stats">
    <div class="cf-stat"><div class="cf-stat-label">Tracked cases</div><div class="cf-stat-number">${total}</div></div>
    <div class="cf-stat"><div class="cf-stat-label">Cases with a recorded blocker</div><div class="cf-stat-number">${blocked}</div></div>
    <div class="cf-stat"><div class="cf-stat-label">Evidence records</div><div class="cf-stat-number">${evidenceCount}</div></div>
  </div>`;
}

function renderCases() {
  if (!state.cases.length) {
    return `<div class="cf-empty">
      <h3>No cases yet</h3>
      <p>Create your first case to record the current situation, identify blockers and track the next action as new evidence arrives.</p>
      <button type="button" class="cf-button cf-button-primary" data-cf-action="new-case">+ Create your first case</button>
    </div>`;
  }

  return `<div class="cf-case-list">${state.cases.map((item) => `
    <button type="button" class="cf-card cf-case-card" data-cf-action="open-case" data-case-id="${escapeHtml(item.id)}">
      <span class="cf-state">${escapeHtml(item.state)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p class="cf-muted">${escapeHtml(item.nextAction || "No next action recorded.")}</p>
      <div class="cf-muted">Updated ${escapeHtml(formatDate(item.updatedAt))} | ${Array.isArray(item.evidence) ? item.evidence.length : 0} evidence item(s)</div>
      <span class="cf-muted">Open case →</span>
    </button>`).join("")}</div>`;
}
function showDashboard() {
  state.currentView = "dashboard";
  state.pendingTransition = null;
  const container = $("cases-container");
  if (!container) return;

  container.innerHTML = `<div class="cf-page">
    <div class="cf-topline"><div><p class="cf-eyebrow">Case intelligence workspace</p><h1 class="cf-title">CASEFLOW</h1>
      <p class="cf-subtitle">Keep the current state, blocker, next action and supporting evidence together. Review proposed changes before applying them.</p></div>
      <button type="button" class="cf-button cf-button-primary" data-cf-action="new-case">+ New case</button>
    </div>
    ${renderStats()}
    <div class="cf-section-heading"><h2>Your cases</h2><span class="cf-muted">${state.cases.length} total</span></div>
    ${renderCases()}
    <p class="cf-footer-note">CASEFLOW stores case records in this browser. AI-generated transitions are proposals and require your confirmation. Browser storage is not a shared or server-side case database.</p>
  </div>`;

  const primaryButton = $("primary-btn");
  if (primaryButton) {
    primaryButton.textContent = "+ New Case";
    primaryButton.onclick = showCaseDefinitionForm;
  }

  const oldEmptyButton = $("empty-primary-btn");
  if (oldEmptyButton) oldEmptyButton.onclick = showCaseDefinitionForm;
}

function showCaseDefinitionForm() {
  state.currentView = "new-case";
  state.pendingTransition = null;
  const container = $("cases-container");
  if (!container) return;

  container.innerHTML = `<div class="cf-page">
    <button type="button" class="cf-button" data-cf-action="back">← All cases</button>
    <div style="margin-top:24px"><p class="cf-eyebrow">Start tracking</p><h1 class="cf-title">Create a case</h1>
      <p class="cf-subtitle">Describe the real situation you need to move forward. Add evidence and refine the case as new information arrives.</p></div>
    <form id="cf-create-form" class="cf-form">
      <div class="cf-field"><label for="cf-title">Case title</label><input id="cf-title" name="title" maxlength="140" placeholder="e.g. Vendor compliance review" required /></div>
      <div class="cf-field"><label for="cf-situation">Current situation</label><textarea id="cf-situation" name="situation" maxlength="8000" placeholder="What has happened so far? What is known, and what still needs to be resolved?" required></textarea>
        <span class="cf-help">Record what is known. Avoid passwords, access tokens or unnecessary sensitive personal information.</span></div>
      <div class="cf-form-actions"><button type="submit" class="cf-button cf-button-primary">Create case</button><button type="button" class="cf-button" data-cf-action="back">Cancel</button></div>
    </form>
  </div>`;

  $("cf-create-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("cf-title")?.value.trim() || "";
    const situation = $("cf-situation")?.value.trim() || "";
    if (!title || !situation) return showNotice("Please complete both fields.", "error");
    createCase(title, situation);
  });

  const primaryButton = $("primary-btn");
  if (primaryButton) {
    primaryButton.textContent = "All cases";
    primaryButton.onclick = showDashboard;
  }
}

function createCase(title, situation) {
  const now = new Date().toISOString();
  const item = {
    id: makeId(),
    title: title.trim(),
    state: INITIAL_STATE,
    situation: situation.trim(),
    blocker: "Not yet assessed",
    nextAction: "Review the situation and identify the next useful action.",
    evidence: [],
    history: [makeHistoryEntry("created", "Case created. Initial state recorded.")],
    createdAt: now,
    updatedAt: now
  };

  state.cases.unshift(item);
  state.activeCaseId = item.id;

  if (!saveCases()) {
    state.cases = state.cases.filter((entry) => entry.id !== item.id);
    state.activeCaseId = null;
    showDashboard();
    return;
  }

  showCaseDetail();
}

function renderEvidence(item) {
  if (!item.evidence?.length) {
    return `<div class="cf-empty"><p>No evidence has been recorded for this case yet.</p></div>`;
  }

  return `<div class="cf-list">${item.evidence.map((e) => `<article class="cf-list-item">
    <div class="cf-muted">Added ${escapeHtml(formatDate(e.timestamp, true))}</div><p>${escapeHtml(e.text)}</p>
    <div class="cf-muted">Analysis: ${escapeHtml(e.analysisStatus || "Not analyzed")}</div></article>`).join("")}</div>`;
}

function renderHistory(item) {
  if (!item.history?.length) {
    return `<p class="cf-muted">No history recorded yet.</p>`;
  }

  return `<div class="cf-list">${[...item.history].reverse().map((entry) => `<article class="cf-list-item">
    <div class="cf-history-type">${escapeHtml(String(entry.type || "event").replace(/-/g, " "))}</div>
    <div class="cf-muted">${escapeHtml(formatDate(entry.timestamp, true))}</div><p>${escapeHtml(entry.note || "")}</p>
    ${entry.fromState || entry.toState ? `<div class="cf-muted">${escapeHtml(entry.fromState || "-")} → ${escapeHtml(entry.toState || "-")}</div>` : ""}
  </article>`).join("")}</div>`;
}

function renderPendingTransition(proposal) {
  return `<section class="cf-pending" id="cf-pending-transition"><p class="cf-eyebrow">Human review required</p><h3>Proposed case transition</h3>
    <p class="cf-muted">AI-generated proposal only—not independently verified. Check each field against the evidence before applying it.</p>
    ${[["Proposed state", proposal.state], ["Proposed blocker", proposal.blocker], ["Proposed next action", proposal.nextAction], ["AI explanation", proposal.reason]].map(([label, value]) => `<div class="cf-card"><div class="cf-muted">${label}</div><p>${escapeHtml(value)}</p></div>`).join("")}
    <div class="cf-pending-actions"><button type="button" class="cf-button cf-button-primary" data-cf-action="confirm-transition">Confirm & apply</button>
    <button type="button" class="cf-button" data-cf-action="reject-transition">Keep current state</button></div>
  </section>`;
}

function showCaseDetail() {
  state.currentView = "detail";
  const item = getCurrentCase();
  const container = $("cases-container");
  if (!container) return;
  if (!item) return showDashboard();

  if (!Array.isArray(item.evidence)) item.evidence = [];
  if (!Array.isArray(item.history)) item.history = [];

  container.innerHTML = `<div class="cf-page">
    <div class="cf-topline"><button type="button" class="cf-button" data-cf-action="back">← All cases</button>
      <button type="button" class="cf-button cf-button-danger" data-cf-action="delete-case" data-case-id="${escapeHtml(item.id)}">Delete case</button></div>
    <p class="cf-eyebrow">Case record</p><h1 class="cf-title">${escapeHtml(item.title)}</h1>
    <p class="cf-subtitle">Created ${escapeHtml(formatDate(item.createdAt))} | Updated ${escapeHtml(formatDate(item.updatedAt, true))}</p>
    <div style="margin-top:16px"><span class="cf-state">${escapeHtml(item.state)}</span></div>
    <div class="cf-detail-grid">
      <section class="cf-card"><h3>Current situation</h3><p>${escapeHtml(item.situation || "Not recorded")}</p></section>
      <section class="cf-card"><h3>Current blocker</h3><p>${escapeHtml(item.blocker || "Not recorded")}</p></section>
      <section class="cf-card" id="cf-next-action"><h3>Next action</h3><p>${escapeHtml(item.nextAction || "Not recorded")}</p></section>
      <section class="cf-card"><h3>Evidence summary</h3><p>${item.evidence.length} evidence item(s) recorded.</p><p class="cf-muted" style="margin-top:8px">Evidence does not automatically establish that a claim is true.</p></section>
    </div>
    <section class="cf-card" id="cf-evidence-section"><h3>Add evidence</h3><p class="cf-muted">Record a new document, event, observation or update. Evidence saves first; AI analysis is optional and depends on Anna runtime availability.</p>
      <form id="cf-evidence-form" class="cf-form"><div class="cf-field"><label for="cf-evidence">New evidence</label>
      <textarea id="cf-evidence" name="evidence" maxlength="12000" placeholder="What new information has arrived? Include relevant context and what it actually demonstrates." required></textarea></div>
      <div class="cf-form-actions"><button type="submit" class="cf-button cf-button-primary">Save evidence & analyze</button></div></form>
    </section>
    ${state.pendingTransition?.caseId === item.id ? renderPendingTransition(state.pendingTransition) : ""}
    <div class="cf-section-heading"><h2>Evidence log</h2><span class="cf-muted">${item.evidence.length} item(s)</span></div>${renderEvidence(item)}
    <div class="cf-section-heading"><h2>Case history</h2><span class="cf-muted">${item.history.length} event(s)</span></div>${renderHistory(item)}
    <p class="cf-footer-note">Proposed changes are not verified facts. Review the evidence and proposed state before confirming a transition.</p>
  </div>`;

  $("cf-evidence-form")?.addEventListener("submit", handleEvidenceSubmit);

  const primaryButton = $("primary-btn");
  if (primaryButton) {
    primaryButton.textContent = "All cases";
    primaryButton.onclick = showDashboard;
  }
}

function extractText(response) {
  const candidates = [
    response?.content,
    response?.result?.content,
    response?.data?.content,
    response?.text,
    response?.result?.text
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();

    if (candidate && typeof candidate.text === "string" && candidate.text.trim()) {
      return candidate.text.trim();
    }

    if (Array.isArray(candidate)) {
      const text = candidate
        .filter((part) => part?.type === "text")
        .map((part) => part.text || "")
        .join("")
        .trim();

      if (text) return text;
    }
  }

  return "";
}

function parseTransitionResponse(rawText) {
  const cleaned = rawText.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed;

  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("The AI response did not contain valid JSON.");

    try {
      parsed = JSON.parse(match[0]);
    } catch {
      throw new Error("The AI returned invalid JSON. The case state was not changed.");
    }
  }

  for (const field of TRANSITION_FIELDS) {
    if (typeof parsed?.[field] !== "string" || !parsed[field].trim()) {
      throw new Error(`The AI transition is incomplete: ${field} is missing.`);
    }
  }

  return {
    state: parsed.state.trim(),
    blocker: parsed.blocker.trim(),
    nextAction: parsed.nextAction.trim(),
    reason: parsed.reason.trim()
  };
}

async function analyzeEvidence(item, evidenceText) {
  if (!state.anna?.llm?.complete) {
    throw new Error("Anna AI is not connected. Evidence is saved, but AI analysis is unavailable in Render preview.");
  }

  const prompt = `You are the decision-support engine inside CASEFLOW.
Analyze new evidence against the current case and propose a careful update.
CURRENT CASE
Title: ${item.title}
Situation: ${item.situation}
Current state: ${item.state}
Current blocker: ${item.blocker}
Current next action: ${item.nextAction}
NEW EVIDENCE
${evidenceText}
Return ONLY a valid JSON object with exactly four non-empty string fields: "state", "blocker", "nextAction", "reason".
Rules: Do not invent facts or verification. Separate reported claims from established facts. Do not infer causes from missing records. Keep current state if evidence does not justify change. Make next action specific and practical. This is a proposal for human review, not an automatic decision.`;

  const response = await state.anna.llm.complete({
    systemPrompt: "You are a precise, cautious case-state decision-support engine. Return only valid JSON.",
    messages: [{ role: "user", content: { type: "text", text: prompt } }],
    maxTokens: 500
  });

  const raw = extractText(response);
  if (!raw) throw new Error("Anna returned an empty response. Evidence remains saved.");

  const proposal = parseTransitionResponse(raw);
  const toolId = window.__ANNA_TOOL_IDS__?.caseflow;

  if (!toolId || typeof state.anna?.tools?.invoke !== "function") {
    throw new Error("CASEFLOW Executa is unavailable; no proposal can proceed.");
  }

  const invocation = await state.anna.tools.invoke({
    tool_id: toolId,
    method: "evaluate_transition",
    args: {
      evidence: evidenceText,
      proposed_state: proposal.state,
      proposed_blocker: proposal.blocker,
      proposed_next_action: proposal.nextAction,
      reason: proposal.reason
    }
  });

  const validation = invocation?.data ?? invocation?.result ?? invocation;

  if (
    invocation?.success === false ||
    validation?.valid !== true ||
    validation?.status !== "READY_FOR_HUMAN_REVIEW"
  ) {
    console.error("CASEFLOW Executa validation response:", invocation);
    throw new Error("Executa validation failed; no transition was applied.");
  }

  return proposal;
}
async function handleEvidenceSubmit(event) {
  event.preventDefault();
  if (state.busy) return;

  const item = getCurrentCase();
  const evidenceText = $("cf-evidence")?.value.trim() || "";

  if (!item || !evidenceText) {
    return showNotice("Add evidence before submitting.", "error");
  }

  const evidence = {
    id: makeId(),
    timestamp: new Date().toISOString(),
    text: evidenceText,
    analysisStatus: "Saved - analysis pending"
  };

  item.evidence.push(evidence);
  item.history.push(
    makeHistoryEntry(
      "evidence-added",
      "New evidence recorded. AI analysis has not yet been confirmed.",
      { evidenceId: evidence.id }
    )
  );

  updateCase(item);

  if (!saveCases()) {
    item.evidence = item.evidence.filter((e) => e.id !== evidence.id);
    item.history = item.history.filter((h) => h.evidenceId !== evidence.id);
    showCaseDetail();
    return;
  }

  showCaseDetail();
  state.busy = true;

  const submit = $("cf-evidence-form")?.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;

  setRuntimeState("Analyzing evidence...", "working");

  try {
    const proposal = await analyzeEvidence(item, evidenceText);

    evidence.analysisStatus = "Analysis complete - proposal awaits review";

    state.pendingTransition = {
      caseId: item.id,
      evidenceId: evidence.id,
      ...proposal
    };

    item.history.push(
      makeHistoryEntry(
        "transition-proposed",
        "AI proposed a transition. No case fields have been changed yet.",
        { evidenceId: evidence.id, proposedState: proposal.state }
      )
    );

    updateCase(item);
    saveCases();

    setRuntimeState("Proposal ready for review.", "connected");
    showCaseDetail();
  } catch (error) {
    console.error("CASEFLOW: Evidence analysis failed.", error);

    evidence.analysisStatus = "Saved - analysis unavailable";

    item.history.push(
      makeHistoryEntry(
        "analysis-failed",
        `Evidence was saved, but analysis failed: ${error?.message || "Unknown error"}`,
        { evidenceId: evidence.id }
      )
    );

    updateCase(item);
    saveCases();

    setRuntimeState("Evidence saved; AI analysis unavailable.", "error");
    showCaseDetail();

    showNotice(
      `Evidence was saved. The case state was not changed. ${error?.message || "Analysis unavailable."}`,
      "error"
    );
  } finally {
    state.busy = false;
  }
}

function confirmTransition() {
  const proposal = state.pendingTransition;
  const item = getCurrentCase();

  if (!proposal || !item || proposal.caseId !== item.id) {
    return showNotice("There is no pending transition to confirm.", "error");
  }

  const old = {
    state: item.state,
    blocker: item.blocker,
    nextAction: item.nextAction,
    historyLength: item.history.length
  };

  item.state = proposal.state;
  item.blocker = proposal.blocker;
  item.nextAction = proposal.nextAction;

  item.history.push(
    makeHistoryEntry(
      "transition-confirmed",
      "User confirmed and applied the proposed case transition.",
      {
        evidenceId: proposal.evidenceId,
        fromState: old.state,
        toState: proposal.state,
        previousBlocker: old.blocker,
        previousNextAction: old.nextAction,
        reason: proposal.reason
      }
    )
  );

  const evidence = item.evidence.find((e) => e.id === proposal.evidenceId);
  if (evidence) evidence.analysisStatus = "Proposal reviewed and applied by user";

  updateCase(item);

  if (!saveCases()) {
    item.state = old.state;
    item.blocker = old.blocker;
    item.nextAction = old.nextAction;
    item.history.length = old.historyLength;

    if (evidence) {
      evidence.analysisStatus = "Analysis complete - proposal awaits review";
    }

    showCaseDetail();
    return;
  }

  state.pendingTransition = null;
  setRuntimeState("Transition applied.", "ready");
  showCaseDetail();

  showNotice(
    "Transition confirmed. Case state, blocker and next action were updated.",
    "success"
  );
}

function rejectTransition() {
  const proposal = state.pendingTransition;
  const item = getCurrentCase();

  if (!proposal || !item || proposal.caseId !== item.id) {
    return showNotice("There is no pending transition to reject.", "error");
  }

  const oldHistoryLength = item.history.length;
  const evidence = item.evidence.find((e) => e.id === proposal.evidenceId);
  const oldStatus = evidence?.analysisStatus;

  if (evidence) {
    evidence.analysisStatus = "Reviewed - proposed transition not applied";
  }

  item.history.push(
    makeHistoryEntry(
      "transition-rejected",
      "User kept the existing case state. The AI proposal was not applied.",
      { evidenceId: proposal.evidenceId }
    )
  );

  updateCase(item);

  if (!saveCases()) {
    item.history.length = oldHistoryLength;
    if (evidence) evidence.analysisStatus = oldStatus;
    showCaseDetail();
    return;
  }

  state.pendingTransition = null;
  setRuntimeState("Existing state retained.", "ready");
  showCaseDetail();

  showNotice(
    "Proposal rejected. The existing state, blocker and next action remain unchanged.",
    "success"
  );
}

function deleteCase(caseId) {
  const item = state.cases.find((entry) => entry.id === caseId);
  if (!item) return;

  if (!window.confirm(
    `Delete "${item.title}" and its evidence/history from this browser? This cannot be undone.`
  )) {
    return;
  }

  const previous = state.cases;
  state.cases = state.cases.filter((entry) => entry.id !== caseId);

  if (!saveCases()) {
    state.cases = previous;
    return;
  }

  state.activeCaseId = null;
  state.pendingTransition = null;

  setRuntimeState("Case deleted.", "ready");
  showDashboard();
}

function handleActionClick(event) {
  const button = event.target.closest("[data-cf-action]");
  if (!button) return;

  const action = button.dataset.cfAction;

  if (action === "new-case") return showCaseDefinitionForm();

  if (action === "back") {
    state.pendingTransition = null;
    return showDashboard();
  }

  if (action === "open-case") {
    state.activeCaseId = button.dataset.caseId;
    state.pendingTransition = null;
    return showCaseDetail();
  }

  if (action === "delete-case") return deleteCase(button.dataset.caseId);
  if (action === "confirm-transition") return confirmTransition();
  if (action === "reject-transition") return rejectTransition();
}


function handleWelcomeAction(event) {
  const button = event.target.closest("[data-welcome-action]");
  if (!button) return;
  const action = button.dataset.welcomeAction;
  const container = $("cases-container");

  if (action === "cases") {
    container?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (!state.cases.length) {
    showCaseDefinitionForm();
    $("cf-title")?.focus();
    return;
  }

  const item = [...state.cases].sort((a, b) =>
    new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  )[0];
  state.activeCaseId = item.id;
  showCaseDetail();

  const hasProposal = state.pendingTransition?.caseId === item.id;
  const targetId = action === "next-action" ? "cf-next-action"
    : action === "evidence" ? "cf-evidence-section"
    : hasProposal ? "cf-pending-transition" : "cf-evidence-section";
  $(targetId)?.scrollIntoView({ behavior: "smooth", block: "center" });

  if (action === "review" && !hasProposal) {
    showNotice(
      state.anna
        ? "No pending AI proposal for this case. Add new evidence to request an analysis, then review the proposal before applying it."
        : "No pending AI proposal for this case. Evidence can be saved locally, but AI transition analysis requires the Anna app runtime and is unavailable in this local Render mode.",
      "warning"
    );
  }
}

async function connectAnna() {
  try {
    // This SDK exists inside the Anna host, not on ordinary static hosting such as Render.
    const { AnnaAppRuntime } = await import("/static/anna-apps/_sdk/latest/index.js");

    state.anna = await AnnaAppRuntime.connect();

    if (!state.anna?.llm?.complete) {
      throw new Error("Anna LLM API is unavailable.");
    }

    setRuntimeState("Anna AI connected.", "connected");
  } catch (error) {
    state.anna = null;

    console.info(
      "CASEFLOW: Anna runtime unavailable; local case features remain enabled.",
      error
    );

    setRuntimeState("Local mode - AI analysis unavailable.", "error");
  }
}

async function main() {
  injectStyles();
  loadCases();

  const container = $("cases-container");

  if (!container) {
    console.error("CASEFLOW: Missing #cases-container in bundle/index.html.");
    setRuntimeState("App startup error: dashboard container missing.", "error");
    return;
  }

  // Keep dynamically rendered buttons working through event delegation.
  container.addEventListener("click", handleActionClick);

  // Connect the hero feature controls to actual case workflows.
  $("welcome-capabilities")?.addEventListener("click", handleWelcomeAction);

  const primaryButton = $("primary-btn");

  if (primaryButton) {
    primaryButton.onclick = showCaseDefinitionForm;
    primaryButton.textContent = "+ New Case";
  }

  const emptyPrimaryButton = $("empty-primary-btn");

  if (emptyPrimaryButton) {
    emptyPrimaryButton.onclick = showCaseDefinitionForm;
  }

  // Render the interface first; don't wait for Anna runtime.
  showDashboard();

  // On Render, this should fail gracefully into local mode.
  void connectAnna();
}

main().catch((error) => {
  console.error("CASEFLOW failed to start.", error);
  setRuntimeState("App startup error. Check browser console.", "error");
});
