# Changelog

Cambios de este fork respecto del `amx_match_deluxe` 8.11 original.
Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- **Repo reestructurado como monorepo.** Los tres componentes pasaron a vivir bajo `apps/`
  (`apps/plugin/`, `apps/rcon-panel/`, `apps/motd-server/`) y el tooling de build/release a `tools/`.
  Se actualizaron todas las rutas relativas (`.bat` de `tools/`, `.gitignore`, docs) y las refs del
  orquestador `start_servidor_ttt.bat` del stack padre. Portabilidad USB intacta (sin rutas con letra
  de unidad; los `.bat` de `tools/` resuelven el stack hermano con `..\..`).

### Removed
- **`build.bat` (build legacy contra el stack stock).** Ya no compilaba `main` (el `.sma` usa
  `#include <reapi>`, ausente en el stack stock); el build vigente es `tools/build_rehlds.bat`. Para
  recompilar la baseline, está el tag `v1.0.0`.

## [2.0.0] - 2026-06-17

Segunda release mayor: el fork migró de HLDS stock a **ReHLDS + ReGameDLL + ReAPI**. Esto habilita el
objetivo central que el engine stock no permitía — **una pausa real que congela también el reloj de la
partida** (ronda, freezetime y C4), no solo a los jugadores. La rama `rehlds-port` pasó a ser `main`;
la baseline sobre HLDS stock queda como [1.0.0].

### Added
- **Pausa total sobre ReHLDS/ReAPI.** La pausa ahora congela el reloj de ronda además de a los
  jugadores (imposible en el engine stock de [1.0.0]). Re-pinea por frame las entidades/tiempos del
  engine vía ReAPI: el blow time de la C4, el fin del freezetime y `m_fRoundStartTimeReal` (de donde
  el engine mide el BUYTIME). Ver _Fixed_ para los casos de borde resueltos (C4 plantada, freezetime,
  ronda viva).
- **`rg_set_user_team` (ReAPI) reemplaza el hack del offset.** El cambio de equipo crash-safe de
  [1.0.0] (`md_set_team`, que escribía `m_iTeam` por el offset 114 de pdata) pasó a usar la native
  `rg_set_user_team` de ReAPI — sin offsets hardcodeados atados a un build puntual del engine.
- **Volcado de estadísticas para el panel rcon.** Nuevo comando admin `amx_md_stats` que escupe en
  líneas parseables el marcador de rondas real del match (`MDS|T|<ct>|<t>`, sumando 1ª + 2ª mitad +
  2-map + overtime) y, por jugador, `MDS|P|<userid>|<authid>|<kills>|<deaths>|<team>|<name>`
  (kills = frags del marcador, muertes = `cs_get_user_deaths`). El `rcon-panel` lo consulta para
  mostrar un contador de kills/muertes/rondas por partido **y** acumulado del torneo (persistido en
  `stats.json`, cerrando cada match automáticamente al reiniciarse el marcador).
- **Línea de equipos con nombre + lado actual (`MDS|TS`)** en el volcado de stats, para que el panel
  siga a cada equipo a través del swap de halftime: `MDS|TS|<clanCT>|<score>|<ladoActual>|<clanT>|<score>|<ladoActual>`.
  Los clanes `main_clanCT`/`main_clanT` nunca se swapean; el lado físico actual se deriva de
  `main_inprogress` (≥3 = 2ª mitad o knife de desempate → ya swapeado).
- **Cartel "EL GANADOR ES &lt;equipo&gt;"** en la pantalla de fin de match. `md_all_to_spec()` arma el
  HUD con el nombre del equipo ganador, capturado en el bloque de resolución del marcador (global
  `g_winner_name`: `main_clanCT` / `main_clanT` según quién ganó, vacío = empate → muestra "EMPATE").
- **Desempate por knife round (reemplaza al overtime).** Cuando el match termina empatado y
  `amx_match_overtime` está en 1, en vez de jugar overtime se juega **un knife round de muerte súbita**:
  el equipo que gana esa ronda gana el match. Flag `g_knife_decider`; reusa el sistema de knife round
  existente (`main_inkniferound` fuerza cuchillo, `kniferound_teamwin` detecta el ganador vía el sonido
  de radio) pero, en vez del voto de lado del knife de inicio, llama a `md_knife_decider_finish()` que
  setea `g_winner_name` con el clan ganador y dispara el freeze a espectador con el cartel
  "EL GANADOR ES …". Si `amx_match_overtime` está en 0, el empate termina como empate (sin desempate).
- **rcon-panel: gestión completa de torneo.** El panel sumó (datos persistidos por fuera del juego,
  en `tournament.json` / `pc-labels.json` / `stats.json`, todos fuera del git):
  - **Equipos + fixture + tabla de posiciones.** Alta de equipos (nombre + tag), armado de match
    (A vs B, lado, fase, formato, config) con **▶ Crear y arrancar** que lanza `amx_match` por rcon
    y empuja `amx_match_overtime` según fase (0 grupos / 1 semis-final). Fixture con estados
    (pendiente/en vivo/cerrado), cierre **semi-manual** (prerellena el marcador con el score en vivo,
    el admin confirma/intercambia) y tabla de grupos auto-computada (PJ, G/E/P, RF:RA, dif, pts).
  - **Etiquetas de PC por IP** (la IP LAN es el único id físico confiable en no-steam): columna PC,
    etiquetar puesto/fila, y **asignar una fila entera** a CT/TT/SPEC de un click.
  - **Gestión de bans** por IP (`addip`) o ID (`banid`) con duración, lista de bans activos y
    `writeip`/`writeid` para que sobrevivan al reinicio.
  - **Card de estadísticas** (rondas + K/D por jugador) con vista Partido / Acumulado del torneo.

### Fixed
- **El freeze a espectador fallaba con presets de liga restrictivos.** Las configs `cal`/`calot`
  traen `allow_spectators 0` (y `jul` trae `sv_maxspectators 1`), así que al terminar el match el
  server rebotaba a los jugadores cuando `md_all_to_spec()` los mandaba a espectador. Ahora la función
  fuerza `allow_spectators 1` + `sv_maxspectators 32` **antes** de mover a nadie, así el freeze
  funciona sin importar con qué config se arrancó el match (los `.cfg` de liga se dejan con
  `allow_spectators 0` a propósito: eso es correcto *durante* la partida, solo se abre al terminar).
- **Pausa con la C4 plantada: el HUD ya no pierde el timer de la bomba.** `pause_hud` y el resync de
  `match_unpause` mandaban siempre por `RoundTime` el tiempo de **ronda**, pisando el número de la C4
  (que c4timer pone en ese mismo HUD) y sin devolverlo al reanudar. Nuevo helper `md_send_frozen_time()`:
  si hay C4 plantada manda los segundos de la **bomba** (`g_pause_c4_left`), si no el tiempo de ronda.
  Así el timer de la C4 queda congelado durante la pausa y vuelve solo al despausar, sincronizado con
  la detonación real (que `md_pause_frame` ya pineaba).
- **Pausa durante el freezetime: el período de compra ya no se vence durante la pausa.** El freeze de
  inicio de ronda termina en tiempo real cuando `gametime >= m_fRoundStartTimeReal`, valor que
  `md_pause_frame` no pineaba → al pausar en la compra, el freezetime se vencía y la ronda se iba a
  LIVE por debajo. Ahora `match_pause` detecta `m_bFreezePeriod`, guarda los segundos restantes
  (`g_pause_freeze_left`) y `md_pause_frame` re-pinea `m_fRoundStartTimeReal` cada frame, así el freeze
  se congela y se reanuda con el tiempo que tenía.
- **Pausa con la ronda viva: la ventana de compra ya no se vence durante la pausa.** El BUYTIME lo
  mide el engine desde `m_fRoundStartTimeReal`; con la ronda viva ese valor queda en el pasado y, sin
  re-pinearlo, `gametime - m_fRoundStartTimeReal` seguía creciendo durante la pausa → la compra se
  vencía. Ahora `match_pause` guarda los segundos transcurridos (`g_pause_real_elapsed`) y
  `md_pause_frame` clava `m_fRoundStartTimeReal` cada frame para mantener ese delta constante (fuera
  del freeze; en freeze sigue aplicando el caso anterior).

### Changed
- **Defaults de `amxmd.cfg` para el formato del torneo.** `amx_match_endtype` pasó a `1` (clinch
  estándar: corta al ganar la ronda MR+1, p.ej. MR10 → corta en 11) y `amx_match_overtime` a `0`
  (default seguro de fase de grupos: el empate se define por puntaje, sin knife). El panel empuja
  `amx_match_overtime 1` por rcon en semis/final para habilitar el desempate por knife.
- **MOTD: reglas del torneo concretas.** El `index.html` del motd-server reemplazó los placeholders
  `[EDITAR: …]` por las reglas reales (fase de grupos a 11 / semis y final a 13, empate por puntaje
  vs. knife, política de pausas: 3 × 30 s por equipo y partida, solo entre rondas).
- **Ayuda de comandos de consola traducida al español.** Los textos del 4º argumento de
  `register_concmd`/`register_clcmd` (los que muestra `amx_help` o un comando con argumentos mal)
  pasaron de inglés a español (`Restart a match` → `Reiniciar un match`, `<Config filename>` →
  `<archivo de config>`, etc.). No afecta el sistema `%L` ni el diccionario, que ya estaban completos.

### Stack (fuera del plugin)
- **c4timer** (`c4timer.amxx`, plugin de terceros de `assets/cs16/c4_timer.7z`) instalado en el stack
  ReHLDS: muestra la cuenta de la C4 en el HUD del round timer al plantar. **Compatible con la pausa**
  (usan mecanismos distintos: la pausa pinea la entidad real de la C4 por frame, c4timer solo manda
  mensajes de display). El roce cosmético del HUD al pausar con la bomba plantada quedó resuelto con
  `md_send_frozen_time()` (ver _Fixed_ arriba).

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
