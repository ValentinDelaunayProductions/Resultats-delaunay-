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
    demo: false
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
    if (!state.sport) {
      const first = CFG.sports.find((s) => (state.data[s.key] || []).length) || CFG.sports[0];
      state.sport = first.key;
    }
    setStatus(state.demo ? "Données d'exemple" : "En direct", !state.demo);
    $("#updated").textContent = "Mis à jour le " + new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    render();
  }

  function setStatus(txt, live) {
    const el = $("#status");
    el.textContent = txt;
    el.classList.toggle("is-live", live);
  }

  // ---------- Render ----------
  function render() {
    renderTabs();
    const all = state.data[state.sport] || [];
    renderStats(all);
    renderChips(all);
    renderMatches(all);
  }

  function renderTabs() {
    $("#sportTabs").innerHTML = CFG.sports.map((s) => {
      const n = (state.data[s.key] || []).length;
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
    const t = e.target.closest("[data-sport],[data-league],[data-status]");
    if (!t) return;
    if (t.dataset.sport) { state.sport = t.dataset.sport; state.league = "all"; }
    if (t.dataset.league) state.league = t.dataset.league;
    if (t.dataset.status) {
      state.status = t.dataset.status;
      document.querySelectorAll(".seg__btn").forEach((b) => b.classList.toggle("is-on", b === t));
    }
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

  load();
  if (CFG.refreshMinutes > 0) setInterval(load, CFG.refreshMinutes * 60000);
})();
