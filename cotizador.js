import { db } from "./firebase-config.js";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.sistemaDesbloqueado = false;
window.cotizacionGuardadaEnNube = false;

window.generarFolioYFecha = function() {
    const date = new Date();
    const yy = date.getFullYear().toString().substr(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9000) + 1000;
    
    const folioTxt = document.getElementById('folio-txt');
    const fecha = document.getElementById('fecha');
    
    if(folioTxt) folioTxt.innerText = `COT-${yy}${mm}${dd}-${random}`;
    if(fecha) fecha.value = `${dd}/${mm}/20${yy}`;
}

document.addEventListener('input', async (e) => {
    if (e.target && e.target.id === 'vin') {
        const inputElement = e.target;
        
        if(!window.inventarioAlDia && !window.modoPrueba) {
            Swal.fire({
                icon: 'error', title: '🔒 Sistema Bloqueado', 
                html: `Sube el inventario de hoy.<br><br>Última vez que se subió: <b>${window.fechaUltimoInventario || 'Nunca'}</b>`
            });
            inputElement.value = ''; 
            return;
        }
        
        inputElement.value = inputElement.value.toUpperCase();
        const longitud = inputElement.value.length;
        const counter = document.getElementById('vin-counter');
        if(counter) counter.innerText = `${longitud}/17`;

        if (longitud === 17) {
            inputElement.style.borderColor = '#008A4B'; 
            if(counter) counter.style.color = '#008A4B';
            window.desbloquearSistema();
            await window.verificarHistorialVIN(inputElement.value);
        } else {
            inputElement.style.borderColor = 'var(--hyundai-blue)'; 
            if(counter) counter.style.color = '#888';
            window.bloquearSistema();
        }
    }
});

document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btn-generar-pdf') {
        const exito = await window.procesarCotizacion(true); 
        if(exito) setTimeout(() => location.reload(), 2000);
    }
    if (e.target && e.target.id === 'btn-nueva-cotizacion') {
        if (!window.cotizacionGuardadaEnNube && window.sistemaDesbloqueado) { 
            await window.procesarCotizacion(false); 
        } 
        location.reload();
    }
});

window.desbloquearSistema = function() {
    window.sistemaDesbloqueado = true;
    const candado = document.getElementById('candado-status');
    if(candado) {
        candado.innerHTML = '🔓 Sistema Desbloqueado';
        candado.style.color = '#00ff88';
    }
    document.querySelectorAll('.disabled-until-vin').forEach(el => el.classList.add('unlocked'));
    document.querySelectorAll('.unlocked input, .unlocked select, .unlocked button').forEach(el => el.disabled = false);
}

window.bloquearSistema = function() {
    if(!window.sistemaDesbloqueado) return;
    window.sistemaDesbloqueado = false;
    const candado = document.getElementById('candado-status');
    if(candado) {
        candado.innerHTML = '🔒 Candado VIN Activo';
        candado.style.color = '#ffcc00';
    }
    document.querySelectorAll('.disabled-until-vin').forEach(el => el.classList.remove('unlocked'));
    document.querySelectorAll('.disabled-until-vin input, .disabled-until-vin select, .disabled-until-vin button').forEach(el => el.disabled = true);
}

window.verificarHistorialVIN = async function(vin) {
    try {
        const q = query(collection(db, "cotizaciones"), where("vin", "==", vin));
        const qs = await getDocs(q);
        if (!qs.empty) {
            let ultimoModelo = "";
            qs.forEach((doc) => { if(doc.data().modelo) ultimoModelo = doc.data().modelo; });
            const modInput = document.getElementById('modelo');
            if(ultimoModelo && modInput) modInput.value = ultimoModelo;
        }
    } catch (e) {}
}

window.verificarPieza = function(inputElement) {
    const tr = inputElement.closest('tr');
    const numLimpio = inputElement.value.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    
    let container = tr.querySelector('.alertas-pieza');
    if(!container) {
        container = document.createElement('div');
        container.className = 'alertas-pieza';
        inputElement.parentNode.appendChild(container);
    }
    
    const descInput = tr.querySelector('.descripcion');
    const ubiInput = tr.querySelector('.ubi-pieza'); 
    const tdDisp = tr.querySelector('.td-disp'); 
    
    if(!numLimpio) { 
        container.innerHTML = ''; descInput.value = ''; ubiInput.value = '';
        tdDisp.innerHTML = `<input type="text" class="disp-pieza" readonly placeholder="-" style="text-align:center; background:#f4f4f4; width:100%; border:none;">`;
        return; 
    }

    let alertasHTML = '';
    let encontrada = false;
    let ubicacionFisica = '';

    if(window.ubicacionesAlmacen && window.ubicacionesAlmacen[numLimpio]) {
        ubicacionFisica = window.ubicacionesAlmacen[numLimpio].ubicacionStr || window.ubicacionesAlmacen[numLimpio].ubicacion;
    }
    ubiInput.value = ubicacionFisica || 'N/A';

    if(window.piezasInventario) {
        const inv = window.piezasInventario.find(p => p.cleanSerie === numLimpio);
        if(inv) {
            encontrada = true;
            descInput.value = inv.descripcion;
            const precioInput = tr.querySelector('.precio');
            if(precioInput.value === '' || parseFloat(precioInput.value) === 0) precioInput.value = inv.precio.toFixed(2);
            
            if(inv.disponible > 0) {
                tdDisp.innerHTML = `<input type="text" class="disp-pieza" value="${inv.disponible}" readonly style="text-align:center; background:#e6ffe6; color:#008A4B; font-weight:bold; width:100%; border:1px solid #008A4B; padding:4px;">`;
                alertasHTML += `<span style="color:#008A4B; font-size:11px; font-weight:bold;">✅ ALMACÉN: ${inv.disponible} pz</span>`;
            } else {
                tdDisp.innerHTML = `<select class="disp-pieza" style="text-align:center; background:#ffe6e6; color:#E63312; font-weight:bold; width:100%; border:1px solid #E63312; padding:4px;">
                    <option value="0">0</option><option value="BO">BO</option><option value="PDC">PDC</option>
                </select>`;
                alertasHTML += `<span style="color:#888; font-size:11px; font-weight:bold;">❌ Agotado (BO/PDC)</span>`;
            }
        }
    }

    if(!encontrada) {
        tdDisp.innerHTML = `<select class="disp-pieza" style="text-align:center; background:#ffe6e6; color:#E63312; font-weight:bold; width:100%; border:1px solid #E63312; padding:4px;">
            <option value="PDC">PDC</option><option value="BO">BO</option>
        </select>`;
        alertasHTML += `<span style="color:#FF8C00; font-size:11px; font-weight:bold;">ℹ️ Pieza no registrada.</span>`;
    }
    container.innerHTML = alertasHTML;
}

window.agregarFila = function() {
    const tbody = document.querySelector('#tabla-refacciones tbody');
    if(!tbody) return;
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="vertical-align: top;"><input type="number" class="canti" value="1" min="1" oninput="window.calcularTotales()"></td>
        <td style="vertical-align: top;"><input type="text" class="num-parte" placeholder="NÚMERO" oninput="this.value = this.value.toUpperCase(); window.verificarPieza(this); window.calcularTotales();"></td>
        <td style="vertical-align: top;"><input type="text" class="descripcion" placeholder="ESCRIBE Y 'TAB' PARA BUSCAR..." style="text-transform: uppercase;"></td>
        <td style="vertical-align: top;"><input type="text" class="ubi-pieza" readonly placeholder="-" style="text-align:center; background:#f9f9f9; font-weight:bold; border:none; width:100%;"></td>
        <td class="td-disp" style="vertical-align: top;"><input type="text" class="disp-pieza" readonly placeholder="-" style="text-align:center; background:#f4f4f4; width:100%; border:none;"></td>
        <td style="vertical-align: top;"><input type="number" class="precio" min="0" step="0.01" placeholder="0.00" oninput="window.calcularTotales()" style="text-align: right;"></td>
        <td class="importe-lbl" style="text-align: right; font-weight:bold; vertical-align: middle;">$0.00</td>
        <td style="text-align: center; vertical-align: top;">
            <button class="btn-primary" title="Localizar en Mapa" style="padding:4px; font-size:12px; background:#6f42c1; border:none; margin-bottom:4px;" onclick="window.localizarPiezaCotizador(this)">📍</button>
            <button class="btn-danger" style="padding:4px;" onclick="this.closest('tr').remove(); window.calcularTotales();">X</button>
        </td>
    `;
    const descInput = tr.querySelector('.descripcion');
    descInput.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && this.value.trim() !== '') { e.preventDefault(); window.abrirBuscadorPiezas(this.value.trim().toUpperCase(), tr); }
    });
    tbody.appendChild(tr);
}

window.localizarPiezaCotizador = function(btn) {
    const tr = btn.closest('tr');
    const numRaw = tr.querySelector('.num-parte').value;
    const numLimpio = numRaw.replace(/[^A-Z0-9]/ig, '').toUpperCase();

    const info = window.ubicacionesAlmacen[numLimpio];
    const claveParaMapear = info ? (info.anaquelKey || info.ubicacion) : null;
    const nombreMostrar = info ? (info.ubicacionStr || info.ubicacion) : null;

    if (!claveParaMapear) { Swal.fire('Atención', 'Esta pieza no tiene ubicación asignada.', 'warning'); return; }

    document.getElementById('mapa-pieza-info').innerText = `Pieza: ${numRaw} | Ubicación: ${nombreMostrar}`;
    if(window.resaltarAnaquelEnMapa) {
        const exito = window.resaltarAnaquelEnMapa(claveParaMapear, 'modal-');
        if (exito) document.getElementById('modal-mapa').style.display = 'flex';
        else Swal.fire('Info', `El área no es mapeable en el plano.`, 'info');
    }
}

window.abrirBuscadorPiezas = function(texto, trActual) {
    if(!window.piezasInventario || window.piezasInventario.length === 0) return;
    const resultados = window.piezasInventario.filter(p => p.descripcion.includes(texto)).slice(0, 50);
    if(resultados.length === 0) return;
    const tbody = document.getElementById('modal-resultados-body'); tbody.innerHTML = '';
    resultados.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `<td style="font-weight:bold;">${p.serie}</td><td>${p.descripcion}</td><td>$${p.precio.toFixed(2)}</td><td style="color:${p.disponible > 0 ? 'green' : 'red'}; font-weight:bold;">${p.disponible}</td>`;
        row.onclick = () => { trActual.querySelector('.num-parte').value = p.serie; window.verificarPieza(trActual.querySelector('.num-parte')); window.calcularTotales(); document.getElementById('modal-buscador').style.display = 'none'; };
        tbody.appendChild(row);
    });
    document.getElementById('modal-buscador').style.display = 'flex';
}

window.calcularTotales = function() {
    let subtotal = 0; window.cotizacionGuardadaEnNube = false; 
    document.querySelectorAll('#tabla-refacciones tbody tr').forEach(fila => {
        const canti = parseFloat(fila.querySelector('.canti').value) || 0;
        const precio = parseFloat(fila.querySelector('.precio').value) || 0;
        const importe = canti * precio;
        fila.querySelector('.importe-lbl').innerText = '$' + importe.toFixed(2);
        subtotal += importe;
    });
    const iva = subtotal * 0.16; const total = subtotal + iva;
    
    const lblSub = document.getElementById('lbl-subtotal');
    const lblIva = document.getElementById('lbl-iva');
    const lblTot = document.getElementById('lbl-total');
    
    if(lblSub) { lblSub.dataset.raw = subtotal; lblSub.innerText = '$' + subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2}); }
    if(lblIva) { lblIva.dataset.raw = iva; lblIva.innerText = '$' + iva.toLocaleString('es-MX', {minimumFractionDigits: 2}); }
    if(lblTot) { lblTot.dataset.raw = total; lblTot.innerText = '$' + total.toLocaleString('es-MX', {minimumFractionDigits: 2}); }
};

window.procesarCotizacion = async function(generarPDF = false) {
    const folio = document.getElementById('folio-txt').innerText;
    const fecha = document.getElementById('fecha').value;
    const vin = document.getElementById('vin').value;
    const modelo = document.getElementById('modelo').value;
    const tipo = document.getElementById('tipo-cotizacion').value;
    
    let refaccionesParaPDF = []; let refaccionesParaDB = [];

    document.querySelectorAll('#tabla-refacciones tbody tr').forEach(fila => {
        const c = fila.querySelector('.canti').value;
        const np = fila.querySelector('.num-parte').value;
        const desc = fila.querySelector('.descripcion').value;
        const dispRaw = fila.querySelector('.disp-pieza').value || '0'; 
        const p = parseFloat(fila.querySelector('.precio').value) || 0;
        
        if(np || desc) { 
            // 1. MEJORA PDF: Transformamos la cantidad en SÍ o NO para el arreglo del PDF
            const cantDisp = parseInt(dispRaw);
            const dispTexto = (cantDisp > 0) ? 'SÍ' : 'NO';

            refaccionesParaPDF.push([c, np, desc, dispTexto, `$${p.toFixed(2)}`, `$${(c*p).toFixed(2)}`]);
            
            // Pero en la base de datos sí guardamos el valor real ('0', 'BO', '5')
            refaccionesParaDB.push({ cantidad: c, numeroParte: np, descripcion: desc, disponibilidad: dispRaw, precioUnitario: p, importe: (c*p) });
        }
    });

    if(refaccionesParaDB.length === 0) return false;

    if(!window.modoPrueba) {
        Swal.fire({ title: 'Guardando en la Nube...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const subtotal = parseFloat(document.getElementById('lbl-subtotal').dataset.raw);
            const iva = parseFloat(document.getElementById('lbl-iva').dataset.raw);
            const total = parseFloat(document.getElementById('lbl-total').dataset.raw);
            await addDoc(collection(db, "cotizaciones"), { folio, fecha, vin, modelo, tipoCotizacion: tipo, refacciones: refaccionesParaDB, totales: { subtotal, iva, total }, timestamp: serverTimestamp() });
        } catch (e) { Swal.fire('Error', 'No se pudo guardar.', 'error'); return false; }
    } else {
        console.log("MODO PRUEBA: Simulación de guardado exitosa.");
    }

    window.cotizacionGuardadaEnNube = true;

    // 2. MEJORA PDF: Inyección del diseño corporativo y Términos separados
    if(generarPDF) {
        const { jsPDF } = window.jspdf; 
        const doc = new jsPDF();
        
        // ENCABEZADO CORPORATIVO HYUNDAI
        doc.setFillColor(0, 44, 95); 
        doc.rect(0, 0, 210, 26, 'F');
        doc.setTextColor(255, 255, 255); 
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18); 
        doc.text("COTIZACIÓN DE REFACCIONES", 14, 17);
        
        // DATOS DEL CLIENTE
        doc.setTextColor(45, 55, 72); 
        doc.setFontSize(10); 
        doc.setFont("helvetica", "normal");
        doc.text(`Folio: ${folio}`, 14, 38);
        doc.text(`Fecha: ${fecha}`, 14, 44);
        doc.text(`VIN: ${vin}`, 14, 50);
        doc.text(`Vehículo: ${modelo.toUpperCase()}`, 14, 56);
        doc.text(`Tipo: ${tipo}`, 150, 38);

        // TABLA AUTOTABLE (Utiliza el arreglo que armamos arriba con los SÍ/NO)
        doc.autoTable({ 
            startY: 64, 
            head: [['CANT.', 'NO. PARTE', 'DESCRIPCIÓN', 'DISP.', 'P. UNITARIO', 'IMPORTE']], 
            body: refaccionesParaPDF, 
            theme: 'grid', 
            headStyles: { fillColor: [0, 44, 95], textColor: 255, fontStyle: 'bold', fontSize: 8 }, 
            styles: { fontSize: 8, textColor: [45, 55, 72] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 
                0: { cellWidth: 15, halign: 'center' }, 
                1: { cellWidth: 35 }, 
                2: { cellWidth: 'auto' }, 
                3: { cellWidth: 15, halign: 'center' }, 
                4: { cellWidth: 25, halign: 'right' }, 
                5: { cellWidth: 25, halign: 'right' } 
            }
        });

        let finalY = doc.lastAutoTable.finalY + 12;
        
        // TOTALES ALINEADOS A LA DERECHA
        doc.setFontSize(12); doc.setFont("helvetica", "bold"); doc.setTextColor(0, 44, 95);
        doc.text(`TOTAL: ${document.getElementById('lbl-total').innerText}`, 155, finalY);
        
        // SEPARADOR Y 7 TÉRMINOS Y CONDICIONES (CON INTERLINEADO)
        finalY += 15;
        doc.setDrawColor(226, 232, 240); 
        doc.setLineWidth(0.5);
        doc.line(14, finalY, 196, finalY); 
        
        finalY += 8;
        doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.setTextColor(113, 128, 150);
        doc.text("TÉRMINOS Y CONDICIONES IMPORTANTES:", 14, finalY);
        
        // LOS 7 NUEVOS TÉRMINOS Y CONDICIONES PARA EL PDF
        doc.setFont("helvetica", "normal");
        const terminos = [
            "1. No se aceptan cambios ni devoluciones una vez entregadas las refacciones.",
            "2. Las piezas eléctricas no tienen garantía.",
            "3. Precios expresados en Moneda Nacional (MXN) con I.V.A. incluido.",
            "4. Precios y existencias sujetos a cambio sin previo aviso. Vigencia de 5 días hábiles.",
            "5. La disponibilidad mostrada es de carácter informativo y está sujeta a venta previa.",
            "6. Tiempos de entrega en Backorder sujetos a logística del fabricante.",
            "7. Para todos los pedidos se requiere un anticipo del 100% del valor de la pieza."
        ];
        
        finalY += 6;
        terminos.forEach(term => {
            const lineas = doc.splitTextToSize(term, 182); 
            doc.text(lineas, 14, finalY);
            finalY += (lineas.length * 4); 
        });
        
        doc.save(`${folio}_${vin}${window.modoPrueba ? '_PRUEBA' : ''}.pdf`);
    }
    
    Swal.fire('¡Listo!', generarPDF ? 'PDF generado.' : 'Cotización procesada.', 'success');
    return true;
}