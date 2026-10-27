(() => {
  "use strict";
  const CFG = window.DELAUNAY_CONFIG;
  const $ = (s) => document.querySelector(s);

  const state = {
    data: {},              // { sportKey: [match, ...] }
    sport: null,
    league: "all",
    status: "all",
    q: "",
    demo: false,
    view: /delaunay/i.test(location.hash) ? "dplus" : "all",   // "all" = tous les scores, "dplus" = matchs Delaunay+
    dplus: [],
    dplusDemo: false,
    conf: "all"            // filtre de confiance (vue Delaunay+)
  };

  // ---------- Utils ----------
  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clean = (s) => String(s ?? "").trim().replace(/\s+/g, " ");

  function parseCSV(text) {
    const rows = []; let row = []; let cell = ""; let q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (c !== "\r") cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function parseDate(s) {
    const t = String(s || "");
    let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})/);                                // 2026-10-24
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    m = t.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}|\d{2})\b/);                // 24/10/2026, 24-10-26
    if (m) return new Date(+m[3] < 100 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]);
    m = t.match(/Date\((\d{4}),(\d{1,2}),(\d{1,2})/);                               // Date(2026,9,24)
    if (m) return new Date(+m[1], +m[2], +m[3]);
    return null;
  }

  function parseScore(s) {
    const m = String(s || "").match(/(\d+)\s*[-–:]\s*(\d+)/);
    return m ? [+m[1], +m[2]] : null;
  }

  function dayNum(j) {
    const m = String(j || "").match(/\d+/);
    return m ? +m[0] : 0;
  }

  function mono(name) {
    const w = clean(name).replace(/[^A-Za-zÀ-ÿ0-9 ]/g, "").split(" ").filter((x) => x.length > 1 && !/^(FC|AS|US|CA|CC|RC|SC|ES|ESM|AC|PA|\d+)$/i.test(x));
    const base = w.length ? w : clean(name).split(" ");
    return (base.length > 1 ? base[0][0] + base[1][0] : base[0].slice(0, 2)).toUpperCase();
  }

  // ---------- Rows -> matches ----------
  function toMatches(rows) {
    const hIdx = rows.findIndex((r) => r.some((c) => norm(c) === "DOMICILE"));
    if (hIdx < 0) return [];
    const head = rows[hIdx].map(norm);
    const col = (...names) => head.findIndex((h) => names.includes(h));
    const C = {
      date: col("DATE"), league: col("LIGUE", "CHAMPIONNAT", "COMPETITION"), day: col("JOURNEE"),
      home: col("DOMICILE"), score: col("SCORE"), away: col("EXTERIEUR"),
      id: col("ID MATCH", "ID"), status: col("STATUT")
    };
    return rows.slice(hIdx + 1).map((r) => {
      const home = clean(r[C.home]), away = clean(r[C.away]);
      if (!home || !away) return null;
      const score = parseScore(r[C.score]);
      const rawStatus = norm(r[C.status]);
      const done = rawStatus.startsWith("TERMIN") || (!rawStatus && !!score);
      return {
        id: clean(r[C.id]) || `${home}-${away}`,
        date: parseDate(r[C.date]),
        league: clean(r[C.league]) || "Autres",
        day: /\d/.test(r[C.day] || "") ? clean(r[C.day]) : "",   // ignore "-", "N/A", etc.
        home, away, score,
        done: done && !!score
      };
    }).filter(Boolean);
  }

  // ---------- Data ----------
  async function fetchTab(tab) {
    const url = `https://docs.google.com/spreadsheets/d/${CFG.sheetId}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tab)}&t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const txt = await res.text();
    if (/^\s*</.test(txt)) throw new Error("not public");
    return assignJournees(toMatches(parseCSV(txt)));
  }

  async function load() {
    setStatus("Mise à jour…", false);
    const results = await Promise.allSettled(CFG.sports.map((s) => fetchTab(s.tab)));
    let okCount = 0;
    results.forEach((r, i) => {
      const k = CFG.sports[i].key;
      if (r.status === "fulfilled") { state.data[k] = r.value; okCount++; }
      else if (!state.data[k]) state.data[k] = [];
    });
    state.demo = false;
    if (okCount === 0 && CFG.demoFallback && window.DEMO_ROWS) {
      state.data = { football: assignJournees(toMatches(window.DEMO_ROWS)) };
      state.demo = true;
    }
    try { state.dplus = await fetchDplus(); state.dplusDemo = false; }
    catch (e) {
      state.dplus = CFG.demoFallback && window.DEMO_DPLUS ? toDplus(window.DEMO_DPLUS) : [];
      state.dplusDemo = !!state.dplus.length;
    }
    linkDplusJournees();
    if (!state.sport) {
      const has = state.view === "dplus" ? (k) => state.dplus.some((d) => d.sport === k) : (k) => (state.data[k] || []).length;
      const first = CFG.sports.find((s) => has(s.key)) || CFG.sports[0];
      state.sport = first.key;
    }
    setStatus(state.demo ? "Données d'exemple" : "En direct", !state.demo);
    $("#updated").textContent = "Mis à jour le " + new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    render();
  }

  // ---------- Delaunay+ ----------
  async function fetchDplus() {
    const D = CFG.delaunayPlus || {};
    if (!D.sheetId) throw new Error("non configuré");
    const sel = D.gid ? `gid=${D.gid}` : `sheet=${encodeURIComponent(D.tab || "scores")}`;
    const res = await fetch(`https://docs.google.com/spreadsheets/d/${D.sheetId}/gviz/tq?tqx=out:csv&headers=1&${sel}&t=${Date.now()}`);
    if (!res.ok) throw new Error(res.status);
    const txt = await res.text();
    if (/^\s*</.test(txt)) throw new Error("not public");
    return toDplus(parseCSV(txt));
  }

  function toDplus(rows) {
    const hIdx = rows.findIndex((r) => r.some((c) => norm(c) === "MATCH") && r.some((c) => norm(c) === "CONFIANCE"));
    if (hIdx < 0) return [];
    const head = rows[hIdx].map(norm);
    const col = (n) => head.indexOf(n);
    const g = (r, n) => clean(r[col(n)] ?? "");
    return rows.slice(hIdx + 1).map((r) => {
      const match = g(r, "MATCH");
      if (!match) return null;
      const [home, away] = match.split(" / ").map(clean);
      const conf = parseFloat(String(g(r, "CONFIANCE")).replace(",", ".").replace("%", ""));
      const score = parseScore(g(r, "SCORE"));
      const sportTxt = norm(g(r, "SPORT"));
      const sport = (CFG.sports.find((s) => sportTxt.includes(norm(s.label))) || {}).key || "";
      return {
        id: g(r, "ID") || match, date: parseDate(g(r, "DATE")), sport,
        league: g(r, "CHAMPIONNAT") || "Championnat inconnu",
        day: /\d/.test(g(r, "JOURNEE")) ? g(r, "JOURNEE") : "",
        home: home || match, away: away || "", score,
        conf: isNaN(conf) ? 0 : conf <= 1 ? Math.round(conf * 100) : Math.round(conf),
        matchedWith: g(r, "MATCH SCORE"), scoreId: g(r, "ID SCORE"),
        note: g(r, "CORRESPONDANCE"), link: g(r, "LIEN")
      };
    }).filter(Boolean);
  }

  // Journée manquante (ex. National) : reprise de la journée calculée côté « Tous les scores »
  function linkDplusJournees() {
    const byId = new Map();
    Object.values(state.data).forEach((ms) => ms.forEach((m) => byId.set(m.id, m)));
    state.dplus.forEach((d) => { if (!d.day && byId.has(d.scoreId)) d.day = byId.get(d.scoreId).day || ""; });
  }

  const confLevel = (c) => (c >= 85 ? "ok" : c >= 60 ? "mid" : "low");
  const confLabel = { ok: "Sûr", mid: "À vérifier", low: "Douteux" };

  function setStatus(txt, live) {
    const el = $("#status");
    el.textContent = txt;
    el.classList.toggle("is-live", live);
  }

  // ---------- Render ----------
  function render() {
    renderViews();
    renderTabs();
    renderSeg();
    if (state.view === "dplus") {
      const all = state.dplus.filter((d) => d.sport === state.sport);
      renderDplusStats(all);
      renderChips(all);
      renderDplus(all);
      return;
    }
    const all = state.data[state.sport] || [];
    renderStats(all);
    renderChips(all);
    renderMatches(all);
  }

  function renderViews() {
    document.querySelectorAll("[data-view]").forEach((b) => {
      const on = b.dataset.view === state.view;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on);
      if (b.dataset.view === "dplus") b.querySelector("small").textContent = state.dplus.length;
    });
    $("#heroTitle").innerHTML = state.view === "dplus" ? "Matchs<br><em>Delaunay+</em>" : "Tous les<br><em>scores.</em>";
    document.body.classList.toggle("is-dplus", state.view === "dplus");
  }

  function renderSeg() {
    const opts = state.view === "dplus"
      ? [["conf", "all", "Tous"], ["conf", "check", "À vérifier"], ["conf", "ok", "Sûrs"]]
      : [["status", "all", "Tous"], ["status", "done", "Terminés"], ["status", "upcoming", "À venir"]];
    const cur = state.view === "dplus" ? state.conf : state.status;
    $("#seg").innerHTML = opts.map(([k, v, l]) => `<button class="seg__btn ${cur === v ? "is-on" : ""}" data-${k}="${v}">${l}</button>`).join("");
  }

  function renderDplusStats(all) {
    const ok = all.filter((d) => d.conf >= 85).length;
    $("#stats").innerHTML = [
      [all.length, "Matchs D+"],
      [ok, "Sûrs"],
      [all.length - ok, "À vérifier"]
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  }

  function renderDplus(all) {
    const q = norm(state.q);
    const list = all.filter((d) =>
      (state.league === "all" || d.league === state.league) &&
      (state.conf === "all" || (state.conf === "ok" ? d.conf >= 85 : d.conf < 85)) &&
      (!q || norm(d.home + " " + d.away + " " + d.matchedWith).includes(q))
    );
    let html = state.dplusDemo ? `<div class="notice">L'onglet « scores » du Sheet MATCHS D+ n'est pas encore accessible : affichage de données d'exemple. Voir le README.</div>` : "";
    html += `<div class="legend"><span class="legend__item legend__item--ok">≥ 85 % Sûr</span><span class="legend__item legend__item--mid">60 – 84 % À vérifier</span><span class="legend__item legend__item--low">&lt; 60 % Douteux</span></div>`;
    if (!list.length) {
      $("#content").innerHTML = html + `<div class="empty"><b>Aucun match</b>Rien ne correspond à ces filtres pour le moment.</div>`;
      return;
    }
    // Regroupé par date, du plus récent au plus ancien
    const byDate = [...groupBy(list, (d) => (d.date ? d.date.getTime() : 0)).entries()].sort((a, b) => b[0] - a[0]);
    html += byDate.map(([t, items]) => {
      items.sort((a, b) => a.conf - b.conf);   // les plus douteux en premier
      const label = t ? new Date(t).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Date inconnue";
      const doubt = items.filter((d) => d.conf < 85).length;
      return `<div class="day">
        <div class="day__head"><span class="day__badge">${esc(label)}</span><span class="day__date">${items.length} match${items.length > 1 ? "s" : ""}${doubt ? ` · ${doubt} à vérifier` : ""}</span></div>
        <div class="grid">${items.map(dcard).join("")}</div>
      </div>`;
    }).join("");
    $("#content").innerHTML = html;
  }

  function dcard(d) {
    const lvl = confLevel(d.conf);
    const [h, a] = d.score || [];
    const has = !!d.score;
    const hw = has && h > a, aw = has && a > h;
    const team = (name, win) => `<div class="team ${win ? "is-win" : ""}"><span class="team__mono">${esc(mono(name))}</span><span class="team__name" title="${esc(name)}">${esc(name)}</span></div>`;
    const pts = (v, win) => has ? `<div class="pts pts--${lvl} ${win ? "is-win" : (hw || aw) ? "is-lose" : ""}">${v}</div>` : `<div class="pts pts--vs">—</div>`;
    const meta = [d.day, d.league].filter(Boolean).map(esc).join(" · ");
    const showMatch = d.matchedWith && lvl !== "ok";
    return `<article class="match dmatch dmatch--${lvl}" id="d-${esc(d.id)}">
      <div class="match__meta"><span class="dmatch__league" title="${esc(d.league)}">${meta}</span><span class="conf conf--${lvl}" title="${esc(d.note)}">${d.conf} %</span></div>
      ${team(d.home, hw)}${pts(h, hw)}
      ${team(d.away, aw)}${pts(a, aw)}
      <div class="dmatch__foot">
        ${showMatch ? `<span class="dmatch__check">Rapproché avec <b>${esc(d.matchedWith)}</b>${d.note && !/^S[uû]r$/i.test(d.note) ? ` — ${esc(d.note)}` : ""}</span>`
                    : `<span class="dmatch__check dmatch__check--ok">${has ? confLabel[lvl] : esc(d.note || "Score pas encore publié")}</span>`}
        ${d.link ? `<a class="dmatch__link" href="${esc(d.link)}" target="_blank" rel="noopener">Delaunay+ ↗</a>` : ""}
      </div>
    </article>`;
  }

  function renderTabs() {
    $("#sportTabs").innerHTML = CFG.sports.map((s) => {
      const n = state.view === "dplus" ? state.dplus.filter((d) => d.sport === s.key).length : (state.data[s.key] || []).length;
      return `<button class="tab ${s.key === state.sport ? "is-on" : ""}" role="tab" aria-selected="${s.key === state.sport}" data-sport="${s.key}">${esc(s.label)}<small>${n}</small></button>`;
    }).join("");
  }

  function renderStats(all) {
    const done = all.filter((m) => m.done);
    const goals = done.reduce((a, m) => a + m.score[0] + m.score[1], 0);
    const upcoming = all.length - done.length;
    const avg = done.length ? (goals / done.length).toFixed(1).replace(".", ",") : "0";
    $("#stats").innerHTML = [
      [done.length, "Matchs joués"],
      [upcoming, "À venir"],
      [avg, "Pts / match"]
    ].map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  }

  function renderChips(all) {
    const leagues = [...new Set(all.map((m) => m.league))].sort((a, b) => a.localeCompare(b, "fr"));
    if (state.league !== "all" && !leagues.includes(state.league)) state.league = "all";
    const chips = [["all", "Tous les championnats"], ...leagues.map((l) => [l, l])];
    $("#leagueChips").innerHTML = leagues.length > 1
      ? chips.map(([v, l]) => `<button class="chip ${state.league === v ? "is-on" : ""}" data-league="${esc(v)}">${esc(l)}</button>`).join("")
      : "";
  }

  function renderMatches(all) {
    const q = norm(state.q);
    const list = all.filter((m) =>
      (state.league === "all" || m.league === state.league) &&
      (state.status === "all" || (state.status === "done" ? m.done : !m.done)) &&
      (!q || norm(m.home).includes(q) || norm(m.away).includes(q))
    );

    let html = state.demo ? `<div class="notice">Le Google Sheet n'est pas encore accessible publiquement : affichage de données d'exemple. Voir le README pour l'activer.</div>` : "";

    if (!list.length) {
      $("#content").innerHTML = html + `<div class="empty"><b>Aucun match</b>Rien ne correspond à ces filtres pour le moment.</div>`;
      return;
    }

    const byLeague = groupBy(list, (m) => m.league);
    const leagues = [...byLeague.keys()].sort((a, b) => a.localeCompare(b, "fr"));

    html += leagues.map((lg) => {
      const ms = byLeague.get(lg);
      const blocks = [...groupBy(ms, blockKey).entries()]
        .map(([key, items]) => ({ key, items, t: blockTime(items) }))
        // Du plus futur au plus passé ; « date à fixer » en tête
        .sort((a, b) => (b.t - a.t) || (dayNum(b.items[0].day) - dayNum(a.items[0].day)));
      return `<section class="league">
        <header class="league__head"><h2 class="league__name">${esc(lg)}</h2><span class="league__count">${ms.length} match${ms.length > 1 ? "s" : ""}</span></header>
        ${blocks.map(dayBlock).join("")}
      </section>`;
    }).join("");

    $("#content").innerHTML = html;
  }

  // ---------- Regroupement : journée si dispo, sinon week-end ----------
  const time = (m) => (m.date ? m.date.getTime() : Infinity);
  const blockTime = (items) => Math.max(...items.map(time));
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

  // Ven→Lun rattachés au week-end (clé = samedi), Mar→Jeu = milieu de semaine (clé = mercredi)
  function weekendAnchor(d) {
    const off = { 5: 1, 6: 0, 0: -1, 1: -2 }[d.getDay()];
    if (off !== undefined) return { type: "we", date: addDays(d, off) };
    return { type: "mid", date: addDays(d, 3 - d.getDay()) };
  }

  // Championnat sans colonne JOURNÉE remplie : on numérote nous-mêmes.
  // 1) Écarte l'ancienne saison (matchs datés avant CFG.debutSaison).
  // 2) Championnat sans colonne JOURNÉE remplie : numérotation automatique.
  //    Référence : le week-end de CFG.journeeRef.date = journée CFG.journeeRef.numero ;
  //    chaque week-end (ou milieu de semaine) joué ensuite = journée suivante, et inversement avant.
  function assignJournees(all) {
    const season = parseDate(CFG.debutSaison || "");
    const matches = season ? all.filter((m) => !m.date || m.date >= season) : all;
    const ref = CFG.journeeRef || {};
    const refDate = parseDate(ref.date || "");
    if (!refDate) return matches;
    const refKey = periodKey(refDate), refNum = +ref.numero || 1;
    groupBy(matches, (m) => m.league).forEach((ms) => {
      if (ms.some((m) => m.day)) return;                       // le Sheet fournit déjà les journées
      const keys = [...new Set(ms.filter((m) => m.date).map((m) => periodKey(m.date)))].sort();
      const refIdx = keys.filter((k) => k < refKey).length;    // position du week-end de référence
      ms.forEach((m) => {
        if (!m.date) return;
        const n = refNum + keys.indexOf(periodKey(m.date)) - refIdx;
        if (n >= 1) { m.day = "J" + n; m.generated = true; }
      });
    });
    return matches;
  }

  function periodKey(date) {
    const a = weekendAnchor(date), d = a.date;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}:${a.type}`;
  }

  function blockKey(m) {
    if (m.day) return "J:" + m.day;
    if (!m.date) return "TBD";
    const [iso, type] = periodKey(m.date).split(":");
    return `${type}:${iso}`;
  }

  function dayBlock({ key, items }) {
    items.sort((a, b) => time(b) - time(a));
    const fmtDay = (dt, opts) => dt.toLocaleDateString("fr-FR", opts);
    const dates = items.map((m) => m.date).filter(Boolean);
    let badge, label = "";

    if (key.startsWith("J:")) {
      badge = key.slice(2);
      if (dates.length) {
        const newest = dates[0], oldest = dates[dates.length - 1];
        const f = (d) => fmtDay(d, { weekday: "short", day: "numeric", month: "long" });
        label = newest.getTime() === oldest.getTime() ? f(newest) : `${f(oldest)} → ${f(newest)}`;
      }
    } else if (key === "TBD") {
      badge = "À fixer";
      label = "Date non communiquée";
    } else {
      const [type, iso] = key.split(":");
      const [y, mo, d] = iso.split("-").map(Number);
      const anchor = new Date(y, mo - 1, d);
      if (type === "we") {
        badge = "Week-end";
        const sun = addDays(anchor, 1);
        label = anchor.getMonth() === sun.getMonth()
          ? `${anchor.getDate()} – ${fmtDay(sun, { day: "numeric", month: "long", year: "numeric" })}`
          : `${fmtDay(anchor, { day: "numeric", month: "long" })} – ${fmtDay(sun, { day: "numeric", month: "long", year: "numeric" })}`;
      } else {
        badge = "Semaine";
        label = `Milieu de semaine · ${fmtDay(anchor, { day: "numeric", month: "long" })}`;
      }
    }

    return `<div class="day">
      <div class="day__head"><span class="day__badge">${esc(badge)}</span><span class="day__date">${label}</span></div>
      <div class="grid">${items.map(card).join("")}</div>
    </div>`;
  }

  function card(m) {
    const [h, a] = m.score || [];
    const hw = m.done && h > a, aw = m.done && a > h;
    const date = m.date ? m.date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : "Date à fixer";
    const team = (name, win) => `<div class="team ${win ? "is-win" : ""}"><span class="team__mono">${esc(mono(name))}</span><span class="team__name" title="${esc(name)}">${esc(name)}</span></div>`;
    const pts = (v, win) => m.done ? `<div class="pts ${win ? "is-win" : ""}">${v}</div>` : `<div class="pts pts--vs">—</div>`;
    return `<article class="match" id="m-${esc(m.id)}">
      <div class="match__meta"><span>${date}</span><span class="status status--${m.done ? "done" : "upcoming"}">${m.done ? "Terminé" : "À venir"}</span></div>
      ${team(m.home, hw)}${pts(h, hw)}
      ${team(m.away, aw)}${pts(a, aw)}
    </article>`;
  }

  function groupBy(arr, fn) {
    const m = new Map();
    arr.forEach((x) => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
    return m;
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-sport],[data-league],[data-status],[data-view],[data-conf]");
    if (!t) return;
    if (t.dataset.view) {
      state.view = t.dataset.view; state.league = "all";
      try { history.replaceState(null, "", state.view === "dplus" ? "#delaunay" : location.pathname + location.search); } catch (err) { /* aperçu */ }
      const pool = state.view === "dplus" ? (k) => state.dplus.some((d) => d.sport === k) : (k) => (state.data[k] || []).length;
      if (!pool(state.sport)) state.sport = (CFG.sports.find((s) => pool(s.key)) || CFG.sports[0]).key;
    }
    if (t.dataset.conf) state.conf = t.dataset.conf;
    if (t.dataset.sport) { state.sport = t.dataset.sport; state.league = "all"; }
    if (t.dataset.league) state.league = t.dataset.league;
    if (t.dataset.status) state.status = t.dataset.status;
    render();
  });
  $("#search").addEventListener("input", (e) => { state.q = e.target.value; render(); });

  // ---------- Demo data (extrait du Sheet) ----------
  window.DEMO_ROWS = [
    ["DATE", "LIGUE", "JOURNÉE", "DOMICILE", "SCORE", "EXTÉRIEUR", "id match", "STATUT"],
    ["", "RÉGIONAL 1 - GROUPE A", "J6", "AS TOURLAVILLE", "VS", "CA LISIEUX PA", "NODATE_ASTOURLAVILLE_CALISIEUXPA_FOOT", "À venir"],
    ["05/09/2026", "RÉGIONAL 1 - GROUPE A", "J1", "BAYEUX FC", "1 - 0", "STADE SOTTEVILLE CC", "20260905_BAYEUXFC_STADESOTTEVILLECC_FOOT", "Terminé"],
    ["05/09/2026", "RÉGIONAL 1 - GROUPE A", "J1", "CA LISIEUX PA", "3 - 0", "EVREUX FC 27", "20260905_CALISIEUXPA_EVREUXFC27_FOOT", "Terminé"],
    ["05/09/2026", "RÉGIONAL 1 - GROUPE A", "J1", "ESM GONFREVILLE", "3 - 0", "FC SERQUIGNY NASSAND", "20260905_ESMGONFREVILLE_FCSERQUIGNYNASSAND_FOOT", "Terminé"],
    ["05/09/2026", "RÉGIONAL 1 - GROUPE A", "J1", "HAVRE CAUCRIAUV S", "0 - 2", "FC ROUEN 1899", "20260905_HAVRECAUCRIAUVS_FCROUEN1899_FOOT", "Terminé"],
    ["05/09/2026", "RÉGIONAL 1 - GROUPE A", "J1", "AS TOURLAVILLE", "1 - 5", "HAVRE AC", "20260905_ASTOURLAVILLE_HAVREAC_FOOT", "Terminé"],
    ["06/09/2026", "RÉGIONAL 1 - GROUPE A", "J1", "QRM", "3 - 0", "PACY MENILLES RC", "20260906_QRM_PACYMENILLESRC_FOOT", "Terminé"],
    ["19/09/2026", "RÉGIONAL 1 - GROUPE A", "J2", "EVREUX FC 27", "0 - 3", "ESM GONFREVILLE", "20260919_EVREUXFC27_ESMGONFREVILLE_FOOT", "Terminé"],
    ["19/09/2026", "RÉGIONAL 1 - GROUPE A", "J2", "STADE SOTTEVILLE CC", "0 - 2", "CA LISIEUX PA", "20260919_STADESOTTEVILLECC_CALISIEUXPA_FOOT", "Terminé"],
    ["19/09/2026", "RÉGIONAL 1 - GROUPE A", "J2", "HAVRE AC", "2 - 1", "BAYEUX FC", "20260919_HAVREAC_BAYEUXFC_FOOT", "Terminé"],
    ["19/09/2026", "RÉGIONAL 1 - GROUPE A", "J2", "PACY MENILLES RC", "1 - 1", "AS TOURLAVILLE", "20260919_PACYMENILLESRC_ASTOURLAVILLE_FOOT", "Terminé"],
    ["19/09/2026", "RÉGIONAL 1 - GROUPE A", "J2", "QRM", "2 - 0", "HAVRE CAUCRIAUV S", "20260919_QRM_HAVRECAUCRIAUVS_FOOT", "Terminé"],
    ["20/09/2026", "RÉGIONAL 1 - GROUPE A", "J2", "FC SERQUIGNY NASSAND", "0 - 6", "FC ROUEN 1899", "20260920_FCSERQUIGNYNASSAND_FCROUEN1899_FOOT", "Terminé"],
    ["03/10/2026", "RÉGIONAL 1 - GROUPE A", "J3", "HAVRE CAUCRIAUV S", "3 - 0", "FC SERQUIGNY NASSAND", "20261003_HAVRECAUCRIAUVS_FCSERQUIGNYNASSAND_FOOT", "Terminé"]
  ];

  window.DEMO_DPLUS = [
    ["ID", "DATE", "SPORT", "CHAMPIONNAT", "JOURNÉE", "MATCH", "SCORE", "CONFIANCE", "MATCH SCORE", "ID SCORE", "CORRESPONDANCE", "LIEN"],
    ["20261025_OLYMPIQUEH_SCTHIBERVI_FOOTBALL", "25/10/2026", "Football", "RÉGIONAL 1 FEMININ - POULE UNIQUE", "J6", "Olympique-Havrais Tréfileries-Neiges (F) / SC Thiberville (F)", "1 - 1", "96", "OH TREFILERIE NEIGES / SC THIBERVILLE", "20261025_OHTREFILERIENEIGES_SCTHIBERVILLE_FOOT", "Sûr", "https://delaunayplus.com/"],
    ["20261025_HAVREATHLE_CALISIEUXP_FOOTBALL", "25/10/2026", "Football", "RÉGIONAL 1 - GROUPE A", "J7", "Havre Athletic Club / CA Lisieux Pays d'Auge", "2 - 0", "75", "HAVRE AC / CA LISIEUX PA", "x2", "À vérifier", "https://delaunayplus.com/"],
    ["20261024_STADEMALHE_FCROUEN_FOOTBALL", "24/10/2026", "Football", "NATIONAL 2 - E", "", "Stade Malherbe Caen B / FC Rouen 1899", "0 - 2", "48", "SM CAEN 2 / FC ROUEN 1899", "x4", "À vérifier : autre match proche (CAEN B / ROUEN)", "https://delaunayplus.com/"]
  ];

  load();
  if (CFG.refreshMinutes > 0) setInterval(load, CFG.refreshMinutes * 60000);
})();
