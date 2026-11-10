# Résultats Delaunay+

Site statique qui affiche les scores de tous les championnats, lus directement depuis le Google Sheet « SCORES DE TOUS LES MATCHS ».

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de la page |
| `style.css` | Charte Delaunay+ (noir / jaune #ffde00 / blanc) |
| `app.js` | Lecture du Sheet, filtres, affichage |
| `config.js` | **Seul fichier à modifier** : ID du Sheet, onglets, rafraîchissement, URL du Blog |
| `apps-script/Blog.gs` | Passerelle à coller dans le Sheet des articles (lecture + boutons du Blog) |

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

## 3. Mise en ligne sur GitHub Pages

1. Dépose ces 4 fichiers à la racine du dépôt.
2. **Settings → Pages → Source : Deploy from a branch → `main` / `/ (root)`** → Save.
3. Le site est disponible après une minute à `https://<compte>.github.io/<dépôt>/`.

Le site se met à jour tout seul : à chaque visite et toutes les 5 minutes, il relit le Sheet.

## Polices

La charte utilise **Arges** (titres) et **Area** (texte). Ce sont des polices sous licence : si tu as les fichiers, place `Arges-Normal.woff2` et `Area-Normal.woff2` dans un dossier `fonts/`, ils seront utilisés automatiquement. Sinon le site utilise Antonio et Manrope (Google Fonts), visuellement proches.
