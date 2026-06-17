# Guía: cómo correr un match con AMX Match Deluxe

Guía operativa del plugin **`amx_match_deluxe`** (8.11) tal como está instalado en este pendrive.
Los comandos y cvars de abajo están sacados del código real (`assets/cs16/amx_match_deluxe.sma`)
y de tu config (`amxmd.cfg`), no de la doc genérica del foro — coinciden con tu versión.

> Contexto del stack: ver `CLAUDE.md`. El servidor se levanta con `start_servidor_ttt.bat`.

---

## 0. Requisitos previos (una sola vez)

1. **Servidor arriba** (`start_servidor_ttt.bat`) y, si querés stats persistentes, **MySQL arriba**
   con la base `amx` creada (ver "Stats a la base de datos" más abajo).
2. **Ser admin.** Los comandos de match requieren el flag de acceso **`a`**
   (`ADMIN_LEVEL_A`). En este setup el admin ya está configurado:
   - Usuario `TTT_Admin`, password `TTT2026`, flag `a` (`addons/amxmodx/configs/users.ini`).
   - El cliente local se autentica solo vía `cstrike/autoexec.cfg`
     (`name "TTT_Admin"` + `setinfo _pw "TTT2026"`).
   - Desde otra PC: poné tu nombre en `TTT_Admin` y en consola `setinfo _pw "TTT2026"`,
     o ejecutá los comandos por **rcon** desde la consola del servidor.

---

## 1. Arrancar un match (comando del admin)

Hay 4 variantes del comando. Se escriben en la **consola del admin** (o por rcon):

| Comando      | Sintaxis                                                                           |
| ------------ | ---------------------------------------------------------------------------------- |
| `amx_match`  | `<tag_CT> <tag_T> <mrXX\|tlXX> <config> [recdemo\|rechltv\|recboth]`               |
| `amx_match2` | `<mrXX\|tlXX> <config> [recdemo\|rechltv\|recboth]` (sin clan tags)                |
| `amx_match3` | `<tag_CT> <tag_T> <mrXX\|tlXX> <config> <segundo_mapa> [rec...]` (best-of-2 mapas) |
| `amx_match4` | `<mrXX\|tlXX> <config> <segundo_mapa> [rec...]` (sin tags, 2 mapas)                |

**Qué significa cada argumento:**

- **`tag_CT` / `tag_T`** — clan tag de cada equipo (ej. `RED` `BLU`). El plugin renombra/agrupa.
- **`mrXX` / `tlXX`** — formato del match:
  - `mrXX` = _max rounds_: XX rounds por mitad. `mr15` → mitades de 15, primero a 16 gana (30+).
  - `tlXX` = _time limit_: mitades de XX minutos. `tl15` → mitades de 15 min.
- **`config`** — nombre (sin `.cfg`) de un archivo de liga en
  `addons/amxmodx/configs/amxmd/leagues/`. Instalados: `cal`, `calot`, `ecup`, `ffa`, `jul`,
  `default`, `warmup`. Ese archivo fija las cvars de juego (freezetime, buytime, c4timer, etc.).
- **`[recdemo|rechltv|recboth]`** — opcional, graba demo del lado servidor / HLTV / ambos.

**Ejemplo típico (5v5, MR15, config CAL, con demo):**

```
amx_match BLU RED mr15 cal recdemo
```

Sin tags, formato CAL estándar:

```
amx_match2 mr15 cal
```

**Por menú (más fácil):** `amx_matchmenu` abre un menú in-game para elegir largo y config.
Tu `amxmd.cfg` precarga el menú con:

- Largos (`amx_match_lmenu`): 10, 12, 13, 15, 20, 30
- Configs (`amx_match_cmenu`): "EuroCup Config" (`ecup`), "CAL config" (`cal`)

---

## 2. Flujo del match (qué pasa después del comando)

Con la config **actual** de `amxmd.cfg`:

1. **Warmup + Ready up.** El plugin entra en warmup y espera que los equipos estén listos
   (`amx_match_readytype "1"` = sistema de "ready"). Hace falta el cupo de jugadores
   (`amx_match_playerneed "10"` = 5v5).
   - Los **jugadores** escriben en el chat: `ready` o `/ready` (y `notready` / `/notready` para
     desmarcarse).
2. **Knife round:** está **desactivado** (`amx_match_kniferound "0"`). Si lo activaras, al terminar
   el knife el equipo ganador elige lado con `/ct` o `/t` en el chat.
3. **LIVE → 1ª mitad.** Cuando todos están ready, el plugin reinicia y va a "LIVE".
4. **Halftime:** cambia de lado automáticamente (`amx_match_swaptype "1"`) y juega la **2ª mitad**.
5. **Fin / Overtime.** El overtime está **activado** (`amx_match_overtime "1"`,
   `amx_match_otlength "3"` = MR3, con su config `amx_match_otcfg "1"`). Si empatan, se juega OT.
6. **Resultado:** se muestra el score (`amx_match_showscore "1"`) y, si los stats están activos
   (`amx_match_stats "1"`), se guardan (ver abajo).

> ⚠️ **Password del match:** `amx_match_password "1"` con `amx_match_password2 "TTT"` hace que al
> iniciar el match el servidor ponga `sv_password "TTT"`. Pasale esa clave a los jugadores, o
> ponés `amx_match_password "0"` en `amxmd.cfg` si no querés password.

---

## 3. Comandos de control durante el match (admin, flag `a`)

Funcionan por consola **y** por chat (las versiones con `/`):

| Acción                             | Consola                  | Chat       |
| ---------------------------------- | ------------------------ | ---------- |
| Forzar inicio (saltear ready)      | `amx_matchstart`         | `/start`   |
| Frenar / cancelar el match         | `amx_matchstop`          | `/stop`    |
| Reiniciar el match desde cero      | `amx_matchrestart`       | `/restart` |
| Reiniciar la mitad actual          | `amx_matchrelo3`         | `/relo3`   |
| Intercambiar equipos de lado       | `amx_swapteams`          | —          |
| Randomizar equipos                 | `amx_randomizeteams`     | —          |
| Probar que HLTV conecta            | `amx_match_testhltv`     | —          |
| Modo PUG on/off                    | `amx_matchpug <on\|off>` | —          |
| Guardar cvars actuales a amxmd.cfg | `amx_matchsave`          | —          |

Comandos de chat para **jugadores**: `ready` / `/ready`, `notready` / `/notready`,
y `/ct` `/t` (solo si hay knife round).

---

## 4. Stats a la base de datos (MySQL)

Como `amx_match_stats "1"`, los resultados del match se persisten. La conexión sale de
`addons/amxmodx/configs/sql.cfg` (host `127.0.0.1`, user `root`, sin pass, base `amx`).

**Antes del primer match**, crear la base y las tablas (el plugin no puede crearlas solo en
MariaDB 11 por la sintaxis vieja `TYPE=MyISAM`):

```bat
mysql-portable\connect.bat -e "CREATE DATABASE IF NOT EXISTS amx;"
mysql-portable\connect.bat amx < mysql-portable\amx_match_deluxe_mariadb.sql
```

Después de un match, podés revisar los resultados:

```bat
mysql-portable\connect.bat amx -e "SELECT * FROM amx_match_main;"
mysql-portable\connect.bat amx -e "SELECT * FROM amx_match_player_statistics;"
```

---

## 5. Receta rápida para el torneo

```
1) start_servidor_ttt.bat                 (levanta MySQL + TeamSpeak + CS)
2) (1ª vez) crear base amx + tablas        (ver sección 4)
3) Equipos entran al server; el admin escribe:
       amx_match RED BLU mr15 cal recdemo
   o usa el menú:  amx_matchmenu
4) Jugadores escriben "ready" en el chat. (10 jugadores = listo)
5) El match va LIVE solo. Si hace falta forzar:  /start
6) Termina, swap de lado, 2ª mitad, (overtime si empatan).
7) Resultado en pantalla + guardado en la base amx.
```

### Ajustes comunes (editar `addons/amxmodx/configs/amxmd/amxmd.cfg`)

| Querés…                          | Cambiá                                      |
| -------------------------------- | ------------------------------------------- |
| Sin password de match            | `amx_match_password "0"`                    |
| Con knife round para elegir lado | `amx_match_kniferound "1"`                  |
| Sin overtime                     | `amx_match_overtime "0"`                    |
| Otro cupo (ej. 2v2)              | `amx_match_playerneed "4"`                  |
| Empezar sin esperar "ready"      | `amx_match_readytype "0"` (o usar `/start`) |

Los cambios en `amxmd.cfg` se aplican al reiniciar el plugin/mapa o con `amx_matchsave` tras
ajustarlos in-game desde el menú de settings.
