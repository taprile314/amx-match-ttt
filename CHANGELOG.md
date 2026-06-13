# Changelog

Cambios de este fork respecto del `amx_match_deluxe` 8.11 original.
Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Planned
- Migración a **ReHLDS + ReGameDLL + ReAPI** (rama `rehlds-port`). Objetivo principal: **pausa real
  que congela también el tiempo de la partida**, no solo a los jugadores — imposible en el engine
  stock. De paso, reemplazar el hack del offset 114 de `md_set_team` por la native `rg_set_user_team`.

## [1.0.0] - 2026-06-12

Primera release estable. Baseline del fork sobre HLDS stock (engine no-steam del torneo), con la
pausa validada in-game. La pausa congela a los jugadores pero **NO** el reloj de ronda (limitación
del engine stock; se resuelve en el port a ReHLDS).

### Added
- **Freeze a espectador al terminar el match.** Nueva función `md_all_to_spec()`: al terminar un
  match (no overtime, no 2-map), pasa a todos los jugadores a espectador y deja el server congelado
  en el mapa esperando al admin. Flag `g_spec_on_end` para distinguir el fin natural del `/stop`
  manual (que sigue volviendo a FFA).
- **Cartel "MATCH TERMINADO"** en pantalla (HUD rojo, centrado) al finalizar.
- **Pausa / despausa de match** (`amx_matchpause` / `amx_matchunpause`, `/pause` / `/unpause`):
  congela a los jugadores + godmode (no se pueden mover ni recibir daño); el unpause hace countdown
  3-2-1. Globales `g_paused`, `g_unpause_t`; funciones `match_pause`, `pause_hud`, `match_unpause`.
  **Limitación (engine stock):** congela a los jugadores pero NO el reloj de la ronda — una pausa más
  larga que el tiempo restante deja terminar la ronda sola. La pausa total (con el tiempo) llega en
  el port a ReHLDS/ReAPI.
- **Traducción al español:** sección `[es]` completa en `amx_match_deluxe.txt` (199 claves,
  sin acentos para compatibilidad de fuente del cliente).
- **Mover jugadores de equipo desde el panel rcon.** Dos comandos admin nuevos:
  `amx_md_setteam <userid> <ct|t|spec>` (mueve UN jugador usando el helper crash-safe `md_set_team`;
  al pasar a spec mata el cuerpo si sigue vivo, como `md_all_to_spec`) y `amx_md_teams` (vuelca el
  equipo de cada jugador en líneas parseables `MDT|userid|team` para que el panel sepa en qué equipo
  está cada uno — el `status` del engine no lo expone). El `rcon-panel` agrega una columna de equipo
  y botones CT / TT / SPEC por jugador.
- **Botones de Pausa / Despausa en el panel rcon** (`amx_matchpause` / `amx_matchunpause`), que antes
  solo se podían disparar tipeándolos en la consola.

### Changed
- **"Control del match" reorganizado en el panel:** de una fila plana de botones mezclados a tres
  subgrupos etiquetados (Partida / Reiniciar / Equipos), con los reinicios ordenados de menos a más
  destructivo (Ronda → Mitad → Match) y "Mapa" separado por un divisor.
- **Halftime sin warmup:** al terminar la 1ª mitad, en vez de `warmup_start` se llama a `half_start`
  → la 2ª mitad arranca LIVE directo (estilo CS2/CSGO).
- **Overtime sin warmup:** misma idea en la rama de overtime.
- **Cambio de equipo crash-safe:** reemplazo de la native `cs_set_user_team` (que crashea en la
  `swds.dll` no-steam con AMX Mod X 1.10) por `md_set_team()`, que escribe `m_iTeam` por offset de
  pdata + `pev_team` + mensaje `TeamInfo`. Usado en `swap_teams` y `randomize_teams`.
- **FFA silencioso al terminar:** en modo fin-de-match no se imprime "Ejecutando config FFA", y se
  comentó el `say FFA config loaded...` en `ffa.cfg`.

### Fixed
- **Tags de equipo con espacios en el panel rcon.** Al iniciar un match con `amx_match`, los tags
  CT/T se mandaban sin comillas: un tag con espacio (ej. `RED TEAM`) se partía en dos argumentos y
  corría todo el resto del comando. Ahora se envuelven en comillas (`quoteArg`) y se sanitizan
  (se quitan `"`, `'`, `` ` ``, `;` y saltos de línea) antes de mandarlos por rcon.
- **Reconexión del panel tras F5.** Al recargar la página el panel quedaba "sin conexión" hasta
  re-loguearse. Causa: el RCON de GoldSrc guarda un solo challenge por IP, y dos handshakes solapados
  (el socket que dejaba el F5 + el nuevo) se pisaban ("Bad challenge"). Ahora `server.js` serializa
  todas las llamadas rcon en una cola (un solo handshake en vuelo) y el cliente saltea pedidos de
  status apilados con un guard de "request en vuelo".
- **La pausa no congelaba a los jugadores.** `FL_FROZEN` estaba redefinido como `(1<<26)`, que en el
  SDK de este engine es `FL_SPECTATOR` (no el bit de freeze). Se eliminó la redefinición; ahora usa
  el valor correcto `(1<<12)` que provee `hlsdk_const.inc` vía `fakemeta`.

### Notes
- Requiere `#include <fakemeta>` (ya agregado) además de los includes originales.
- Pausa validada in-game en el engine no-steam del torneo. La pausa total (con congelado del tiempo
  de partida) llega con la migración a ReHLDS — ver sección [Unreleased].

## [8.11] - base original
- Versión original de `amx_match_deluxe` por Shromilder (código original) e Infra (port a AMX Mod X).
