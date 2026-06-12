# Changelog

Cambios de este fork respecto del `amx_match_deluxe` 8.11 original.
Formato basado en [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Freeze a espectador al terminar el match.** Nueva función `md_all_to_spec()`: al terminar un
  match (no overtime, no 2-map), pasa a todos los jugadores a espectador y deja el server congelado
  en el mapa esperando al admin. Flag `g_spec_on_end` para distinguir el fin natural del `/stop`
  manual (que sigue volviendo a FFA).
- **Cartel "MATCH TERMINADO"** en pantalla (HUD rojo, centrado) al finalizar.
- **Pausa / despausa de match** (`amx_matchpause` / `amx_matchunpause`, `/pause` / `/unpause`):
  congela a los jugadores + godmode; el unpause hace countdown 3-2-1. Globales `g_paused`,
  `g_unpause_t`; funciones `match_pause`, `pause_hud`, `match_unpause`.
- **Traducción al español:** sección `[es]` completa en `amx_match_deluxe.txt` (199 claves,
  sin acentos para compatibilidad de fuente del cliente).

### Changed
- **Halftime sin warmup:** al terminar la 1ª mitad, en vez de `warmup_start` se llama a `half_start`
  → la 2ª mitad arranca LIVE directo (estilo CS2/CSGO).
- **Overtime sin warmup:** misma idea en la rama de overtime.
- **Cambio de equipo crash-safe:** reemplazo de la native `cs_set_user_team` (que crashea en la
  `swds.dll` no-steam con AMX Mod X 1.10) por `md_set_team()`, que escribe `m_iTeam` por offset de
  pdata + `pev_team` + mensaje `TeamInfo`. Usado en `swap_teams` y `randomize_teams`.
- **FFA silencioso al terminar:** en modo fin-de-match no se imprime "Ejecutando config FFA", y se
  comentó el `say FFA config loaded...` en `ffa.cfg`.

### Notes
- Requiere `#include <fakemeta>` (ya agregado) además de los includes originales.
- Pendiente de prueba in-game exhaustiva en el engine no-steam del torneo.

## [8.11] - base original
- Versión original de `amx_match_deluxe` por Shromilder (código original) e Infra (port a AMX Mod X).
