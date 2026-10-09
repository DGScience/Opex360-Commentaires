# Opex360 — Filtre de commentaires

Extension Firefox pour filtrer les commentaires du site [Opex360](https://www.opex360.com/).

**Version actuelle : 2026.5**

Cette extension ajoute des commandes sous chaque commentaire d'Opex360 :

- **Masquer cet auteur** replie ses commentaires sur tous les articles derrière un nœud `+` ;
- un clic sur `+` affiche temporairement le commentaire et transforme le nœud en `−` pour le replier ;
- l'option **Masquer toute la branche** replie également toutes les réponses situées sous l'auteur exclu ;
- **Auteur apprécié** applique une couleur choisie à tous ses commentaires ;
- l'icône de l'extension affiche les auteurs mémorisés et permet de retirer une règle.
- **Exporter** sauvegarde les auteurs, leurs couleurs et les options dans un fichier JSON ;
- **Importer** restaure une sauvegarde JSON après confirmation et remplace la configuration courante.

Les préférences restent dans le stockage local du navigateur. Aucune donnée n'est envoyée ailleurs.

Depuis la version 2026.4, l'extension demande explicitement à Firefox de placer son icône dans la barre d'outils.

Depuis la version 2026.5, l'import s'effectue dans un onglet persistant : Firefox fermait la fenêtre de l'extension pendant l'ouverture du sélecteur de fichier, ce qui interrompait l'import.

## Installation dans Firefox

1. Décompressez l'archive.
2. Ouvrez `about:debugging#/runtime/this-firefox`.
3. Cliquez sur **Charger un module complémentaire temporaire**.
4. Sélectionnez le fichier `manifest.json` du dossier décompressé.

Cette méthode est temporaire : Firefox retire l'extension au redémarrage. Pour une installation permanente, l'archive doit être signée par Mozilla.

## Installation dans Chrome / Edge

1. Décompressez l'archive.
2. Ouvrez `chrome://extensions` ou `edge://extensions`.
3. Activez le **Mode développeur**.
4. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier décompressé.

## Utilisation

Ouvrez un article Opex360 contenant des commentaires. Les commandes apparaissent au bas de chaque commentaire. Rechargez une page déjà ouverte juste après l'installation.

## Portée

L'extension ne s'exécute que sur `opex360.com`. Elle identifie les commentaires à partir des structures WordPress usuelles et de plusieurs sélecteurs de secours.

## Code source et versions

Le code source est disponible dans ce dépôt. Les archives de chaque version sont accessibles depuis la section **Releases**.

Le fichier ZIP distribué ici n’est pas signé par Mozilla : son chargement sous Firefox standard est temporaire via `about:debugging`. Une installation permanente exige la signature Mozilla.

## Signalement des problèmes

Utilisez les **Issues** de ce dépôt pour signaler un bug ou proposer une amélioration.

## Droits

Tous droits réservés, sauf mention contraire. La publication du code n’accorde pas automatiquement le droit de le réutiliser ou de le redistribuer.
