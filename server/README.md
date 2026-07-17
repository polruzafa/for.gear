# Fardell API

Backend mínim per als comptes d'usuari i la sincronització de dades i fotografies
de Fardell: un **Worker de Cloudflare** sense dependències amb una base de dades
**D1** (SQLite) i un bucket **R2** per a les imatges.

Per què Cloudflare i no un altre servei gratuït:

- El pla gratuït (100.000 peticions/dia) sobra de llarg per a un ús personal.
- **No s'adorm ni es pausa**: a Render el servei gratuït triga ~1 min a despertar-se,
  i Supabase pausa els projectes al cap d'una setmana sense activitat.
- D1 és SQLite de veritat (5 GB gratuïts) i no cal gestionar cap servidor.

## Què fa

- Comptes amb adreça electrònica i contrasenya (PBKDF2-SHA256 amb sal per usuari).
- Sessions amb testimonis aleatoris; a la base de dades només se'n guarda el hash.
- Una còpia del JSON de dades per usuari, amb control de concurrència optimista
  (`baseUpdatedAt`): si dos dispositius desen alhora, el segon rep un 409 i l'app
  ho resol preguntant a l'usuari.
- Les fotografies de cada usuari, com a objectes R2 «`userId/clau`» (la clau és
  la mateixa que el client fa servir a IndexedDB). Màxim 1 MB per imatge — les
  fotos ja arriben reduïdes de l'app. Si el bucket no està configurat, aquests
  endpoints responen 501 i l'app deixa les fotografies en local.

| Mètode | Ruta                | Cos                        | Resposta                 |
| ------ | ------------------- | -------------------------- | ------------------------ |
| POST   | `/api/register`     | `{ email, password, code? }` | `{ token, email }`     |
| POST   | `/api/login`        | `{ email, password }`      | `{ token, email }`       |
| POST   | `/api/logout`       | — (Bearer)                 | 204                      |
| GET    | `/api/data`         | — (Bearer)                 | `{ payload, updatedAt }` |
| PUT    | `/api/data`         | `{ payload, baseUpdatedAt }` (Bearer) | `{ updatedAt }` o 409 |
| GET    | `/api/photos`       | — (Bearer)                 | `{ keys }`               |
| GET    | `/api/photos/:clau` | — (Bearer)                 | el binari de la imatge   |
| PUT    | `/api/photos/:clau` | el binari (Bearer)         | 204                      |
| DELETE | `/api/photos/:clau` | — (Bearer)                 | 204                      |
| DELETE | `/api/account`      | `{ password }` (Bearer)    | 204                      |

## Desplegament (un sol cop)

Cal un compte gratuït de [Cloudflare](https://dash.cloudflare.com/sign-up).

```sh
cd server
pnpm install
npx wrangler login                        # obre el navegador per autoritzar
npx wrangler d1 create fardell            # crea la base de dades
npx wrangler r2 bucket create fardell-photos   # el bucket de les fotografies
```

Copieu el `database_id` que retorna la creació de la base de dades dins de
`wrangler.toml`, i després:

```sh
pnpm db:init                       # aplica schema.sql a la base remota
pnpm deploy                        # publica el Worker
npx wrangler secret put REGISTER_SECRET   # el codi d'invitació (recomanat!)
```

El **codi d'invitació** tanca el registre: sense el codi, ningú no pot crear
comptes (iniciar sessió no el demana). Trieu una frase qualsevol i digueu-la a
la família; a l'app va al camp «Codi d'invitació» en crear el compte. Sense el
secret definit, el registre queda obert — útil només per fer proves.

El desplegament imprimeix l'URL pública, del tipus
`https://fardell-api.<el-vostre-subdomini>.workers.dev`. És l'URL que es posa
al camp «Servidor» dels Ajustos de l'app (o a la variable `VITE_API_URL` en
compilar el frontend perquè surti emplenada per defecte).

Per actualitzar l'API després d'un canvi: `pnpm deploy` i prou.

## Desenvolupament en local

```sh
pnpm db:init:local   # crea les taules a la D1 local (Miniflare)
pnpm dev             # serveix l'API a http://localhost:8787
```

Per provar el codi d'invitació en local, poseu-lo en un fitxer `.dev.vars`
(no es puja al repositori): `REGISTER_SECRET=el-codi-que-sigui`.

## Contenció d'abusos

L'API és pública i el pla és gratuït: els límits hi són perquè un compte
hostil (o un client amb un error) no pugui buidar les quotes.

- **Registre amb codi d'invitació** (`REGISTER_SECRET`, vegeu més amunt).
- **Quota de fotografies**: 1.000 per usuari i 1 MB per imatge; només
  s'accepten tipus d'imatge (JPEG, PNG, WebP) i se serveixen amb `nosniff`.
- **Sessions**: com a molt 10 de vives per usuari (les velles cauen soles) i
  caduquen després de 90 dies sense fer-se servir.
- **Limitació de peticions**: el Worker no en fa; activeu la regla gratuïta
  del WAF de Cloudflare (n'hi ha una al pla gratuït). Al tauler:
  *Security → WAF → Rate limiting rules → Create rule*, amb:
  - Camp `URI Path`, operador `starts with`, valor `/api/`
  - «With the same characteristics»: `IP`
  - Llindar: `60` peticions per `10` segons → acció `Block`

  Amb això, la força bruta contra `/api/login` i les ràfegues per cremar la
  quota diària queden tallades a l'entrada, abans de tocar el Worker.

## Límits coneguts (a posta, per simplicitat)

- No hi ha recuperació de contrasenya: si es perd, cal esborrar l'usuari amb
  `wrangler d1 execute` i tornar-se a registrar (les dades del dispositiu no es perden).
- La limitació de peticions per IP es fa al WAF de Cloudflare, no al Worker
  (vegeu «Contenció d'abusos»).
- Les fotografies se sincronitzen «l'últim que escriu, guanya»: si es canvia la
  mateixa fotografia en dos dispositius alhora, en queda una de les dues.
