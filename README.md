# Fardell

PWA per portar l'inventari de material de muntanya i preparar motxilles. Local primer: el web és estàtic i les dades viuen al dispositiu; opcionalment, un compte d'usuari les sincronitza entre dispositius a través d'una API pròpia (vegeu `server/`).

## Com funciona

- **Material**: llista de tot l'equip, amb cerca i filtre per categoria. Cada element té fitxa pròpia (categoria, pes, etiquetes, notes, característiques i foto local).
- **Kits**: grups de material amb nom («kit arròs», «kit mess tin»…) que es poden reutilitzar i imbricar: un kit pot contenir altres kits.
- **Motxilles**: tria una motxilla del material (categoria «Mochilas») i omple-la amb elements i kits sencers. Mostra el pes total, el percentatge de càrrega i una barra de pes per categories. Cada pertinença té **quantitat** (2 cantimplores) i pot marcar-se **«a sobre»** (roba posada, bastons): surt a la llista però no compta en el pes transportat. Si una mateixa peça arriba per dos camins val la quantitat més gran (és la mateixa peça física), i no s'hi poden crear cicles. Els elements de la categoria «Mochilas» no s'afegeixen mai com a contingut solt: una motxilla només entra en un grup com a contenidor o com a grup imbricat.
- **Sortides**: la llista de sortides planificades i fetes, separades entre properes i passades, cadascuna amb dates, lloc i les motxilles preparades que hi van (amb el pes total). Si la sortida té coordenades i comença d'aquí a 7 dies o menys, la targeta mostra el pronòstic diari d'[Open-Meteo](https://open-meteo.com) (gratuït i sense clau; les respostes es guarden en memòria cau una hora). Les notes fan d'anada i tornada: el pla de ruta abans, i què va faltar o sobrava en tornar.
- **Menjar**: ressenyes de plats cuinats amb el material (sabor, neteja, preu i dificultat), amb fins a **3 fotografies** locals per ressenya (l'embalatge, la cocció, el resultat…).
- **Dades** (dins dels *Ajustos*): exporta o importa el JSON sencer, buida les dades, o **afegeix elements enganxant JSON** (additiu, amb comprovació de format; accepta els camps de l'app i els del format original de l'inventari).
- **Dependències**: un element pot declarar `needs` (etiquetes que un altre element del grup ha de tenir, com ara `fuel` o `mechero`); si no es cobreixen, la motxilla o el kit mostren un avís de «possibles oblits» sense bloquejar res.
- **Temes**: cinc paletes de colors triables als *Ajustos* (`src/theme.tsx` i els blocs `[data-theme]` de `styles.css`), cadascuna amb variant clara i fosca: per defecte la tria el sistema, però es pot forçar. Un script d'`index.html` aplica el tema desat abans de la primera pintada. «Pedra» és l'original; la resta ve de l'app bitácora.

## Dades

- El primer cop, l'app comença amb l'inventari **buit** i les categories inicials de `src/data/starter.json`; a partir d'aleshores tot el que hi ha és de l'usuari i es desa al dispositiu.
- **Catàleg** (`src/data/catalog.json`, tipus a `src/catalog.ts`): una llista curada de material per triar. En triar-ne un element s'obre el formulari preomplert perquè l'usuari el personalitzi; la fitxa desada és una còpia seva (amb `catalogId` com a procedència). Ara mateix el catàleg es distribueix **buit** — el botó «Catàleg» s'amaga tot sol — i està pensat perquè més endavant l'ompli un scraper de botigues de material europees.
- Fins al juliol del 2026 l'app duia una llavor amb material (`gear.json`) que es fusionava a cada arrencada (`seedMerge.ts`); es va retirar quan la llista va passar a ser privada. Les dades dels dispositius existents no es toquen: simplement ja no es fusionen amb res.

### Compte i sincronització

- **Opcional**: sense compte, l'app funciona exactament igual que abans, només amb el dispositiu.
- Amb un compte (adreça electrònica i contrasenya, des dels *Ajustos*), les dades es guarden també al servidor i se sincronitzen entre dispositius: cada canvi s'envia al cap d'un moment, i en obrir l'app es recullen les novetats. Crear el compte demana el **codi d'invitació** si el servidor en té un de configurat (recomanat; vegeu `server/README.md`).
- La lògica és a `src/account.tsx`: el dispositiu recorda quina versió del servidor coneix (`lastSyncedAt`) i si té canvis pendents (`dirty`). Si hi ha canvis a totes dues bandes, l'app pregunta amb quina versió quedar-se; mai no fusiona a cegues.
- El backend és un Worker de Cloudflare amb D1 (i un bucket R2 per a les fotografies), dins de `server/`; el desplegament (gratuït) està explicat a `server/README.md`. L'URL de l'API s'escriu al formulari dels *Ajustos*, o es deixa preconfigurada compilant amb `VITE_API_URL`.
- Les fotografies també se sincronitzen (`src/photoSync.ts`): cada canvi local s'apunta en una cua i, amb les dades al dia, s'envien les pendents, es propaguen les supressions i es baixen les que falten. Si el servidor no té el bucket R2 configurat, queden en local com abans. No viatgen mai amb l'exportació del JSON.

### Migracions

Les dades de l'usuari viuen a `localStorage` i no s'han de perdre mai en una actualització:

1. **Camps opcionals nous**: no cal apujar `schemaVersion`; les dades velles són vàlides tal qual.
2. **Canvis incompatibles** (renoms, canvis d'unitats o de forma): apugeu `SCHEMA_VERSION` (a `src/store.tsx`, i el mateix valor a `starter.json`) **i** afegiu un pas a `migrate()` que transformi les dades antigues sense descartar-les.
3. Tornar a l'inventari buit és només l'últim recurs, per a dades corruptes o de versions desconegudes.

## Desenvolupament

```sh
pnpm install
pnpm dev        # servidor de desenvolupament
pnpm build      # comprova tipus i genera dist/
pnpm preview    # serveix dist/ en local
pnpm icons      # regenera les icones PNG (scripts/make-icons.mjs)
```

## Desplegament

Es publica automàticament a **https://polruzafa.github.io/fardell/** amb el workflow `deploy.yml` a cada push a `main`. `base: './'` i el `HashRouter` fan que funcioni des de qualsevol subcarpeta.

El backend (comptes i sincronització) és a part: un Worker de Cloudflare que es desplega a mà amb `pnpm deploy` des de `server/` (vegeu `server/README.md`).

### Història del nom

- Fins al juliol del 2026 l'app vivia dins del repositori `fornets` i es servia a `/fornets/for-gear/`; la història d'aquells commits es va conservar amb `git subtree split`.
- L'app (i el repositori) es va dir **For·Gear** fins al juliol del 2026. Les claus antigues de `localStorage` (`for-gear:*`) i la base de fotografies es migren soles a l'arrencada (`src/migrateStorage.ts`), sense perdre res; quan tots els dispositius s'hagin actualitzat, la migració es podrà retirar.
- El canvi de nom del repositori va canviar l'URL de GitHub Pages: qui tingués la PWA instal·lada de `/for.gear/` ha de tornar-la a instal·lar des de l'URL nova (les dades no es perden: `localStorage` és del domini, no de la ruta).

## Instal·lació al mòbil

Obriu el web al mòbil i:

- **iOS (Safari)**: Compartir → «Afegeix a la pantalla d'inici».
- **Android (Chrome)**: menú ⋮ → «Instal·la l'aplicació».

El servei worker (generat per `vite-plugin-pwa`) deixa l'app disponible sense connexió i s'actualitza sol a cada desplegament.
