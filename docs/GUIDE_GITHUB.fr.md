# Guide : mettre WebMake CLI sur GitHub

Copyright (c) 2026 Rafael ISTE (FarTekTV) - MIT License

## 0. Avant de commencer : public ou privé ?

- **Public** : tout le monde voit le code, `docs/` et le cahier des charges. Idéal pour un projet open source.
- **Privé** : seul toi (et les personnes invitées) voient le dépôt. Les Actions (CI) restent gratuites avec un quota mensuel.

Si le cahier des charges est confidentiel, supprime `docs/CAHIER_DES_CHARGES.fr.md` avant de publier, ou choisis « Private ».

## 1. Installer Git

Windows : https://git-scm.com/download/win (laisser les options par défaut). Vérifier :

```
git --version
```

Configurer ton identité (une seule fois, avec TES infos) :

```
git config --global user.name "Ton Nom"
git config --global user.email "ton-email@exemple.com"
```

## 2. Créer le dépôt sur GitHub

1. Va sur https://github.com/new (compte gratuit si besoin).
2. **Repository name** : `webmake-cli`.
3. Choisis Public ou Private.
4. **Ne coche rien** (ni README, ni .gitignore, ni licence) : ils existent déjà dans le projet.
5. Clique **Create repository**. GitHub affiche l'URL, par ex. `https://github.com/WebMake-Studio/webmake-cli.git`.

## 3. Envoyer le projet

Dézippe l'archive, ouvre un terminal dans le dossier `webmake-cli`, puis :

```
git init
git add .
git commit -m "Initial commit: WebMake CLI 2.0.0"
git branch -M main
git remote add origin https://github.com/WebMake-Studio/webmake-cli.git
git push -u origin main
```

Au premier `push`, une fenêtre de connexion GitHub s'ouvre : connecte-toi. (Si le mot de passe est refusé, utilise un « Personal Access Token » : GitHub > Settings > Developer settings > Tokens.)

Vérifie que le dossier `node_modules` n'est PAS envoyé : le `.gitignore` s'en charge.

## 4. Vérifier la CI (tests Windows / macOS / Linux)

Onglet **Actions** du dépôt : le workflow « CI » se lance seul à chaque push. Il teste Node 18, 20 et 22 sur Windows, macOS et Linux (9 jobs). Les pastilles vertes confirment que ça marche aussi sur Mac, sans avoir besoin de ton pote.

## 5. Relier GitHub à npm (recommandé)

Modifie `package.json` en remplaçant `WebMake-Studio` :

```json
"repository": { "type": "git", "url": "git+https://github.com/WebMake-Studio/webmake-cli.git" },
"homepage": "https://github.com/WebMake-Studio/webmake-cli#readme",
"bugs": { "url": "https://github.com/WebMake-Studio/webmake-cli/issues" }
```

Puis :

```
git add package.json
git commit -m "Add repository links"
git push
```

Les liens apparaîtront sur la page npm à la prochaine publication (nouvelle version, par ex. 2.0.1 : `npm version patch` puis `npm publish`).

## 6. Badge CI dans le README (optionnel)

Ajoute dans le README, sous les autres badges :

```
[![CI](https://github.com/WebMake-Studio/webmake-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/WebMake-Studio/webmake-cli/actions/workflows/ci.yml)
```

## 7. Publication npm automatique (optionnel)

Le fichier `.github/workflows/publish.yml` publie sur npm à chaque « Release » GitHub.

1. npmjs.com > Access Tokens > **Generate New Token > Granular** : droit *Read and write* sur `webmake-cli`, avec l'option **bypass 2FA**. Copie le token.
2. GitHub > dépôt > Settings > Secrets and variables > Actions > **New repository secret** : nom `NPM_TOKEN`, valeur = le token.
3. Pour publier : augmente la version (`npm version patch`, puis `git push --follow-tags`), puis GitHub > Releases > **Draft a new release** > choisis le tag > **Publish release**.

Ne colle jamais un token dans un fichier du projet.

## 8. Mises à jour au quotidien

```
git add .
git commit -m "Description du changement"
git push
```

## Problèmes fréquents

| Problème | Solution |
|---|---|
| `remote origin already exists` | `git remote set-url origin <URL>` |
| `src refspec main does not match any` | Fais d'abord `git commit` |
| `failed to push (rejected)` | Tu as coché README à la création : `git pull origin main --allow-unrelated-histories` puis `git push` |
| CI rouge sur un OS | Ouvre le job dans l'onglet Actions et lis l'erreur |
