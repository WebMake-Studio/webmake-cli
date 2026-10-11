# WebMake CLI : documentation technique et fonctionnelle

> **Version 2.0.0** · Document destiné au client · © 2026 FarTekTV · Code source © 2026 Rafael ISTE · Licence MIT

---

## Sommaire

1. [Présentation](#1-présentation)
2. [Périmètre fonctionnel](#2-périmètre-fonctionnel)
3. [Installation et prise en main](#3-installation-et-prise-en-main)
4. [Architecture technique](#4-architecture-technique)
5. [Fonctionnement détaillé](#5-fonctionnement-détaillé)
6. [Configuration](#6-configuration)
7. [Cas d'usage](#7-cas-dusage)
8. [Sécurité](#8-sécurité)
9. [Qualité et tests](#9-qualité-et-tests)
10. [Dépendances et compatibilité](#10-dépendances-et-compatibilité)
11. [Recommandations](#11-recommandations)
12. [Points d'attention et limites connues](#12-points-dattention-et-limites-connues)
13. [Dépannage](#13-dépannage)
14. [Maintenance et évolutions](#14-maintenance-et-évolutions)

---

## 1. Présentation

**WebMake CLI** est un outil en ligne de commande (Node.js) qui lance un serveur de développement pour sites statiques et applications monopage (SPA). La commande principale est :

```bash
webmake dev
```

Il se distingue par :

- **zéro dépendance** : aucun paquet tiers n'est installé avec lui ;
- la **détection automatique des fichiers de redirection**, quel que soit leur nom ou leur plateforme d'origine (`_redirects`, `netlify.toml`, `vercel.json`, `firebase.json`, `staticwebapp.config.json`, `.htaccess`), appliqués comme le ferait l'hébergeur ;
- la gestion complète des **pages 404** ;
- le **rechargement automatique** du navigateur ;
- une interface terminal en anglais, aux couleurs de WebMake Studio (indigo, lavande, fenêtres arrondies avec pastilles rouge / jaune / verte).

## 2. Périmètre fonctionnel

### 2.1 Commandes

| Commande | Rôle |
|---|---|
| `webmake dev [dossier]` | Lance le serveur (alias `serve`, `start`). |
| `webmake build [dossier]` | Copie le site vers le dossier de sortie et exporte des `_redirects` / `_headers` normalisés. |
| `webmake routes [dossier]` | Affiche toutes les règles détectées (option `--json`). |
| `webmake init` | Crée un fichier `webmake.dev` commenté. |
| `webmake help [commande]` | Aide. |

### 2.2 Fonctions du serveur

| Fonction | Description |
|---|---|
| Fichiers statiques | Types MIME corrects, requêtes `Range` (lecture vidéo / audio), `HEAD`, `OPTIONS`. |
| URL propres | `/about` sert `about.html` ; `/dossier` redirige vers `/dossier/`. |
| Redirections | 301, 302, 303, 307, 308, avec conservation de la query string. |
| Réécritures | Statut 200 : l'URL ne change pas. |
| Proxy | Une règle `200` vers une URL `http(s)://` transfère la requête vers ce serveur (erreur 502 lisible si injoignable). |
| En-têtes | `_headers`, `netlify.toml`, `vercel.json`, `firebase.json`, `.htaccess`, `webmake.dev`. |
| Pages 404 | Voir §5.3. |
| Mode SPA | Voir §5.4. |
| Rechargement automatique | Événements serveur (SSE) ; le CSS est remplacé à chaud sans rechargement. |
| Listing de dossier | Page stylée si le dossier n'a pas d'`index.html`. |
| Pages internes | `/__webmake/routes` : vue des règles détectées. |
| Raccourcis clavier | `o`, `r`, `u`, `c`, `q`. |

### 2.3 Exemple de `webmake.dev`

```javascript
module.exports = {
    dir: './',
    out: './',
    port: 8888,
    host: '192.168.1.24',
    watch: '.',
    poll: false,
    spa: true,
    open: true,
};
```

## 3. Installation et prise en main

**Prérequis** : Node.js 18.17 ou plus récent (`node -v`).

```bash
npm install -g webmake-cli     # installation globale : la commande "webmake" est immédiatement disponible
webmake dev                    # dans le dossier du site
```

Aucun `npm link` n'est nécessaire. En installation **locale** (`npm install webmake-cli` dans un projet), la commande se lance avec `npx webmake dev` ou via un script `package.json` : c'est le fonctionnement standard de npm, une installation locale n'ajoute pas la commande au PATH global.

> **Publication npm** : le nom `webmake-cli` est déjà publié en version 1.0.0 par le compte `fartek.tv`. Cette version 2.0.0 peut être publiée par le même compte avec `npm publish` (le script `prepublishOnly` lance les tests avant publication).

## 4. Architecture technique

### 4.1 Vue d'ensemble

```text
                 ┌────────────┐
 webmake dev ──▶ │   cli.js   │  analyse des arguments, aide, codes de sortie
                 └─────┬──────┘
                       ▼
                 ┌────────────┐      ┌──────────────┐
                 │ commands/  │ ───▶ │  config.js   │  defaults < webmake.dev < flags
                 └─────┬──────┘      └──────────────┘
                       ▼
   ┌───────────┐  ┌─────────────┐  ┌──────────────┐
   │ detect.js │─▶│  parsers/*  │  │  watcher.js  │──┐ changements de fichiers
   └─────┬─────┘  └─────────────┘  └──────────────┘  │
         ▼ RuleSet                                     ▼
   ┌───────────┐   résolution   ┌──────────────┐  événements SSE
   │ router.js │◀──────────────▶│  server.js   │────────────▶ navigateurs
   └───────────┘                └──────┬───────┘
                                       ▼
                               pages.js (404, listing, routes)
```

### 4.2 Modules

| Module | Responsabilité |
|---|---|
| `bin/webmake.js` | Point d'entrée ; vérifie la version de Node. |
| `src/cli.js` | Table d'options, analyse, aide, suggestions (« did you mean »), codes de sortie (0 OK, 1 erreur, 2 usage). |
| `src/config.js` | Chargement et validation de `webmake.dev` ; résolution des chemins ; avertissements d'options inconnues. |
| `src/detect.js` | Recherche des fichiers de redirection / en-têtes ; construction du `RuleSet`. |
| `src/parsers/*` | Un analyseur par format ; ne lèvent jamais d'exception : les problèmes deviennent des avertissements. |
| `src/patterns.js` | Compile les 4 syntaxes de chemins (Netlify, Vercel, Firebase, regex) vers une interface unique. |
| `src/rules.js` | Modèle `Rule` / `HeaderRule` indépendant de la plateforme. |
| `src/router.js` | Décide de la réponse : règle, fichier, repli, 404. |
| `src/server.js` | Serveur HTTP, SSE, proxy, plages d'octets. |
| `src/watcher.js` | Surveillance native (un `fs.watch` par dossier non ignoré) ou par sondage. |
| `src/pages.js` | Pages HTML intégrées (échappement systématique). |
| `src/ui.js` | Couleurs (16 / 256 / 24 bits), bannière, journal, tableaux. |
| `src/commands/` | `dev`, `build`, `routes`, `init`. |

### 4.3 Choix techniques

- **Node.js pur, zéro dépendance** : surface d'attaque minimale, installation instantanée, aucune mise à jour de dépendance à suivre.
- **Surveillance maison** : `fs.watch` récursif n'existe pas partout et surveille `node_modules` ; WebMake parcourt l'arborescence lui-même et ignore `node_modules`, `.git` et le dossier de sortie. Repli automatique vers le sondage en cas d'erreur (`ENOSPC`, `EMFILE`).
- **SSE plutôt que WebSocket** : natif dans les navigateurs, sans bibliothèque, reconnexion automatique.
- **Modèle de règle unique** : tous les formats sont convertis en `Rule`, ce qui rend le routeur indépendant des plateformes.

## 5. Fonctionnement détaillé

### 5.1 Détection des fichiers

WebMake examine : le dossier servi, le dossier courant, `public/` et `static/` du dossier courant. Noms reconnus (insensibles à la casse) :

| Type | Noms |
|---|---|
| Redirections | `_redirects`, `redirects`, `.redirects`, `_redirect`, `redirect`, `redirects.txt`, `_redirects.txt`, `.redirects.txt` |
| En-têtes | `_headers`, `headers`, `.headers`, `_header`, `headers.txt`, `_headers.txt`, `.headers.txt` |
| Autres | `netlify.toml`, `vercel.json`, `now.json`, `firebase.json`, `staticwebapp.config.json`, `.htaccess` |

Ces fichiers **ne sont jamais servis** par HTTP. Modifier l'un d'eux recharge les règles immédiatement.

### 5.2 Ordre d'évaluation

1. Règles, dans l'ordre : `webmake.dev` → `_redirects` → `netlify.toml` → `vercel.json` → `firebase.json` → `staticwebapp.config.json` → `.htaccess`. La première qui correspond l'emporte.
2. Une règle **non forcée** ne s'applique que si aucun fichier n'existe à cette URL ; une règle **forcée** (`!`, ou redirections Vercel / Firebase / Azure) s'applique toujours.
3. Fichier réel, index de dossier, URL propre.
4. Replis : `navigationFallback` (Azure), mode SPA.
5. Listing de dossier.
6. Page 404.

### 5.3 Pages 404

Ordre : règle servant une page (`/* /404.html 404`) → `notFound` / `ErrorDocument 404` / override Azure → `404.html` **le plus proche** en remontant l'arborescence → page intégrée WebMake. Le code HTTP est toujours **404**.

### 5.4 Mode SPA

Avec `spa: true`, une URL inconnue **sans extension**, demandée par un navigateur (en-tête `Accept` contenant `text/html`), reçoit `200.html` s'il existe, sinon `index.html` (ou le fichier indiqué par `spa: 'fichier.html'`). Les ressources manquantes (`/absent.js`) et les appels d'API restent en 404.

### 5.5 Réseau

Liaison **IPv4 uniquement**. Avec `0.0.0.0`, WebMake affiche l'URL `Local` (`http://localhost:PORT/`) et une URL `Network` par interface. Si le port est occupé, le suivant est utilisé (jusqu'à 30 essais) sauf `strictPort`. Si `host` n'est pas une adresse de la machine, WebMake écoute sur `0.0.0.0` et l'indique.

### 5.6 Commande `build`

Copie le dossier source vers `out` en excluant `node_modules`, les dossiers et fichiers cachés (sauf `.well-known` et `.htaccess`) et les fichiers `webmake.*`. Puis écrit un `_redirects` et un `_headers` **normalisés** (syntaxe Netlify / Cloudflare Pages) à partir de toutes les sources détectées. Les règles inexprimables dans ce format (expressions régulières `.htaccess`, motifs Vercel complexes) ne sont **pas** exportées et chacune est signalée par un avertissement.

Garde-fous : refus si `out` est le dossier source, un de ses parents, la racine du disque, le dossier personnel, ou en dehors du projet (sauf `--force`).

## 6. Configuration

Référence complète des options : voir le [README](../README.md#all-options). Règles générales :

- priorité : **valeurs par défaut < `webmake.dev` < options de ligne de commande** ;
- les chemins de `webmake.dev` sont relatifs à l'emplacement du fichier ; ceux de la ligne de commande, au dossier courant ;
- toute valeur invalide est signalée **en une seule fois** avec un code de sortie 2 ; une option inconnue donne un avertissement avec suggestion (`prot` → `port`) ;
- formats acceptés : `webmake.dev`, `webmake.dev.js`, `webmake.config.js`, `webmake.config.json` ; l'export peut être un objet ou une fonction.

## 7. Cas d'usage

| Besoin | Mise en œuvre |
|---|---|
| Développer un site statique | `webmake dev` dans le dossier. |
| Tester une SPA (React, Vue, Svelte…) construite | `webmake dev ./dist --spa`. |
| Valider ses redirections avant déploiement | `webmake routes`, puis tester les URL dans le navigateur. |
| Migrer d'un hébergeur à un autre | Conserver `vercel.json` / `.htaccess`, lancer `webmake build` : un `_redirects` équivalent est généré pour Netlify / Cloudflare Pages. |
| Tester sur téléphone | Garder `host: '0.0.0.0'`, ouvrir l'URL `Network` sur le même Wi-Fi. |
| Appeler une API sans souci de CORS | Règle `/api/* https://api.exemple.com/:splat 200`. |
| Intégration CI / scripts | `webmake routes --json`, ou l'API `startServer()`. |
| Dossier sur disque réseau / Docker / WSL | `poll: true`. |

## 8. Sécurité

| Risque | Mesure |
|---|---|
| Traversée de chemin | Normalisation, contrôle de confinement, rejet de `\` et des octets NUL ; tests dédiés. |
| Fuite de secrets | Dossiers / fichiers cachés (`.env`, `.git`) et fichiers de configuration jamais servis ni listés. |
| XSS | Tout texte issu de l'URL ou du disque est échappé dans les pages intégrées. |
| Redirection ouverte | Les valeurs capturées sont encodées et `//` en tête est neutralisé. |
| Injection d'en-têtes | Valeurs capturées encodées (CR / LF impossibles). |
| Exposition réseau | Défaut `0.0.0.0` (utile pour les tests mobiles) : **utiliser `127.0.0.1` sur un réseau non fiable**. |
| Code de configuration | `webmake.dev` est du JavaScript exécuté : ne charger que des fichiers de confiance. |

**WebMake est un outil de développement : ne pas l'exposer sur Internet ni l'utiliser en production.**

## 9. Qualité et tests

70 tests automatisés (`npm test`, exécuteur natif `node:test`, aucune dépendance) :

| Fichier | Couverture |
|---|---|
| `patterns.test.js` | Les 4 dialectes de chemins, substitution, encodage. |
| `parsers.test.js` | TOML, `_redirects`, `_headers`, Netlify, Vercel, Firebase, Azure, `.htaccess`. |
| `router.test.js` | Priorités, règles forcées, 404, SPA, détection multi-plateformes, sécurité. |
| `server.test.js` | Serveur réel : injection, SSE, proxy, ranges, XSS, CORS, repli de port. |
| `config.test.js` | Chargement, priorités, validation. |
| `cli.test.js` | Arguments, sous-processus `init` / `routes` / `build` / `dev`. |
| `watcher.test.js` | Surveillance native et par sondage, exclusions. |

La suite a été exécutée de façon répétée sans échec intermittent. Elle a été exécutée sous Linux et Windows ; voir §12 pour macOS.

## 10. Dépendances et compatibilité

- **Dépendances d'exécution : aucune.** Uniquement des modules natifs de Node.js (`http`, `https`, `fs`, `path`, `os`, `child_process`, `readline`).
- **Node.js** : 18.17 ou plus récent.
- **Navigateurs** : tout navigateur moderne (le rechargement utilise `EventSource`).
- **Ouverture automatique du navigateur** : `xdg-open` (Linux), `open` (macOS), `start` (Windows). Désactivée si la variable `CI` est définie.

## 11. Recommandations

1. Installer globalement (`npm install -g webmake-cli`) pour disposer de la commande partout.
2. Versionner `webmake.dev` avec le projet pour que toute l'équipe ait la même configuration.
3. Exécuter `webmake routes` après chaque modification des redirections et traiter les avertissements « skipped ».
4. Pour une SPA, placer les redirections réelles dans `_redirects` (`/* /index.html 200`) afin qu'elles soient identiques en production, et réserver `spa: true` aux cas simples.
5. Utiliser `host: '127.0.0.1'` hors réseau de confiance.
6. Ajouter un `404.html` à la racine (et dans les sous-dossiers qui en ont besoin) plutôt que de compter sur la page intégrée.
7. Conserver `out: './dist'` : une sortie égale à la source est refusée par `build`.

## 12. Points d'attention et limites connues

- **Plateformes testées** : la suite a été exécutée sous **Linux** (Node 22) et sous **Windows** (retour du client : 68 tests sur 70 au premier essai ; les 2 échecs venaient de tests non portables, corrigés depuis : nom de fichier `<b>.txt` interdit sous Windows, et `SIGTERM` qui termine brutalement un processus Windows sans passer par l'arrêt propre). **macOS** n'a pas été testé : une vérification manuelle (`npm test`, `webmake dev`) est recommandée.
- **Conditions non évaluables en local** (règles ignorées et signalées, jamais devinées) : `Country` / `Language` / `Role` (Netlify), règles par nom d'hôte, `has` / `missing` (Vercel), réécritures vers Cloud Functions / Cloud Run (Firebase), conditions `.htaccess` autres que `!-f` / `!-d`, redirections d'erreur Azure.
- **Netlify Functions, Edge Functions, authentification Azure** : non émulées.
- **Syntaxes volontairement partielles** : `.htaccess` (directives de redirection, `ErrorDocument 404`, `Header`) ; regex PCRE converties en regex JavaScript (quelques constructions Apache spécifiques peuvent différer).
- **TOML** : lecteur minimal et tolérant, suffisant pour `netlify.toml` ; une ligne invalide est ignorée avec avertissement.
- **Port 0** (`--port 0`) : accepté (port aléatoire), sans repli.
- **Fichiers `webmake.dev` en syntaxe ES modules** (`export default`) : acceptés seulement par les versions récentes de Node.js ; la syntaxe recommandée reste `module.exports`.
- **Nom npm** : `webmake-cli` existe déjà en 1.0.0 (voir §3) ; la 2.0.0 est une réécriture avec changement d'architecture (retrait de `chokidar`, `dotenv`, `ws`).
- **Pas de HTTPS** en local dans cette version.

## 13. Dépannage

| Symptôme | Solution |
|---|---|
| `webmake` introuvable après `npm install webmake-cli` | Installation locale : utiliser `npx webmake dev`, ou installer avec `-g`. |
| « Host … is not an address of this computer » | L'adresse IP a changé : corriger `host` ou utiliser `0.0.0.0`. |
| « Port … is already in use » | Fermer l'autre programme, changer `--port`, ou retirer `strictPort`. |
| Modifications non détectées | Activer `poll: true` (Docker, WSL, disque réseau). |
| Téléphone sans accès | Même Wi-Fi, pare-feu autorisant Node.js, réseau « invité » sans isolation. |
| Une redirection ne fait rien | `webmake routes` : règle masquée par un fichier réel (ajouter `!`) ou ignorée. |
| 404 en mode SPA avec `curl` | Ajouter `-H "Accept: text/html"`. |

Pour un diagnostic détaillé : `DEBUG=webmake webmake dev`.

## 14. Maintenance et évolutions

Pistes d'évolution possibles : HTTPS local, émulation de fonctions, nouveaux formats d'hébergeurs (Render, Surge), évaluation de conditions de langue / pays, compression des réponses, configuration de proxy avancée. Chaque format est isolé dans `src/parsers/` : en ajouter un revient à écrire un analyseur retournant des `Rule` et à l'enregistrer dans `src/detect.js`.

---

*© 2026 FarTekTV · Rafael ISTE · Licence MIT*
