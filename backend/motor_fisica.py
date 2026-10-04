"""Motor de Física y Calidad de Olas para Surfline Castellón.

Traducción a Python 3 de la física costera del Mediterráneo y el algoritmo
de calidad pre-IA especificado en MASTER_CONTEXT.md.

Módulos estándar utilizados exclusivamente: math, typing.
"""

import math
from typing import Any, Dict, Optional, Union

# Configuración geográfica y física de los spots de la costa de Castellón.
# azimut: orientación de la línea de costa (grados).
# thetaCrit: ángulo crítico de sombra o difracción del oleaje.
# sBase: factor base de sombra para oleajes muy cerrados / resguardados.
# offshoreMin / offshoreMax: rango angular (grados) del viento de tierra (offshore).
SPOT_CONFIG: Dict[str, Dict[str, Union[int, float]]] = {
    'Planetario':  {'azimut': 26,  'thetaCrit': 45, 'sBase': 0.15, 'offshoreMin': 275, 'offshoreMax': 315},
    'Gurugu':      {'azimut': 26,  'thetaCrit': 45, 'sBase': 0.15, 'offshoreMin': 275, 'offshoreMax': 315},
    'Pirámides':   {'azimut': 38,  'thetaCrit': 50, 'sBase': 0.10, 'offshoreMin': 285, 'offshoreMax': 330},
    'Voramar':     {'azimut': 54,  'thetaCrit': 65, 'sBase': 0.05, 'offshoreMin': 300, 'offshoreMax': 350},
    'La Renegà':   {'azimut': 172, 'thetaCrit': 10, 'sBase': 0.90, 'offshoreMin': 230, 'offshoreMax': 290},
    'Burriana':    {'azimut': 26,  'thetaCrit': 45, 'sBase': 0.20, 'offshoreMin': 275, 'offshoreMax': 315},
    'Nules':       {'azimut': 26,  'thetaCrit': 40, 'sBase': 0.25, 'offshoreMin': 275, 'offshoreMax': 315},
    'Almenara':    {'azimut': 26,  'thetaCrit': 35, 'sBase': 0.30, 'offshoreMin': 275, 'offshoreMax': 315},
    'Peñíscola N': {'azimut': 10,  'thetaCrit': 10, 'sBase': 0.80, 'offshoreMin': 260, 'offshoreMax': 300},
    'Vinaròs':     {'azimut': 10,  'thetaCrit': 10, 'sBase': 0.85, 'offshoreMin': 260, 'offshoreMax': 300},
}

# Configuración por defecto para spots no reconocidos o genéricos de la zona
DEFAULT_SPOT_CONFIG: Dict[str, Union[int, float]] = {
    'azimut': 26,
    'thetaCrit': 40,
    'sBase': 0.20,
    'offshoreMin': 275,
    'offshoreMax': 315,
}


def _to_float(val: Any, default: float = 0.0) -> float:
    """Convierte de forma segura un valor a float, equivalente a Number(x) || 0 en JS."""
    if val is None:
        return default
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (ValueError, TypeError):
        return default


def _js_round(x: float) -> int:
    """Emula Math.round de JavaScript (redondeo hacia arriba en 0.5 hacia +inf)."""
    return math.floor(x + 0.5) if x >= 0 else math.ceil(x - 0.5)


def getSpotConfig(nombre: Optional[str] = None) -> Dict[str, Union[int, float]]:
    """Obtiene la configuración física del spot buscando por coincidencia de subcadena.

    Si no se encuentra coincidencia o nombre es None, devuelve la configuración
    por defecto de la costa de Castellón.
    """
    if nombre is not None:
        nombre_str = str(nombre)
        for key, config in SPOT_CONFIG.items():
            if key in nombre_str:
                return dict(config)
    return dict(DEFAULT_SPOT_CONFIG)


def calcularFisica(
    nombre: Optional[str],
    h: Union[int, float, str, None],
    periodo: Union[int, float, str, None],
    dirSwell: Union[int, float, str, None],
) -> float:
    """Calcula la altura efectiva de ola en la rompiente costera.

    Aplica la fórmula de propagación y difracción marina:
      1. Factor de sombra sigmoidal (sf) dependiente del ángulo del oleaje (dirSwell).
      2. Factor amplificador por período si dirSwell < 75°.
      3. Factor de exposición angular perpendicular a la línea de costa (normalCosta).

    Retorna:
      Altura estimada de ola redondeada a 2 decimales (metros). Si h <= 0, retorna 0.
    """
    h_val = _to_float(h)
    periodo_val = _to_float(periodo)
    dir_swell_val = _to_float(dirSwell)

    if h_val <= 0:
        return 0

    cfg = getSpotConfig(nombre)
    k = 0.15
    sf = cfg['sBase'] + (1.0 - cfg['sBase']) / (1.0 + math.exp(-k * (dir_swell_val - cfg['thetaCrit'])))

    amplificador = 1.0
    if dir_swell_val < 75:
        ganancia = (periodo_val / 4.0) ** 2
        ganancia = min(max(ganancia, 1.0), 2.5)
        factor_sombra = 1.0 - sf
        amplificador = 1.0 + ((ganancia - 1.0) * factor_sombra)

    normal_costa = cfg['azimut'] + 90
    exposicion = abs(math.cos((dir_swell_val - normal_costa) * math.pi / 180.0))
    exposicion = max(exposicion, 0.05)

    return _js_round(h_val * sf * amplificador * exposicion * 100.0) / 100.0


def calcularCalidad(
    h: Union[int, float, str, None],
    p: Union[int, float, str, None],
    ws: Union[int, float, str, None],
    wd: Union[int, float, str, None],
    nombre: Optional[str] = None,
    presion: Optional[Union[int, float, str]] = None,
    visib: Optional[Union[int, float, str]] = None,
) -> int:
    """Calcula el índice de calidad de surf en una escala de 0 a 5.

    Parámetros:
      h: Altura de ola (m)
      p: Período (s)
      ws: Velocidad del viento (nudos / km/h según escala de entrada)
      wd: Dirección del viento (grados)
      nombre: Nombre del spot (opcional)
      presion: Presión atmosférica en hPa (por defecto 1013)
      visib: Visibilidad (reservado para compatibilidad con JS)

    Retorna:
      Puntuación entera entre 0 (inviable/plato) y 5 (épico).
    """
    h_val = _to_float(h)
    p_val = _to_float(p)
    ws_val = _to_float(ws)
    wd_val = _to_float(wd)

    if h_val < 0.2:
        return 0
    # Umbral de plano más exigente para mar de viento (h < 0.4 y p < 5s)
    if h_val < 0.4 and p_val < 5:
        return 1
    if h_val < 0.35:
        return 1

    s = 2.0
    
    # Penalizar con fuerza periodos muy cortos
    if p_val < 5:
        s -= 1.0
        
    if h_val >= 0.5:
        s += 1.0
    if h_val >= 0.9:
        s += 1.0
    if p_val >= 6:
        s += 0.5
    if p_val >= 8:
        s += 0.5

    energia = h_val * h_val * p_val
    if energia >= 5:
        s += 0.5
    if energia >= 15:
        s += 0.5

    cfg = getSpotConfig(nombre) if nombre else None
    if cfg:
        if cfg['offshoreMin'] < cfg['offshoreMax']:
            is_offshore = (wd_val >= cfg['offshoreMin'] and wd_val <= cfg['offshoreMax'])
        else:
            is_offshore = (wd_val >= cfg['offshoreMin'] or wd_val <= cfg['offshoreMax'])
        if is_offshore and ws_val < 15:
            s += 1.0
        if is_offshore and ws_val < 8:
            s += 0.5
            
        # Reforzar penalización onshore y brisa marina
        if not is_offshore:
            if ws_val > 10:
                s -= 1.0
            if ws_val > 15:
                s -= 1.0
    else:
        off_gen = (260 <= wd_val <= 360) or (0 <= wd_val < 45)
        if off_gen and ws_val < 12:
            s += 1.0
        if not off_gen:
            if ws_val > 10:
                s -= 1.0
            if ws_val > 15:
                s -= 1.0

    if ws_val > 20:
        s -= 1.0
    if ws_val > 30:
        s -= 1.0

    presion_val = _to_float(presion, default=0.0)
    if presion_val <= 0:
        presion_val = 1013.0

    if 0 < presion_val < 1008:
        s += 0.5
    if 0 < presion_val < 995:
        s += 0.5

    return min(max(_js_round(s), 0), 5)


# Alias en snake_case para convenciones idiomáticas de Python
get_spot_config = getSpotConfig
calcular_fisica = calcularFisica
calcular_calidad = calcularCalidad

__all__ = [
    'SPOT_CONFIG',
    'DEFAULT_SPOT_CONFIG',
    'getSpotConfig',
    'get_spot_config',
    'calcularFisica',
    'calcular_fisica',
    'calcularCalidad',
    'calcular_calidad',
]
