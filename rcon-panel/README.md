# Panel de control web (rcon) — TTT CS 1.6

Panel web para controlar el servidor de Counter-Strike 1.6 por **rcon** desde el navegador:
cambiar mapa, iniciar/parar matches, **mover jugadores de equipo (CT / TT / SPEC) uno por uno**,
kickear, mandar mensajes y una consola rcon libre, con estado en vivo (mapa, jugadores y equipo).

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

## Cómo funciona (rcon GoldSrc)

El rcon de CS 1.6 es **UDP** (no TCP como Source). El backend hace el handshake
(challenge → comando) y le pasa la salida al navegador. La `rcon_password` vive **solo en el
backend** (`config.json`), nunca se manda al navegador.

## Seguridad (LAN)

- El panel pide contraseña; el token de sesión va en cookie `HttpOnly`.
- Es HTTP plano (sin HTTPS): la contraseña viaja en claro por la LAN. Para un torneo en LAN
  cerrada es aceptable. No lo expongas a internet.
- Apagá el panel (Ctrl+C en su ventana) cuando no lo uses.
