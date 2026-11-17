"""
Datos de referencia para `seed_data`.

Países y coordenadas: SPEC §3.1. Indicadores: valores aproximados de World Bank (2021-2023)
redondeados; los de Colombia 2023 reproducen el caso de prueba IRPC del SPEC §4.4.
"""

ANIOS = (2021, 2022, 2023)

# codigo_iso: (nombre, moneda_codigo, moneda_nombre, region, latitud, longitud, poblacion)
PAISES = {
    'CO': ('Colombia', 'COP', 'Peso colombiano', 'ANDINA', '4.5709', '-74.2973', 52_085_168),
    'BR': ('Brasil', 'BRL', 'Real brasileño', 'CONO_SUR', '-14.2350', '-51.9253', 216_422_446),
    'MX': ('México', 'MXN', 'Peso mexicano', 'CENTROAMERICA', '23.6345', '-102.5528', 128_455_567),
    'AR': ('Argentina', 'ARS', 'Peso argentino', 'CONO_SUR', '-38.4161', '-63.6167', 45_773_884),
    'CL': ('Chile', 'CLP', 'Peso chileno', 'CONO_SUR', '-35.6751', '-71.5430', 19_629_590),
    'PE': ('Perú', 'PEN', 'Sol peruano', 'ANDINA', '-9.1900', '-75.0152', 34_352_719),
    'EC': ('Ecuador', 'USD', 'Dólar estadounidense', 'ANDINA', '-1.8312', '-78.1834', 18_190_484),
    'UY': ('Uruguay', 'UYU', 'Peso uruguayo', 'CONO_SUR', '-32.5228', '-55.7658', 3_423_108),
    'PY': ('Paraguay', 'PYG', 'Guaraní paraguayo', 'CONO_SUR', '-23.4425', '-58.4438', 6_861_524),
    'PA': ('Panamá', 'PAB', 'Balboa panameño', 'CENTROAMERICA', '8.5380', '-80.7821', 4_468_087),
}

BANDERA_URL = 'https://flagcdn.com/w320/{iso}.png'

# Valores por año en el orden de ANIOS (2021, 2022, 2023).
# PIB en USD corrientes; PIB_PERCAPITA en USD; el resto en porcentaje.
INDICADORES = {
    'CO': {
        'PIB': (318.5e9, 358.1e9, 363.5e9), 'PIB_PERCAPITA': (6_160, 6_640, 6_800),
        'INFLACION': (3.5, 10.2, 9.2), 'DESEMPLEO': (13.9, 11.2, 11.3),
        'BALANZA_COMERCIAL': (-6.9, -5.1, -4.2), 'DEUDA_PIB': (63.0, 58.0, 55.0),
    },
    'BR': {
        'PIB': (1_649.6e9, 1_951.9e9, 2_173.7e9), 'PIB_PERCAPITA': (7_700, 9_070, 10_040),
        'INFLACION': (8.3, 9.3, 4.6), 'DESEMPLEO': (13.2, 9.2, 8.0),
        'BALANZA_COMERCIAL': (0.6, 0.9, 2.4), 'DEUDA_PIB': (78.3, 72.9, 74.4),
    },
    'MX': {
        'PIB': (1_312.6e9, 1_466.0e9, 1_789.1e9), 'PIB_PERCAPITA': (10_310, 11_500, 13_930),
        'INFLACION': (5.7, 7.9, 5.5), 'DESEMPLEO': (4.1, 3.3, 2.8),
        'BALANZA_COMERCIAL': (-1.0, -1.9, -1.2), 'DEUDA_PIB': (50.8, 48.6, 49.0),
    },
    'AR': {
        'PIB': (487.2e9, 631.1e9, 640.6e9), 'PIB_PERCAPITA': (10_740, 13_810, 13_990),
        'INFLACION': (48.4, 72.4, 133.5), 'DESEMPLEO': (8.7, 6.8, 6.1),
        'BALANZA_COMERCIAL': (2.3, 0.2, -1.1), 'DEUDA_PIB': (80.8, 84.5, 89.5),
    },
    'CL': {
        'PIB': (317.1e9, 302.1e9, 335.5e9), 'PIB_PERCAPITA': (16_200, 15_360, 17_090),
        'INFLACION': (4.5, 11.6, 7.6), 'DESEMPLEO': (9.1, 7.9, 8.7),
        'BALANZA_COMERCIAL': (1.2, -2.5, 2.1), 'DEUDA_PIB': (36.3, 37.9, 39.4),
    },
    'PE': {
        'PIB': (226.4e9, 245.0e9, 267.6e9), 'PIB_PERCAPITA': (6_730, 7_220, 7_790),
        'INFLACION': (4.0, 7.9, 6.3), 'DESEMPLEO': (5.1, 4.4, 4.7),
        'BALANZA_COMERCIAL': (4.1, 2.9, 5.6), 'DEUDA_PIB': (35.9, 33.9, 33.0),
    },
    'EC': {
        'PIB': (106.2e9, 116.1e9, 118.8e9), 'PIB_PERCAPITA': (5_960, 6_390, 6_530),
        'INFLACION': (0.1, 3.5, 2.2), 'DESEMPLEO': (4.2, 3.8, 3.4),
        'BALANZA_COMERCIAL': (1.6, 1.0, 1.3), 'DEUDA_PIB': (62.2, 57.0, 55.5),
    },
    'UY': {
        'PIB': (61.4e9, 71.2e9, 77.2e9), 'PIB_PERCAPITA': (17_990, 20_810, 22_560),
        'INFLACION': (7.8, 9.1, 5.9), 'DESEMPLEO': (9.3, 7.9, 8.3),
        'BALANZA_COMERCIAL': (1.4, 0.3, -0.8), 'DEUDA_PIB': (68.0, 60.8, 62.0),
    },
    'PY': {
        'PIB': (40.5e9, 41.9e9, 43.0e9), 'PIB_PERCAPITA': (6_010, 6_150, 6_260),
        'INFLACION': (4.8, 9.8, 4.6), 'DESEMPLEO': (7.5, 6.8, 5.9),
        'BALANZA_COMERCIAL': (0.4, -4.8, 1.9), 'DEUDA_PIB': (36.6, 40.6, 41.4),
    },
    'PA': {
        'PIB': (67.4e9, 76.5e9, 83.3e9), 'PIB_PERCAPITA': (15_440, 17_360, 18_660),
        'INFLACION': (1.6, 2.9, 1.5), 'DESEMPLEO': (11.3, 9.9, 7.4),
        'BALANZA_COMERCIAL': (-1.9, -5.6, -2.7), 'DEUDA_PIB': (62.6, 56.8, 55.7),
    },
}

UNIDADES = {
    'PIB': 'USD',
    'PIB_PERCAPITA': 'USD',
    'INFLACION': 'PORCENTAJE',
    'DESEMPLEO': 'PORCENTAJE',
    'BALANZA_COMERCIAL': 'PORCENTAJE',
    'DEUDA_PIB': 'PORCENTAJE',
}

# Unidades de moneda local por 1 USD (convención de ExchangeRate-API /latest/USD).
# moneda: (tasa_actual, volatilidad_diaria_%, deriva_diaria_%)
TIPOS_CAMBIO = {
    'COP': (4_050.0, 0.70, 0.02),
    'BRL': (5.45, 0.80, 0.03),
    'MXN': (18.60, 0.60, 0.01),
    'ARS': (1_020.0, 1.20, 0.30),
    'CLP': (945.0, 0.65, 0.01),
    'PEN': (3.76, 0.30, 0.00),
    'USD': (1.0, 0.0, 0.0),
    'UYU': (40.20, 0.40, 0.01),
    'PYG': (7_850.0, 0.25, 0.01),
    'PAB': (1.0, 0.0, 0.0),
}
DIAS_TIPO_CAMBIO = 30

USUARIOS = (
    ('admin@datapulse.com', 'Administrador DataPulse', 'ADMIN'),
    ('analista@datapulse.com', 'Analista DataPulse', 'ANALISTA'),
    ('viewer@datapulse.com', 'Visualizador DataPulse', 'VIEWER'),
)

# Posiciones: (pais, tipo_activo, monto_usd, dias_desde_entrada, dias_desde_salida | None, notas)
PORTAFOLIOS = (
    {
        'usuario': 'analista@datapulse.com',
        'nombre': 'Andino Conservador',
        'descripcion': 'Portafolio de renta fija concentrado en la región andina.',
        'es_publico': True,
        'posiciones': (
            ('CO', 'RENTA_FIJA', 2_500_000, 240, None, 'Bonos TES 2030'),
            ('PE', 'RENTA_FIJA', 1_500_000, 200, None, 'Bonos soberanos en soles'),
            ('CL', 'RENTA_VARIABLE', 1_000_000, 150, None, 'ETF IPSA'),
            ('EC', 'COMMODITIES', 750_000, 120, None, 'Exposición a petróleo'),
        ),
    },
    {
        'usuario': 'analista@datapulse.com',
        'nombre': 'Crecimiento Cono Sur',
        'descripcion': 'Estrategia de renta variable y monedas en mercados del Cono Sur y México.',
        'es_publico': False,
        'posiciones': (
            ('BR', 'RENTA_VARIABLE', 3_000_000, 300, None, 'Índice Bovespa'),
            ('MX', 'RENTA_VARIABLE', 2_000_000, 180, None, 'ETF IPC'),
            ('UY', 'RENTA_FIJA', 1_200_000, 160, None, 'Notas del Tesoro'),
            ('AR', 'MONEDA', 500_000, 90, 30, 'Cobertura ARS cerrada'),
        ),
    },
)
