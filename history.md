# Opex360 — Filtre de commentaires — historique

## 2026.9
- **Pourquoi** : nombre de catégories de couleur libre.
- **Nouveautés** : popup → « + Ajouter une catégorie » (20 au maximum ; la nouvelle catégorie prend une couleur pastel pas encore utilisée, et le curseur est placé sur son libellé) ; ✕ supprime une catégorie (désactivé quand il n'en reste qu'une). Si des auteurs utilisent la catégorie supprimée, une confirmation les liste et ils perdent leur couleur. ↺ n'apparaît que sur les 5 catégories d'origine. Sans libellé, une catégorie ajoutée s'affiche par son code (#FFE4C7).
- **Compatibilité** : synchro au format v2 (identifiant, couleur et libellé de chaque catégorie) ; le format v1 reste lu.
- **Tester** : ajouter une catégorie et lui donner un libellé, puis vérifier qu'elle apparaît dans la liste sur opex360 ; supprimer une catégorie utilisée → confirmation nommant les auteurs ; supprimer jusqu'à la dernière → ✕ grisé.

## 2026.8
- **Pourquoi** : import d'une sauvegarde vide (« 0 auteurs restaurés ») — export fait sur un appareil sans règles, le stockage n'étant pas partagé entre appareils.
- **Nouveautés** :
  - Synchronisation via le compte Firefox (`background.js`, storage.sync, format compact découpé, quota 100 Ko). Fusion à la première synchro d'un appareil (union des auteurs, la règle locale l'emporte en cas de conflit), puis le dernier qui écrit l'emporte. Case à cocher par appareil dans le popup, avec l'état de la synchro (envoyé, reçu, erreur). **Ordinateurs uniquement** : Firefox Android ne synchronise pas les données d'extension (bug 1625257). Nécessite « Modules complémentaires » coché dans Sync.
  - Import : confirmation renforcée si la sauvegarde ne contient aucun auteur (nombre d'auteurs qui seront effacés, propagation par la synchro) ; la confirmation normale affiche aussi le nombre d'auteurs actuel.
  - Export : avertissement si la configuration exportée est vide ; le nombre d'auteurs est affiché.
- **Tester** : sur deux PC connectés au même compte, colorer un auteur sur l'un → apparaît sur l'autre après une synchro Firefox (forçable via « Synchroniser maintenant » dans le menu du compte). Importer le JSON vide du 13/10 → message ATTENTION.

## 2026.7
- **Pourquoi** : pouvoir donner un sens aux couleurs et les adapter.
- **Nouveautés** : popup, section « Couleurs » — pour chacune des 5 couleurs, libellé personnalisé (facultatif) et code web (#rrggbb ou #rgb) ; ↺ rétablit la couleur et le libellé par défaut. Les listes affichent « Libellé (Violet) », ou « Libellé (#2A5D34) » si la couleur a été modifiée, et le nom seul en l'absence de libellé. Les règles pointent sur l'emplacement de couleur : changer une couleur recolore tous ses auteurs. Le texte passe en blanc si la couleur est foncée. La liste de la page montre une bande à la couleur choisie. Les auteurs en couleur du popup affichent leur libellé.
- **Compatibilité** : les anciennes règles (couleur seule) sont rattachées automatiquement ; l'export passe en formatVersion 2 avec la palette, et l'import accepte les versions 1 et 2.
- **Tester** : définir un libellé sur Violet → la liste sur opex360 affiche « Libellé (Violet) » ; changer le code du Vert en foncé → auteurs verts recolorés, texte blanc ; exporter puis importer → libellés et couleurs restaurés.

## 2026.6
- **Pourquoi** : en mode sombre, les commentaires colorés étaient illisibles (texte clair du thème sur fond pastel).
- **Correction** : `content.css` — dans `.o360-highlighted`, texte forcé en noir (#111, y compris liens, nom d'auteur, date, libellés) ; bouton et liste de couleur forcés fond blanc / texte sombre.
- **Tester** : opex360 en thème sombre, colorer un auteur → corps, nom, date et « Auteur apprécié » lisibles en noir ; liste « Violet » fond blanc. Vérifier en thème clair que rien ne change.

## 2026.5
- Version de référence (masquage d'auteurs, couleurs, repli de branches, import/export).
