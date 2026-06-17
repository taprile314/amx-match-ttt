# Original (`amx_match_deluxe` 8.11) vs Fork TTT

Comparación de lo que traía el plugin **original** (`amx_match_deluxe` 8.11, de *Shromilder* /
*Infra*, junio 2007) contra lo que **implementamos nosotros** en este fork para el torneo TTT 2026.

---

## 1. Lo que YA traía el original (baseline 8.11)

Todo esto es funcionalidad de fábrica — **no la tocamos**, sigue funcionando igual.

### Inicio y formato de match
| Feature | Detalle |
|---|---|
| 4 comandos de inicio | `amx_match` (tags, 1 mapa), `amx_match2` (sin tags), `amx_match3` (tags, 2 mapas), `amx_match4` (sin tags, 2 mapas) |
| Formatos de match | **maxround** (`mrXX`), **timelimit** (`tlXX`), **winlimit** (`wlXX`) |
| Matches de 2 mapas | Best-of-2: juega un mapa, cambia al segundo automáticamente |
| Configs de liga | `cal`, `calot`, `ecup`, `ffa`, `jul`, `default`, `warmup` (cvars de juego por archivo) |
| Menú in-game | `amx_matchmenu` + `amx_match_addlength` / `amx_match_addconfig` |

### Flujo de partida
| Feature | Detalle |
|---|---|
| Warmup + sistema de ready | `amx_match_readytype` 0 (todos), 1 (uno por equipo), 2 (solo admin) |
| Knife round | Round de cuchillo opcional; el ganador elige lado por **votación** |
| Halftime con swap | Cambio de lado automático a la mitad (`amx_match_swaptype`) |
| Overtime | Limitado e **ilimitado** (`amx_match_overtime`, `amx_match_otlength`, `amx_match_otunlimited`, `amx_match_otcfg`) |
| End types | `amx_match_endtype` 0 (jugar todos los rounds), 1 (clinch), 2 (clinch + votación de playout) |

### Control del match (admin)
`amx_matchstart` / `/start`, `amx_matchstop` / `/stop`, `amx_matchrestart` / `/restart`,
`amx_matchrelo3` / `/relo3` (reiniciar mitad), `amx_swapteams`, `amx_randomizeteams`,
`amx_matchsave`, `amx_matchpug <on|off>`.

### Extras del original
| Feature | Detalle |
|---|---|
| Demos | Grabación server-side / HLTV / ambos (`recdemo` / `rechltv` / `recboth`), `amx_match_testhltv` |
| Stats a MySQL | Logueo de resultados + interfaz web PHP/MySQL (v8.00) |
| PUG gameplay | Modo Pick-Up-Game (v7.00) |
| Screenshots | Capturas client-side a fin de mitad/match (`amx_match_screenshot` / `screenshot2`) |
| Marcador en pantalla | `amx_match_showscore` (0/1/2) |
| Restricción de escudo | `amx_match_shield` / `shield2` |
| Password / hostname | El plugin setea `sv_password` y cambia el hostname durante el match |
| Multi-idioma | br, cz, da, de, en, fr, pl, sr, sv |

---

## 2. Lo que implementamos NOSOTROS (fork TTT)

### 2.1 — Cambio de equipo crash-safe (`md_set_team`)
**Problema:** la native `cs_set_user_team` crashea el server en la `swds.dll` no-steam de 2005 con
AMX Mod X 1.10 (el gamedata no matchea y la firma apunta mal).
**Solución:** helper propio `md_set_team(id, team)` que escribe `m_iTeam` por **offset de pdata**
(`MD_TEAM_OFFSET 114`) + `pev_team` + mensaje `TeamInfo`, sin tocar la native rota.
**Dónde:** se usa en `swap_teams()` y `randomize_teams()`. Requiere `#include <fakemeta>` (agregado).

### 2.2 — Halftime sin warmup
**Original:** fin de 1ª mitad → swap → **warmup + re-ready** → 2ª mitad.
**Fork:** fin de 1ª mitad → swap → **2ª mitad LIVE directo** (estilo CS2/CSGO).
**Dónde:** en `half_stop()`, la rama de la 1ª mitad llama a `half_start` en vez de `warmup_start`.

### 2.3 — Overtime sin warmup
**Original:** empate → warmup + ready → overtime.
**Fork:** empate → swap → **overtime LIVE directo**.
**Dónde:** rama de overtime de `half_stop()`, `half_start` en vez de `warmup_start`.

### 2.4 — Freeze a espectador al terminar + cartel "MATCH TERMINADO"
**Original:** al terminar el match → ejecuta `ffa.cfg` y **vuelve a juego libre (FFA)**; todos
siguen jugando.
**Fork:** al terminar (fin natural, no overtime ni 2-map) → **pasa a todos a espectador** y deja el
server **congelado en el mapa** esperando al admin, con un cartel grande rojo **"MATCH TERMINADO"**.
**Dónde:** nueva función `md_all_to_spec()`; flag `g_spec_on_end` para distinguir el fin natural
del `/stop` manual (que **sigue volviendo a FFA** como antes). Llamado desde `uninit()`.

### 2.5 — Pausa / despausa de match
**Original:** no existía.
**Fork:** comandos nuevos `amx_matchpause` / `/pause` y `amx_matchunpause` / `/unpause`.
Congela a los jugadores (`FL_FROZEN`) + godmode (`pev_takedamage 0`) mientras está en pausa;
el unpause hace **countdown 3-2-1** antes de reanudar.
**Dónde:** globales `g_paused`, `g_unpause_t`; funciones `match_pause`, `pause_hud`, `match_unpause`.

### 2.6 — Traducción al español
**Original:** 9 idiomas, **sin español**.
**Fork:** sección **`[es]`** completa (199 claves) en `data/lang/amx_match_deluxe.txt`, sin acentos
para garantizar compatibilidad con la fuente del cliente. Se activa con `amx_language "es"`.

### 2.7 — FFA silencioso al terminar
**Original:** al terminar imprime "Ejecutando config FFA" y `ffa.cfg` dice "FFA config loaded...".
**Fork:** en modo fin-de-match **no** se imprime "Ejecutando config FFA", y se comentó el
`say FFA config loaded...` en `ffa.cfg`. Queda limpio el cierre del match.

---

## 3. Comandos / cvars NUEVOS de este fork

| Tipo | Nombre | Qué hace |
|---|---|---|
| Comando | `amx_matchpause` / `say /pause` | Pausa el match (congela + godmode) |
| Comando | `amx_matchunpause` / `say /unpause` | Reanuda con countdown 3-2-1 |
| Idioma | `amx_language "es"` | Activa la traducción al español agregada |

> No agregamos cvars de configuración nuevos para el resto de los cambios (halftime/overtime sin
> warmup, freeze a espectador): son comportamiento fijo del fork. Si en el futuro querés hacerlos
> opcionales por cvar, es un buen próximo paso.

---

## 4. Lo que NO cambiamos (sigue 100% como el original)

Formatos de match, knife round, stats a MySQL, demos/HLTV, PUG, matches de 2 mapas, end types,
screenshots, restricción de escudo, menú, y el resto de los comandos de control. Solo se modificó
lo listado en la sección 2.
