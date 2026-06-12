# amx-match-ttt

Fork personalizado del plugin **AMX Mod X `amx_match_deluxe` 8.11** (originalmente de
*Shromilder*, portado a AMX Mod X por *Infra*), adaptado para el torneo de **Counter-Strike 1.6
"TTT 2026"** que corre sobre un stack portable (USB) en LAN.

> Este repo contiene **solo el plugin y sus configs** — no el stack completo (game binaries,
> MariaDB, TeamSpeak viven aparte).

## Qué le agregamos al plugin original

| Feature | Descripción |
|---|---|
| **Cambio de equipo crash-safe** (`md_set_team`) | Reemplaza la native `cs_set_user_team`, que crashea en esta `swds.dll` no-steam con AMX Mod X 1.10. Cambia el equipo por offset de `pdata` (`m_iTeam`) + `pev_team` + mensaje `TeamInfo`. |
| **Halftime sin warmup** | Al terminar la 1ª mitad: swap de lados → 2ª mitad **LIVE directo** (sin warmup ni re-ready). |
| **Overtime sin warmup** | Si el match empata: swap → overtime **LIVE directo**. |
| **Freeze a espectador al terminar** | Al terminar el match, pasa a **todos a espectador** y deja el server congelado en el mapa esperando al admin, con un cartel grande **"MATCH TERMINADO"**. |
| **Pausa / despausa** (`/pause`, `/unpause`) | Congela a los jugadores en el lugar + godmode; el unpause hace countdown 3-2-1. |
| **Traducción al español** | Sección `[es]` completa en el diccionario `amx_match_deluxe.txt` (sin acentos para compatibilidad de fuente). |
| **FFA silencioso** | Sin el ruido de "FFA config loaded" / "Ejecutando config FFA" al terminar el match. |

Detalle por commit en [`CHANGELOG.md`](CHANGELOG.md).

## Estructura del repo

```
scripting/amx_match_deluxe.sma     ⭐ fuente del plugin (lo que se edita)
plugins/amx_match_deluxe.amxx        compilado (deliverable, para deploy directo)
data/lang/amx_match_deluxe.txt       diccionario multi-idioma (incluye [es])
configs/amxmd/amxmd.cfg              config principal del plugin
configs/amxmd/leagues/*.cfg          configs de liga (cal, ecup, ffa, etc.)
configs/sql.cfg                      conexión MySQL/MariaDB para stats
configs/users.ini.example            admins (plantilla — sin credenciales reales)
docs/GUIA_MATCH.md                   guía operativa de comandos y flujo
build.bat                            compila el .sma y lo despliega al server
```

## Instalar en un server de CS 1.6 + AMX Mod X

Copiá cada archivo a su lugar dentro de `cstrike/`:

| Del repo | Va en |
|---|---|
| `scripting/amx_match_deluxe.sma` | `addons/amxmodx/scripting/` |
| `plugins/amx_match_deluxe.amxx` | `addons/amxmodx/plugins/` |
| `data/lang/amx_match_deluxe.txt` | `addons/amxmodx/data/lang/` |
| `configs/amxmd/` | `addons/amxmodx/configs/amxmd/` |
| `configs/sql.cfg` | `addons/amxmodx/configs/` |
| `configs/users.ini.example` | `addons/amxmodx/configs/users.ini` (renombrar y completar) |

Asegurate de que `addons/amxmodx/configs/plugins.ini` cargue `amx_match_deluxe.amxx`, y de tener
`amx_language "es"` en `addons/amxmodx/configs/amxx.cfg` para que salga en español.

## Compilar

Requiere el compilador `amxxpc.exe` de AMX Mod X (no se versiona acá). Si el repo está dentro del
stack USB (al lado de `Counter-Strike 1.6-amx/`), simplemente:

```bat
build.bat
```

Compila `scripting/amx_match_deluxe.sma` → `plugins/amx_match_deluxe.amxx` y lo copia al server.
Si tu AMX Mod X está en otra ruta, editá la variable `AMXX` arriba del `.bat`.

## Comandos

Ver [`docs/GUIA_MATCH.md`](docs/GUIA_MATCH.md). Resumen de admin (flag `a`): `amx_match[2|3|4]`,
`amx_matchmenu`, `amx_matchstart` / `/start`, `amx_matchstop` / `/stop`, `amx_matchrestart`,
`amx_swapteams`, `amx_matchpause` / `/pause`, `amx_matchunpause` / `/unpause`. Jugadores:
`ready` / `notready`, `/ct` `/t` (knife round).

## Licencia y créditos

Trabajo derivado de `amx_match_deluxe` (Shromilder, Infra) y AMX Mod X, distribuido bajo **GPL**.
Ver [`LICENSE`](LICENSE). Las modificaciones de este fork son para uso del torneo TTT 2026.
