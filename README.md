# Site Médiation Scientifique Inria

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

