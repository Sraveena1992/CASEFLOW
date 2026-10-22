const state = {
  user: null,
  cases: [],
  details: {},
  users: [],
  audit: [],
  view: "dashboard",
  filter: "all",
  activeId: null,
  pendingProposal: null,
  anna: null,
  pendingProposal: null,
  busy: false,
  csrf: ""
};
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[ch]));
const date = (value, time) => {
  if (!value) return "Not recorded";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Not recorded" : d.toLocaleString(undefined, time
    ? {year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}
    : {year:"numeric",month:"short",day:"numeric"});
};
const isAdmin = () => state.user && state.user.role === "admin";
const isManager = () => state.user && state.user.role === "account_manager";
const notice = (message, kind) => {
  let el = $("cf-global-notice");
  if (!el) {
    el = document.createElement("div");
    el.id = "cf-global-notice";
    $("cases-container").prepend(el);
  }
  el.className = "cf-notice cf-notice-" + (kind || "warning");
  el.setAttribute("role", "status");
  el.textContent = message;
};
const setStatus = (message, status) => {
  if ($("status")) $("status").textContent = message;
  if ($("runtime-label")) $("runtime-label").textContent = status === "connected" ? "Anna AI connected" : status === "working" ? "Processing" : status === "error" ? "API issue" : "Secure workspace";
  if ($("status-dot")) $("status-dot").style.background = status === "connected" ? "#27845c" : status === "error" ? "#b23850" : status === "working" ? "#d49b2a" : "#EAAA00";
};
async function api(url, options) {
  const opts = options || {};
  const headers = Object.assign({"Accept":"application/json"}, opts.headers || {});
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.method && opts.method !== "GET") {
    if (!state.csrf) {
      const tokenResponse = await fetch("/api/auth/csrf", {credentials:"same-origin"});
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokenData.error || "Could not prepare secure request.");
      state.csrf = tokenData.csrfToken;
    }
    headers["X-CSRF-Token"] = state.csrf;
  }
  const response = await fetch(url, Object.assign({}, opts, {headers, credentials:"same-origin"}));
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.assign("/login.html");
    throw new Error("Your session expired. Please sign in again.");
  }
  if (!response.ok) throw new Error(data.error || "Request failed (" + response.status + ").");
  return data;
}
function normalizeCase(row) {
  return Object.assign({}, row, {
    id: String(row.id),
    title: row.title || "",
    situation: row.description || "",
    state: row.state || "NEW",
    blocker: row.blocker || "Not yet assessed",
    nextAction: row.next_action || "Review the situation and identify the next useful action.",
    ownerEmail: row.owner_email || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    evidence: [],
    history: []
  });
}
async function refreshData() {
  const response = await api("/api/cases");
  state.cases = (response.cases || []).map(normalizeCase);
  state.details = {};
  await Promise.all(state.cases.map(async (item) => {
    try {
      const detail = await api("/api/cases/" + encodeURIComponent(item.id));
      item.evidence = (detail.evidence || []).map((e) => ({
        id:e.id, text:e.content, sourceLabel:e.source_label, timestamp:e.created_at, createdBy:e.created_by
      }));
      item.history = (detail.history || []).map((h) => ({
        id:h.id, type:h.event_type, note:h.summary, details:h.details || {}, timestamp:h.created_at, actorId:h.actor_user_id
      }));
      state.details[item.id] = detail;
    } catch (error) { console.error("Unable to load case detail", item.id, error); }
  }));
}
function allEvents() {
  return state.cases.flatMap((item) => (item.history || []).map((event) => Object.assign({}, event, {
    caseId:item.id, caseTitle:item.title, ownerEmail:item.ownerEmail
  }))).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
}
function isAwaitingCorrection(item) {
  const events = item.history || [];
  const request = events.find((e) => e.type === "admin_change_requested");
  if (!request) return false;
  const lastRequest = Math.max.apply(null, events.filter((e) => e.type === "admin_change_requested").map((e) => new Date(e.timestamp).getTime()));
  const lastUpdate = Math.max.apply(null, events.filter((e) => ["case_updated","evidence_added"].includes(e.type)).map((e) => new Date(e.timestamp).getTime()).concat([0]));
  return lastRequest > lastUpdate;
}
function addStyles() {
  if ($("cf-role-styles")) return;
  const style = document.createElement("style");
  style.id = "cf-role-styles";
  style.textContent = ".cf-nav{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 22px}.cf-nav button{border:1px solid rgba(58,15,52,.17);border-radius:999px;padding:9px 13px;background:#fff;color:#3A0F34;font-size:12px;font-weight:800;cursor:pointer}.cf-nav button.active{background:#3A0F34;color:#F5F6F7;border-color:#3A0F34}.cf-owner{font-size:11px;color:#7B3A6D;font-weight:800}.cf-form{display:grid;gap:16px;margin-top:22px}.cf-field{display:grid;gap:8px}.cf-field label{font-size:12px;font-weight:800}.cf-field input,.cf-field textarea{width:100%;border:1px solid rgba(58,15,52,.2);border-radius:12px;padding:13px;background:#fff;color:#3A0F34;font:inherit;font-size:13px}.cf-field textarea{min-height:120px;resize:vertical}.cf-help{font-size:11px;color:#655560;line-height:1.6}.cf-form-actions{display:flex;flex-wrap:wrap;gap:9px}.cf-list{display:grid;gap:10px}.cf-list-item{border:1px solid rgba(58,15,52,.14);border-radius:13px;background:rgba(255,255,255,.65);padding:15px;overflow-wrap:anywhere}.cf-list-item p{white-space:pre-wrap;line-height:1.65}.cf-empty{border:1px dashed rgba(58,15,52,.25);border-radius:18px;padding:28px;text-align:center}.cf-empty h3{margin-top:0}.cf-empty p{color:#655560;line-height:1.7}.cf-two-col{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cf-request{border:1px solid rgba(234,170,0,.65);border-radius:16px;background:rgba(234,170,0,.09);padding:18px;margin:18px 0}.cf-history-type{font-size:11px;font-weight:900;letter-spacing:.7px;text-transform:uppercase;color:#7B3A6D}.cf-footer-note{margin-top:25px;padding-top:15px;border-top:1px solid rgba(58,15,52,.13);font-size:11px;color:#655560;line-height:1.7}.cf-table{width:100%;border-collapse:collapse;font-size:12px}.cf-table th,.cf-table td{padding:12px 10px;text-align:left;border-bottom:1px solid rgba(58,15,52,.12);vertical-align:top}.cf-table th{color:#7B3A6D;font-size:10px;text-transform:uppercase;letter-spacing:.7px}.cf-scroll{overflow:auto;border:1px solid rgba(58,15,52,.13);border-radius:15px;background:#fff}.cf-tag{display:inline-block;border-radius:999px;padding:5px 8px;background:rgba(58,15,52,.07);font-size:10px;font-weight:850}.cf-detail-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}@media(max-width:650px){.cf-two-col{grid-template-columns:1fr}.cf-table{min-width:620px}}";
  document.head.appendChild(style);
}
function renderNav() {
  const tabs = isAdmin()
    ? [["all","All cases"],["review","Review queue"],["audit","Audit log"],["users","Account managers"]]
    : [["all","My cases"]];
  return '<nav class="cf-nav" aria-label="Workspace sections">' + tabs.map((t) =>
    '<button type="button" class="' + (state.filter === t[0] ? "active" : "") + '" data-action="filter" data-filter="' + t[0] + '">' + t[1] + '</button>'
  ).join("") + "</nav>";
}
function renderStats(items) {
  const list = items || state.cases;
  const blocked = list.filter((x) => x.blocker && !["None recorded","Not yet assessed"].includes(x.blocker)).length;
  const evidence = list.reduce((n,x) => n + (x.evidence || []).length, 0);
  const review = list.filter(isAwaitingCorrection).length;
  return '<div class="cf-stats"><div class="cf-stat"><div class="cf-stat-label">Tracked cases</div><div class="cf-stat-number">' + list.length + '</div></div><div class="cf-stat"><div class="cf-stat-label">Cases with blockers</div><div class="cf-stat-number">' + blocked + '</div></div><div class="cf-stat"><div class="cf-stat-label">' + (isAdmin() ? "Awaiting correction" : "Evidence records") + '</div><div class="cf-stat-number">' + (isAdmin() ? review : evidence) + '</div></div></div>';
}
function renderCaseCards(items) {
  if (!items.length) return '<div class="cf-empty"><h3>' + (state.filter === "review" ? "No open review requests" : "No cases yet") + '</h3><p>' + (isAdmin() ? "Cases created by Account Managers will appear here automatically." : "Create your first case to record the situation, evidence and next action.") + '</p>' + (isManager() ? '<button class="cf-button cf-button-primary" data-action="new-case">＋ Create your first case</button>' : "") + '</div>';
  return '<div class="cf-case-list">' + items.map((item) =>
    '<button type="button" class="cf-card cf-case-card" data-action="open" data-id="' + esc(item.id) + '"><span class="cf-state">' + esc(item.state) + '</span><h3>' + esc(item.title) + '</h3><p class="cf-muted">' + esc(item.nextAction || "No next action recorded.") + '</p>' +
    (isAdmin() ? '<div class="cf-owner">Owner · ' + esc(item.ownerEmail || "Account Manager") + '</div>' : "") +
    (isAwaitingCorrection(item) ? '<span class="cf-tag">Correction requested</span>' : "") +
    '<div class="cf-muted">Updated ' + esc(date(item.updatedAt)) + ' · ' + (item.evidence || []).length + ' evidence item(s)</div><span class="cf-muted">Open record →</span></button>'
  ).join("") + '</div>';
}
function showDashboard() {
  state.view = "dashboard";
  const container = $("cases-container");
  if (!container) return;
  let items = state.cases.slice();
  if (state.filter === "review" && isAdmin()) items = items.filter(isAwaitingCorrection);
  container.innerHTML = '<div class="cf-page"><div class="cf-topline"><div><p class="cf-eyebrow">' + (isAdmin() ? "Administrator workspace" : "Account Manager workspace") + '</p><h1 class="cf-title">' + (isAdmin() ? "Portfolio oversight" : "Your cases, in motion") + '</h1><p class="cf-subtitle">' + (isAdmin() ? "Review every Account Manager case, inspect evidence and history, and request corrections without silently editing the original record." : "Create and manage your cases, keep evidence together, and respond to review requests with a transparent history.") + '</p></div>' + (isManager() ? '<button type="button" class="cf-button cf-button-primary" data-action="new-case">＋ New case</button>' : "") + '</div>' + renderNav() + renderStats(items) + '<div class="cf-section-heading"><h2>' + (state.filter === "review" ? "Review queue" : isAdmin() ? "All Account Manager cases" : "My cases") + '</h2><span class="cf-muted">' + items.length + ' record(s)</span></div>' + renderCaseCards(items) + '<p class="cf-footer-note">Shared records are stored in PostgreSQL. Changes, evidence and review requests are recorded in the audit history. Admins can review and request corrections; Account Managers own case updates. File attachments are not enabled yet—record evidence text and a source label for now.</p></div>';
}
function showCreateForm() {
  if (!isManager()) return notice("Only Account Managers can create cases.", "error");
  state.view = "create";
  $("cases-container").innerHTML = '<div class="cf-page"><button class="cf-button" data-action="back">← My cases</button><div style="margin-top:24px"><p class="cf-eyebrow">Start tracking</p><h1 class="cf-title">Create a case</h1><p class="cf-subtitle">Capture the current situation. The initial state and first audit event will be recorded on the server.</p></div><form id="create-form" class="cf-form"><div class="cf-field"><label for="case-title">Case title</label><input id="case-title" maxlength="200" required placeholder="e.g. Vendor compliance review"></div><div class="cf-field"><label for="case-description">Current situation</label><textarea id="case-description" maxlength="10000" required placeholder="What is known, what is uncertain, and what needs to be resolved?"></textarea><span class="cf-help">Do not include passwords, access tokens or unnecessary sensitive personal information.</span></div><div class="cf-form-actions"><button class="cf-button cf-button-primary" type="submit">Create case</button><button class="cf-button" type="button" data-action="back">Cancel</button></div></form></div>';
  $("create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const created = await api("/api/cases", {method:"POST",body:JSON.stringify({title:$("case-title").value.trim(),description:$("case-description").value.trim()})});
      await refreshData();
      state.activeId = created.case.id;
      notice("Case created and saved to the shared workspace.", "success");
      showDetail(state.activeId);
    } catch (error) { notice(error.message, "error"); button.disabled = false; }
  });
}
function renderHistory(item) {
  if (!item.history || !item.history.length) return '<div class="cf-empty"><p>No history events have been recorded.</p></div>';
  return '<div class="cf-list">' + item.history.map((h) => '<article class="cf-list-item"><div class="cf-history-type">' + esc(String(h.type || "event").replace(/_/g," ")) + '</div><div class="cf-muted">' + esc(date(h.timestamp,true)) + '</div><p>' + esc(h.note) + '</p>' + (h.details && h.details.message && h.type !== "admin_change_requested" ? '<p>' + esc(h.details.message) + '</p>' : "") + '</article>').join("") + '</div>';
}
function renderEvidence(item) {
  if (!item.evidence || !item.evidence.length) return '<div class="cf-empty"><p>No evidence has been recorded yet.</p></div>';
  return '<div class="cf-list">' + item.evidence.map((e) => '<article class="cf-list-item"><div class="cf-muted">' + esc(date(e.timestamp,true)) + (e.sourceLabel ? " · " + esc(e.sourceLabel) : "") + '</div><p>' + esc(e.text) + '</p></article>').join("") + '</div>';
}
async function analyzeEvidence(item, evidenceText) {
  if (!state.anna || !state.anna.llm || typeof state.anna.llm.complete !== "function") throw new Error("Anna AI is not connected in this hosting context.");
  const prompt = "You are CASEFLOW's cautious decision-support engine. Review the case and new evidence. Return only JSON with exactly four non-empty string fields: state, blocker, next_action, reason. Do not invent facts. Distinguish claims from verified facts. Keep current state if the evidence does not justify a change. A proposal is not an automatic decision.\n\nCASE TITLE: " + item.title + "\nCURRENT SITUATION: " + item.situation + "\nCURRENT STATE: " + item.state + "\nCURRENT BLOCKER: " + item.blocker + "\nCURRENT NEXT ACTION: " + item.nextAction + "\n\nNEW EVIDENCE:\n" + evidenceText;
  const response = await state.anna.llm.complete({systemPrompt:"You are a precise, cautious case-state decision-support engine. Return only valid JSON.",messages:[{role:"user",content:{type:"text",text:prompt}}]});
  let raw = "";
  const candidates = [response && response.content,response && response.result && response.result.content,response && response.text,response && response.result && response.result.text];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) { raw = candidate.trim(); break; }
    if (candidate && typeof candidate.text === "string" && candidate.text.trim()) { raw = candidate.text.trim(); break; }
    if (Array.isArray(candidate)) { raw = candidate.filter((p) => p && p.type === "text").map((p) => p.text || "").join("").trim(); if (raw) break; }
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (_) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Anna returned no valid JSON proposal.");
    parsed = JSON.parse(match[0]);
  }
  const nextAction = parsed.next_action || parsed.nextAction;
  for (const value of [parsed.state,parsed.blocker,nextAction,parsed.reason]) if (typeof value !== "string" || !value.trim()) throw new Error("Anna's proposal was incomplete.");
  return {state:parsed.state.trim(),blocker:parsed.blocker.trim(),next_action:nextAction.trim(),reason:parsed.reason.trim()};
}
async function reviewProposal(accepted) {
  const proposal = state.pendingProposal;
  if (!proposal || !isManager()) return notice("There is no proposal to review.", "error");
  try {
    await api("/api/cases/" + encodeURIComponent(proposal.caseId) + "/transition-review", {method:"POST",body:JSON.stringify({accepted:accepted,state:proposal.state,blocker:proposal.blocker,next_action:proposal.next_action,reason:proposal.reason})});
    state.pendingProposal = null;
    await refreshData();
    showDetail(proposal.caseId);
    notice(accepted ? "Proposal reviewed and applied. The decision is in the audit history." : "Proposal rejected. Existing case fields remain unchanged; the review is in the audit history.", "success");
  } catch (error) { notice(error.message, "error"); }
}
function showDetail(id) {
  const item = state.cases.find((x) => x.id === String(id));
  if (!item) { showDashboard(); return; }
  state.view = "detail";
  state.activeId = item.id;
  const requests = (item.history || []).filter((h) => h.type === "admin_change_requested");
  const latestRequest = requests[0];
  const requestPanel = latestRequest ? '<section class="cf-request"><div class="cf-history-type">Admin review request</div><p>' + esc(latestRequest.note) + '</p><div class="cf-muted">' + esc(date(latestRequest.timestamp,true)) + '</div>' + (isManager() && isAwaitingCorrection(item) ? '<p><strong>Please update the case below, then save your changes.</strong></p>' : "") + '</section>' : "";
  const proposal = state.pendingProposal && state.pendingProposal.caseId === item.id ? '<section class="cf-request" id="cf-pending-proposal"><div class="cf-history-type">AI proposal · human review required</div><p class="cf-muted">This is a suggestion, not a verified fact. Check it against the evidence before applying.</p><div class="cf-card"><strong>Proposed state</strong><p>' + esc(state.pendingProposal.state) + '</p><strong>Proposed blocker</strong><p>' + esc(state.pendingProposal.blocker) + '</p><strong>Proposed next action</strong><p>' + esc(state.pendingProposal.next_action) + '</p><strong>Reasoning</strong><p>' + esc(state.pendingProposal.reason) + '</p></div><div class="cf-detail-actions"><button type="button" class="cf-button cf-button-primary" data-action="confirm-transition">Confirm &amp; apply</button><button type="button" class="cf-button" data-action="reject-transition">Reject proposal</button></div></section>' : "";
  const managerEdit = isManager() ? '<section class="cf-card"><h3>Update case record</h3><p class="cf-muted">Saving records the changed fields and preserves the earlier history.</p><form id="edit-form" class="cf-form"><div class="cf-field"><label for="edit-title">Case title</label><input id="edit-title" maxlength="200" required value="' + esc(item.title) + '"></div><div class="cf-field"><label for="edit-description">Current situation</label><textarea id="edit-description" maxlength="10000">' + esc(item.situation) + '</textarea></div><div class="cf-two-col"><div class="cf-field"><label for="edit-state">State</label><input id="edit-state" maxlength="100" required value="' + esc(item.state) + '"></div><div class="cf-field"><label for="edit-blocker">Blocker</label><input id="edit-blocker" maxlength="10000" value="' + esc(item.blocker) + '"></div></div><div class="cf-field"><label for="edit-next">Next action</label><textarea id="edit-next" maxlength="10000">' + esc(item.nextAction) + '</textarea></div><div class="cf-form-actions"><button class="cf-button cf-button-primary" type="submit">Save case updates</button></div></form></section><section class="cf-card" style="margin-top:16px"><h3>Add evidence</h3><form id="evidence-form" class="cf-form"><div class="cf-field"><label for="evidence-source">Source label (optional)</label><input id="evidence-source" maxlength="200" placeholder="e.g. Supplier email, inspection note"></div><div class="cf-field"><label for="evidence-content">Evidence / observation</label><textarea id="evidence-content" maxlength="20000" required placeholder="Record what the source says and what it actually demonstrates."></textarea></div><div class="cf-form-actions"><button class="cf-button cf-button-primary" type="submit">Save evidence</button></div></form></section>' : "";
  const adminReview = isAdmin() ? '<section class="cf-card"><h3>Request changes</h3><p class="cf-muted">This creates a visible audit event for the Account Manager. It does not edit the case fields.</p><form id="review-form" class="cf-form"><div class="cf-field"><label for="review-message">What needs correction or clarification?</label><textarea id="review-message" maxlength="5000" required placeholder="Specify the missing evidence, blocker to clarify, or next action to revise."></textarea></div><div class="cf-form-actions"><button class="cf-button cf-button-primary" type="submit">Send review request</button></div></form></section>' : "";
  $("cases-container").innerHTML = '<div class="cf-page"><div class="cf-topline"><button type="button" class="cf-button" data-action="back">← ' + (isAdmin() ? "All cases" : "My cases") + '</button><span class="cf-tag">' + esc(item.state) + '</span></div><p class="cf-eyebrow">Case record</p><h1 class="cf-title">' + esc(item.title) + '</h1><p class="cf-subtitle">Created ' + esc(date(item.createdAt)) + ' · Updated ' + esc(date(item.updatedAt,true)) + (isAdmin() ? ' · Owner ' + esc(item.ownerEmail) : "") + '</p>' + requestPanel + proposal + '<div class="cf-two-col" style="margin:22px 0"><section class="cf-card"><h3>Current situation</h3><p>' + esc(item.situation || "Not recorded") + '</p></section><section class="cf-card"><h3>Current blocker</h3><p>' + esc(item.blocker || "Not recorded") + '</p></section><section class="cf-card"><h3>Next action</h3><p>' + esc(item.nextAction || "Not recorded") + '</p></section><section class="cf-card"><h3>Evidence summary</h3><p>' + item.evidence.length + ' evidence item(s) recorded.</p><p class="cf-muted">Evidence is a record of information, not automatic proof that a claim is true.</p></section></div>' + managerEdit + adminReview + '<div class="cf-section-heading"><h2>Evidence log</h2><span class="cf-muted">' + item.evidence.length + ' item(s)</span></div>' + renderEvidence(item) + '<div class="cf-section-heading"><h2>Case history</h2><span class="cf-muted">' + item.history.length + ' event(s)</span></div>' + renderHistory(item) + '<p class="cf-footer-note">No record is silently overwritten: saved field changes, evidence entries and review requests are preserved in the server-side history.</p></div>';
  if (isManager()) {
    $("edit-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await api("/api/cases/" + encodeURIComponent(item.id), {method:"PATCH",body:JSON.stringify({
          title:$("edit-title").value.trim(),description:$("edit-description").value.trim(),state:$("edit-state").value.trim(),
          blocker:$("edit-blocker").value.trim(),next_action:$("edit-next").value.trim()
        })});
        await refreshData();
        showDetail(item.id);
        notice("Case updates saved. The audit history was updated.", "success");
      } catch (error) { notice(error.message, "error"); button.disabled = false; }
    });
    $("evidence-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        const evidenceText = $("evidence-content").value.trim();
        await api("/api/cases/" + encodeURIComponent(item.id) + "/evidence", {method:"POST",body:JSON.stringify({source_label:$("evidence-source").value.trim(),content:evidenceText})});
        await refreshData();
        showDetail(item.id);
        notice("Evidence saved to PostgreSQL and added to the audit history.", "success");
        if (state.anna && state.anna.llm && typeof state.anna.llm.complete === "function") {
          setStatus("Analyzing evidence for a proposal…", "working");
          try {
            const freshItem = state.cases.find((x) => x.id === item.id);
            const result = await analyzeEvidence(freshItem, evidenceText);
            state.pendingProposal = Object.assign({caseId:item.id}, result);
            showDetail(item.id);
            notice("AI proposal ready. No case fields have changed; review it before applying.", "warning");
            setStatus("Proposal ready for human review.", "connected");
          } catch (analysisError) {
            notice("Evidence is saved. AI analysis could not complete: " + analysisError.message, "warning");
            setStatus("Evidence saved; AI analysis unavailable.", "ready");
          }
        } else {
          notice("Evidence is saved. AI analysis is available only inside the Anna app runtime.", "warning");
        }
      } catch (error) { notice(error.message, "error"); button.disabled = false; }
    });
  }
  if (isAdmin()) {
    $("review-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await api("/api/cases/" + encodeURIComponent(item.id) + "/review-request", {method:"POST",body:JSON.stringify({message:$("review-message").value.trim()})});
        await refreshData();
        showDetail(item.id);
        notice("Review request recorded. The Account Manager can see it in the case history.", "success");
      } catch (error) { notice(error.message, "error"); button.disabled = false; }
    });
  }
}
async function showUsers() {
  state.view = "users";
  $("cases-container").innerHTML = '<div class="cf-page"><p class="cf-eyebrow">Team access</p><h1 class="cf-title">Account Managers</h1><p class="cf-subtitle">Review team access. Case creation remains with Account Managers; Admin has oversight access.</p><div class="cf-empty">Loading team accounts…</div></div>';
  try {
    const response = await api("/api/admin/users");
    state.users = response.users || [];
    $("cases-container").innerHTML = '<div class="cf-page"><div class="cf-topline"><div><p class="cf-eyebrow">Team access</p><h1 class="cf-title">Account Managers</h1><p class="cf-subtitle">Account status and role overview.</p></div><button class="cf-button" data-action="back">← Dashboard</button></div><div class="cf-scroll"><table class="cf-table"><thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Created</th></tr></thead><tbody>' + state.users.map((u) => '<tr><td>' + esc(u.email) + '</td><td>' + esc(u.role) + '</td><td>' + (u.active ? "Active" : "Disabled") + '</td><td>' + esc(date(u.created_at)) + '</td></tr>').join("") + '</tbody></table></div></div>';
  } catch (error) { $("cases-container").innerHTML = '<div class="cf-page"><h1 class="cf-title">Could not load team accounts</h1><p class="cf-subtitle">' + esc(error.message) + '</p><button class="cf-button" data-action="back">← Dashboard</button></div>'; }
}
async function showAudit() {
  state.view = "audit";
  $("cases-container").innerHTML = '<div class="cf-page"><p class="cf-eyebrow">Accountability</p><h1 class="cf-title">Audit log</h1><p class="cf-subtitle">Recent events across the workspace.</p><div class="cf-empty">Loading audit history…</div></div>';
  try {
    const response = await api("/api/admin/audit-log");
    state.audit = response.events || [];
    $("cases-container").innerHTML = '<div class="cf-page"><div class="cf-topline"><div><p class="cf-eyebrow">Accountability</p><h1 class="cf-title">Audit log</h1><p class="cf-subtitle">Latest 500 events across all cases.</p></div><button class="cf-button" data-action="back">← Dashboard</button></div>' + (state.audit.length ? '<div class="cf-list">' + state.audit.map((e) => '<article class="cf-list-item"><div class="cf-history-type">' + esc(String(e.event_type).replace(/_/g," ")) + '</div><p><strong>' + esc(e.summary) + '</strong></p><div class="cf-muted">' + esc(date(e.created_at,true)) + ' · ' + esc(e.actor_email) + ' · Case: ' + esc(e.case_title) + '</div></article>').join("") + '</div>' : '<div class="cf-empty"><p>No audit events yet.</p></div>') + '</div>';
  } catch (error) { $("cases-container").innerHTML = '<div class="cf-page"><h1 class="cf-title">Could not load audit log</h1><p class="cf-subtitle">' + esc(error.message) + '</p><button class="cf-button" data-action="back">← Dashboard</button></div>'; }
}
async function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  if (action === "filter") { state.filter = button.dataset.filter; return showDashboard(); }
  if (action === "new-case") return showCreateForm();
  if (action === "back") { state.filter = "all"; return showDashboard(); }
  if (action === "open") return showDetail(button.dataset.id);
  if (action === "confirm-transition") return reviewProposal(true);
  if (action === "reject-transition") return reviewProposal(false);
  if (action === "users") return showUsers();
  if (action === "audit") return showAudit();
}
async function connectAnna() {
  try {
    const mod = await import("/static/anna-apps/_sdk/latest/index.js");
    state.anna = await mod.AnnaAppRuntime.connect();
    if (state.anna && state.anna.llm && state.anna.llm.complete) setStatus("Anna runtime connected. Human review remains required.", "connected");
    else setStatus("Secure workspace ready. AI analysis unavailable.", "ready");
  } catch (_) { setStatus("Shared database connected. Anna AI is available only inside the Anna app.", "ready"); }
}
async function main() {
  addStyles();
  state.user = window.__CASEFLOW_USER__ || null;
  if (!state.user) {
    document.addEventListener("caseflow:authenticated", () => { state.user = window.__CASEFLOW_USER__ || null; startWorkspace(); }, {once:true});
    return;
  }
  await startWorkspace();
}
async function startWorkspace() {
  const container = $("cases-container");
  if (!container) return;
  container.addEventListener("click", handleClick);
  if ($("welcome-capabilities")) {
    $("welcome-capabilities").addEventListener("click", (event) => {
      const b = event.target.closest("[data-welcome-action]");
      if (!b) return;
      if (b.dataset.welcomeAction === "cases") container.scrollIntoView({behavior:"smooth",block:"start"});
      else if (isManager() && b.dataset.welcomeAction === "next-action") {
        if (state.cases.length) showDetail(state.cases[0].id); else showCreateForm();
      } else if (state.cases.length) showDetail(state.cases[0].id);
      else if (isManager()) showCreateForm();
      else notice("Case records will appear here when Account Managers create them.", "warning");
    });
  }
  try {
    const token = await api("/api/auth/csrf");
    state.csrf = token.csrfToken;
    await refreshData();
    showDashboard();
    setStatus("Shared PostgreSQL workspace ready.", "ready");
  } catch (error) {
    container.innerHTML = '<div class="cf-page"><h1 class="cf-title">Workspace could not load</h1><p class="cf-subtitle">' + esc(error.message) + '</p><button class="cf-button" onclick="location.reload()">Retry</button></div>';
    setStatus("Workspace connection error.", "error");
  }
  void connectAnna();
}
main().catch((error) => { console.error("CASEFLOW startup failed", error); setStatus("Workspace startup error.", "error"); });
