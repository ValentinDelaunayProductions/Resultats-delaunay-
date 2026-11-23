# Résultats Delaunay+

Site statique qui affiche les scores de tous les championnats, lus directement depuis le Google Sheet « SCORES DE TOUS LES MATCHS ».

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `style.css` | Charte Delaunay+ (noir / jaune #ffde00 / blanc) |
| `app.js` | Lecture du Sheet, filtres, affichage |
| `config.js` | **Seul fichier à modifier** : ID du Sheet, onglets, rafraîchissement, URL du Blog, Sheet du Live |
| `apps-script/Annuaire.gs` | Passerelle protégée par mot de passe : écran de connexion + onglet Annuaire & inventaire |
| `apps-script/Blog.gs` | Passerelle à coller dans le Sheet des articles (lecture + boutons du Blog) |
| `productions.html`, `productions.css`, `productions.js` | Centre de suivi **Delaunay Productions** (fond blanc), ouvert par le bouton ⇄ en haut à droite |
| `apps-script/BlogProductions.gs` | Passerelle à coller dans le Sheet des articles Delaunay Productions |
| `n8n/Delaunay_Productions_A_Collecte.json`, `n8n/Delaunay_Productions_B_Redaction.json` | Workflows n8n du blog Delaunay Productions |

## 1. Rendre le Sheet lisible par le site

Le site lit chaque onglet du Sheet au format CSV. Il faut que le Sheet soit consultable sans connexion :

**Partager → Accès général → « Tous les utilisateurs disposant du lien » → Lecteur.**

Tant que ce n'est pas fait, le site affiche des données d'exemple avec un bandeau jaune.

> Tout le contenu du Sheet (y compris les colonnes `error` et `details`) devient lisible par quiconque a le lien. Si tu veux éviter ça, crée un Sheet dédié qui ne contient que les résultats (via `IMPORTRANGE` ou n8n) et mets son ID dans `config.js`.

## 2. Format attendu de chaque onglet

Une ligne d'en-tête avec ces colonnes (ordre libre, accents et majuscules ignorés) :

`DATE` · `CHAMPIONNAT` · `POULE` · `JOURNÉE` · `DOMICILE` · `SCORE` · `EXTÉRIEUR` · `STATUT` · `id match`

- `DATE` au format `JJ/MM/AAAA` (peut être vide).
- `CHAMPIONNAT` : nom propre (« Régional 1 », « National 2 »…) ; `POULE` : `A`, `B`… ou `Unique`. L'ancien format `LIGUE` (« RÉGIONAL 1 - GROUPE A ») est toujours compris : la poule est extraite du nom.
- `SCORE` au format `1 - 0` ; vide pour un exempt ou un forfait.
- `STATUT` : `Terminé`, `Exempt` (club sans adversaire, l'autre équipe s'appelle `EXEMPT`) ou `Forfait général : CLUB`.
- `id match` sert d'ancre : `…/#m-20260905_BAYEUXFC_STADESOTTEVILLECC_FOOT` pointe vers le match.

### Ordre et regroupement des matchs

- Tout est trié **du match le plus futur au plus ancien** ; les matchs sans date (« À fixer ») apparaissent en tête.
- Chaque championnat est découpé par poule, puis par journée.
- Si la colonne `JOURNÉE` est remplie, les matchs sont regroupés par journée.
- Si elle est vide (ou ne contient pas de numéro, ex. « - »), le site **numérote les journées lui-même** à partir de `journeeRef` dans `config.js` (week-end du 17-18 octobre 2026 = J7), puis chaque week-end joué (vendredi → lundi) ou milieu de semaine joué = journée suivante. Les trêves ne créent pas de journée vide.
- Les matchs datés avant `debutSaison` (22 août 2026) sont considérés comme l'ancienne saison et masqués.

Pour ajouter un sport, ajoute une ligne dans `config.js` avec le nom exact de l'onglet.

## Section « Matchs Delaunay+ »

Le bouton **Score de Matchs Delaunay+** (premier onglet, affiché par défaut) affiche l'onglet **scores** du Sheet *MATCHS D+*, rempli par le workflow n8n « Associer scores Delaunay+ ».

- Colonnes lues : `DATE`, `SPORT`, `CHAMPIONNAT`, `POULE`, `JOURNÉE`, `MATCH`, `SCORE`, `CONFIANCE`, `MATCH SCORE`, `CORRESPONDANCE`, `VIGILANCE`, `LIEN`, `ID`, `ID SCORE`.
- `VIGILANCE` : écarts relevés par n8n entre Delaunay+ et la fédération (championnat, poule, masculin/féminin, nom d'équipe à ajouter dans CLUBS DIFFUSÉS). Affichés en orange sous le match ; ces matchs comptent dans le filtre « À vérifier ».
- Couleur du score selon la confiance : **vert ≥ 85 %**, **orange 60–84 %**, **rouge < 60 %**. Sous chaque match douteux, le site affiche le match des fédérations avec lequel il a été rapproché.
- Filtre « À vérifier » pour ne voir que les cas < 85 %, les plus douteux en premier.
- Si la journée manque (ex. National), elle est reprise de la journée calculée dans « Tous les scores ».
- Le Sheet *MATCHS D+* doit être partagé en « Tous les utilisateurs disposant du lien » → Lecteur. L'ID et l'onglet se règlent dans `config.js` (`delaunayPlus`).

## Sections « Match à programmer » et « Rugby »

Ces deux boutons (liens directs : `…/#a-programmer` et `…/#rugby`) lisent l'onglet **MATCH A PROGRAMMER** du Sheet *MATCHS à venir D+*. Le workflow n8n « Calendrier matchs à programmer » le remplit à chaque lancement : il croise le calendrier fédéral des matchs diffusés par Delaunay+ avec les matchs déjà programmés sur delaunayplus.com.

- Colonnes lues : `DATE`, `HEURE`, `SPORT`, `GENRE`, `CHAMPIONNAT`, `POULE`, `DOMICILE`, `EXTÉRIEUR`, `STATUT`, `SUIVI` (`AUTO` ou `MANUEL`), `PROGRAMMÉ` (`OUI`, `À VÉRIFIER`, `NON` ou `SANS OBJET` pour un exempt / forfait / match annulé), `CONFIANCE`, `MATCH D+`, `VIGILANCE`, `LIEN D+`, `ID_MATCH`, `MAJ`.
- **Match à programmer** : football et basket suivis automatiquement. Deux cases à cocher, *À programmer* et *Déjà programmés*, cochées toutes les deux par défaut. Un bandeau rouge liste les matchs du **week-end qui arrive** qui ne sont pas encore programmés : du lundi au vendredi, c'est le samedi suivant ; le samedi et le dimanche, c'est le week-end en cours. Les matchs passés disparaissent d'eux-mêmes.
- **Rugby** : simple rappel, car la liste des matchs à diffuser arrive chaque semaine. Le site montre les matchs de rugby programmés sur D+ et les matchs de Normandie du calendrier fédéral, sans alerte rouge.
- Les clubs suivis se règlent dans l'onglet **CLUBS DIFFUSÉS** du Sheet *LIENS POUR AUTOMATISATION D+* (une ligne par équipe : sport, championnat, poule, genre, nom fédération, noms Delaunay+ séparés par `|`, actif). Plus besoin de toucher au workflow.
- Le Sheet *MATCHS à venir D+* doit être partagé en « Tous les utilisateurs disposant du lien » → Lecteur. L'ID et l'onglet se règlent dans `config.js` (`aProgrammer`).

## Section « Live »

Le bouton **Live** (lien direct : `…/#live`) affiche le fil des matchs suivis en direct. Les données viennent de Highlightly (plan gratuit) via deux workflows n8n, et sont écrites dans le Sheet *API-Sports — clubs par sport* (ID dans `config.js`, `live.sheetId`).

- Onglets lus : **Live (réglages)** (match suivi, Actif, score, minute, état), **Live** (un événement par ligne : minute, type, équipe, texte, statut) et **Matchs** (championnat, journée, date).
- Pour suivre un match : copier son `ID match` depuis l'onglet *Matchs* dans *Live (réglages)*, mettre **Actif = Oui** et activer le workflow n8n « Highlightly — Live texte d'un match ». Il interroge l'API toutes les 2 minutes et remet Actif à Non à la fin du match.
- Sur le site : tableau d'affichage (score, minute, état), puis le fil du plus récent au plus ancien. Les buts annulés par la VAR sont barrés ; les événements retirés par la source sont masqués.
- Quand l'onglet Live est ouvert, le fil se recharge toutes les 30 secondes (`live.refreshSeconds`).
- Le Sheet doit être partagé en « Tous les utilisateurs disposant du lien » → Lecteur. Ne jamais y écrire la clé API (elle reste dans n8n).
- Plan gratuit Highlightly : 100 requêtes par jour, soit un seul live complet (≈ 60 requêtes) par jour. Vérifier leurs conditions avant d'afficher ces données au public.

## Section « Flux vidéo »

Le bouton **Flux vidéo** (lien direct : `…/#flux`) montre, match par match, si le flux envoyé par le club arrive bien sur nos chaînes YouTube. Les données viennent de l'onglet **FLUX LIVE** du Sheet *MATCHS à venir D+*, réécrit toutes les 5 minutes par le workflow n8n **« Flux YouTube — suivi des lives »** (`n8n/Flux-YouTube-suivi-des-lives.json`) : vendredi 18 h – 22 h, samedi et dimanche 13 h – 22 h.

| Couleur | États | Signification |
| --- | --- | --- |
| 🔴 rouge | Aucun flux · Flux coupé · Jamais reçu | rien n'arrive alors que le match commence dans moins de 15 min ou a commencé ; le flux est tombé pendant le match ; match fini sans aucun flux |
| 🟠 orange | Qualité dégradée · Live pas lancé | YouTube juge le flux mauvais (débit, résolution…) ; le flux arrive mais aucun live YouTube n'est en cours sur la clé, donc rien n'est visible en ligne |
| 🟢 vert | Flux reçu | flux reçu, qualité bonne ou correcte, live en cours |
| 🟡 jaune | En attente · Hors planning | match pas encore commencé ; flux reçu sur une clé sans match aujourd'hui (test, match non programmé) |
| ⚪ gris | Terminé · Clé non associée | match fini ; aucune clé de diffusion trouvée pour l'équipe |

- Chaque carte montre la chaîne, la clé (son nom, jamais la clé secrète), la qualité, l'état du live YouTube, les spectateurs, l'heure du premier et du dernier signal et le nombre de coupures, avec les liens YouTube, YouTube Studio et la page Delaunay+.
- Le compteur du bouton passe au rouge s'il y a des matchs sans flux. Un bandeau rouge s'affiche si une chaîne ne répond plus (identifiant à reconnecter dans n8n) ou si la dernière vérification date de plus de 12 minutes pendant un créneau.
- Quand la section est ouverte, la page relit l'onglet toutes les minutes (`flux.refreshSeconds`).

### Associer une équipe à sa clé

L'onglet **CLÉS DE DIFFUSION** est rempli tout seul par n8n : une ligne par clé trouvée sur les 7 chaînes. n8n remplit **EQUIPES** avec le nom tiré de la clé (`RTMP Stream | Evreux Netreville BB | API` → `Evreux Netreville BB`), qui correspond déjà aux noms de « à venir D+ ». Si une équipe reste « Clé non associée », corrige **EQUIPES** pour qu'il soit **exactement comme dans la colonne DOMICILE** (plusieurs noms séparés par `|`, ex. `SM Caen 2|SM Caen B`). `ACTIF = NON` ignore une clé. Si une équipe a plusieurs clés, celle qui reçoit un flux est retenue. Les matchs de **Ligue 3** ne sont pas suivis (pas de clé club) : liste `CHAMPIONNATS_IGNORES` en haut du nœud « Analyser les flux ». Le rapprochement se fait d'abord sur l'équipe à domicile, puis sur l'équipe à l'extérieur, et seulement parmi les chaînes du même sport.

### Installer le workflow (une fois)

1. Google Cloud : dans le projet qui sert déjà à n8n, activer **YouTube Data API v3**.
2. n8n : **Import from file** → `Flux-YouTube-suivi-des-lives.json`.
3. Créer 7 identifiants **Google OAuth2 API**, un par chaîne sport (la chaîne principale *Youtube Delaunay+* n'a pas le direct activé et n'est pas suivie) (même Client ID / Secret que d'habitude, scope `https://www.googleapis.com/auth/youtube.readonly`). À la connexion, Google demande de choisir le compte : choisir **la chaîne** concernée. Les nommer « YouTube — D+ Football Normandie », etc.
4. Dans chaque groupe de 3 nœuds `YT clés / YT en direct / YT à venir — <chaîne>`, choisir l'identifiant de cette chaîne. Pour `Spectateurs`, n'importe lequel. Pour les nœuds Google Sheets, l'identifiant Sheets habituel.
5. Lancer **Test manuel**, compléter EQUIPES dans CLÉS DE DIFFUSION, puis activer le workflow.
6. Optionnel : activer le nœud **Mail d'alerte** (Gmail) avec la bonne adresse ; il n'envoie un mail que quand un match change d'état.

**Quota YouTube :** environ 25 unités par passage (clés sur plusieurs pages pour le foot et le basket, 14 appels pour les lives, 1 pour les spectateurs), soit environ 2 700 unités un samedi ou un dimanche et 6 700 sur un week-end, pour 10 000 par jour. Le quota repart à zéro à 9 h (heure de Paris).

**Sécurité :** le workflow ne demande jamais la partie `cdn` de l'API : la clé de stream secrète n'est ni lue ni écrite dans le Sheet, qui est public par lien.

## Section « Blog »

Le bouton **Blog** (lien direct : `…/#blog`) affiche les articles rédigés par le workflow n8n « B. Sélection & rédaction » dans l'onglet **Articles** du Sheet *Automatisation Article blog Delaunay+*.

- Articles rangés par jour, **du plus récent au plus ancien**. Chaque carte montre le **sport** (pastille de couleur), le club, l'heure, le titre et le chapô ; « Lire l'article » déplie le texte complet et les liens vers les sources.
- Filtres : un onglet par sport (*Handball féminin* est rangé dans *Handball*, etc.), un filtre par club, et *Tous / À trier / Validés / Rejetés*.
- Trois boutons par article, enregistrés directement dans la colonne `Statut` du Sheet :
  - **vert « Publier »** → `Validé` : publiable sur Delaunay+ ;
  - **orange « À revoir »** → `À revoir` : on ne sait pas encore ;
  - **rouge « Rejeter »** → `Rejeté` : on ne publie pas.
  
  Le prénom de la personne (demandé une fois, mémorisé dans le navigateur) et l'heure sont notés dans `Relu par`.
- **Copier le texte** met titre, chapô, corps et sources dans le presse-papiers, prêts à coller sur Delaunay+.
- Le workflow n8n supprime du Sheet les articles de plus de 7 jours : ils disparaissent aussi du site.

### Comment les articles sont choisis

Un encadré lumineux **« Comment ça fonctionne »**, en haut du Blog, l'explique à l'équipe. En résumé :

1. **Collecte (toutes les heures, 7 h – 23 h)** : n8n lit les flux d'une cinquantaine de médias, plus des recherches par sport et par niveau (onglet *Recherches*). Les clubs sont interrogés à tour de rôle (un sixième par heure, les clubs phares à chaque fois) pour que les petits ne soient pas noyés. Seules les actus de moins de 24 h sont gardées.
2. **Tri** : une actu n'est retenue que si elle cite un des clubs normands suivis (onglet *Clubs*, près de 90 clubs du R1 à la Ligue 1). Agrégateurs, pronostics, feuilles de match, catégories jeunes et copies d'un même journal (ex. maville.com = Ouest-France) sont écartés (onglet *Filtres*).
3. **Croisement** : les actus sur le même événement sont regroupées. Une seule source suffit si c'est un grand média (fiabilité 4 ou 5 dans l'onglet Sources : Ouest-France, Paris-Normandie, actu.fr…), ou si le club est de priorité 1 ou 2 ; l'article affiche alors l'alerte **⚠ Source unique** sur le Blog. Sinon il faut 2 médias différents. Un contrôle automatique sépare les actus que l'IA aurait regroupées à tort (aucun mot important en commun). Un sujet déjà traité n'est jamais réécrit.
4. **Rédaction** : jusqu'à 10 événements par passage, rédigés par l'IA à partir des seuls faits des sources, citées en bas de l'article. Score = `3 × médias (max 3) + fiabilité + 2 × importance du club + 2 si moins de 6 h + 4 si le club n'a pas eu d'article depuis 48 h`. Chaque article déjà choisi pour un club retire 8 points à ses autres sujets, pour varier clubs et sports.
5. **Décision** : vert, orange ou rouge sur le Blog. Rien n'est publié automatiquement ; les articles disparaissent après 7 jours.

Les réglages (médias, clubs, recherches, filtres, seuils) se font dans le Sheet *Automatisation Article blog Delaunay+*, onglets **Sources**, **Clubs**, **Recherches**, **Filtres** et **Paramètres**.

### Brancher le Blog au Sheet (une seule fois)

Le site ne peut pas écrire dans un Google Sheet tout seul : une petite passerelle **Apps Script** s'en charge. Le Sheet des articles n'a **pas** besoin d'être partagé publiquement.

1. Ouvre le Sheet *Automatisation Article blog Delaunay+* → **Extensions → Apps Script**.
2. Remplace le contenu de `Code.gs` par celui de [`apps-script/Blog.gs`](apps-script/Blog.gs), puis enregistre.
3. **Déployer → Nouveau déploiement** → type **Application web** → *Exécuter en tant que* : **Moi** → *Qui a accès* : **Tout le monde** → Déployer, puis autorise l'accès à ton compte.
4. Copie l'URL qui se termine par `/exec` et colle-la dans `config.js` → `blog.apiUrl`.
5. Pousse `config.js` sur GitHub : le Blog affiche les vrais articles.

Tant que `blog.apiUrl` est vide, le Blog affiche des articles d'exemple et les boutons ne modifient rien.

> Si tu modifies `Blog.gs` plus tard : **Déployer → Gérer les déploiements → ✏️ → Version : Nouvelle version**, sinon l'ancienne version reste en ligne (l'URL ne change pas).
>
> Sécurité : l'URL `/exec` est visible dans `config.js` (dépôt public). Quelqu'un qui la trouverait pourrait lire les articles et changer un statut, rien d'autre : le script n'accepte que les statuts `À relire`, `Validé`, `À revoir`, `Rejeté` et `Publié`, et ne touche à aucune autre colonne.

## Centre de suivi Delaunay Productions

Le bouton **⇄ Delaunay Productions** en haut à droite du centre de suivi Delaunay+ ouvre `productions.html`, une page séparée aux couleurs de delaunayproductions.fr (fond blanc, texte noir). Le bouton **⇄ Delaunay+** de cette page ramène au centre de suivi Delaunay+. Les deux pages sont indépendantes : seul le mot de passe est partagé (une connexion sur l'une vaut pour l'autre sur le même appareil).

Pour l'instant la page contient l'onglet **Blog** : les articles rédigés par les workflows n8n à partir de la presse spécialisée (drone, audiovisuel, événementiel, médias) et de la presse normande. Mêmes boutons que le Blog Delaunay+ (Publier / À revoir / Rejeter, Copier le texte), avec en plus le pôle, le thème, un badge Normandie, la meta description et les mots-clés SEO.

### Les deux workflows n8n

| Workflow | Quand | Rôle |
| --- | --- | --- |
| `n8n/Delaunay_Productions_A_Collecte.json` | toutes les 3 h, 7 h 20 → 22 h 20 | Lit les flux (onglet Sources) et les recherches par thème (onglet Thèmes), garde les actus de moins de 48 h qui correspondent à un thème, écarte les promos et drones militaires (onglet Filtres) et écrit dans **Actus brutes** |
| `n8n/Delaunay_Productions_B_Redaction.json` | toutes les 3 h, 7 h 40 → 22 h 40 | Regroupe les actus par sujet (Ollama), choisit les 3 meilleurs sujets, lit les articles sources et rédige l'article, la meta description et les mots-clés, puis écrit dans **Articles** au statut « À relire » |

Import : dans n8n, **Workflows → Import from File**, puis vérifie les identifiants Google Sheets et Ollama sur chaque nœud. Les workflows arrivent désactivés : lance **Test manuel** sur A puis sur B, regarde le Sheet, puis active-les.

### Le Sheet « Automatisation Article blog Delaunay Productions »

| Onglet | À quoi il sert |
| --- | --- |
| Paramètres | Tous les réglages (fenêtre de collecte, nombre d'articles, longueur minimale, prompt de l'IA, présentation de l'agence utilisée en fin d'article…) |
| Sources | Médias suivis. Un flux natif est lu quand **Statut flux = OK** ; sinon la recherche Google News (mode test) prend le relais |
| Thèmes | Sujets suivis : mots-clés de détection, mots exclus, « Normandie obligatoire », priorité, angle éditorial donné à l'IA |
| Filtres | Sites bloqués, reprises (maville = Ouest-France), URL et titres ignorés |
| Actus brutes / Articles | Remplis par n8n |
| Photos | Visuels autorisés, par pôle ou par thème (Autorisation obtenue = Oui) |

### Brancher la page au Sheet (une seule fois)

1. Ouvre le Sheet *Automatisation Article blog Delaunay Productions* → **Extensions → Apps Script**.
2. Remplace le contenu de `Code.gs` par celui de [`apps-script/BlogProductions.gs`](apps-script/BlogProductions.gs), puis enregistre.
3. Optionnel : ⚙ **Paramètres du projet → Propriétés du script** → `MOT_DE_PASSE` = le mot de passe du centre de suivi.
4. **Déployer → Nouveau déploiement** → **Application web** → *Exécuter en tant que* : **Moi** → *Qui a accès* : **Tout le monde**.
5. Colle l'URL `/exec` dans `config.js` → `productions.blog.apiUrl` et pousse sur GitHub.

Tant que `productions.blog.apiUrl` est vide, la page affiche des articles d'exemple.

## 3. Mise en ligne sur GitHub Pages

1. Dépose ces 4 fichiers à la racine du dépôt.
2. **Settings → Pages → Source : Deploy from a branch → `main` / `/ (root)`** → Save.
3. Le site est disponible après une minute à `https://<compte>.github.io/<dépôt>/`.

Le site se met à jour tout seul : à chaque visite et toutes les 5 minutes, il relit le Sheet.

## Après une modification de app.js, style.css ou config.js

GitHub Pages garde ces fichiers en cache une dizaine de minutes. Pour que tout le monde reçoive la nouvelle version tout de suite, change le numéro `?v=…` des trois liens en bas et en haut de `index.html` (par exemple la date du jour).

## Polices

La charte utilise **Arges** (titres) et **Area** (texte). Ce sont des polices sous licence : si tu as les fichiers, place `Arges-Normal.woff2` et `Area-Normal.woff2` dans un dossier `fonts/`, ils seront utilisés automatiquement. Sinon le site utilise Antonio et Manrope (Google Fonts), visuellement proches.


## Mot de passe & Annuaire

Le dépôt est **public** et les Sheets de scores sont partagés par lien : un mot de passe vérifié par le site
lui-même ne protégerait rien. Le mot de passe est donc vérifié **chez Google**, par la passerelle
[`apps-script/Annuaire.gs`](apps-script/Annuaire.gs). C'est elle seule qui lit les 4 Sheets
« DelaunayPlus_Annuaire_et_Inventaire_* » (Football, Basketball, Handball, Rugby), qui doivent rester **privés**
(Partager → Accès général : *Limité*).

**Installation (une fois) :**
1. [script.google.com](https://script.google.com) → **Nouveau projet** → nommer « Annuaire Delaunay+ » → coller `Annuaire.gs` → enregistrer.
2. Exécuter `testLecture` (autoriser l'accès) → *Journaux* : le nombre de clubs lus doit s'afficher.
3. ⚙ **Paramètres du projet → Propriétés du script → Ajouter** : `MOT_DE_PASSE` = le mot de passe de l'équipe.
4. **Déployer → Nouveau déploiement → Application web** → *Exécuter en tant que* : **Moi** → *Qui a accès* : **Tout le monde**.
5. Copier l'URL `…/exec` dans `config.js` → `annuaire.apiUrl`. Dès ce moment, le site demande le mot de passe.

**Changer le mot de passe :** modifier `MOT_DE_PASSE` dans les propriétés du script (effet immédiat, pas besoin de redéployer).
Tout le monde est déconnecté au chargement suivant.

**Boutons du Blog :** ajouter la même propriété `MOT_DE_PASSE` dans le projet Apps Script du Blog : seuls les connectés pourront valider ou rejeter.

**Ce qui reste public :** les scores, matchs à programmer, live et articles (Sheets partagés par lien). Ne mettre
**aucune donnée confidentielle** dans ces Sheets ni dans ce dépôt.

**Lecture des Sheets :** chaque onglet est lu à partir de sa ligne « Nom du Club ». Le bandeau « DELAUNAY+ … (R1 - Groupe B) »
donne le championnat. Les colonnes « Mail X » / « Tel X » / « X (Nom) » / « X - Nom & Prénom » deviennent des contacts.
Les autres colonnes s'affichent en infos. L'onglet « Inventaire SIM » complète SIM et PUK par référence de caméra.
Les listes de diffusion et la « FEUILLE LIGUE » sont ignorées. Si tu modifies `Annuaire.gs` : **Gérer les déploiements → ✏️ → Nouvelle version**.
