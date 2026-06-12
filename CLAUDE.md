# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este repo

Fork personalizado del plugin **AMX Mod X `amx_match_deluxe` 8.11** (Pawn) para Counter-Strike 1.6,
usado en el torneo LAN **"TTT 2026"**. Contiene **solo el plugin + sus configs + el panel rcon** — NO
el stack completo (los game binaries de CS, MariaDB y TeamSpeak viven en el repo padre `sv_cs_ttt/`,
fuera de este git). Detalle de qué se le cambió al original: `README.md`, `CHANGELOG.md` y
`docs/ORIGINAL-VS-FORK.md`.

## Build / deploy

No hay tests automatizados ni linter: es un plugin de juego, se verifica **in-game**.

```bat
build.bat        REM compila scripting\amx_match_deluxe.sma -> plugins\amx_match_deluxe.amxx
                 REM y copia el .amxx al server adyacente
```

- El **compilador `amxxpc.exe` NO se versiona** acá: `build.bat` lo busca en
  `..\Counter-Strike 1.6-amx\cstrike\addons\amxmodx\scripting` (variable `AMXX` arriba del `.bat`).
  Esto asume que el repo está **dentro del stack USB, al lado de `Counter-Strike 1.6-amx/`**. Si el
  AMX Mod X está en otra ruta, editar la variable `AMXX`.
- El **`.amxx` compilado NO se versiona** (`plugins/*.amxx` está en `.gitignore`): es un artefacto de
  build. Se publica como **release asset** (ver "Releases" abajo). `plugins/.gitkeep` mantiene la carpeta.
- Tras compilar, el plugin nuevo se carga recién al **`changelevel`** o reinicio del server (AMX Mod X
  lee los `.amxx` al cargar el mapa).

### Releases (publicar una versión)

```bat
release.bat v1.0.0
```
Compila → arma un **bundle de deploy** (`dist/amx-match-ttt-vX.Y.Z.zip`, que espeja la estructura
`addons/amxmodx/` para extraer sobre `cstrike/`) → crea un **GitHub Release** con ese zip adjunto vía
el CLI `gh` (debe estar logueado). Requiere el commit pusheado (el tag se crea sobre HEAD). Actualizar
`CHANGELOG.md` antes de cortar la versión. `INSTALL.txt` (incluido en el bundle) explica el deploy al
usuario final.
- Compilación válida = se genera el `.amxx` con `Done.` (hay warnings preexistentes de símbolos
  deprecados y unreachable code — son inofensivos, no romper por ellos).

El flujo de trabajo es: editar `scripting/amx_match_deluxe.sma` → `build.bat` → `changelevel` → probar.

## Arquitectura del plugin — lo que NO es obvio leyendo un solo archivo

Todo el plugin es **un único `.sma` de ~7600 líneas** (`scripting/amx_match_deluxe.sma`). Las
modificaciones del fork (vs el 8.11 original) son puntuales y conviene conocerlas antes de tocar:

- **Cambio de equipo crash-safe (`md_set_team`, línea ~335).** La native `cs_set_user_team` de AMX
  Mod X 1.10 **crashea** en la `swds.dll` no-steam de 2005 de este torneo (el gamedata no matchea).
  `md_set_team` la reemplaza escribiendo `m_iTeam` por offset de pdata + `pev_team` + mensaje
  `TeamInfo`. ⚠️ **El offset está hardcodeado: `#define MD_TEAM_OFFSET 114` (m_iTeam, Windows).** Es
  específico de ese build del engine — si se cambia el engine, este offset puede romper. Usado en
  `swap_teams` y `randomize_teams`. Por esto el plugin agrega `#include <fakemeta>` (no estaba en el
  original).

- **Fin de match → freeze a espectador.** Al terminar un match natural (no overtime, no 2-map),
  `md_all_to_spec()` pasa a todos a espectador y deja el server congelado en el mapa con un HUD
  "MATCH TERMINADO". La pieza clave es el flag global **`g_spec_on_end`**: se setea en `half_stop`
  (fin natural) y se consume en `uninit`, para distinguir el fin natural (→ freeze) del **`/stop`
  manual** (que sigue volviendo a FFA como el original). Tocar uno sin entender el otro rompe el flujo.

- **Halftime y overtime LIVE directo (sin warmup).** Al terminar la 1ª mitad / al entrar overtime, en
  vez de `warmup_start` se llama a `half_start` → arranca LIVE sin re-ready (estilo CSGO).

- **Pausa de match** (`match_pause`/`match_unpause`, `/pause` `/unpause`): congela jugadores + godmode;
  el unpause hace countdown 3-2-1. Globales `g_paused`, `g_unpause_t`; HUD en `pause_hud`.

## Idiomas / traducción

Los textos in-game NO están hardcodeados: el `.sma` usa `%L ... "CLAVE"` y las claves se resuelven en
**`data/lang/amx_match_deluxe.txt`** (diccionario multi-idioma). **Traducir o editar textos no requiere
recompilar** — se edita el `.txt` (lado derecho del `=`, la CLAVE no se toca) y se recarga el mapa. El
fork agregó la sección **`[es]`** (199 claves, sin acentos por compatibilidad de fuente del cliente). El
idioma activo lo decide el cvar `amx_language` en el server.

## Configs (se despliegan dentro de `cstrike/addons/amxmodx/`)

- `configs/amxmd/amxmd.cfg` — config principal del plugin (cvars `amx_match_*`).
- `configs/amxmd/leagues/*.cfg` — presets de liga que fijan reglas de juego (`cal`, `ecup`, `calot`,
  `ffa`, etc.). Se pasan como argumento `<config>` al iniciar un match.
- `configs/sql.cfg` — conexión MySQL/MariaDB para stats (host/user/pass/db).
- `configs/users.ini.example` — plantilla de admins. **Las credenciales reales (`configs/users.ini`)
  están en `.gitignore`**; solo se versiona el `.example`. Misma política para `rcon-panel/config.json`.

## rcon-panel/ — panel de control web

Herramienta aparte (no es parte del plugin): panel web en **Node con cero dependencias** (módulos
nativos `http` + `dgram`) para controlar el server por rcon.

- `node server.js` o `start_panel.bat` (portable, `%~dp0`). Sirve `public/index.html` + API rcon.
- **El rcon de GoldSrc es por UDP** (a diferencia de Source que es TCP): handshake challenge → comando.
  La `rconPassword` vive solo en el backend (`config.json`), nunca llega al navegador.
- **`config.json` está en `.gitignore`** (tiene passwords). Copiar `config.example.json` → `config.json`
  y editar antes de usar.
- `rcon-test.js` — CLI de diagnóstico: `node rcon-test.js "status"` (usa el mismo `config.json`).

## Comandos in-game (admin = flag `a`)

Referencia completa en `docs/GUIA_MATCH.md`. Resumen: `amx_match[2|3|4]` (iniciar; `mrXX`=rounds por
mitad, `tlXX`=minutos), `amx_matchmenu`, `amx_matchstart`/`/start`, `amx_matchstop`/`/stop`,
`amx_matchrestart`, `amx_swapteams`, `amx_matchpause`/`/pause`, `amx_matchunpause`/`/unpause`.
Jugadores: `ready`/`notready`, `/ct` `/t` (si hay knife round).
