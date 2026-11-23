// ============================================================
//  CONFIGURATION — la seule partie à modifier
// ============================================================
window.DELAUNAY_CONFIG = {
  // ID du Google Sheet (la partie entre /d/ et /edit dans l'URL)
  sheetId: "12NMoDXFc3wQxWIxjrvR5aat5yn2VFw8i1JGujQJ7nu8",

  // Un onglet du Sheet = un sport. "tab" doit correspondre EXACTEMENT au nom de l'onglet.
  sports: [
    { key: "football",        label: "Football",        tab: "FOOTBALL" },
    { key: "basketball",      label: "Basketball",      tab: "BASKETBALL" },
    { key: "handball",        label: "Handball",        tab: "HANDBALL" },
    { key: "rugby",           label: "Rugby",           tab: "RUGBY" },
    { key: "tennis-de-table", label: "Tennis de table", tab: "TENNIS DE TABLE" }
  ],

  // Section « Matchs Delaunay+ » : onglet « scores » du Sheet MATCHS D+ (rempli par n8n)
  delaunayPlus: {
    sheetId: "1V0hQIpJj14_f5STTaLu7B3Zmu7Ql6N7jq1wuSwILSK8",
    gid: "1700641691"          // identifiant de l'onglet « scores » (gid=... dans l'URL)
  },

  // Sections « Matchs à venir » et « Rugby » : onglet « MATCH A PROGRAMMER » du Sheet MATCHS à venir D+
  // (rempli par le workflow n8n « Calendrier matchs à programmer »)
  aProgrammer: {
    sheetId: "1V0hQIpJj14_f5STTaLu7B3Zmu7Ql6N7jq1wuSwILSK8",
    gid: "349643127"           // identifiant de l'onglet « MATCH A PROGRAMMER »
  },

  // Section « Blog » : articles rédigés par le workflow n8n « B. Sélection & rédaction »
  // (onglet « Articles » du Sheet « Automatisation Article blog Delaunay+ »).
  // apiUrl = URL de l'application web Apps Script (…/exec), voir apps-script/Blog.gs et le README.
  // Vide = le site affiche des articles d'exemple.
  blog: {
    apiUrl: "https://script.google.com/macros/s/AKfycbwxU-IMlXO-JiMfXi2DdoAKnq1DkEsNYVpLshRtTIW0NEcMl6ZGLDlkc0hfc0CSNLnA/exec"
  },

  // Centre de suivi Delaunay Productions (productions.html, bouton ⇄ en haut à droite) : indépendant de Delaunay+.
  // Section « Blog » : articles rédigés par le workflow n8n « Delaunay Productions | B. Sélection & rédaction »
  // (onglet « Articles » du Sheet « Automatisation Article blog Delaunay Productions »).
  // apiUrl = URL de l'application web Apps Script (…/exec), voir apps-script/BlogProductions.gs et le README.
  // Vide = la page affiche des articles d'exemple. Le mot de passe est le même que pour Delaunay+.
  productions: {
    blog: {
      apiUrl: ""
    },
    refreshMinutes: 5
  },

  // Section « Live » : Sheet « API-Sports — clubs par sport » rempli par les workflows n8n Highlightly
  // (onglets « Live (réglages) », « Live » et « Matchs »). Le Sheet doit être partagé en lecture avec le lien.
  live: {
    sheetId: "1MBFi6e_heMMzPC55WAxuMXtJiGJ6yc9q7WSNq17ZTq8",
    refreshSeconds: 30         // rafraîchissement du fil quand l'onglet Live est ouvert
  },

  // Section « Flux vidéo » : onglet « FLUX LIVE » du Sheet MATCHS à venir D+, rempli toutes les 5 min
  // par le workflow n8n « Flux YouTube — suivi des lives » (vendredi 18h-22h, samedi et dimanche 13h-22h).
  flux: {
    sheetId: "1V0hQIpJj14_f5STTaLu7B3Zmu7Ql6N7jq1wuSwILSK8",
    gid: "2031239987",         // identifiant de l'onglet « FLUX LIVE »
    refreshSeconds: 60         // relecture de l'onglet quand la section Flux vidéo est ouverte
  },

  // Mot de passe + section « Annuaire & inventaire » : passerelle Apps Script apps-script/Annuaire.gs.
  // Elle lit les 4 Sheets « DelaunayPlus_Annuaire_et_Inventaire_* » (qui restent PRIVÉS) et vérifie
  // le mot de passe chez Google. apiUrl rempli = le site demande le mot de passe à l'ouverture.
  // Vide = pas d'écran de connexion, et l'Annuaire affiche la marche à suivre. Voir le README.
  annuaire: {
    apiUrl: "https://script.google.com/macros/s/AKfycbw3BD3RwRhjaM0wWZqB9lm7b9R4mcKExu962kwr8gt6kaKhgW65z8oNGxygujZJ1YR5pw/exec"
  },

  // Début de la saison en cours : les matchs datés avant sont masqués (ancienne saison).
  debutSaison: "2026-08-22",

  // Championnats sans colonne JOURNÉE : un week-end de référence et son numéro de journée.
  // Les autres journées sont numérotées à partir de là, un week-end joué = une journée.
  journeeRef: { date: "2026-10-17", numero: 7 },

  // Rafraîchissement automatique (en minutes). 0 = désactivé.
  refreshMinutes: 5,

  // true = affiche des données d'exemple si le Sheet n'est pas accessible
  demoFallback: true
};
