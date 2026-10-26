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

  // Pour les championnats sans colonne JOURNÉE : week-end de la journée 1 (samedi, AAAA-MM-JJ).
  // Les journées suivantes sont numérotées automatiquement, un week-end joué = une journée.
  journee1: "2026-08-22",

  // Rafraîchissement automatique (en minutes). 0 = désactivé.
  refreshMinutes: 5,

  // true = affiche des données d'exemple si le Sheet n'est pas accessible
  demoFallback: true
};
