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
    document.getElementById('folio-txt').innerText = `COT-${yy}${mm}${dd}-${random}`;
    document.getElementById('fecha').value = `${dd}/${mm}/20${yy}`;
}

// ==== CANDADO VIN ====
document.getElementById('vin').addEventListener('input', async function() {
    if(!window.inventarioAlDia) {
        Swal.fire('Bloqueado', 'Actualiza el inventario del día primero.', 'error');
        this.value = '';
        return;
    }
    
    this.value = this.value.toUpperCase();
    const longitud = this.value.length;
    document.getElementById('vin-counter').innerText = `${longitud}/17`;

    if (longitud === 17) {
        this.style.borderColor = '#008A4B';
        document.getElementById('vin-counter').style.color = '#008A4B';
        window.desbloquearSistema();
        await window.verificarHistorialVIN(this.value);
    } else {
        this.style.borderColor = 'var(--hyundai-blue)';
        document.getElementById('vin-counter').style.color = '#888';
        window.bloquearSistema();
    }
});

window.desbloquearSistema = function() {
    window.sistemaDesbloqueado = true;
    document.getElementById('candado-status').innerHTML = '🔓 Sistema Desbloqueado';
    document.getElementById('candado-status').style.color = '#00ff88';
    document.querySelectorAll('.disabled-until-vin').forEach(el => el.classList.add('unlocked'));
    document.querySelectorAll('.unlocked input, .unlocked select, .unlocked button').forEach(el => el.disabled = false);
}

window.bloquearSistema = function() {
    if(!window.sistemaDesbloqueado) return;
    window.sistemaDesbloqueado = false;
    document.getElementById('candado-status').innerHTML = '🔒 Candado VIN Activo';
    document.getElementById('candado-status').style.color = '#ffcc00';
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
            if(ultimoModelo) document.getElementById('modelo').value = ultimoModelo;

            Swal.fire({
                toast: true, position: 'top-end', showConfirmButton: false, timer: 6000, timerProgressBar: true,
                icon: 'info', title: `Este VIN tiene ${qs.size} cotizaciones.\n👉 CLIC AQUÍ PARA VER`,
                customClass: { popup: 'toast-cursor' },
                didOpen: (toast) => {
                    toast.addEventListener('click', () => {
                        window.cambiarVista('buscador');
                        document.getElementById('vin-search').value = vin;
                        document.getElementById('btn-buscar').click();
                    })
                }
            });
        }
    } catch (e) { console.error("Error buscando VIN:", e); }
}

// ==== LÓGICA DE TABLA Y DISPONIBILIDAD ====
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
    const precioInput = tr.querySelector('.precio');
    const dispInput = tr.querySelector('.disp-pieza'); // CAPTURAMOS LA NUEVA CELDA
    
    if(!numLimpio) { 
        container.innerHTML = ''; 
        descInput.value = ''; 
        precioInput.value = '';
        dispInput.value = ''; 
        return; 
    }

    let alertasHTML = '';
    dispInput.value = '0'; // Por defecto 0
    dispInput.style.color = '#E63312'; // Rojo por defecto

    // 1. INVENTARIO
    if(window.piezasInventario) {
        const inv = window.piezasInventario.find(p => p.cleanSerie === numLimpio);
        if(inv) {
            descInput.value = inv.descripcion;
            if(precioInput.value === '' || parseFloat(precioInput.value) === 0) precioInput.value = inv.precio.toFixed(2);
            
            // LLENAMOS LA CELDA DE DISPONIBILIDAD
            dispInput.value = inv.disponible;
            if(inv.disponible > 0) {
                dispInput.style.color = '#008A4B'; // Verde
                alertasHTML += `<span style="color: #008A4B; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">✅ ALMACÉN: ${inv.disponible} pz disponible(s)</span>`;
            } else {
                alertasHTML += `<span style="color: #888; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">❌ ALMACÉN: Agotado (0 pz)</span>`;
            }
        }
    }

    // 2. SOBRANTES
    if(window.piezasSobrantes) {
        const sobrante = window.piezasSobrantes.find(p => p.cleanSerie === numLimpio);
        if(sobrante) {
            alertasHTML += `<span style="color: #E63312; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">🚨 SOBRANTE EN ALMACÉN (Cant: ${sobrante.cantidad})</span>`;
            if(!descInput.value) descInput.value = sobrante.descripcion;
            
            // Si es sobrante, forzamos mostrar la cantidad en la tabla y en rojo
            dispInput.value = sobrante.cantidad;
            dispInput.style.color = '#E63312';
        }
    }

    // 3. OBSOLETOS
    if(window.piezasObsoletas) {
        const obsoleto = window.piezasObsoletas.find(p => p.cleanSerie === numLimpio);
        if(obsoleto) {
            alertasHTML += `<span style="color: #FF8C00; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">⚠️ PIEZA OBSOLETA: ${obsoleto.clasificacion}</span>`;
        }
    }
    
    container.innerHTML = alertasHTML;
}

// ==== LA FILA NUEVA Y EL EVENTO TAB ====
window.agregarFila = function() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="vertical-align: top;"><input type="number" class="canti" value="1" min="1" oninput="window.calcularTotales()"></td>
        <td style="vertical-align: top;"><input type="text" class="num-parte" placeholder="NÚMERO" oninput="this.value = this.value.toUpperCase(); window.verificarPieza(this); window.calcularTotales();"></td>
        <td style="vertical-align: top;"><input type="text" class="descripcion" placeholder="ESCRIBE Y PRESIONA 'TAB' PARA BUSCAR..." style="text-transform: uppercase;"></td>
        <!-- NUEVO: CAMPO DE DISPONIBILIDAD INCRUSTADO -->
        <td style="vertical-align: top;"><input type="text" class="disp-pieza" readonly style="text-align: center; background-color: #f4f4f4; color: #333; font-weight: bold;" placeholder="-"></td>
        <td style="vertical-align: top;"><input type="number" class="precio" min="0" step="0.01" placeholder="0.00" oninput="window.calcularTotales()" style="text-align: right;"></td>
        <td class="importe-lbl" style="text-align: right; font-weight:bold; vertical-align: middle;">$0.00</td>
        <td style="text-align: center; vertical-align: top;"><button class="btn-danger" onclick="this.closest('tr').remove(); window.calcularTotales();">X</button></td>
    `;
    
    // Asignar el buscador al presionar TAB
    const descInput = tr.querySelector('.descripcion');
    descInput.addEventListener('keydown', function(e) {
        if (e.key === 'Tab' && this.value.trim() !== '') {
            e.preventDefault(); 
            window.abrirBuscadorPiezas(this.value.trim().toUpperCase(), tr);
        }
    });

    document.querySelector('#tabla-refacciones tbody').appendChild(tr);
}

// ==== BUSCADOR MODAL DINÁMICO ====
window.abrirBuscadorPiezas = function(texto, trActual) {
    if(!window.piezasInventario || window.piezasInventario.length === 0) {
        Swal.fire('Error', 'No hay inventario cargado para buscar.', 'warning');
        return;
    }

    const resultados = window.piezasInventario.filter(p => p.descripcion.includes(texto)).slice(0, 50);
    
    if(resultados.length === 0) {
        Swal.fire({ toast: true, position: 'top', title: 'No se encontraron piezas.', icon: 'info', timer: 3000, showConfirmButton: false });
        return;
    }

    const tbody = document.getElementById('modal-resultados-body');
    tbody.innerHTML = '';

    resultados.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight:bold;">${p.serie}</td>
            <td>${p.descripcion}</td>
            <td>$${p.precio.toFixed(2)}</td>
            <td style="color:${p.disponible > 0 ? 'green' : 'red'}; font-weight:bold;">${p.disponible}</td>
        `;
        row.onclick = () => {
            const numInput = trActual.querySelector('.num-parte');
            numInput.value = p.serie;
            window.verificarPieza(numInput); // Autocompleta TODO (Número, Descripción, Precio y Disp)
            window.calcularTotales();
            document.getElementById('modal-buscador').style.display = 'none';
        };
        tbody.appendChild(row);
    });

    document.getElementById('modal-buscador').style.display = 'flex';
}

window.calcularTotales = function() {
    let subtotal = 0;
    window.cotizacionGuardadaEnNube = false; 

    document.querySelectorAll('#tabla-refacciones tbody tr').forEach(fila => {
        const canti = parseFloat(fila.querySelector('.canti').value) || 0;
        const precio = parseFloat(fila.querySelector('.precio').value) || 0;
        const importe = canti * precio;
        fila.querySelector('.importe-lbl').innerText = '$' + importe.toFixed(2);
        subtotal += importe;
    });

    const iva = subtotal * 0.16;
    const total = subtotal + iva;
    document.getElementById('lbl-subtotal').dataset.raw = subtotal;
    document.getElementById('lbl-iva').dataset.raw = iva;
    document.getElementById('lbl-total').dataset.raw = total;
    document.getElementById('lbl-subtotal').innerText = '$' + subtotal.toLocaleString('es-MX', {minimumFractionDigits: 2});
    document.getElementById('lbl-iva').innerText = '$' + iva.toLocaleString('es-MX', {minimumFractionDigits: 2});
    document.getElementById('lbl-total').innerText = '$' + total.toLocaleString('es-MX', {minimumFractionDigits: 2});
};

// ================= PROCESAR COTIZACIÓN (GUARDAR Y PDF) =================
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
        const disp = fila.querySelector('.disp-pieza').value || '0'; // CAPTURA LA DISPONIBILIDAD
        const p = parseFloat(fila.querySelector('.precio').value) || 0;
        
        if(np || desc) { 
            // METEMOS LA DISPONIBILIDAD AL PDF
            refaccionesParaPDF.push([c, np, desc, disp, `$${p.toFixed(2)}`, `$${(c*p).toFixed(2)}`]);
            refaccionesParaDB.push({ cantidad: c, numeroParte: np, descripcion: desc, disponibilidad: disp, precioUnitario: p, importe: (c*p) });
        }
    });

    if(refaccionesParaDB.length === 0) {
        if(generarPDF) Swal.fire('Atención', 'Agrega al menos una refacción.', 'warning');
        return false;
    }

    Swal.fire({
        title: 'Guardando en la Nube...',
        html: `<div style="display:flex; justify-content:center; margin:15px 0;"><div class="wheel-and-hamster"><div class="wheel"></div><div class="hamster"><div class="hamster__body"><div class="hamster__head"><div class="hamster__ear"></div><div class="hamster__eye"></div><div class="hamster__nose"></div></div><div class="hamster__limb hamster__limb--fr"></div><div class="hamster__limb hamster__limb--fl"></div><div class="hamster__limb hamster__limb--br"></div><div class="hamster__limb hamster__limb--bl"></div><div class="hamster__tail"></div></div></div><div class="spoke"></div></div></div>`,
        showConfirmButton: false, allowOutsideClick: false
    });

    try {
        const subtotal = parseFloat(document.getElementById('lbl-subtotal').dataset.raw);
        const iva = parseFloat(document.getElementById('lbl-iva').dataset.raw);
        const total = parseFloat(document.getElementById('lbl-total').dataset.raw);

        await addDoc(collection(db, "cotizaciones"), {
            folio, fecha, vin, modelo, tipoCotizacion: tipo, refacciones: refaccionesParaDB,
            totales: { subtotal, iva, total }, timestamp: serverTimestamp()
        });
        window.cotizacionGuardadaEnNube = true;

        if(generarPDF) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setTextColor(0, 44, 95); doc.setFontSize(22); doc.text("HYUNDAI COATZACOALCOS", 14, 20);
            doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text("CRUFER 2000 S. DE R.L. DE C.V.", 14, 27);
            doc.setTextColor(0, 0, 0); doc.text(`Folio: ${folio}`, 150, 20); doc.text(`Fecha: ${fecha}`, 150, 26);
            
            doc.setFontSize(11); 
            doc.text(`VIN: ${vin}`, 14, 40); 
            doc.text(`Modelo: ${modelo}`, 14, 46); 
            doc.text(`Tipo: ${tipo}`, 150, 40);

            // TABLA DEL PDF CON LA COLUMNA EXTRA Y DISEÑO AJUSTADO
            doc.autoTable({ 
                startY: 55, 
                head: [['Cant.', 'No. Parte', 'Descripción', 'Disp.', 'P. Unitario', 'Importe']], 
                body: refaccionesParaPDF, 
                theme: 'striped', 
                headStyles: { fillColor: [0, 44, 95] }, 
                styles: { fontSize: 8 },
                columnStyles: {
                    0: { cellWidth: 12 }, 
                    1: { cellWidth: 35 }, 
                    2: { cellWidth: 'auto' }, 
                    3: { cellWidth: 15, halign: 'center' }, 
                    4: { cellWidth: 25, halign: 'right' }, 
                    5: { cellWidth: 25, halign: 'right' }
                }
            });

            let finalY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(10);
            doc.text("Subtotal:", 140, finalY); doc.text(document.getElementById('lbl-subtotal').innerText, 175, finalY);
            doc.text("IVA (16%):", 140, finalY + 6); doc.text(document.getElementById('lbl-iva').innerText, 175, finalY + 6);
            doc.setFontSize(12); doc.setTextColor(0, 44, 95);
            doc.text("Total:", 140, finalY + 14); doc.text(document.getElementById('lbl-total').innerText, 175, finalY + 14);
            
            doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "bold");
            doc.text("TÉRMINOS Y CONDICIONES IMPORTANTES:", 14, finalY + 30); doc.setFont("helvetica", "normal");
            doc.text("1. NO SE ACEPTAN CAMBIOS NI DEVOLUCIONES UNA VEZ ENTREGADAS LAS REFACCIONES. PIEZAS ELÉCTRICAS NO TIENEN GARANTÍA.", 14, finalY + 35);
            doc.text("2. Precios expresados en Moneda Nacional (MXN) sin I.V.A. Precios y existencias sujetos a cambio sin previo aviso.", 14, finalY + 40);
            doc.text("3. La presente cotización tiene una vigencia de 5 días hábiles.", 14, finalY + 45);
            doc.text("4. Los tiempos de entrega para piezas en BACKORDER dependen de la logística del fabricante e importación.", 14, finalY + 50);
            
            doc.save(`${folio}_${vin}.pdf`);
        }
        Swal.fire('¡Listo!', generarPDF ? 'Cotización PDF generada y respaldada.' : 'Cotización guardada exitosamente.', 'success');
        return true;
    } catch (e) { Swal.fire('Error', 'No se pudo guardar.', 'error'); console.error(e); return false; }
}

document.getElementById('btn-generar-pdf').addEventListener('click', async () => {
    const exito = await window.procesarCotizacion(true);
    if(exito) setTimeout(() => location.reload(), 2000);
});

document.getElementById('btn-nueva-cotizacion').addEventListener('click', async () => {
    if (!window.cotizacionGuardadaEnNube && window.sistemaDesbloqueado) { await window.procesarCotizacion(false); }
    location.reload();
});