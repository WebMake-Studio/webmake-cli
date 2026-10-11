# Cahier des charges : WebMake CLI

> **Version 2.0.0** · © 2026 FarTekTV · Rafael ISTE

| | |
|---|---|
| **Projet** | WebMake CLI : serveur de développement en ligne de commande |
| **Commanditaire** | FarTekTV / WebMake Studio |
| **Auteur** | Rafael ISTE |
| **Date** | 10 octobre 2026 |
| **Statut** | Livré (voir le tableau de conformité, §8) |

---

## 1. Contexte et objectifs

WebMake Studio conçoit des sites web percutants. L'agence a besoin d'un outil en ligne de commande, cohérent avec son identité visuelle, pour prévisualiser localement les sites qu'elle livre et reproduire fidèlement le comportement des hébergeurs (redirections, pages 404, en-têtes).

**Objectifs**

1. Lancer un serveur local avec une seule commande : `webmake dev`.
2. Reconnaître automatiquement les fichiers de redirection, quel que soit leur nom ou leur plateforme.
3. Offrir une expérience terminal professionnelle, lisible en anglais, aux couleurs de WebMake Studio.
4. S'installer simplement : `npm install webmake-cli`, sans étape supplémentaire.
5. Rester léger, sûr et maintenable : aucune dépendance.

## 2. Périmètre

**Inclus** : serveur de développement, rechargement automatique, redirections / réécritures / proxy, en-têtes, pages 404, mode SPA, configuration par `webmake.dev`, export de build, inspection des règles, documentation, tests.

**Exclus** (version 2.0.0) : HTTPS, exécution de fonctions serverless, authentification, déploiement vers un hébergeur, compilation / bundling d'assets.

## 3. Utilisateurs cibles

- Développeurs et intégrateurs de l'agence.
- Clients techniques souhaitant prévisualiser un site livré.
- Environnements d'intégration continue (via `routes --json` et l'API).

## 4. Exigences fonctionnelles

| ID | Exigence | Priorité |
|---|---|---|
| F1 | La commande `webmake dev` démarre un serveur sur le dossier courant. | Obligatoire |
| F2 | Le site s'ouvre automatiquement dans le navigateur, sur le réseau IPv4, port **8888** par défaut (`http://localhost:8888`). | Obligatoire |
| F3 | Un fichier `webmake.dev` (module CommonJS) définit `dir`, `out`, `port`, `host`, `watch`, `poll`, `spa`, `open`. | Obligatoire |
| F4 | Détection automatique de `_redirects` sous plusieurs noms et de `netlify.toml`, `vercel.json`, `firebase.json`, `staticwebapp.config.json`, `.htaccess`. | Obligatoire |
| F5 | Gestion des pages 404 (fichier `404.html`, règles, `ErrorDocument`, page intégrée) avec le code HTTP 404. | Obligatoire |
| F6 | Redirections 3xx, réécritures 200, règles forcées, jokers, paramètres nommés, filtre par query string. | Obligatoire |
| F7 | Mode SPA (`spa: true`) avec repli sur `index.html` / `200.html`. | Obligatoire |
| F8 | Rechargement automatique du navigateur ; remplacement à chaud du CSS. | Obligatoire |
| F9 | Surveillance des fichiers native, avec mode sondage (`poll`). | Obligatoire |
| F10 | Affichage des URL `Local` et `Network`. | Obligatoire |
| F11 | Repli automatique si le port est occupé ou si `host` est inconnu de la machine. | Souhaitable |
| F12 | Commandes `build`, `routes`, `init`, `help`. | Souhaitable |
| F13 | En-têtes HTTP personnalisés (`_headers`, `netlify.toml`, …). | Souhaitable |
| F14 | Proxy vers une API externe par règle `200`. | Souhaitable |
| F15 | Pages internes : liste des routes, listing de dossier. | Souhaitable |
| F16 | API programmatique `startServer()`. | Souhaitable |

## 5. Exigences non fonctionnelles

| ID | Exigence | Mesure |
|---|---|---|
| N1 | **Installation** : `npm install -g webmake-cli` suffit ; pas de `npm link`. | Champ `bin` du `package.json`. |
| N2 | **Zéro dépendance** d'exécution. | `dependencies: {}`. |
| N3 | **Langue** : messages, aide et erreurs en anglais clair, avec suggestion de correction. | Revue des messages ; codes de sortie 0 / 1 / 2. |
| N4 | **Identité visuelle** : palette WebMake Studio (indigo `#5b5bf0`, violet `#9b8cff`, lavande `#cfc9ff`), cadre arrondi avec pastilles rouge / jaune / verte, pages intégrées au style du site. | Bannière, journal, pages HTML. |
| N5 | **Performance** : démarrage < 100 ms ; réponse statique de l'ordre de la milliseconde. | Mesuré : démarrage ≈ 20 ms. |
| N6 | **Sécurité** : aucune fuite de fichiers cachés / de configuration, pas de traversée de chemin, pas d'XSS. | Tests dédiés. |
| N7 | **Robustesse** : un fichier de configuration invalide ne plante jamais le serveur ; il produit un avertissement. | Tests des analyseurs. |
| N8 | **Compatibilité** : Node.js ≥ 18.17 ; Windows, macOS, Linux. | `engines` ; voir §8 pour l'état de validation. |
| N9 | **Qualité** : suite de tests automatisés sans dépendance. | 70 tests. |
| N10 | **Documentation** : README, documentation technique et fonctionnelle, cahier des charges. | Dossier `docs/`. |
| N11 | **Propriété** : copyright Rafael ISTE dans tous les fichiers source ; mention FarTekTV dans le README et la documentation. | En-têtes de fichiers. |

## 6. Interface en ligne de commande

```text
webmake <commande> [options]

Commandes   dev [dossier]   build [dossier]   routes [dossier]   init   help
Options     -p --port   -H --host   -d --dir   -o --out   -c --config   -w --watch
            --poll   --spa   --open / --no-open   --no-livereload   --no-clean-urls
            --no-listing   --cors   --strict-port   --not-found   -q --quiet
            --json   -f --force   --no-clean   --no-color   -h --help   -v --version
```

Codes de sortie : `0` succès · `1` erreur d'exécution · `2` erreur d'usage ou de configuration.

## 7. Contraintes et hypothèses

- Node.js 18.17 ou plus récent est installé.
- L'outil est réservé au **développement** ; aucune exigence de durcissement pour la production.
- Le nom npm `webmake-cli` appartient déjà au compte `fartek.tv` (version 1.0.0) : la version 2.0.0 est publiée par le même compte.

## 8. Tableau de conformité

| ID | Statut | Vérification |
|---|---|---|
| F1 | ✔ Conforme | Test `cli.test.js` (démarrage et arrêt propre). |
| F2 | ✔ Conforme | Port 8888, IPv4, ouverture navigateur (désactivée si `CI`). L'ouverture réelle d'un navigateur n'a pas été testée dans l'environnement de livraison (sans interface graphique). |
| F3 | ✔ Conforme | `config.test.js` charge le fichier exact du cahier des charges. |
| F4 | ✔ Conforme | `router.test.js` (détection multi-plateformes), `parsers.test.js`. |
| F5 | ✔ Conforme | `router.test.js`, `server.test.js`. |
| F6 | ✔ Conforme | `parsers.test.js`, `router.test.js`. |
| F7 | ✔ Conforme | `router.test.js`. |
| F8 | ✔ Conforme | Test SSE ; essai manuel : événements `css` et `reload`. |
| F9 | ✔ Conforme | `watcher.test.js` (natif et sondage). |
| F10 | ✔ Conforme | Sortie réelle du serveur. |
| F11 | ✔ Conforme | `server.test.js`. |
| F12 | ✔ Conforme | `cli.test.js`. |
| F13 | ✔ Conforme | `server.test.js`, `router.test.js`. |
| F14 | ✔ Conforme | `server.test.js` (amont réel, erreur 502). |
| F15 | ✔ Conforme | `server.test.js`. |
| F16 | ✔ Conforme | Utilisée par `server.test.js`. |
| N1–N3, N5–N7, N9–N11 | ✔ Conforme | Voir plus haut. |
| N4 | ✔ Conforme | Revue visuelle de la bannière ; pages HTML non contrôlées dans un navigateur graphique. |
| N8 | ◐ Partiel | Validé sous Linux (Node 22) et Windows (tests corrigés après retour client). macOS : code prévu, **non testé**. |

## 9. Livrables

1. Paquet npm `webmake-cli` 2.0.0 (archive ZIP) : `bin/`, `src/`.
2. Tests (`test/`) et site de démonstration (`examples/demo-site/`).
3. `README.md` professionnel (badges, installation, utilisation, exemples).
4. `docs/DOCUMENTATION.fr.md` : documentation technique et fonctionnelle.
5. `docs/CAHIER_DES_CHARGES.fr.md` : le présent document.
6. `LICENSE` (MIT), `CHANGELOG.md`.

## 10. Recette (procédure de validation)

1. `node -v` renvoie 18.17 ou plus.
2. `npm install -g webmake-cli-2.0.0.tgz` (ou `npm install -g .`) puis `webmake --version` affiche `2.0.0`.
3. `npm test` : 70 tests réussis.
4. `webmake dev examples/demo-site` : le navigateur s'ouvre sur `http://localhost:8888`.
5. Dans le navigateur : `/about` (URL propre), `/old-page` (redirection 301 vers `/about`), `/blog/x` (réécriture), `/inconnu` (404 personnalisée), `/files/` (listing).
6. Modifier `css/style.css` : les couleurs changent sans rechargement ; modifier `about.html` : la page se recharge.
7. `webmake routes` liste 4 règles et 2 blocs d'en-têtes.
8. `webmake build` dans une copie du projet crée `dist/` avec `_redirects` et `_headers`.

---

*© 2026 FarTekTV · Rafael ISTE*
