// ============================================================
//  Centre de suivi Delaunay Productions — vue « Blog »
//  Lit l'onglet « Articles » du Sheet « Automatisation Article blog Delaunay Productions »
//  via la passerelle Apps Script apps-script/BlogProductions.gs (config.js → productions.blog.apiUrl).
//  Indépendant du centre de suivi Delaunay+ : seul le mot de passe est partagé.
// ============================================================
(() => {
  "use strict";
  const CFG = window.DELAUNAY_CONFIG || {};
  const PCFG = CFG.productions || {};
  const $ = (s) => document.querySelector(s);

  const state = {
    blog: [], blogState: "",   // "" | "demo" | "error"
    stat: "all", pole: "all", theme: "all", q: "",
    open: new Set(), pending: {}, howtoOpen: false
  };

  const norm = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toUpperCase();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clean = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
  const blogUrl = () => (PCFG.blog && PCFG.blog.apiUrl) || "";

  // ---------- Pôles ----------
  const POLES = [
    { key: "drone", label: "Drone" },
    { key: "audiovisuel", label: "Audiovisuel" },
    { key: "evenementiel", label: "Événementiel" },
    { key: "medias", label: "Médias" },
    { key: "autre", label: "Autres" }
  ];
  const poleKey = (p) => {
    const n = norm(String(p || "").split(";")[0]);
    if (/DRONE/.test(n)) return "drone";
    if (/AUDIO|VIDEO/.test(n)) return "audiovisuel";
    if (/EVENEMENT/.test(n)) return "evenementiel";
    if (/MEDIA/.test(n)) return "medias";
    return "autre";
  };
  const poleLabel = (k) => (POLES.find((p) => p.key === k) || POLES[4]).label;

  // ---------- Statuts ----------
  const ST = { "VALIDE": "ok", "PUBLIE": "ok", "A REVOIR": "mid", "REJETE": "low" };
  const level = (statut) => ST[norm(statut)] || "todo";
  const LABEL = { ok: "Validé", mid: "À revoir", low: "Rejeté", todo: "À relire" };
  const DECISIONS = [["ok", "Validé", "✓", "Publier"], ["mid", "À revoir", "?", "À revoir"], ["low", "Rejeté", "✕", "Rejeter"]];

  // ---------- Données ----------
  async function fetchBlog() {
    const url = blogUrl();
    if (!url) throw new Error("non configuré");
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    if (!data.ok) throw new Error(data.erreur || "erreur");
    return toBlog(data.articles || []);
  }

  function toBlog(rows) {
    return rows.filter((r) => r["ID article"] && r["Titre"]).map((r) => {
      const id = String(r["ID article"]);
      const pending = state.pending[id];
      const statut = pending || r["Statut"] || "À relire";
      // Le corps contient le bloc « Sources : » ajouté par n8n : on l'affiche à part
      const corps = String(r["Corps de l'article"] || "").split(/\n\s*Sources\s*:\s*\n/i)[0].trim();
      const sources = String(r["Sources citées (média + URL)"] || "").split("\n").map((l) => {
        const m = l.match(/^(.*?)\s*:\s*(https?:\/\/\S+)/);
        return m ? { media: clean(m[1]), url: m[2] } : null;
      }).filter(Boolean);
      const d = new Date(r["Date création"]);
      const pole = poleKey(r["Pôle"]);
      return {
        id, statut, st: level(statut), date: isNaN(d) ? null : d,
        titre: clean(r["Titre"]), chapo: clean(r["Chapô"]), corps,
        theme: clean(r["Thème"]) || "—", pole, poleTxt: clean(r["Pôle"]) || poleLabel(pole),
        normandie: norm(r["Normandie"]) === "OUI",
        meta: clean(r["Meta description (SEO)"]), motsCles: clean(r["Mots-clés SEO"]),
        format: clean(r["Format"]),
        sources, nbSources: Number(r["Nb de sources"]) || sources.length,
        photo: clean(r["Photo (URL)"]), credit: clean(r["Crédit photo"]),
        relu: clean(r["Relu par"]), pending: !!pending
      };
    }).sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  }

  async function load() {
    try { state.blog = await fetchBlog(); state.blogState = ""; }
    catch (e) {
      state.blog = CFG.demoFallback !== false ? toBlog(demo()) : [];
      state.blogState = blogUrl() ? "error" : "demo";
    }
    setStatus(state.blogState ? "Données d'exemple" : "En direct", !state.blogState);
    $("#updated").textContent = "Mis à jour le " + new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
    render();
  }

  function setStatus(txt, live) {
    const el = $("#status");
    el.textContent = txt;
    el.classList.toggle("is-live", !!live);
  }

  // ---------- Rendu ----------
  const statsHTML = (arr) => arr.map(([v, l, cls]) => `<div class="stat ${cls ? "stat--" + cls : ""}"><b>${v}</b><span>${l}</span></div>`).join("");
  const ilYa = (d) => {
    if (!d) return "";
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return "à l'instant";
    if (min < 60) return `il y a ${min} min`;
    if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) + " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };
  const jourLabel = (t) => {
    if (!t) return "Date inconnue";
    const d = new Date(t), auj = new Date(); auj.setHours(0, 0, 0, 0);
    const diff = Math.round((auj - d) / 86400000);
    if (diff === 0) return "Aujourd'hui";
    if (diff === 1) return "Hier";
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  };
  const nbMots = (s) => (String(s).match(/\S+/g) || []).length;
  const groupBy = (arr, fn) => { const m = new Map(); arr.forEach((x) => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };

  function render() {
    const all = state.blog;
    const n = (st) => all.filter((a) => a.st === st).length;
    $("#stats").innerHTML = statsHTML([
      [all.length, "Articles", "main"],
      [n("todo"), "À relire", n("todo") ? "warn" : ""],
      [n("ok"), "Validés", "ok"],
      [n("mid"), "À revoir", n("mid") ? "warn" : ""],
      [n("low"), "Rejetés", n("low") ? "alert" : ""]
    ]);
    $("#navBlog").textContent = n("todo") || all.length;
    $("#navBlog").title = n("todo") ? `${n("todo")} article${n("todo") > 1 ? "s" : ""} à relire` : "";

    // Pôles
    const poles = POLES.filter((p) => all.some((a) => a.pole === p.key));
    if (state.pole !== "all" && !poles.some((p) => p.key === state.pole)) state.pole = "all";
    const tab = (key, label, cnt) => `<button class="tab ${state.pole === key ? "is-on" : ""}" role="tab" aria-selected="${state.pole === key}" data-pole="${key}">${key !== "all" ? `<i class="dot dot--${key}"></i>` : ""}${esc(label)}<small>${cnt}</small></button>`;
    $("#poleTabs").innerHTML = tab("all", "Tous les pôles", all.length) + poles.map((p) => tab(p.key, p.label, all.filter((a) => a.pole === p.key).length)).join("");

    // Statut
    const opts = [["all", "Tous"], ["sort", "À trier"], ["ok", "Validés"], ["low", "Rejetés"]];
    $("#seg").innerHTML = opts.map(([v, l]) => `<button class="seg__btn ${state.stat === v ? "is-on" : ""}" data-stat="${v}">${l}</button>`).join("");

    // Thèmes du pôle choisi
    const dansPole = all.filter((a) => state.pole === "all" || a.pole === state.pole);
    const themes = [...new Set(dansPole.map((a) => a.theme))].sort((a, b) => a.localeCompare(b, "fr"));
    if (state.theme !== "all" && !themes.includes(state.theme)) state.theme = "all";
    $("#themeChips").innerHTML = themes.length > 1
      ? [["all", "Tous les thèmes"], ...themes.map((t) => [t, t])].map(([v, l]) => `<button class="chip ${state.theme === v ? "is-on" : ""}" data-theme="${esc(v)}">${esc(l)}</button>`).join("")
      : "";

    const q = norm(state.q);
    const list = dansPole.filter((a) =>
      (state.theme === "all" || a.theme === state.theme) &&
      (state.stat === "all" || (state.stat === "sort" ? (a.st === "todo" || a.st === "mid") : a.st === state.stat)) &&
      (!q || norm(a.titre + " " + a.theme + " " + a.chapo + " " + a.motsCles).includes(q))
    );

    let html = howtoHTML();
    if (state.blogState === "demo") html += `<div class="notice">Articles d'exemple : la passerelle Apps Script n'est pas encore branchée (<code>productions.blog.apiUrl</code> dans config.js). Les boutons ne modifient rien dans le Sheet. Voir le README.</div>`;
    if (state.blogState === "error") html += `<div class="notice notice--error">Impossible de lire les articles depuis le Sheet pour le moment : affichage d'exemples. Vérifie le déploiement Apps Script (README).</div>`;
    html += `<div class="legend"><span class="legend__item legend__item--ok">Validé : publiable sur delaunayproductions.fr</span><span class="legend__item legend__item--mid">À revoir</span><span class="legend__item legend__item--low">Rejeté</span><span class="legend__item">À relire</span><span class="legend__item legend__item--uniq">⚠ Source unique : à vérifier</span></div>`;
    if (!list.length) {
      $("#content").innerHTML = html + `<div class="empty"><b>Aucun article</b>${all.length ? "Rien ne correspond à ces filtres." : "Le workflow n8n n'a encore rédigé aucun article."}</div>`;
      return;
    }
    const byDay = [...groupBy(list, (a) => { if (!a.date) return 0; const d = new Date(a.date); d.setHours(0, 0, 0, 0); return d.getTime(); }).entries()];
    html += byDay.map(([t, items]) => {
      const todo = items.filter((a) => a.st === "todo").length;
      return `<section class="day">
        <header class="day__head"><h2 class="day__name">${esc(jourLabel(t))}</h2><span class="day__count">${items.length} article${items.length > 1 ? "s" : ""}${todo ? ` · ${todo} à relire` : ""}</span></header>
        <div class="posts">${items.map(postCard).join("")}</div>
      </section>`;
    }).join("");
    $("#content").innerHTML = html;
  }

  const HOWTO = [
    ["Collecte", "Toutes les 3 h, 7 h – 22 h", "n8n lit la presse spécialisée (Helicomicro, Mediakwest, Sonovision, CB News…), la presse normande et une recherche par thème. Seules les actus de moins de 48 h sont gardées."],
    ["Tri", "Automatique", "Une actu n'est retenue que si elle correspond à l'un des thèmes suivis (réglementation drone, matériel vidéo, événements en Normandie…). Promotions, tests consommateurs et drones militaires sont écartés."],
    ["Croisement", "Toutes les 3 h", "Les actus qui parlent du même sujet sont regroupées. Il faut 2 médias différents, sauf pour un média spécialisé noté 4-5 ou un thème secondaire : l'article porte alors l'alerte ⚠ Source unique. Un sujet déjà traité n'est jamais réécrit."],
    ["Rédaction", "IA, 3 par passage", "Les meilleurs sujets sont rédigés uniquement à partir des faits des sources, citées en bas de l'article, avec une meta description et des mots-clés pour le référencement."],
    ["À vous de choisir", "Ici", "Vert : publiable sur delaunayproductions.fr. Orange : à revoir. Rouge : on ne publie pas. Rien n'est publié automatiquement."]
  ];
  function howtoHTML() {
    return `<details class="howto" id="howto" ${state.howtoOpen ? "open" : ""}>
      <summary class="howto__btn">
        <span class="howto__ico" aria-hidden="true">?</span>
        <span class="howto__txt"><b>Comment ça fonctionne</b><small>De l'actu de la presse spécialisée à l'article prêt à publier</small></span>
        <span class="howto__chev" aria-hidden="true">▾</span>
      </summary>
      <div class="howto__body">
        <ol class="howto__steps">
          ${HOWTO.map(([t, quand, txt], i) => `<li class="howto__step"><span class="howto__num">${i + 1}</span><div><b>${t}</b><em>${quand}</em><p>${txt}</p></div></li>`).join("")}
        </ol>
        <div class="howto__rules">
          <p><b>Qui passe en premier ?</b> <code>3 × médias (max 3) + fiabilité + 2 × priorité du thème + 2 si moins de 12 h + 4 si le thème n'a pas eu d'article depuis 72 h + 3 si le sujet concerne la Normandie</code>.</p>
          <p><b>Un thème à ajouter, un média à suivre ?</b> Tout se règle dans le Sheet <i>Automatisation Article blog Delaunay Productions</i> : onglets Sources, Thèmes, Filtres et Paramètres.</p>
        </div>
      </div>
    </details>`;
  }

  function postCard(a) {
    const paras = a.corps.split(/\n\s*\n|\n/).map(clean).filter(Boolean);
    const open = state.open.has(a.id);
    const meta = [a.theme, ilYa(a.date)].filter(Boolean).map(esc).join(" · ");
    return `<article class="post is-${a.st}${a.pending ? " is-pending" : ""}" id="a-${esc(a.id)}" data-id="${esc(a.id)}">
      <div class="post__meta">
        <span class="pole"><i class="dot dot--${a.pole}"></i>${esc(a.poleTxt)}</span>
        ${a.normandie ? `<span class="badge badge--nor">Normandie</span>` : ""}
        <span class="post__info">${meta}</span>
        <span class="pill pill--${a.st}">${a.pending ? "Envoi…" : LABEL[a.st]}</span>
      </div>
      ${a.photo ? `<figure class="post__photo"><img src="${esc(a.photo)}" alt="" loading="lazy">${a.credit ? `<figcaption>© ${esc(a.credit)}</figcaption>` : ""}</figure>` : ""}
      ${a.nbSources === 1 ? `<div class="post__warn" role="note"><span aria-hidden="true">⚠</span><span><b>Source unique</b> : l'info ne vient que de ${esc((a.sources[0] && a.sources[0].media) || "un seul média")}. À vérifier avant de publier.</span></div>` : ""}
      <h3 class="post__title">${esc(a.titre)}</h3>
      ${a.chapo ? `<p class="post__chapo">${esc(a.chapo)}</p>` : ""}
      <details class="post__more" data-open-id="${esc(a.id)}" ${open ? "open" : ""}>
        <summary>Lire l'article <span>${nbMots(a.chapo + " " + a.corps)} mots · ${a.nbSources} source${a.nbSources > 1 ? "s" : ""}${a.format ? " · " + esc(a.format) : ""}</span></summary>
        <div class="post__body">${paras.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
        ${a.meta || a.motsCles ? `<div class="post__seo">${a.meta ? `<div><b>Meta description</b>${esc(a.meta)}</div>` : ""}${a.motsCles ? `<div><b>Mots-clés</b>${esc(a.motsCles)}</div>` : ""}</div>` : ""}
        ${a.sources.length ? `<div class="post__src"><b>Sources</b><ul>${a.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.media)} ↗</a></li>`).join("")}</ul></div>` : ""}
      </details>
      <div class="post__actions">
        <div class="votes" role="group" aria-label="Décision">
          ${DECISIONS.map(([lvl, statut, ico, label]) => `<button class="vote vote--${lvl} ${a.st === lvl ? "is-on" : ""}" data-decision="${esc(statut)}" aria-pressed="${a.st === lvl}" ${a.pending ? "disabled" : ""}><span aria-hidden="true">${ico}</span>${label}</button>`).join("")}
        </div>
        <button class="post__copy" data-copy="${esc(a.id)}">Copier le texte</button>
      </div>
      ${a.relu ? `<div class="post__relu">Dernière décision : ${esc(a.relu)}</div>` : ""}
    </article>`;
  }

  // ---------- Décisions et copie ----------
  const lireNom = () => { try { return localStorage.getItem("dplus.relecteur") || ""; } catch (e) { return ""; } };
  const ecrireNom = (n) => { try { localStorage.setItem("dplus.relecteur", n); } catch (e) { /* navigation privée */ } };

  async function decider(id, statut) {
    const a = state.blog.find((x) => x.id === id);
    if (!a || a.pending) return;
    const avant = { statut: a.statut, st: a.st };
    const url = blogUrl();
    if (state.blogState || !url) {
      Object.assign(a, { statut, st: level(statut) });
      render(); toast(`Exemple : « ${statut} » n'est pas enregistré dans le Sheet.`);
      return;
    }
    let par = lireNom();
    if (!par) { par = (window.prompt("Ton prénom (pour savoir qui a validé) :", "") || "").trim(); if (par) ecrireNom(par); }
    state.pending[id] = statut;
    Object.assign(a, { statut, st: level(statut), pending: true });
    render();
    try {
      // text/plain : requête « simple », acceptée par Apps Script sans pré-vérification CORS
      const res = await fetch(url, { method: "POST", body: JSON.stringify({ id, statut, par, mdp: lireMdp() }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.erreur || "refusé");
      a.relu = `${par ? par + " · " : ""}${new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}`;
      toast(`« ${a.titre.slice(0, 50)}${a.titre.length > 50 ? "…" : ""} » → ${statut}`);
    } catch (err) {
      Object.assign(a, avant);
      toast(`Échec de l'enregistrement : ${err.message}. Réessaie.`, true);
    } finally {
      delete state.pending[id];
      a.pending = false;
      render();
    }
  }

  async function copier(id) {
    const a = state.blog.find((x) => x.id === id);
    if (!a) return;
    const texte = [a.titre, a.chapo, a.corps,
      a.sources.length ? "Sources :\n" + a.sources.map((s) => `- ${s.media} : ${s.url}`).join("\n") : "",
      a.meta ? "Meta description : " + a.meta : "", a.motsCles ? "Mots-clés : " + a.motsCles : ""].filter(Boolean).join("\n\n");
    try { await navigator.clipboard.writeText(texte); toast("Article copié dans le presse-papiers"); }
    catch (e) { toast("Copie impossible dans ce navigateur", true); }
  }

  let toastTimer;
  function toast(msg, err) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.toggle("toast--err", !!err);
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 3200);
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pole],[data-stat],[data-theme],[data-decision],[data-copy]");
    if (!b) return;
    if (b.dataset.pole) { state.pole = b.dataset.pole; state.theme = "all"; render(); }
    else if (b.dataset.stat) { state.stat = b.dataset.stat; render(); }
    else if (b.dataset.theme) { state.theme = b.dataset.theme; render(); }
    else if (b.dataset.decision) decider(b.closest("[data-id]").dataset.id, b.dataset.decision);
    else if (b.dataset.copy) copier(b.dataset.copy);
  });
  document.addEventListener("toggle", (e) => {
    const d = e.target;
    if (d.id === "howto") { state.howtoOpen = d.open; return; }
    if (!d.dataset || !d.dataset.openId) return;
    if (d.open) state.open.add(d.dataset.openId); else state.open.delete(d.dataset.openId);
  }, true);
  let tq;
  $("#search").addEventListener("input", (e) => { clearTimeout(tq); tq = setTimeout(() => { state.q = e.target.value; render(); }, 150); });

  // ---------- Exemples (affichés tant que la passerelle n'est pas branchée) ----------
  function demo() {
    const h = (n) => new Date(Date.now() - n * 3600000).toISOString();
    const art = (id, heures, pole, theme, normandie, titre, chapo, corps, sources, statut, meta, mots) => ({
      "ID article": id, "Date création": h(heures), "Pôle": pole, "Thème": theme, "Normandie": normandie ? "Oui" : "Non",
      "Titre": titre, "Chapô": chapo, "Corps de l'article": corps + "\n\nSources :\n" + sources.map((s) => "- " + s).join("\n"),
      "Sources citées (média + URL)": sources.join("\n"), "Nb de sources": sources.length, "Statut": statut,
      "Meta description (SEO)": meta, "Mots-clés SEO": mots, "Format": "exemple"
    });
    return [
      art("ART-DP-DEMO-1", 2, "Drone", "Drones : matériel et nouveautés", false,
        "Exemple : un nouveau dock DJI qui change seul la batterie du drone",
        "Article d'exemple. Le contenu réel apparaîtra ici dès que la passerelle Apps Script sera branchée.",
        "Ce texte montre la mise en page d'un article. Le premier paragraphe dit ce qui est nouveau.\n\nLe deuxième donne les détails tirés des sources.\n\nLe dernier relie le sujet aux besoins d'un tournage ou d'un événement.",
        ["Helicomicro : https://www.helicomicro.com/", "DroneDJ : https://dronedj.com/"], "À relire",
        "Exemple de meta description pour les moteurs de recherche.", "drone, DJI, prise de vue aérienne"),
      art("ART-DP-DEMO-2", 6, "Audiovisuel", "Live, streaming et broadcast", false,
        "Exemple : les grands événements sportifs entre cloud et régie classique",
        "Article d'exemple sur la production en direct.",
        "Texte d'exemple. Les articles réels sont rédigés à partir des seuls faits des sources citées.",
        ["Mediakwest : https://www.mediakwest.com/"], "Validé", "", "streaming, broadcast"),
      art("ART-DP-DEMO-3", 28, "Événementiel", "Événements en Normandie", true,
        "Exemple : un festival normand mise sur un spectacle de drones",
        "Article d'exemple sur un événement en Normandie.",
        "Texte d'exemple.",
        ["Ouest-France : https://www.ouest-france.fr/", "Paris-Normandie : https://www.paris-normandie.fr/"], "À revoir", "", "festival, Normandie")
    ];
  }

  // ---------- Mot de passe (le même que le centre de suivi Delaunay+) ----------
  const annuUrl = () => (CFG.annuaire && CFG.annuaire.apiUrl) || "";
  const MDP_KEY = "dplus.mdp";
  function lireMdp() { try { return localStorage.getItem(MDP_KEY) || ""; } catch (e) { return ""; } }
  function ecrireMdp(v) { try { v ? localStorage.setItem(MDP_KEY, v) : localStorage.removeItem(MDP_KEY); } catch (e) { /* navigation privée */ } }
  async function verifierMdp(mdp) {
    const res = await fetch(annuUrl(), { method: "POST", body: JSON.stringify({ mdp }) });
    const data = await res.json();
    if (!data.ok) { const err = new Error(data.erreur || "refusé"); err.auth = !!data.auth; throw err; }
    return data;
  }

  let demarre = false;
  function demarrer() {
    if (demarre) return;
    demarre = true;
    document.body.classList.remove("is-locked");
    $("#gate").hidden = true;
    $("#logout").hidden = !annuUrl();
    load();
    const minutes = PCFG.refreshMinutes ?? CFG.refreshMinutes ?? 5;
    if (minutes > 0) setInterval(load, minutes * 60000);
  }
  function ouvrirPorte(msg) {
    document.body.classList.add("is-locked");
    $("#gate").hidden = false;
    $("#gateErr").textContent = msg || "";
    setTimeout(() => $("#gatePwd").focus(), 50);
  }
  $("#gateForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const mdp = $("#gatePwd").value;
    if (!mdp) return;
    const btn = $("#gateBtn");
    btn.disabled = true; btn.textContent = "Vérification…"; $("#gateErr").textContent = "";
    try { await verifierMdp(mdp); ecrireMdp(mdp); demarrer(); }
    catch (err) { $("#gateErr").textContent = err.auth ? err.message : "Connexion impossible (" + err.message + "). Réessaie."; $("#gatePwd").select(); }
    finally { btn.disabled = false; btn.textContent = "Entrer"; }
  });
  $("#logout").addEventListener("click", () => { ecrireMdp(""); location.reload(); });

  if (!annuUrl()) demarrer();
  else if (lireMdp()) {
    demarrer();
    // re-vérification discrète : un mot de passe changé renvoie vers l'écran de connexion
    verifierMdp(lireMdp()).catch((err) => { if (err.auth && /incorrect/i.test(err.message)) { ecrireMdp(""); location.reload(); } });
  }
  else ouvrirPorte();
})();
