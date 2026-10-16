window.pedidosGenerados = [];

window.procesarReporteEstadistico = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    Swal.fire({
        title: 'Analizando Ventas...',
        html: `<div style="display:flex; justify-content:center; margin:15px 0;"><div class="wheel-and-hamster"><div class="wheel"></div><div class="hamster"><div class="hamster__body"><div class="hamster__head"><div class="hamster__ear"></div><div class="hamster__eye"></div><div class="hamster__nose"></div></div><div class="hamster__limb hamster__limb--fr"></div><div class="hamster__limb hamster__limb--fl"></div><div class="hamster__limb hamster__limb--br"></div><div class="hamster__limb hamster__limb--bl"></div><div class="hamster__tail"></div></div></div><div class="spoke"></div></div></div><br><b>Calculando promedio de 6 meses y cruce de stock...</b>`,
        showConfirmButton: false,
        allowOutsideClick: false
    });

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, {header: 1}); 

            const currentMonth = new Date().getMonth(); 
            const previousMonths = [];
            for (let i = 1; i <= 6; i++) {
                let m = currentMonth - i;
                if (m < 0) m += 12; 
                previousMonths.push(m);
            }

            const pedidos = [];

            for (let r = 1; r < rows.length; r++) {
                const row = rows[r];
                if (!row || row.length < 18) continue; 

                const numParte = row[0];
                if (!numParte || numParte.toString().toUpperCase().includes('TOTAL')) continue;

                const descripcion = row[1] || '';
                const disponible = parseFloat(row[2]) || 0; 
                const costo = parseFloat(row[4]) || 0;      
                const precioLista = parseFloat(row[5]) || 0;

                let freq = 0; 
                let totalVentas = 0;

                previousMonths.forEach(m => {
                    const colIndex = m + 6; 
                    const ventaMes = parseFloat(row[colIndex]) || 0;
                    if (ventaMes > 0) {
                        freq++;
                        totalVentas += ventaMes;
                    }
                });

                const avg = totalVentas / 6;
                let target = 0;

                if (freq >= 5) {
                    target = Math.ceil(avg * 1.5); 
                } else if (freq === 4) {
                    target = Math.ceil(avg * 1.0); 
                }

                let toOrder = target - disponible;
                
                if (toOrder > 0) {
                    pedidos.push({
                        numParte: numParte.toString(),
                        descripcion: descripcion.toString(),
                        disponible,
                        hits: freq,
                        avg: avg.toFixed(2),
                        toOrder,
                        costo,
                        precioLista,
                        total: toOrder * costo
                    });
                }
            }

            window.pedidosGenerados = pedidos;
            renderTablaPedidos();
            Swal.fire('Completado', `Análisis terminado.\nSe sugiere pedir ${pedidos.length} números de parte distintos.`, 'success');
            event.target.value = '';

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Fallo al leer el reporte estadístico.', 'error');
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderTablaPedidos() {
    const tbody = document.querySelector('#tabla-pedidos-db tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    window.pedidosGenerados.forEach(p => {
        tbody.innerHTML += `<tr>
            <td style="font-weight:bold; border-bottom: 1px solid #ddd; padding: 8px;">${p.numParte}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px;">${p.descripcion}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center;">${p.disponible}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center; color:#E63312; font-weight:bold;">${p.hits}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center;">${p.avg}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center; font-weight:bold; color:#00AAD2;">${p.toOrder}</td>
        </tr>`;
    });
}

// ==== GENERADOR DE EXCEL PROFESIONAL CON EXCELJS ====
window.exportarPedidoExcel = async function() {
    if (!window.pedidosGenerados || window.pedidosGenerados.length === 0) {
        Swal.fire('Atención', 'Sube el reporte estadístico primero para generar datos.', 'warning');
        return;
    }

    Swal.fire({
        title: 'Generando Formato...',
        html: 'Aplicando diseño corporativo y colores de Hyundai...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Crear libro y hoja con ExcelJS
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Pedido Stock');

        // Configurar ancho exacto de columnas
        ws.columns = [
            { width: 4 },  // A (Espacio)
            { width: 8 },  // B (items)
            { width: 14 }, // C (TIPO DE PEDIDO)
            { width: 18 }, // D (UNIDAD EN TALLER)
            { width: 15 }, // E (ASEGURADORA)
            { width: 8 },  // F (NO)
            { width: 10 }, // G (COMPRA)
            { width: 14 }, // H (FICHA INGRESO)
            { width: 12 }, // I (CLIENTE)
            { width: 22 }, // J (No. PARTE)
            { width: 40 }, // K (DESCRIPCION)
            { width: 12 }, // L (CANTIDAD)
            { width: 18 }, // M (COSTO)
            { width: 18 }, // N (PRECIO LISTA)
            { width: 18 }  // O (P.TOTAL)
        ];

        // Fila 2: Título Principal
        ws.mergeCells('B2:O2');
        const titleCell = ws.getCell('B2');
        titleCell.value = 'PEDIDO PARTES STOCK HYUNDAI COATZACOALCOS';
        titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002C5F' } }; // Azul Hyundai
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        ws.getRow(2).height = 25;

        // Fila 3: Fecha
        ws.mergeCells('L3:M3');
        ws.getCell('L3').value = 'FECHA:';
        ws.getCell('L3').font = { bold: true };
        ws.getCell('L3').alignment = { horizontal: 'right' };
        ws.mergeCells('N3:O3');
        ws.getCell('N3').value = new Date().toLocaleDateString('es-MX');
        ws.getCell('N3').alignment = { horizontal: 'center' };

        // Estructura de cabeceras complejas (Filas 4, 5 y 6)
        ws.getCell('B4').value = 'items';
        ws.getCell('C4').value = 'TIPO DE PEDIDO';
        ws.getCell('H4').value = 'FICHA DE INGRESO / ORDEN DE SERV.';
        ws.getCell('I4').value = 'CLIENTE';
        ws.getCell('J4').value = 'No. PARTE';
        ws.getCell('K4').value = 'DESCRIPCION';
        ws.getCell('L4').value = 'CANTIDAD';
        ws.getCell('M4').value = 'PRECIO UNIT COSTO';
        ws.getCell('N4').value = 'PRECIO LISTA';
        ws.getCell('O4').value = 'P.TOTAL';

        ws.getCell('C5').value = 'STOCK';
        ws.getCell('D5').value = 'UNIDAD EN TALLER';
        ws.getCell('E5').value = 'ASEGURADORA';
        ws.getCell('H5').value = 'ORDEN';

        ws.getCell('D6').value = 'MOSTRADOR';
        ws.getCell('E6').value = 'COTIZACION';
        ws.getCell('F6').value = 'NO';
        ws.getCell('G6').value = 'COMPRA';

        // Fusionar celdas de la cabecera
        ws.mergeCells('B4:B6');
        ws.mergeCells('C4:G4');
        ws.mergeCells('H4:H4'); // Para mantener el alto visual
        ws.mergeCells('H5:H6');
        ws.mergeCells('I4:I6');
        ws.mergeCells('J4:J6');
        ws.mergeCells('K4:K6');
        ws.mergeCells('L4:L6');
        ws.mergeCells('M4:M6');
        ws.mergeCells('N4:N6');
        ws.mergeCells('O4:O6');

        // Estilos para TODA la cabecera
        for (let r = 4; r <= 6; r++) {
            ws.getRow(r).eachCell({ includeEmpty: true }, function(cell, colNumber) {
                if (colNumber >= 2 && colNumber <= 15) {
                    cell.font = { bold: true, color: { argb: 'FF000000' }, size: 9 };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    // Fondo gris claro
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
                    // Bordes
                    cell.border = {
                        top: { style: 'thin' }, left: { style: 'thin' },
                        bottom: { style: 'thin' }, right: { style: 'thin' }
                    };
                }
            });
        }

        // Insertar los datos generados
        let currentRow = 7;
        let totalCosto = 0;
        let totalLista = 0;
        let totalP = 0;

        window.pedidosGenerados.forEach(p => {
            const r = ws.getRow(currentRow);
            r.getCell(9).value = 'STOCK'; // Col I
            r.getCell(10).value = p.numParte; // Col J
            r.getCell(11).value = p.descripcion; // Col K
            r.getCell(12).value = p.toOrder; // Col L
            r.getCell(13).value = p.costo; // Col M
            r.getCell(14).value = p.precioLista; // Col N
            r.getCell(15).value = p.total; // Col O

            // Formato moneda y bordes
            for (let c = 2; c <= 15; c++) {
                const cell = r.getCell(c);
                cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
                cell.alignment = { vertical: 'middle' };
                if (c >= 13 && c <= 15) {
                    cell.numFmt = '"$"#,##0.00';
                }
                if (c === 12 || c === 9) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
            }
            totalCosto += p.costo;
            totalLista += p.precioLista;
            totalP += p.total;
            currentRow++;
        });

        // Fila de TOTALES
        const rowTotal = ws.getRow(currentRow);
        rowTotal.getCell(11).value = 'TOTAL:';
        rowTotal.getCell(13).value = totalCosto;
        rowTotal.getCell(14).value = totalLista;
        rowTotal.getCell(15).value = totalP;

        for (let c = 11; c <= 15; c++) {
            rowTotal.getCell(c).font = { bold: true };
            rowTotal.getCell(c).border = { top: { style: 'medium' }, bottom: { style: 'medium' } };
            if (c >= 13) rowTotal.getCell(c).numFmt = '"$"#,##0.00';
        }
        rowTotal.getCell(11).alignment = { horizontal: 'right' };

        // Espacios para Firmas
        currentRow += 4;
        ws.mergeCells(`D${currentRow}:E${currentRow}`);
        ws.mergeCells(`L${currentRow}:M${currentRow}`);
        
        ws.getCell(`D${currentRow}`).value = 'ELABORO:';
        ws.getCell(`L${currentRow}`).value = 'VB GERENTE POSTVENTA';

        [ws.getCell(`D${currentRow}`), ws.getCell(`L${currentRow}`)].forEach(cell => {
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'medium' } };
        });

        // Generar archivo físico y descargarlo
        const buffer = await wb.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Pedido_Stock_${new Date().getTime()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        Swal.fire('¡Listo!', 'El documento Excel ha sido generado con el diseño corporativo.', 'success');

    } catch (error) {
        console.error(error);
        Swal.fire('Error', 'Hubo un problema al generar el archivo Excel.', 'error');
    }
}