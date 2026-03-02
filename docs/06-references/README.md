# 06 — Références

Ce dossier rassemble les documents de référence sur l'état du projet MiraMD : ce qui a été audité, ce qui ne marche pas encore, ce qui est prévu, et ce qui reste à l'horizon lointain. Ce sont des **documents vivants** — ils sont mis à jour au fil de l'eau, pas figés.

## Note d'usage

Ces fichiers sont des références, pas une lecture linéaire — consulte ce dont tu as besoin selon ta question du moment. Tu n'es pas obligé de les lire dans l'ordre, ni de les lire en entier.

Pour découvrir le projet, commence plutôt par [`../01-decouverte/`](../01-decouverte/). Pour comprendre l'architecture, va voir [`../03-choix-techniques/`](../03-choix-techniques/).

## Contenu du dossier

### [`audit.md`](audit.md)
État technique global du projet, dimension par dimension : architecture, sécurité, performance, données, fiabilité, maintenabilité, frontend, tests, déploiement, DX. Inclut un tableau de scores et une synthèse des chantiers prioritaires.

> **À consulter quand** tu veux une vue d'ensemble objective de la santé du code, ou pour situer un sujet précis dans le tableau global.

### [`problemes-connus.md`](problemes-connus.md)
Inventaire des bugs et limites identifiés à date. Chaque entrée décrit le symptôme, le périmètre du code concerné, la cause probable, une piste de fix et un statut (ouvert / en cours / résolu).

> **À consulter quand** tu rencontres un comportement bizarre (pour vérifier s'il est connu), ou avant de proposer un fix (pour t'aligner sur l'analyse existante).

### [`feuille-de-route.md`](feuille-de-route.md)
Ce qui est fait, ce qui est en cours, ce qui est prévu. Découpée en trois horizons (court / moyen / long terme) avec un état d'avancement honnête — un point qui n'a pas avancé est marqué comme tel.

> **À consulter quand** tu veux savoir si un sujet est planifié, à quel horizon, ou pour ne pas dupliquer un effort déjà engagé.

### [`perspectives.md`](perspectives.md)
Vision long terme et idées exploratoires. Contient des pistes à 1+ an (remplacement éventuel de Muya, plugins tiers, sync, collaboration) ainsi que des questions ouvertes qui n'ont pas encore été tranchées.

> **À consulter quand** tu veux comprendre où le projet pourrait aller à long terme, ou pour formuler une idée prospective sans engagement immédiat.

## Conventions

- **Pas de promesses** dans ces documents : on décrit ce qu'on observe ou ce qu'on envisage, jamais ce qu'on garantit livrer.
- **Honnêteté sur l'avancement** : si un point de la feuille de route stagne depuis trois mois, il reste affiché comme stagnant — on ne le réécrit pas pour faire bonne figure.
- **Termes techniques** : un lien systématique vers le [glossaire](../01-decouverte/glossaire.md) à la première occurrence dans chaque document.
