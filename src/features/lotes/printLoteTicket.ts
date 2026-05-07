import { CALIDAD_PRODUCTO_CONFIG, TIPO_PRODUCCION_CONFIG, VARIEDAD_PRODUCTO_CONFIG } from '@/constants'
import { formatFecha, formatPeso } from '@/utils/formatters'
import { calcularPesoPorJaba } from '@/utils/business-rules'
import type { Lote } from '@/types/models'

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getJulianDay(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '001'
  const start = new Date(d.getFullYear(), 0, 0)
  const day = Math.floor((d.getTime() - start.getTime()) / 86_400_000)
  return String(day).padStart(3, '0')
}

function getAcopiadorLabel(lote: Lote) {
  if (lote.acopiador) return `${lote.acopiador.apellido}, ${lote.acopiador.nombre}`
  if (lote.acopiador_agricultor) return `${lote.acopiador_agricultor.apellido}, ${lote.acopiador_agricultor.nombre}`
  return '-'
}

export function printLoteTicket(lote: Lote) {
  const acopiadorLabel = getAcopiadorLabel(lote)
  const productoNombre = lote.producto?.nombre ?? '-'
  const productoCodigo = lote.producto?.codigo ?? '-'
  const variedad = lote.producto ? VARIEDAD_PRODUCTO_CONFIG[lote.producto.variedad].label : '-'
  const calidad = lote.producto ? CALIDAD_PRODUCTO_CONFIG[lote.producto.calidad].label : '-'
  const tipo = lote.producto ? TIPO_PRODUCCION_CONFIG[lote.producto.tipo_produccion].label : '-'
  const centroAcopio = lote.centro_acopio?.nombre ?? '-'
  const julianoCosecha = getJulianDay(lote.fecha_cosecha)
  const pesoPorJaba = calcularPesoPorJaba(lote.peso_neto_kg, lote.num_cubetas)

  const printWindow = window.open('', '_blank', 'width=420,height=720')
  if (!printWindow) return

  const copias = ['AGRICULTOR', 'ACOPIO', 'PROCESO']

  const ticketBody = (copia: string) => `
        <main class="ticket">
          <section class="center block">
            <div class="title">AGRONESIS DEL PERU S.A.C.</div>
            <div class="strong">${escapeHtml(formatFecha(lote.fecha_ingreso))}</div>
            <div class="subtitle">Centro de acopio: ${escapeHtml(centroAcopio)}</div>
          </section>

          <div class="divider"></div>

          <section class="center block">
            <div class="strong">TICKET DE CONFIRMACION</div>
            <div class="value">${escapeHtml(lote.codigo)}</div>
            <div class="copia-label">${escapeHtml(copia)}</div>
          </section>

          <div class="divider"></div>

          <section class="block">
            <div class="label">Codigo</div>
            <div class="value">${escapeHtml(lote.codigo)}</div>
          </section>

          ${lote.codigo_lote_agricultor ? `
          <section class="block">
            <div class="label">Codigo de lote por agricultor</div>
            <div class="value">${escapeHtml(lote.codigo_lote_agricultor)}</div>
          </section>
          ` : ''}

          <section class="block">
            <div class="label">Agricultor</div>
            <div class="value">${escapeHtml(`${lote.agricultor?.apellido ?? '-'}, ${lote.agricultor?.nombre ?? ''}`.trim())}</div>
          </section>

          <section class="block">
            <div class="label">Acopiador</div>
            <div class="value">${escapeHtml(acopiadorLabel)}</div>
          </section>

          <div class="divider"></div>

          <section class="block">
            <div class="label">Producto</div>
            <div class="value">${escapeHtml(productoNombre)}</div>
            <div class="row"><span class="label">Codigo</span><span class="value">${escapeHtml(productoCodigo)}</span></div>
            <div class="row"><span class="label">Variedad</span><span class="value">${escapeHtml(variedad)}</span></div>
            <div class="row"><span class="label">Calidad</span><span class="value">${escapeHtml(calidad)}</span></div>
            <div class="row"><span class="label">Tipo</span><span class="value">${escapeHtml(tipo)}</span></div>
          </section>

          <div class="grid4">
            <div>
              <div class="metric-label">Bruto</div>
              <div class="metric-value">${escapeHtml(formatPeso(lote.peso_bruto_kg))}</div>
            </div>
            <div>
              <div class="metric-label">Tara</div>
              <div class="metric-value">${escapeHtml(formatPeso(lote.peso_tara_kg))}</div>
            </div>
            <div>
              <div class="metric-label">Neto</div>
              <div class="metric-value">${escapeHtml(formatPeso(lote.peso_neto_kg))}</div>
            </div>
            <div>
              <div class="metric-label">Peso por jaba</div>
              <div class="metric-value">${escapeHtml(formatPeso(pesoPorJaba))}</div>
            </div>
          </div>

          <div class="grid2">
            <div>
              <div class="metric-label">Jabas ingresadas</div>
              <div class="metric-value">${escapeHtml(String(lote.num_cubetas))}</div>
            </div>
            <div>
              <div class="metric-label">Fecha</div>
              <div class="metric-value">${escapeHtml(formatFecha(lote.fecha_ingreso))}</div>
            </div>
          </div>

          <div class="grid2">
            <div>
              <div class="metric-label">Fecha de cosecha</div>
              <div class="metric-value">${escapeHtml(formatFecha(lote.fecha_cosecha))}</div>
            </div>
            <div>
              <div class="metric-label">Juliano de cosecha</div>
              <div class="metric-value">${escapeHtml(julianoCosecha)}</div>
            </div>
          </div>

          ${lote.jabas_prestadas > 0 ? `
          <div class="block" style="margin-top:3mm">
            <div class="label">Jabas prestadas (por devolver)</div>
            <div class="value">${escapeHtml(String(lote.jabas_prestadas))}</div>
          </div>
          ` : ''}
        </main>`

  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Ticket ${escapeHtml(lote.codigo)}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #111;
            font-family: 'Courier New', Courier, monospace;
          }
          body {
            width: 72mm;
            margin: 0 auto;
            padding: 4mm 2mm 6mm;
          }
          .ticket {
            width: 100%;
            font-size: 12px;
            line-height: 1.15;
            page-break-after: always;
          }
          .ticket:last-child {
            page-break-after: auto;
          }
          .center { text-align: center; }
          .strong { font-weight: 700; }
          .title {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 2mm;
            text-transform: uppercase;
          }
          .subtitle {
            font-size: 11px;
            margin-bottom: 3mm;
          }
          .divider {
            border-top: 1px dashed #111;
            margin: 3mm 0;
          }
          .block { margin-bottom: 3mm; }
          .label {
            font-size: 10px;
            text-transform: uppercase;
          }
          .value {
            font-size: 12px;
            font-weight: 700;
          }
          .copia-label {
            font-size: 13px;
            font-weight: 700;
            margin-top: 2mm;
            padding: 1.5mm 3mm;
            border: 1.5px solid #111;
            display: inline-block;
            letter-spacing: 1px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 8px;
            margin: 1mm 0;
          }
          .row .label {
            font-size: 11px;
            text-transform: none;
          }
          .row .value {
            font-size: 11px;
            font-weight: 700;
            text-align: right;
          }
          .grid3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2mm;
            margin-top: 2mm;
          }
          .grid4 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2mm;
            margin-top: 2mm;
          }
          .grid4 > div, .grid3 > div, .grid2 > div {
            border-top: 1px dashed #999;
            padding-top: 1.5mm;
          }
          .grid2 {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 2mm;
            margin-top: 2mm;
          }
          .metric-label {
            font-size: 10px;
            text-transform: uppercase;
          }
          .metric-value {
            font-size: 13px;
            font-weight: 700;
            margin-top: 1mm;
          }
        </style>
      </head>
      <body>
        ${copias.map((c) => ticketBody(c)).join('\n')}
        <script>
          window.onload = () => {
            window.print();
            window.onafterprint = () => window.close();
          };
        </script>
      </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}
