"""
Exportación de portafolios a PDF (Matplotlib, con gráficos incrustados) y a Excel (openpyxl).

Se usa la API orientada a objetos de Matplotlib (`Figure`) en lugar de `pyplot`, que mantiene estado
global y no es segura entre hilos en el servidor.
"""
import io

from django.utils import timezone
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.figure import Figure
from openpyxl import Workbook
from openpyxl.chart import DoughnutChart, PieChart, Reference
from openpyxl.styles import Alignment, Font, PatternFill

A4_HORIZONTAL = (11.69, 8.27)
FILAS_POR_PAGINA = 22
PALETA = ('#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d',
          '#ea580c', '#475569')
ENCABEZADOS_POSICIONES = ('País', 'Tipo de activo', 'Monto (USD)', 'Fecha entrada', 'Fecha salida', 'Estado',
                          'Notas')


def _usd(valor):
    return '—' if valor is None else f'${valor:,.2f}'


def _filas_posiciones(posiciones):
    return [
        (p.pais.nombre, p.get_tipo_activo_display(), float(p.monto_inversion_usd), p.fecha_entrada,
         p.fecha_salida, 'Activa' if p.fecha_salida is None else 'Cerrada', p.notas)
        for p in posiciones
    ]


# --- PDF ----------------------------------------------------------------------------------------------

def _grafico_torta(ax, filas, etiqueta, titulo, dona=False):
    if not filas:
        ax.text(0.5, 0.5, 'Sin posiciones activas', ha='center', va='center', color='#64748b')
        ax.set_axis_off()
    else:
        ax.pie(
            [fila['monto'] for fila in filas], labels=[fila[etiqueta] for fila in filas],
            autopct='%1.1f%%', startangle=90, colors=PALETA[:len(filas)], textprops={'fontsize': 9},
            radius=0.85,
            wedgeprops={'width': 0.45, 'edgecolor': 'white'} if dona else {'edgecolor': 'white'},
        )
        ax.axis('equal')
    ax.set_title(titulo, fontsize=12, fontweight='bold')


def _pagina_resumen(portafolio, metricas):
    figura = Figure(figsize=A4_HORIZONTAL)
    figura.text(0.05, 0.93, f'Portafolio: {portafolio.nombre}', fontsize=20, fontweight='bold')
    figura.text(0.05, 0.895, f'{portafolio.descripcion or "Sin descripción"}', fontsize=10, color='#475569')
    figura.text(0.05, 0.865, (
        f'Propietario: {portafolio.usuario.nombre_completo or portafolio.usuario.email} · '
        f'{"Público" if portafolio.es_publico else "Privado"} · '
        f'Generado: {timezone.localtime():%Y-%m-%d %H:%M}'
    ), fontsize=9, color='#64748b')

    riesgo = metricas['riesgo_promedio_ponderado']
    riesgo_texto = f'{riesgo:.2f} · {metricas["nivel_riesgo"]}' if riesgo is not None else '—'
    kpis = (
        ('Monto activo', _usd(metricas['monto_total_activo'])),
        ('Disponible (límite $50M)', _usd(metricas['monto_disponible'])),
        ('Posiciones activas', str(metricas['posiciones_activas'])),
        ('Riesgo ponderado (IRPC)', riesgo_texto),
    )
    for indice, (titulo, valor) in enumerate(kpis):
        x = 0.05 + indice * 0.235
        figura.text(x, 0.80, titulo, fontsize=9, color='#64748b')
        color = metricas['color_riesgo'] if indice == 3 and metricas['color_riesgo'] else '#0f172a'
        figura.text(x, 0.765, valor, fontsize=14, fontweight='bold', color=color)

    _grafico_torta(figura.add_axes((0.03, 0.05, 0.45, 0.62)), metricas['distribucion_pais'], 'nombre',
                   'Distribución por país')
    _grafico_torta(figura.add_axes((0.52, 0.05, 0.45, 0.62)), metricas['distribucion_tipo_activo'],
                   'etiqueta', 'Distribución por tipo de activo', dona=True)
    return figura


def _paginas_posiciones(posiciones):
    filas = [
        (pais, tipo, _usd(monto), f'{entrada:%Y-%m-%d}', f'{salida:%Y-%m-%d}' if salida else '—', estado,
         (notas[:40] + '…') if len(notas) > 40 else notas)
        for pais, tipo, monto, entrada, salida, estado, notas in _filas_posiciones(posiciones)
    ] or [('Sin posiciones registradas',) + ('',) * 6]
    total = (len(filas) - 1) // FILAS_POR_PAGINA + 1
    for numero in range(total):
        figura = Figure(figsize=A4_HORIZONTAL)
        figura.text(0.05, 0.93, f'Posiciones ({numero + 1}/{total})', fontsize=16, fontweight='bold')
        ax = figura.add_axes((0.05, 0.05, 0.9, 0.83))
        ax.set_axis_off()
        bloque = filas[numero * FILAS_POR_PAGINA:(numero + 1) * FILAS_POR_PAGINA]
        tabla = ax.table(cellText=bloque, colLabels=ENCABEZADOS_POSICIONES, loc='upper center',
                         cellLoc='left', colWidths=(0.12, 0.13, 0.13, 0.11, 0.11, 0.08, 0.32))
        tabla.auto_set_font_size(False)
        tabla.set_fontsize(9)
        tabla.scale(1, 1.4)
        for (fila, _), celda in tabla.get_celld().items():
            if fila == 0:
                celda.set_facecolor('#1e3a8a')
                celda.set_text_props(color='white', fontweight='bold')
            elif fila % 2 == 0:
                celda.set_facecolor('#f1f5f9')
        yield figura


def generar_pdf(portafolio, metricas, posiciones):
    buffer = io.BytesIO()
    metadatos = {'Title': f'Portafolio {portafolio.nombre}', 'Author': 'DataPulse Latam'}
    with PdfPages(buffer, metadata=metadatos) as pdf:
        pdf.savefig(_pagina_resumen(portafolio, metricas))
        for figura in _paginas_posiciones(posiciones):
            pdf.savefig(figura)
    return buffer.getvalue()


# --- Excel --------------------------------------------------------------------------------------------

ENCABEZADO = Font(bold=True, color='FFFFFF')
RELLENO_ENCABEZADO = PatternFill('solid', fgColor='1E3A8A')
FORMATO_USD = '"$"#,##0.00'


def _hoja_tabla(hoja, encabezados, filas, anchos, formatos=None):
    hoja.append(encabezados)
    for celda in hoja[1]:
        celda.font, celda.fill = ENCABEZADO, RELLENO_ENCABEZADO
        celda.alignment = Alignment(horizontal='center')
    for fila in filas:
        hoja.append(fila)
    for columna, ancho in zip('ABCDEFGH', anchos):
        hoja.column_dimensions[columna].width = ancho
    for columna, formato in (formatos or {}).items():
        for celda in hoja[columna][1:]:
            celda.number_format = formato
    hoja.freeze_panes = 'A2'


def _grafico_excel(hoja, clase, titulo, filas, ancla):
    if filas < 1:
        return
    grafico = clase()
    grafico.title = titulo
    grafico.add_data(Reference(hoja, min_col=3, min_row=1, max_row=filas + 1), titles_from_data=True)
    grafico.set_categories(Reference(hoja, min_col=2, min_row=2, max_row=filas + 1))
    hoja.add_chart(grafico, ancla)


def generar_xlsx(portafolio, metricas, posiciones):
    libro = Workbook()
    resumen = libro.active
    resumen.title = 'Resumen'
    _hoja_tabla(resumen, ('Campo', 'Valor'), [
        ('Portafolio', portafolio.nombre), ('Descripción', portafolio.descripcion),
        ('Propietario', portafolio.usuario.email), ('Público', 'Sí' if portafolio.es_publico else 'No'),
        ('Monto activo (USD)', metricas['monto_total_activo']),
        ('Monto disponible (USD)', metricas['monto_disponible']),
        ('Posiciones activas', metricas['posiciones_activas']),
        ('Posiciones cerradas', metricas['posiciones_cerradas']),
        ('Riesgo promedio ponderado (IRPC)', metricas['riesgo_promedio_ponderado']),
        ('Nivel de riesgo', metricas['nivel_riesgo'] or '—'),
        ('Generado', timezone.localtime().strftime('%Y-%m-%d %H:%M')),
    ], (34, 50))
    for fila in (6, 7):
        resumen.cell(row=fila, column=2).number_format = FORMATO_USD

    _hoja_tabla(libro.create_sheet('Posiciones'), ENCABEZADOS_POSICIONES, _filas_posiciones(posiciones),
                (16, 18, 18, 14, 14, 10, 50), {'C': FORMATO_USD, 'D': 'yyyy-mm-dd', 'E': 'yyyy-mm-dd'})

    por_pais = libro.create_sheet('Por país')
    filas_pais = metricas['distribucion_pais']
    _hoja_tabla(por_pais, ('Código', 'País', 'Monto (USD)', '% del total', 'IRPC', 'Nivel'),
                [(f['pais'], f['nombre'], f['monto'], f['porcentaje'] / 100, f['irpc'], f['nivel_riesgo'])
                 for f in filas_pais], (10, 16, 18, 12, 10, 12), {'C': FORMATO_USD, 'D': '0.00%'})
    _grafico_excel(por_pais, PieChart, 'Distribución por país', len(filas_pais), 'H2')

    por_tipo = libro.create_sheet('Por tipo de activo')
    filas_tipo = metricas['distribucion_tipo_activo']
    _hoja_tabla(por_tipo, ('Código', 'Tipo de activo', 'Monto (USD)', '% del total'),
                [(f['tipo_activo'], f['etiqueta'], f['monto'], f['porcentaje'] / 100) for f in filas_tipo],
                (18, 18, 18, 12), {'C': FORMATO_USD, 'D': '0.00%'})
    _grafico_excel(por_tipo, DoughnutChart, 'Distribución por tipo de activo', len(filas_tipo), 'F2')

    buffer = io.BytesIO()
    libro.save(buffer)
    return buffer.getvalue()
