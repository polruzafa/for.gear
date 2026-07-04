# For Gear

PWA per portar l'inventari de material de muntanya i preparar motxilles. Sense servidor: tot és estàtic i les dades viuen al dispositiu.

## Com funciona

- **Material**: llista de tot l'equip, amb cerca i filtre per categoria. Cada element té fitxa pròpia (categoria, pes, etiquetes, notes i, en el futur, foto).
- **Motxilles**: tria una motxilla del material (categoria «Motxilles») i omple-la amb elements. Mostra el pes total i una barra de pes per categories.
- **Dades**: exporta o importa el JSON sencer, o torna a les dades d'exemple.

## Dades

- La llavor és a `src/data/gear.json` i s'empaqueta amb l'app.
- El primer cop, l'app copia la llavor a `localStorage`; a partir d'aleshores totes les edicions es desen al dispositiu.
- Per actualitzar la llavor del repositori: *Dades → Exporta el JSON* i substituïu `src/data/gear.json` pel fitxer exportat.

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
