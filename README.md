# Site Médiation Scientifique Inria

## Administration Sveltia en production

L'administration du site est disponible à l'adresse :

`https://<domaine-du-site>/admin/`

Le fichier de configuration Sveltia est :

`docs/admin/config.yml`

En production, Sveltia écrit dans le dépôt GitHub `MediationScientifiqueInria/ms-staging-v2026` sur la branche `main`. Cette branche déclenche le déploiement GitHub Pages, donc les contenus publiés depuis l'admin seront intégrés au site après le prochain build.

Pour donner accès à un membre de l'équipe :

1. Lui donner accès au dépôt GitHub avec le droit d'écriture.
2. Lui demander d'ouvrir `/admin/`.
3. Lui demander de se connecter avec GitHub si le bouton de connexion OAuth est disponible, ou avec **Sign In with Token**.
4. En cas d'utilisation d'un token, créer un Personal Access Token GitHub avec les permissions proposées par Sveltia, puis le coller dans la fenêtre de connexion.

Ne jamais ajouter de token GitHub dans `docs/admin/config.yml` ou dans le dépôt. Le token reste dans le navigateur de la personne connectée.

## Getting started

WATCHDOG_FORCE_POLLING=1 mkdocs serve --dirtyreload

Puis ouvrir l’administration locale dans un navigateur Chromium (Chrome, Edge ou Brave) :

http://127.0.0.1:8000/admin/index.html

Pour que Sveltia CMS crée les fichiers Markdown dans le dépôt local :

1. Cliquer sur **Work with Local Repository**.
2. Sélectionner le dossier racine du projet, par exemple `ms-staging-v2026`.
3. Vérifier dans le menu du compte que le CMS indique le mode local.
4. Créer ou modifier une entrée dans le CMS, puis cliquer sur **Save**.
5. Vérifier les fichiers générés avec `git status`.

Les actualités sont créées dans :

`docs/contenus/actualites/posts/`

Les ressources sont créées dans :

`docs/contenus/ressources/posts/`

Les événements du calendrier sont créés dans :

`docs/contenus/evenements/`

Sveltia CMS n’utilise pas `local_backend` ni `decap-server` pour le mode local. Si on se connectes au backend GitHub au lieu de choisir le dépôt local, les changements ne seront pas écrits directement dans ton dossier de travail.

En mode GitHub, l’admin cible le dépôt `MediationScientifiqueInria/ms-staging-v2026` sur la branche `main`. En mode local, il faut quand même choisir **Work with Local Repository** pour écrire dans les fichiers de ce dossier.

