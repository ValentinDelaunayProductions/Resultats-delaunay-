/**
 * Delaunay+ — Passerelle « Blog » entre le site GitHub et le Google Sheet
 * « Automatisation Article blog Delaunay+ ».
 *
 * À coller dans le Sheet : Extensions → Apps Script, puis Déployer → Nouveau déploiement
 * → type « Application web » → Exécuter en tant que : Moi → Qui a accès : Tout le monde.
 * Copier l'URL obtenue (…/exec) dans config.js → blog.apiUrl.
 *
 *  GET  …/exec                                   → { ok, articles: [...] }
 *  POST …/exec  {"id":"ART-…","statut":"Validé","par":"Valentin"}  → { ok, id, statut }
 *
 * Le Sheet n'a pas besoin d'être partagé publiquement : seul ce script le lit et l'écrit.
 */
const ONGLET_ARTICLES = 'Articles';
const STATUTS_AUTORISES = ['À relire', 'Validé', 'À revoir', 'Rejeté', 'Publié'];
const COLONNES_EXPOSEES = [
  'ID article', 'Date création', 'ID événement', 'Titre', 'Chapô', "Corps de l'article", 'Club(s)', 'Sport',
  'Sources citées (média + URL)', 'Nb de sources', 'Photo (URL)', 'Crédit photo', 'Licence photo',
  'Statut', 'Date publication', 'URL publication', 'Relu par',
];

function doGet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ONGLET_ARTICLES);
  if (!sh) return reponse_({ ok: false, erreur: 'Onglet « ' + ONGLET_ARTICLES + ' » introuvable' });
  const valeurs = sh.getDataRange().getValues();
  const entetes = valeurs.shift().map(String);
  const articles = valeurs
    .filter(l => l[entetes.indexOf('ID article')])
    .map(l => {
      const o = {};
      COLONNES_EXPOSEES.forEach(c => {
        const i = entetes.indexOf(c);
        const v = i >= 0 ? l[i] : '';
        o[c] = v instanceof Date ? v.toISOString() : v;
      });
      return o;
    });
  return reponse_({ ok: true, articles: articles, maj: new Date().toISOString() });
}

function doPost(e) {
  const verrou = LockService.getScriptLock();
  verrou.waitLock(10000);
  try {
    let corps = {};
    try { corps = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
    catch (err) { return reponse_({ ok: false, erreur: 'Requête illisible' }); }

    const id = String(corps.id || '').trim();
    const statut = String(corps.statut || '').trim();
    const par = String(corps.par || '').trim().slice(0, 40);
    if (!id) return reponse_({ ok: false, erreur: 'ID article manquant' });
    if (STATUTS_AUTORISES.indexOf(statut) < 0) return reponse_({ ok: false, erreur: 'Statut non autorisé : ' + statut });

    const sh = SpreadsheetApp.getActive().getSheetByName(ONGLET_ARTICLES);
    const valeurs = sh.getDataRange().getValues();
    const entetes = valeurs[0].map(String);
    const cId = entetes.indexOf('ID article');
    const cStatut = entetes.indexOf('Statut');
    const cRelu = entetes.indexOf('Relu par');
    if (cId < 0 || cStatut < 0) return reponse_({ ok: false, erreur: 'Colonnes « ID article » / « Statut » introuvables' });

    for (let r = 1; r < valeurs.length; r++) {
      if (String(valeurs[r][cId]).trim() !== id) continue;
      sh.getRange(r + 1, cStatut + 1).setValue(statut);
      if (cRelu >= 0) {
        const quand = Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');
        sh.getRange(r + 1, cRelu + 1).setValue((par ? par + ' · ' : '') + quand);
      }
      return reponse_({ ok: true, id: id, statut: statut });
    }
    return reponse_({ ok: false, erreur: 'Article introuvable (supprimé après 7 jours ?)' });
  } finally {
    verrou.releaseLock();
  }
}

function reponse_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}
