/**
 * Delaunay+ — Passerelle « Annuaire & inventaire » (protégée par mot de passe)
 *
 * Lit les 4 Sheets « DelaunayPlus_Annuaire_et_Inventaire_* » (qui restent PRIVÉS)
 * et ne renvoie leur contenu qu'à quelqu'un qui envoie le bon mot de passe.
 * La vérification se fait ici, chez Google : le mot de passe n'est écrit nulle part
 * dans le site ni dans le dépôt GitHub.
 *
 * Mise en place (voir README, section « Mot de passe & Annuaire ») :
 *  1. script.google.com → Nouveau projet → coller ce fichier.
 *  2. ⚙ Paramètres du projet → Propriétés du script → MOT_DE_PASSE = <le mot de passe de l'équipe>.
 *  3. Déployer → Nouveau déploiement → Application web → Exécuter en tant que : Moi
 *     → Qui a accès : Tout le monde. Copier l'URL (…/exec) dans config.js → annuaire.apiUrl.
 *
 *  POST …/exec  {"mdp":"…"}  → { ok, clubs: [...], maj }   |   { ok:false, erreur, auth:true }
 */
const SOURCES = [
  { sport: 'Football',   id: '1g55kZpD2xevMY6mbPFy5xQkJM1KhnSOxdHtjIgiFkjs' },
  { sport: 'Basketball', id: '1Uuy0GOIb6OBHBAbk_Cwn-yuvSFyvtL5FqOgdoYpxwrM' },
  { sport: 'Handball',   id: '1MS3kQX95MHkBdQYlBiqhZmqp1Wh01ruCUJ81hVqfZAU' },
  { sport: 'Rugby',      id: '1_np51O1YTmnu8oWg-qyQao2znj7dcOSL5pC59w7TswY' },
];
// Onglets qui ne décrivent pas un club par ligne (listes de diffusion, fiche ligue)
const ONGLETS_IGNORES = /mailing|mails?_clubs|feuille ligue/i;
const ESSAIS_MAX = 15;          // essais ratés tolérés…
const BLOCAGE_SECONDES = 900;   // …avant 15 min de blocage

function doGet() {
  return reponse_({ ok: false, erreur: 'Accès réservé : passe par le Centre de suivi.' });
}

function doPost(e) {
  let corps = {};
  try { corps = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { /* vide */ }
  const attendu = PropertiesService.getScriptProperties().getProperty('MOT_DE_PASSE');
  if (!attendu) return reponse_({ ok: false, erreur: 'MOT_DE_PASSE non défini dans les propriétés du script' });

  const cache = CacheService.getScriptCache();
  const echecs = Number(cache.get('echecs') || 0);
  if (echecs >= ESSAIS_MAX) return reponse_({ ok: false, auth: true, erreur: 'Trop d\'essais. Réessaie dans 15 minutes.' });
  if (!egal_(String(corps.mdp || ''), attendu)) {
    cache.put('echecs', String(echecs + 1), BLOCAGE_SECONDES);
    Utilities.sleep(800);
    return reponse_({ ok: false, auth: true, erreur: 'Mot de passe incorrect' });
  }
  return reponse_({ ok: true, clubs: lireTout_(), maj: new Date().toISOString() });
}

// Comparaison en temps constant
function egal_(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const n_ = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const propre_ = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

function lireTout_() {
  const clubs = [];
  SOURCES.forEach((src) => {
    let ss;
    try { ss = SpreadsheetApp.openById(src.id); } catch (err) { return; }
    const onglets = ss.getSheets().filter((sh) => !ONGLETS_IGNORES.test(sh.getName()));
    // 1) Inventaires SIM à part (onglet avec une colonne PUK et « Club assigné »)
    const sims = {};
    onglets.forEach((sh) => { if (/inventaire/i.test(sh.getName())) lireSims_(sh, sims); });
    // 2) Onglets clubs
    onglets.forEach((sh) => {
      if (/inventaire/i.test(sh.getName())) return;
      lireOnglet_(sh, src, ss.getId()).forEach((c) => {
        const s = sims[n_(c.camera)] || sims['club:' + n_(c.club)];
        if (s) {
          if (!c.sim) c.sim = s.sim;
          if (!c.puk) c.puk = s.puk;
          if (s.modele) c.modele = s.modele;
        }
        clubs.push(c);
      });
    });
  });
  return clubs;
}

function lireSims_(sh, sims) {
  const v = sh.getDataRange().getDisplayValues();
  let h = null;
  v.forEach((row) => {
    const nr = row.map(n_);
    if (!h && nr.indexOf('puk') >= 0) {
      h = {
        club: nr.findIndex((x) => /^club/.test(x)), modele: nr.indexOf('modele'),
        ref: nr.findIndex((x) => /^ref/.test(x)), sim: nr.findIndex((x) => /sim/.test(x)), puk: nr.indexOf('puk'),
      };
      return;
    }
    if (!h) return;
    const g = (k) => (h[k] >= 0 ? propre_(row[h[k]]) : '');
    const o = { modele: g('modele'), sim: g('sim'), puk: g('puk') };
    if (g('ref')) sims[n_(g('ref'))] = o;
    if (g('club')) sims['club:' + n_(g('club'))] = o;
  });
}

// Rôles de contact reconnus quand la colonne n'a ni « Mail » ni « Tel » dans son titre
const ROLES_CONNUS = /^(coach|entraineur|president|presidente|president\(e\)|tresorier|secretaire|charge|chargee|referent|responsable|manager|dirigeant)/;

function cleRole_(s) {
  let k = n_(s).replace(/\(e\)/g, '').replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  k = k.replace(/^(charge|chargee) de /, '');
  if (/^comm/.test(k)) k = 'communication';
  return k;
}

// Ce que contient une colonne, d'après son titre
function classer_(titre) {
  const t = n_(titre);
  if (!t) return { type: 'note', label: 'Note' };
  if (t === 'nom du club') return { type: 'club' };
  if (/^ipad ou veo/.test(t) || t === 'outil diffusion') return { type: 'outil' };
  if (/^e-?mail compte/.test(t)) return { type: 'compte' };
  if (/^mot de passe/.test(t)) return { type: 'mdp' };
  if (/^ref\b\.?\s*\//.test(t) || /^id camera/.test(t)) return { type: 'camera' };
  if (/^statut \/ stockage/.test(t)) return { type: 'statut' };
  if (t === 'puk') return { type: 'puk' };
  if (/^(e-?sim|sim)\b/.test(t)) return { type: 'sim' };
  if (/^numero d.affiliation/.test(t)) return { type: 'info', label: 'N° d\'affiliation' };
  if (t === 'mail officiel lfn') return { type: 'contact', champ: 'mail', role: 'Secrétariat (mail officiel LFN)', cle: 'lfn' };
  let m;
  if ((m = t.match(/^(?:tel|telephone)\b\.?\s*(.+)$/))) return { type: 'contact', champ: 'tel', cle: cleRole_(m[1]), role: propre_(titre).replace(/^(t[ée]l[ée]?(phone)?)\.?\s*/i, '') };
  if ((m = t.match(/^(?:mail|e-?mail)\s+(.+)$/))) return { type: 'contact', champ: 'mail', cle: cleRole_(m[1]), role: propre_(titre).replace(/^e?-?mail\s+/i, '') };
  if ((m = t.match(/^(.+?)\s*-\s*(?:nom & prenom|nom et prenom|nom)$/))) return { type: 'contact', champ: 'nom', cle: cleRole_(m[1]), role: propre_(titre).replace(/\s*-\s*nom.*$/i, '') };
  if ((m = t.match(/^(.+?)\s*-\s*(?:e-?mail|mail)$/))) return { type: 'contact', champ: 'mail', cle: cleRole_(m[1]), role: propre_(titre).replace(/\s*-\s*e?-?mail$/i, '') };
  if ((m = t.match(/^(.+?)\s*-\s*(?:telephone|tel)$/))) return { type: 'contact', champ: 'tel', cle: cleRole_(m[1]), role: propre_(titre).replace(/\s*-\s*t[ée]l.*$/i, '') };
  if ((m = t.match(/^(.+?)\s*\(nom\)$/))) return { type: 'contact', champ: 'nom', cle: cleRole_(m[1]), role: propre_(titre).replace(/\s*\(nom\)$/i, '') };
  if (ROLES_CONNUS.test(t)) return { type: 'contact', champ: 'nom', cle: cleRole_(t), role: propre_(titre) };
  return { type: 'info', label: propre_(titre).replace(/\s*\?\s*$/, ' ?') };
}

function lireOnglet_(sh, src, ssId) {
  const v = sh.getDataRange().getDisplayValues();
  const out = [];
  let champ = propre_(sh.getName());
  let cols = null, iClub = -1;
  v.forEach((row, r) => {
    const titre = row.find((x) => /^\s*delaunay\+/i.test(x));
    if (titre) {                                  // bandeau « DELAUNAY+ — … (R1 - Groupe B) »
      const p = titre.match(/\(([^()]+)\)\s*$/);
      champ = p ? propre_(p[1]) : propre_(sh.getName());
      return;
    }
    const nr = row.map(n_);
    const ic = nr.indexOf('nom du club');
    if (ic >= 0) {                                // ligne d'en-têtes
      iClub = ic;
      cols = row.map((h, j) => (j === ic ? { type: 'club' } : classer_(h)));
      // Un titre de rôle seul (« Coach ») n'est un nom que si on reconnaît le rôle ou s'il a un Mail/Tel associé
      const cles = new Set(cols.filter((c) => c.type === 'contact').map((c) => c.cle));
      cols = cols.map((c, j) => (c.type === 'info' && cles.has(cleRole_(row[j])) ? { type: 'contact', champ: 'nom', cle: cleRole_(row[j]), role: propre_(row[j]) } : c));
      return;
    }
    if (!cols || !propre_(row[iClub])) return;
    const c = {
      sport: src.sport, championnat: champ, onglet: sh.getName(), club: propre_(row[iClub]),
      outil: '', compte: '', mdp: '', camera: '', statut: '', sim: '', puk: '', modele: '',
      infos: [], contacts: [],
      lien: 'https://docs.google.com/spreadsheets/d/' + ssId + '/edit#gid=' + sh.getSheetId() + '&range=A' + (r + 1),
    };
    const roles = {};
    cols.forEach((col, j) => {
      const val = propre_(row[j]);
      if (!val || col.type === 'club') return;
      if (['outil', 'compte', 'mdp', 'camera', 'statut', 'sim', 'puk'].indexOf(col.type) >= 0) { c[col.type] = c[col.type] ? c[col.type] + ' · ' + val : val; return; }
      if (col.type === 'contact') {
        const k = col.cle;
        const o = roles[k] || (roles[k] = { role: '', nom: '', mail: '', tel: '' });
        if (col.champ === 'nom' || !o.role) o.role = col.champ === 'nom' ? col.role : (o.role || col.role);
        let champ2 = col.champ;
        if (/@/.test(val)) champ2 = 'mail';
        else if (/^[+\d][\d\s.\-()]{7,}$/.test(val)) champ2 = 'tel';
        o[champ2] = o[champ2] && o[champ2] !== val ? o[champ2] + ' / ' + val : val;
        return;
      }
      c.infos.push({ label: col.label, valeur: val });
    });
    // Une même personne sur plusieurs rôles (référent caméra = coach) : une seule fiche
    const fusion = [];
    Object.keys(roles).forEach((k) => {
      const o = roles[k];
      if (!o.nom && !o.mail && !o.tel) return;
      o.role = o.role ? o.role.charAt(0).toUpperCase() + o.role.slice(1) : 'Contact';
      const meme = fusion.find((x) => (o.tel && x.tel === o.tel) || (o.nom && n_(x.nom) === n_(o.nom) && (!o.tel || !x.tel || x.tel === o.tel)));
      if (meme) {
        meme.role += ' · ' + o.role;
        ['nom', 'mail', 'tel'].forEach((f) => { if (!meme[f]) meme[f] = o[f]; });
      } else fusion.push(o);
    });
    c.contacts = fusion;
    // Pas de colonne « iPad ou VEO » (football, rugby) : une réf. de caméra Veo suffit
    if (!c.outil && (/veo/i.test(c.modele) || /^(\d{5,}|vc3)/i.test(c.camera))) c.outil = 'VEO';
    out.push(c);
  });
  return out;
}

function reponse_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

// Pour tester dans l'éditeur Apps Script : Exécuter → testLecture, puis Affichage → Journaux
function testLecture() {
  const clubs = lireTout_();
  Logger.log(clubs.length + ' clubs');
  Logger.log(JSON.stringify(clubs.slice(0, 3), null, 2));
}
