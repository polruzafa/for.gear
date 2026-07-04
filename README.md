# For Gear

PWA per portar l'inventari de material de muntanya i preparar motxilles. Sense servidor: tot és estàtic i les dades viuen al dispositiu.

## Com funciona

- **Material**: llista de tot l'equip, amb cerca i filtre per categoria. Cada element té fitxa pròpia (categoria, pes, etiquetes, notes, característiques i foto local).
- **Kits**: grups de material amb nom («kit arròs», «kit mess tin»…) que es poden reutilitzar i imbricar: un kit pot contenir altres kits.
- **Motxilles**: tria una motxilla del material (categoria «Mochilas») i omple-la amb elements i kits sencers. Mostra el pes total, el percentatge de càrrega i una barra de pes per categories. Els pesos compten cada element un sol cop encara que arribi per dos camins, i no s'hi poden crear cicles. Els elements de la categoria «Mochilas» no s'afegeixen mai com a contingut solt: una motxilla només entra en un grup com a contenidor o com a grup imbricat.
- **Dades**: exporta o importa el JSON sencer, torna a les dades d'exemple, o **afegeix elements enganxant JSON** (additiu, amb comprovació de format; accepta els camps de l'app i els del format original de l'inventari).
- **Dependències**: un element pot declarar `needs` (etiquetes que un altre element del grup ha de tenir, com ara `fuel` o `mechero`); si no es cobreixen, la motxilla o el kit mostren un avís de «possibles oblits» sense bloquejar res.

## Dades

- La llavor és a `src/data/gear.json` i s'empaqueta amb l'app.
- El primer cop, l'app copia la llavor a `localStorage`; a partir d'aleshores totes les edicions es desen al dispositiu.
- Per actualitzar la llavor del repositori: *Dades → Exporta el JSON* i substituïu `src/data/gear.json` pel fitxer exportat.

### Migracions

Les dades de l'usuari viuen a `localStorage` i no s'han de perdre mai en una actualització:

1. **Camps opcionals nous**: no cal apujar `schemaVersion`; les dades velles són vàlides tal qual.
2. **Canvis incompatibles** (renoms, canvis d'unitats o de forma): apugeu `schemaVersion` a la llavor **i** afegiu un pas a `migrate()` de `src/store.tsx` que transformi les dades antigues sense descartar-les.
3. El reset a la llavor és només l'últim recurs, per a dades corruptes o de versions desconegudes.

## Desenvolupament

```sh
pnpm install
pnpm dev        # servidor de desenvolupament
pnpm build      # comprova tipus i genera dist/
pnpm preview    # serveix dist/ en local
pnpm icons      # regenera les icones PNG (scripts/make-icons.mjs)
```

## Desplegament

Es publica automàticament a **https://polruzafa.github.io/fornets/for-gear/** amb el workflow `deploy-web.yml`, que construeix `fornets-web` i `for-gear` i les serveix com un únic site de Pages. `base: './'` i el `HashRouter` fan que funcioni des de qualsevol subcarpeta.

## Instal·lació al mòbil

Obriu el web al mòbil i:

- **iOS (Safari)**: Compartir → «Afegeix a la pantalla d'inici».
- **Android (Chrome)**: menú ⋮ → «Instal·la l'aplicació».

El servei worker (generat per `vite-plugin-pwa`) deixa l'app disponible sense connexió i s'actualitza sol a cada desplegament.
