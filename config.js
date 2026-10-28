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
