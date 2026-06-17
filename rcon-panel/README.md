# Panel de control web (rcon) — TTT CS 1.6

Panel web para controlar el servidor de Counter-Strike 1.6 por **rcon** desde el navegador:
cambiar mapa, iniciar/parar matches, **mover jugadores de equipo (CT / TT / SPEC) uno por uno**,
kickear, **banear / desbanear (por IP o Steam/Unique ID, con duración)**, mandar mensajes y una
consola rcon libre, con estado en vivo (mapa, jugadores y equipo).

> **Mover jugadores de equipo** requiere el plugin `amx_match_deluxe` del torneo **recompilado**
> (`build.bat`) y recargado (`changelevel`): aporta los comandos `amx_md_setteam <userid> <ct|t|spec>`
> y `amx_md_teams` (el `status` del engine no expone el equipo, y la native estándar
> `cs_set_user_team` crashea en la `swds.dll` no-steam del torneo). Con un plugin viejo el panel
> sigue andando, pero la columna de equipo queda en `?` y los botones de mover no harán efecto.

Hecho en **Node.js con cero dependencias** (módulos nativos `http` + `dgram`). No usa `npm install`.

## Requisitos

1. **Node.js** en la PC donde corre el panel (esta tiene v24). `node --version` para verificar.
2. El server de CS con **`rcon_password`** seteado (ya está en `server.cfg`: `rcon_password "TTT2026rcon"`).
   - ⚠️ El `rcon_password` toma efecto **al arrancar el server**. Si el server ya estaba corriendo
     sin password, reinícialo (o `changelevel`) para que lo tome.

## Configuración inicial (una vez)

El `config.json` con las contraseñas reales **no se versiona** (está en `.gitignore`). Copiá la
plantilla y editá tus valores:

```bat
copy config.example.json config.json
```
Luego abrí `config.json` y poné tu `rconPassword` (debe coincidir con `rcon_password` de
`server.cfg`) y tu `panelPassword`.

## Cómo levantarlo

1. Doble clic en **`start_panel.bat`** (o `node server.js` desde esta carpeta).
2. Abrí el navegador en **http://localhost:8080**.
   - Desde otra PC de la LAN: **http://IP-DE-ESTA-PC:8080** (ej. `http://192.168.1.10:8080`).
3. Entrá con la contraseña del panel (por defecto **`TTT2026`**).

## Configuración — `config.json`

| Campo           | Qué es                                                            | Default        |
|-----------------|-------------------------------------------------------------------|----------------|
| `gameHost`      | IP del server de CS (rcon UDP). `127.0.0.1` si corre en esta PC.  | `127.0.0.1`    |
| `gamePort`      | Puerto del server de CS (usamos 27016: visible en LAN y sin choque). | `27016`      |
| `rconPassword`  | **Debe coincidir** con `rcon_password` de `server.cfg`.           | `TTT2026rcon`  |
| `panelHost`     | Interfaz donde escucha el panel. `0.0.0.0` = accesible en la LAN. | `0.0.0.0`      |
| `panelPort`     | Puerto del panel web.                                             | `8080`         |
| `panelPassword` | Contraseña para entrar al panel.                                  | `TTT2026`      |
| `maps`          | Mapas que aparecen en el dropdown.                                | lista          |
| `configs`       | Configs de match en el dropdown (cal, ecup, ...).                 | lista          |

Cambiá las contraseñas antes del torneo. Si cambiás `rconPassword`, cambiá también
`rcon_password` en `server.cfg` (y reiniciá el server).

## Identificar cada PC (etiquetas) y armar equipos

En una LAN no-steam el `uniqueid` **no distingue máquinas** (casi todos los clientes reportan el mismo
`STEAM_ID_LAN` / `HLTV`) y el nombre lo cambia el jugador. El único identificador físico confiable de
cada PC es su **IP LAN**. Por eso el panel muestra una columna **PC** en la tabla de jugadores:

- Click en **`+ etiquetar`** y le ponés un **nombre** al puesto (ej. `PC-03`) y una **fila/grupo**
  (ej. `A`). Queda guardado **por IP** en `pc-labels.json` y reaparece cada vez que esa PC se conecta.
- Con cada puesto identificado, armás los equipos con los botones **CT / TT / SPEC** de cada fila
  (que ya usan `amx_md_setteam`), sabiendo qué máquina física es cada una.

**Asignar una fila entera de un toque.** Cuando hay PCs con fila/grupo asignado, arriba de la tabla
aparece una barra **"Asignar fila:"** con un control por cada grupo: `Fila A (5)  [CT] [TT] [SPEC]`.
Un click manda a **todos los jugadores conectados de esa fila** al equipo elegido (corre
`amx_md_setteam` por cada uno). Ideal para separar el lab por filas sin tocar jugador por jugador.

> ⚠️ Las etiquetas se recuerdan por IP. Dentro de una misma sesión del torneo las IPs por DHCP se
> mantienen, así que pegan bien. Si reiniciás las PCs otro día y el DHCP reparte distinto, una etiqueta
> puede quedar en otra máquina — reasignala. (Si tu lab tuviera IPs fijas, el mapeo es permanente.)
> `pc-labels.json` no se versiona (está en `.gitignore`): es específico de cada lab.

## Gestión de bans

El botón **Ban** en la tabla de jugadores abre un diálogo para banear por **IP** (`addip`) o por
**Steam/Unique ID** (`banid`), con duración (permanente / 15 min / 30 min / 1 h / 1 día). La card
**Bans activos** lista los baneos vigentes (`listid` / `listip`) y permite **quitarlos**
(`removeid` / `removeip`). Cada cambio se graba en el server con `writeip` / `writeid`, así que los
bans **sobreviven al reinicio**.

> En la LAN no-steam del torneo, **conviene banear por IP**: varios clientes suelen compartir el
> mismo Unique ID (`STEAM_ID_LAN` / `HLTV`), y un ban por ID podría afectar a más de uno. El diálogo
> elige IP por defecto cuando hay IP disponible. No requiere nada especial del plugin: usa comandos
> nativos del engine GoldSrc.

## Estadísticas (contador por fuera del juego)

La card **Estadísticas** lleva un marcador que persiste fuera del juego:

- **Rondas ganadas** por equipo (CT / TT) — el score real del plugin (1ª + 2ª mitad + overtime).
- **Kills y muertes** por jugador (con K/D), ordenado por kills.
- Dos vistas con el selector **Partido / Acumulado**:
  - **Partido**: el match en curso (se reinicia solo cuando arranca un match nuevo).
  - **Acumulado**: suma de todos los matches cerrados **+** el partido en curso, persistido en
    `stats.json`. El panel cierra un match automáticamente cuando detecta que el plugin reinició el
    marcador. Botón **Resetear acumulado** para arrancar de cero (no toca el partido en curso).

> **Requiere el plugin recompilado** (`build.bat`) y recargado (`changelevel`): aporta el comando
> `amx_md_stats` que el panel consulta por rcon. Con un plugin viejo la card queda vacía ("Sin datos")
> y el resto del panel anda igual. Como el `.sma` del torneo está en la branch **ReHLDS** (usa
> `#include <reapi>`), compilá con el `amxxpc.exe` del stack ReHLDS (`cs1.6_RE-HDLS/.../scripting`),
> no con el del stack viejo.

## Torneo (equipos, fixture y tabla de posiciones)

Dos cards manejan todo el torneo. Los datos persisten en `tournament.json` (no se versiona,
es específico de cada torneo).

**Card "Torneo — Equipos y armado de match":**
- **Equipos:** alta con **nombre** + **tag** corto (el tag es el clantag que se ve en el
  scoreboard in-game; si lo dejás vacío usa el nombre). Los podés borrar (rechaza si el equipo
  ya tiene matches en el fixture).
- **Armar match:** elegís **Equipo A vs Equipo B**, qué **lado** arranca A (CT/TT), la **fase**
  (Grupos / Semi / Final), el **formato** (autocompleta `mr10` para grupos y `mr12` para
  semis/final; editable) y el **config** (`cal`, `ecup`, …).
  - **▶ Crear y arrancar:** crea el match **y** lo lanza en el server por rcon
    (`amx_match "<tagCT>" "<tagTT>" <fmt> <cfg>`), así el scoreboard in-game muestra los nombres reales.
    Acto seguido **empuja `amx_match_overtime` según la fase**: `0` en grupos (un empate
    se define por puntaje, sin knife) y `1` en semis/final (un empate va a **knife round**
    de muerte súbita). El cvar se lee en vivo al terminar el tiempo regular, así que el
    push posterior al `amx_match` queda firme hasta ese momento — no hay que tocarlo a mano.
  - **Solo crear:** lo agenda como *pendiente* para arrancarlo después.

**Card "Torneo — Fixture y tabla de posiciones":**
- **Matches:** lista del fixture con fase, partido, marcador, estado (Pendiente / En vivo /
  Cerrado) y acciones: **Arrancar**, **Cerrar**, **Reabrir**, **Borrar**.
  - Al **Cerrar** se abre un diálogo que **prerellena el marcador con el score en vivo** del
    plugin (mapea CT/TT al equipo según el lado inicial de A) — verificalo contra el scoreboard
    del juego y confirmá. El **ganador** se deriva del marcador; en grupos (MR sin OT) un empate
    queda marcado como tal.
- **Tabla de posiciones (grupos):** se computa sola desde los matches de **grupos cerrados**:
  PJ, G/E/P, rondas a favor/en contra (RF:RA), diferencia y puntos (victoria 3, empate 1).
  Orden de desempate actual: **Pts › Dif › RF › nombre** (los criterios definitivos del torneo
  se ajustan cuando los definas).

> **Cierre de match — lo importante:** el score que lee el plugin viene por **lado actual (CT/T)**
> y los lados se **invierten en el halftime**. Por eso el cierre es **semi-manual**: el panel
> propone los números pero el admin confirma (botón **⇄** para intercambiar si quedaron al revés).
> Así nunca se atribuye mal el resultado. Requiere el plugin con `amx_md_stats` para el prerelleno;
> sin él, cargás el marcador a mano.

## Cómo funciona (rcon GoldSrc)

El rcon de CS 1.6 es **UDP** (no TCP como Source). El backend hace el handshake
(challenge → comando) y le pasa la salida al navegador. La `rcon_password` vive **solo en el
backend** (`config.json`), nunca se manda al navegador.

## Seguridad (LAN)

- El panel pide contraseña; el token de sesión va en cookie `HttpOnly`.
- Es HTTP plano (sin HTTPS): la contraseña viaja en claro por la LAN. Para un torneo en LAN
  cerrada es aceptable. No lo expongas a internet.
- Apagá el panel (Ctrl+C en su ventana) cuando no lo uses.
