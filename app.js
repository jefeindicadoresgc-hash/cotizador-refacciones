import { db } from "./firebase-config.js";
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { cargarSobrantesDesdeDB } from "./sobrantes.js";
import { cargarInventarioDesdeDB } from "./inventario.js";
import { cargarObsoletosDesdeDB } from "./obsoletos.js";
import { recrearCotizacion } from "./recrear.js";

let sistemaDesbloqueado = false;
let cotizacionGuardadaEnNube = false;

// ================= INICIALIZACIÓN Y NAVEGACIÓN =================
window.onload = async () => {
    generarFolioYFecha();
    agregarFila(); 
    
    // Cargar las 3 bases de datos a la vez
    await Promise.all([ cargarSobrantesDesdeDB(), cargarInventarioDesdeDB(), cargarObsoletosDesdeDB() ]);
    
    // Configurar botones del menú lateral
    document.getElementById('btn-nav-nueva').onclick = () => cambiarVista('nueva');
    document.getElementById('btn-nav-historial').onclick = () => cambiarVista('buscador');
    document.getElementById('btn-nav-inventario').onclick = () => cambiarVista('inventario');
    document.getElementById('btn-nav-almacen').onclick = () => cambiarVista('sobrantes');

    // ALERTA 7 DÍAS (OBSOLETOS)
    if(window.alertaObsoletos7Dias) {
        Swal.fire({
            toast: true, position: 'bottom-end', icon: 'warning', 
            title: '⚠️ El reporte de piezas obsoletas tiene más de 7 días.\nSe recomienda actualizarlo.',
            showConfirmButton: false, timer: 7000
        });
    }

    // CANDADO DIARIO (INVENTARIO PRINCIPAL)
    if(!window.inventarioAlDia) {
        Swal.fire({
            icon: 'warning',
            title: 'Inventario Desactualizado',
            text: 'Debes cargar el inventario del día de hoy antes de realizar cualquier cotización.',
            confirmButtonText: 'Ir a cargar Inventario',
            allowOutsideClick: false
        }).then(() => {
            cambiarVista('inventario');
        });
    }
};

function cambiarVista(vista) {
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('sec-nueva-cotizacion').style.display = 'none';
    document.getElementById('sec-buscador').style.display = 'none';
    document.getElementById('sec-inventario').style.display = 'none';
    document.getElementById('sec-sobrantes').style.display = 'none';
    
    if(vista === 'nueva') {
        if(!window.inventarioAlDia) {
            Swal.fire('Atención', 'Sube el inventario diario antes de cotizar.', 'error');
            document.getElementById('btn-nav-inventario').classList.add('active');
            document.getElementById('sec-inventario').style.display = 'block';
            return;
        }
        document.getElementById('btn-nav-nueva').classList.add('active');
        document.getElementById('sec-nueva-cotizacion').style.display = 'block';
    } else if(vista === 'buscador') {
        document.getElementById('btn-nav-historial').classList.add('active');
        document.getElementById('sec-buscador').style.display = 'block';
        if(document.getElementById('vin-search').value === '') cargarUltimasCotizaciones();
    } else if(vista === 'inventario') {
        document.getElementById('btn-nav-inventario').classList.add('active');
        document.getElementById('sec-inventario').style.display = 'block';
    } else if(vista === 'sobrantes') {
        document.getElementById('btn-nav-almacen').classList.add('active');
        document.getElementById('sec-sobrantes').style.display = 'block';
    }
}

function generarFolioYFecha() {
    const date = new Date();
    const yy = date.getFullYear().toString().substr(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9000) + 1000;
    document.getElementById('folio-txt').innerText = `COT-${yy}${mm}${dd}-${random}`;
    document.getElementById('fecha').value = `${dd}/${mm}/20${yy}`;
}

// ================= CANDADO VIN =================
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
        desbloquearSistema();
        await verificarHistorialVIN(this.value);
    } else {
        this.style.borderColor = 'var(--hyundai-blue)';
        document.getElementById('vin-counter').style.color = '#888';
        bloquearSistema();
    }
});

function desbloquearSistema() {
    sistemaDesbloqueado = true;
    document.getElementById('candado-status').innerHTML = '🔓 Sistema Desbloqueado';
    document.getElementById('candado-status').style.color = '#00ff88';
    document.querySelectorAll('.disabled-until-vin').forEach(el => el.classList.add('unlocked'));
    document.querySelectorAll('.unlocked input, .unlocked select, .unlocked button').forEach(el => el.disabled = false);
}

function bloquearSistema() {
    if(!sistemaDesbloqueado) return;
    sistemaDesbloqueado = false;
    document.getElementById('candado-status').innerHTML = '🔒 Candado VIN Activo';
    document.getElementById('candado-status').style.color = '#ffcc00';
    document.querySelectorAll('.disabled-until-vin').forEach(el => el.classList.remove('unlocked'));
    document.querySelectorAll('.disabled-until-vin input, .disabled-until-vin select, .disabled-until-vin button').forEach(el => el.disabled = true);
}

async function verificarHistorialVIN(vin) {
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
                        cambiarVista('buscador');
                        document.getElementById('vin-search').value = vin;
                        document.getElementById('btn-buscar').click();
                    })
                }
            });
        }
    } catch (e) { console.error("Error buscando VIN:", e); }
}

// ================= VERIFICACIÓN MÚLTIPLE DE REFACCIONES =================
window.verificarPieza = function(inputElement) {
    const tr = inputElement.closest('tr');
    const numLimpio = inputElement.value.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    
    let container = tr.querySelector('.alertas-pieza');
    if(!container) {
        container = document.createElement('div');
        container.className = 'alertas-pieza';
        inputElement.parentNode.appendChild(container);
    }
    
    if(!numLimpio) { container.innerHTML = ''; return; }

    let alertasHTML = '';
    const descInput = tr.querySelector('.descripcion');
    const precioInput = tr.querySelector('.precio');

    // 1. INVENTARIO PRINCIPAL
    const inv = window.piezasInventario.find(p => p.cleanSerie === numLimpio);
    if(inv) {
        if(!descInput.value) descInput.value = inv.descripcion;
        if(precioInput.value === '' || parseFloat(precioInput.value) === 0) precioInput.value = inv.precio.toFixed(2);
        
        if(inv.disponible > 0) alertasHTML += `<span style="color: #008A4B; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">✅ ALMACÉN: ${inv.disponible} pz disponible(s)</span>`;
        else alertasHTML += `<span style="color: #888; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">❌ ALMACÉN: Agotado (0 pz)</span>`;
    }

    // 2. SOBRANTES
    const sobrante = window.piezasSobrantes.find(p => p.cleanSerie === numLimpio);
    if(sobrante) {
        alertasHTML += `<span style="color: #E63312; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">🚨 SOBRANTE EN ALMACÉN (Cant: ${sobrante.cantidad})</span>`;
        if(!descInput.value) descInput.value = sobrante.descripcion;
    }

    // 3. OBSOLETOS
    const obsoleto = window.piezasObsoletas.find(p => p.cleanSerie === numLimpio);
    if(obsoleto) {
        alertasHTML += `<span style="color: #FF8C00; font-size: 11px; display: block; font-weight: bold; margin-top: 3px;">⚠️ PIEZA OBSOLETA: ${obsoleto.clasificacion}</span>`;
    }

    container.innerHTML = alertasHTML;
}

document.getElementById('btn-add-row').addEventListener('click', agregarFila);

function agregarFila() {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td style="vertical-align: top;"><input type="number" class="canti" value="1" min="1" oninput="window.calcularTotales()"></td>
        <td style="vertical-align: top;"><input type="text" class="num-parte" placeholder="NÚMERO" oninput="this.value = this.value.toUpperCase(); window.verificarPieza(this); window.calcularTotales();"></td>
        <td style="vertical-align: top;"><input type="text" class="descripcion" placeholder="DESCRIPCIÓN..." style="text-transform: uppercase;"></td>
        <td style="vertical-align: top;"><input type="number" class="precio" min="0" step="0.01" placeholder="0.00" oninput="window.calcularTotales()" style="text-align: right;"></td>
        <td class="importe-lbl" style="text-align: right; font-weight:bold; vertical-align: middle;">$0.00</td>
        <td style="text-align: center; vertical-align: top;"><button class="btn-danger" onclick="this.closest('tr').remove(); window.calcularTotales();">X</button></td>
    `;
    document.querySelector('#tabla-refacciones tbody').appendChild(tr);
}

window.calcularTotales = function() {
    let subtotal = 0;
    cotizacionGuardadaEnNube = false; 

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
async function procesarCotizacion(generarPDF = false) {
    const folio = document.getElementById('folio-txt').innerText;
    const fecha = document.getElementById('fecha').value;
    const vin = document.getElementById('vin').value;
    const modelo = document.getElementById('modelo').value;
    const tipo = document.getElementById('tipo-cotizacion').value;
    
    let refaccionesParaPDF = []; 
    let refaccionesParaDB = [];

    document.querySelectorAll('#tabla-refacciones tbody tr').forEach(fila => {
        const c = fila.querySelector('.canti').value;
        const np = fila.querySelector('.num-parte').value;
        const desc = fila.querySelector('.descripcion').value;
        const p = parseFloat(fila.querySelector('.precio').value) || 0;
        if(np || desc) { 
            refaccionesParaPDF.push([c, np, desc, `$${p.toFixed(2)}`, `$${(c*p).toFixed(2)}`]);
            refaccionesParaDB.push({ cantidad: c, numeroParte: np, descripcion: desc, precioUnitario: p, importe: (c*p) });
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
        
        cotizacionGuardadaEnNube = true;

        if(generarPDF) {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.setTextColor(0, 44, 95); doc.setFontSize(22); doc.text("HYUNDAI COATZACOALCOS", 14, 20);
            doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text("CRUFER 2000 S. DE R.L. DE C.V.", 14, 27);
            doc.setTextColor(0, 0, 0); doc.text(`Folio: ${folio}`, 150, 20); doc.text(`Fecha: ${fecha}`, 150, 26);
            doc.setFontSize(11); doc.text(`VIN: ${vin}`, 14, 40); doc.text(`Modelo: ${modelo}`, 14, 46); doc.text(`Tipo: ${tipo}`, 150, 40);

            doc.autoTable({ startY: 55, head: [['Cant.', 'No. Parte', 'Descripción', 'P. Unitario', 'Importe']], body: refaccionesParaPDF, theme: 'striped', headStyles: { fillColor: [0, 44, 95] }, styles: { fontSize: 9 } });

            let finalY = doc.lastAutoTable.finalY + 10;
            doc.setFontSize(10);
            doc.text("Subtotal:", 140, finalY); doc.text(document.getElementById('lbl-subtotal').innerText, 175, finalY);
            doc.text("IVA (16%):", 140, finalY + 6); doc.text(document.getElementById('lbl-iva').innerText, 175, finalY + 6);
            doc.setFontSize(12); doc.setTextColor(0, 44, 95);
            doc.text("Total:", 140, finalY + 14); doc.text(document.getElementById('lbl-total').innerText, 175, finalY + 14);
            
            // Textos legales para blindar la cotización en el PDF
            doc.setFontSize(8); 
            doc.setTextColor(100, 100, 100);
            doc.setFont("helvetica", "bold");
            doc.text("TÉRMINOS Y CONDICIONES IMPORTANTES:", 14, finalY + 30);
            doc.setFont("helvetica", "normal");
            doc.text("1. NO SE ACEPTAN CAMBIOS NI DEVOLUCIONES UNA VEZ ENTREGADAS LAS REFACCIONES. PIEZAS ELÉCTRICAS NO TIENEN GARANTÍA.", 14, finalY + 35);
            doc.text("2. Precios expresados en Moneda Nacional (MXN) sin I.V.A. Precios y existencias sujetos a cambio sin previo aviso.", 14, finalY + 40);
            doc.text("3. La presente cotización tiene una vigencia de 5 días hábiles.", 14, finalY + 45);
            doc.text("4. Los tiempos de entrega para piezas en BACKORDER dependen de la logística del fabricante e importación.", 14, finalY + 50);
            
            doc.save(`${folio}_${vin}.pdf`);
        }

        Swal.fire('¡Listo!', generarPDF ? 'Cotización PDF generada y respaldada.' : 'Cotización guardada exitosamente.', 'success');
        return true;
    } catch (e) {
        Swal.fire('Error', 'No se pudo guardar.', 'error');
        console.error(e);
        return false;
    }
}

document.getElementById('btn-generar-pdf').addEventListener('click', async () => {
    const exito = await procesarCotizacion(true);
    if(exito) setTimeout(() => location.reload(), 2000);
});

document.getElementById('btn-nueva-cotizacion').addEventListener('click', async () => {
    if (!cotizacionGuardadaEnNube && sistemaDesbloqueado) { await procesarCotizacion(false); }
    location.reload();
});

// ================= BÚSQUEDA Y TARJETAS =================
function armarTarjeta(data) {
    const totalFmt = '$' + data.totales.total.toLocaleString('es-MX', {minimumFractionDigits: 2});
    let listaPiezas = `<ul class="lista-piezas">`;
    data.refacciones.forEach(ref => {
        listaPiezas += `<li><b>${ref.cantidad}x</b> ${ref.numeroParte} - ${ref.descripcion} <i>($${ref.importe.toFixed(2)})</i></li>`;
    });
    listaPiezas += `</ul>`;

    const card = document.createElement('div');
    card.className = 'history-card toast-cursor'; 
    card.style = 'transition: 0.3s;';
    card.onmouseover = () => card.style.boxShadow = '0 5px 15px rgba(0,170,210,0.3)';
    card.onmouseout = () => card.style.boxShadow = 'none';
    
    card.onclick = () => recrearCotizacion(data);

    card.innerHTML = `
        <div style="display:flex; justify-content:space-between;">
            <h4 style="margin:0;">Folio: ${data.folio}</h4>
            <span style="font-size:12px; font-weight:bold; color:var(--hyundai-light-blue);">🔄 CLIC PARA RECREAR</span>
        </div>
        <p style="font-size:12px; color:#666; margin-bottom:10px;">${data.fecha}</p>
        <p><strong>VIN:</strong> ${data.vin || 'N/A'}</p>
        <p><strong>Modelo:</strong> ${data.modelo || 'N/A'}</p>
        <p><strong>Total Cotizado:</strong> ${totalFmt}</p>
        <div style="margin-top:15px; border-top:1px dashed #ccc; padding-top:10px;">
            <p style="font-size:12px; font-weight:bold; color:var(--hyundai-blue);">PIEZAS COTIZADAS:</p>
            ${listaPiezas}
        </div>
    `;
    return card;
}

async function cargarUltimasCotizaciones() {
    const div = document.getElementById('resultados-busqueda');
    div.innerHTML = '<p>Cargando las últimas cotizaciones...</p>';
    try {
        const q = query(collection(db, "cotizaciones"), orderBy("timestamp", "desc"), limit(30));
        const qs = await getDocs(q);
        if(qs.empty) { div.innerHTML = '<p style="color: #888;">No hay cotizaciones registradas aún.</p>'; return; }
        
        div.innerHTML = '<h3 style="color:var(--hyundai-blue); margin-bottom:15px;">Últimas 30 Cotizaciones Registradas</h3>';
        qs.forEach((doc) => div.appendChild(armarTarjeta(doc.data())));
    } catch(e) {
        console.error(e);
        div.innerHTML = '<p style="color: red;">Error al cargar el historial general.</p>';
    }
}

document.getElementById('btn-buscar').addEventListener('click', async () => {
    const vinBusqueda = document.getElementById('vin-search').value.toUpperCase();
    if(vinBusqueda.length !== 17) { Swal.fire('Error', 'Ingresa los 17 dígitos del VIN', 'error'); return; }

    const div = document.getElementById('resultados-busqueda');
    div.innerHTML = '<p>Buscando historial del VIN...</p>';

    try {
        const q = query(collection(db, "cotizaciones"), where("vin", "==", vinBusqueda));
        const qs = await getDocs(q);
        if(qs.empty) { div.innerHTML = '<p style="color: red;">No se encontraron cotizaciones para este VIN.</p>'; return; }

        div.innerHTML = `<h3 style="color:var(--hyundai-blue); margin-bottom:15px;">Resultados para VIN: ${vinBusqueda}</h3>`;
        qs.forEach((doc) => div.appendChild(armarTarjeta(doc.data())));
    } catch(e) {
        div.innerHTML = 'Error al consultar la base de datos.';
    }
});