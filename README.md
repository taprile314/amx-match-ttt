# amx-match-ttt

> 🤖 **Todo este proyecto fue vibecodeado** — desarrollado con asistencia de IA (Claude Code): las
> modificaciones del fork, el panel rcon, el servidor del MOTD, el tooling de build/release y la
> documentación. Tenelo en cuenta al revisar o auditar el código.

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

Detalle por commit en [`CHANGELOG.md`](CHANGELOG.md). Comparación completa original vs fork en
[`apps/plugin/docs/ORIGINAL-VS-FORK.md`](apps/plugin/docs/ORIGINAL-VS-FORK.md).

## Estructura del repo (monorepo)

Tres componentes bajo `apps/`, más el tooling de build/release en `tools/`:

```
apps/plugin/                                 ⭐ el plugin AMX Mod X (Pawn)
  scripting/amx_match_deluxe.sma               fuente del plugin (lo que se edita)
  plugins/amx_match_deluxe.amxx                compilado — NO versionado (release asset / build local)
  data/lang/amx_match_deluxe.txt               diccionario multi-idioma (incluye [es])
  configs/amxmd/amxmd.cfg                       config principal del plugin
  configs/amxmd/leagues/*.cfg                   configs de liga (cal, ecup, ffa, etc.)
  configs/sql.cfg                               conexión MySQL/MariaDB para stats
  configs/users.ini.example                     admins (plantilla — sin credenciales reales)
  docs/GUIA_MATCH.md                            guía operativa de comandos y flujo
  INSTALL.txt                                   instrucciones de deploy (van en el bundle)
apps/rcon-panel/                             panel de control web (Node, rcon)
apps/motd-server/                            servidor HTTP del MOTD (PowerShell)
tools/build_rehlds.bat                       compila el .sma (stack ReHLDS) y lo despliega al server
tools/release.bat                            compila + arma bundle .zip + publica GitHub Release
```

> El `.amxx` compilado **no se versiona** (está en `.gitignore`). Para deploy, bajá el bundle de la
> última [Release](https://github.com/taprile314/amx-match-ttt/releases) o compilalo con `tools\build_rehlds.bat`.

## Instalar en un server de CS 1.6 + AMX Mod X

> ⚠️ **Requisitos de runtime (v2.0.0):** servidor dedicado sobre **ReHLDS + ReGameDLL**, con
> **Metamod + AMX Mod X 1.10** y los módulos **`reapi` (`reapi_amxx.dll`), `cstrike`, `fakemeta` y
> `regex`** cargados. Desde v2.0.0 el plugin usa natives de ReAPI (`#include <reapi>`), por lo que
> **NO carga en un HLDS stock** ni en un engine sin ReGameDLL/ReAPI. Para HLDS stock, usá la release
> [`v1.0.0`](https://github.com/taprile314/amx-match-ttt/releases/tag/v1.0.0) (baseline sin ReAPI).

Copiá cada archivo a su lugar dentro de `cstrike/`:

| Del repo | Va en |
|---|---|
| `apps/plugin/scripting/amx_match_deluxe.sma` | `addons/amxmodx/scripting/` |
| `apps/plugin/plugins/amx_match_deluxe.amxx` | `addons/amxmodx/plugins/` |
| `apps/plugin/data/lang/amx_match_deluxe.txt` | `addons/amxmodx/data/lang/` |
| `apps/plugin/configs/amxmd/` | `addons/amxmodx/configs/amxmd/` |
| `apps/plugin/configs/sql.cfg` | `addons/amxmodx/configs/` |
| `apps/plugin/configs/users.ini.example` | `addons/amxmodx/configs/users.ini` (renombrar y completar) |

Asegurate de que `addons/amxmodx/configs/plugins.ini` cargue `amx_match_deluxe.amxx`, y de tener
`amx_language "es"` en `addons/amxmodx/configs/amxx.cfg` para que salga en español.

## Compilar

Requiere el compilador `amxxpc.exe` de AMX Mod X (no se versiona acá). El plugin usa
`#include <reapi>`, así que se compila con el `amxxpc.exe` del **stack ReHLDS**. Si el repo está dentro
del stack USB (al lado de `cs1.6_RE-HDLS/`), simplemente:

```bat
tools\build_rehlds.bat
```

Compila `apps/plugin/scripting/amx_match_deluxe.sma` → `apps/plugin/plugins/amx_match_deluxe.amxx` y lo
copia al server. Si tu AMX Mod X está en otra ruta, editá la variable `AMXX` arriba del `.bat`.

## Releases

El binario no se versiona; cada versión se publica como **GitHub Release** con un bundle de deploy
adjunto. Para cortar una versión (requiere `gh` logueado y el commit pusheado):

```bat
tools\release.bat v2.0.0
```

Compila, arma `dist/amx-match-ttt-v2.0.0.zip` (espeja `addons/amxmodx/` para extraer sobre `cstrike/`,
incluye `INSTALL.txt`) y crea el Release con ese zip como asset. Antes de cada release, actualizá
`CHANGELOG.md`. Los usuarios bajan el bundle desde la
[pestaña Releases](https://github.com/taprile314/amx-match-ttt/releases).

## Comandos

Ver [`apps/plugin/docs/GUIA_MATCH.md`](apps/plugin/docs/GUIA_MATCH.md). Resumen de admin (flag `a`): `amx_match[2|3|4]`,
`amx_matchmenu`, `amx_matchstart` / `/start`, `amx_matchstop` / `/stop`, `amx_matchrestart`,
`amx_swapteams`, `amx_matchpause` / `/pause`, `amx_matchunpause` / `/unpause`. Jugadores:
`ready` / `notready`, `/ct` `/t` (knife round).

## Licencia y créditos

Trabajo derivado de `amx_match_deluxe` (Shromilder, Infra) y AMX Mod X, distribuido bajo **GPL**.
Ver [`LICENSE`](LICENSE). Las modificaciones de este fork son para uso del torneo TTT 2026.
