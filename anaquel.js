import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const ZONAS_ESPECIALES = ['ACEITES1', 'ACEITES2', 'ADUANA', 'BATERIAS', 'METAL', 'FACIAS', 'RACK'];
window.cambiosPendientesAnaquel = false;

// =========================================================================
// FUNCIONES AUXILIARES Y AUDITORÍA ESTRICTA
// =========================================================================
window.obtenerPiezaEnCoordenada = function (anaquelKey, nivel, seccion) {
    for (let numParte in window.ubicacionesAlmacen) {
        const ubi = window.ubicacionesAlmacen[numParte];
        if (ubi.anaquelKey === anaquelKey && ubi.extra === `NIVEL ${nivel} - S${seccion}`) {
            return numParte;
        }
    }
    return null;
}

// =========================================================================
// 1. MODO ASIGNAR (Bloqueo Inteligente)
// =========================================================================
window.dibujarMicroGridAsignacion = function (anaquelKey) {
    const contenedor = document.getElementById('contenedor-micro-grid-asignar');
    const btnGuardar = document.getElementById('btn-guardar-coordenada');

    if (ZONAS_ESPECIALES.includes(anaquelKey)) {
        contenedor.style.display = 'none';
        btnGuardar.style.display = 'block';
        return;
    }

    const totalColumnas = (anaquelKey === 'C1C2') ? 14 : 7;

    let html = `<p style="font-size:12px; margin-bottom:10px; color:#94a3b8; text-align:center;"><b>2. Selecciona el cajón vacío exacto:</b></p>`;
    html += `<div class="micro-grid" style="grid-template-columns: repeat(${totalColumnas}, 1fr) 60px;">`;

    for (let nivel = 5; nivel >= 1; nivel--) {
        for (let sec = totalColumnas; sec >= 1; sec--) {
            const ocupante = window.obtenerPiezaEnCoordenada(anaquelKey, nivel, sec);
            let estiloOcupado = ocupante ? 'background: rgba(255, 51, 102, 0.1); border-color: #ff3366; color: #ff3366; cursor: not-allowed;' : '';

            html += `<div class="micro-sec" style="${estiloOcupado}" onclick="window.verificarYSeleccionarSeccion('${anaquelKey}', ${nivel}, ${sec}, this)">
                        <span class="sec-title">S${sec}</span>
                        ${ocupante ? `<span style="font-size:8px; margin-top:10px;">Ocupado</span>` : '<span style="font-size:8px; margin-top:10px; color:#00e5ff;">Libre</span>'}
                     </div>`;
        }
        html += `<div class="micro-lvl-lbl">NIVEL ${nivel}</div>`;
    }
    html += `</div>`;

    contenedor.innerHTML = html;
    contenedor.style.display = 'block';
    btnGuardar.style.display = 'none';
}

window.verificarYSeleccionarSeccion = function (anaquelKey, nivel, sec, divDOM) {
    const ocupante = window.obtenerPiezaEnCoordenada(anaquelKey, nivel, sec);

    if (ocupante && ocupante !== window.piezaEnEdicion) {
        Swal.fire({
            icon: 'error',
            title: 'UBICACIÓN OCUPADA',
            html: `La sección <b>S${sec}</b> está reservada para:<br><br><b style="font-size:20px; color:#00e5ff;">${ocupante}</b>`,
            background: '#12141c', color: '#fff',
            showCancelButton: true, confirmButtonText: `Modificar ${ocupante}`, cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) { window.abrirModalAsignacion(ocupante); }
        });
        return;
    }

    document.querySelectorAll('#contenedor-micro-grid-asignar .micro-sec').forEach(d => d.classList.remove('seleccionado'));
    divDOM.classList.add('seleccionado');

    document.getElementById('modal-ubi-extra').value = `NIVEL ${nivel} - S${sec}`;
    document.getElementById('btn-guardar-coordenada').style.display = 'block';
}

// =========================================================================
// 2. MODO ZOOM Y MATRIZ FIJA (Para Drag & Drop Perfecto)
// =========================================================================
window.abrirModalZoomAnaquel = function (anaquelKey, nombreMostrar) {
    if (ZONAS_ESPECIALES.includes(anaquelKey)) {
        Swal.fire({ title: 'ZONA GENERAL', text: `${nombreMostrar} es un área libre a piso.`, icon: 'info', background: '#12141c', color: '#fff' });
        return;
    }

    window.cambiosPendientesAnaquel = false;
    document.getElementById('titulo-ver-anaquel').innerHTML = `🔍 COMMAND CENTER: <span style="color:#00e5ff;">${nombreMostrar}</span>`;
    window.renderizarInteriorAnaquel(anaquelKey, nombreMostrar);
    document.getElementById('modal-ver-anaquel').style.display = 'flex';
}

window.renderizarInteriorAnaquel = function (anaquelKey, nombreMostrar) {
    const contenedor = document.getElementById('contenedor-micro-grid-ver');
    const capacidadMax = (anaquelKey === 'C1C2') ? 14 : 7;

    const piezasEnEsteAnaquel = [];
    for (let numParte in window.ubicacionesAlmacen) {
        if (window.ubicacionesAlmacen[numParte].anaquelKey === anaquelKey) {
            piezasEnEsteAnaquel.push({ numParte: numParte, extra: window.ubicacionesAlmacen[numParte].extra || "" });
        }
    }

    let html = `<div id="btn-guardar-movs" style="display:${window.cambiosPendientesAnaquel ? 'block' : 'none'}; background: rgba(0, 229, 255, 0.15); border: 2px solid #00e5ff; color: #00e5ff; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: 800; margin-bottom: 15px; box-shadow: 0 0 15px rgba(0,229,255,0.4); text-transform: uppercase; letter-spacing: 1px;" onclick="window.confirmarMovimientosDragDrop('${anaquelKey}')">
                    ⚠️ Movimientos detectados. Clic aquí para guardar en la Nube.
                </div>`;

    // MATRIZ FIJA: Siempre dibuja las X columnas solicitadas.
    html += `<div class="micro-grid" style="grid-template-columns: repeat(${capacidadMax}, 1fr) 70px;">`;

    for (let nivel = 5; nivel >= 1; nivel--) {
        for (let sec = capacidadMax; sec >= 1; sec--) {
            let chipsHtml = window.obtenerChipsDePiezas(piezasEnEsteAnaquel, nivel, sec, anaquelKey, nombreMostrar);

            // Cada compartimento es una zona activa de Drop
            html += `<div class="micro-sec" 
                          ondragover="event.preventDefault(); this.classList.add('drag-over');" 
                          ondragleave="this.classList.remove('drag-over');" 
                          ondrop="this.classList.remove('drag-over'); window.soltarPieza(event, ${nivel}, ${sec}, '${anaquelKey}', '${nombreMostrar}')">
                        <span class="sec-title">S${sec}</span>
                        <div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; width:100%;">${chipsHtml}</div>
                     </div>`;
        }
        html += `<div class="micro-lvl-lbl">NIVEL ${nivel}</div>`;
    }

    html += `</div>`;
    contenedor.innerHTML = html;
}

// Genera la etiqueta con estilos NEÓN
window.obtenerChipsDePiezas = function (piezasDelAnaquel, nivel, sec, anaquelKey, nombreMostrar) {
    let chips = "";
    piezasDelAnaquel.forEach(p => {
        if (p.extra === `NIVEL ${nivel} - S${sec}`) {
            let claseNeon = 'chip-gray';
            let dispTxt = '? pz';

            if (window.piezasInventario) {
                const enStock = window.piezasInventario.find(inv => inv.cleanSerie === p.numParte);
                if (enStock) {
                    dispTxt = `${enStock.disponible} pz`;
                    claseNeon = enStock.disponible > 0 ? 'chip-green' : 'chip-red';
                }
            }

            chips += `<div class="pieza-chip ${claseNeon}" draggable="true" ondragstart="window.iniciarArrastre(event, '${p.numParte}')" title="Arrastra para mover">
                        <span style="font-size:11px; line-height:1.2;">${p.numParte} <br> <span style="font-weight:normal; font-size:9px;">${dispTxt}</span></span>
                        <span class="btn-borrar-chip" onclick="window.borrarUbicacionRapida('${p.numParte}', '${anaquelKey}', '${nombreMostrar}')" title="Borrar ubicación">✖</span>
                      </div>`;
        }
    });
    return chips;
}

// =========================================================================
// 3. LÓGICA DE DRAG & DROP
// =========================================================================
window.iniciarArrastre = function (e, numParte) {
    e.dataTransfer.setData('text/plain', numParte);
}

window.soltarPieza = function (e, nivelDestino, secDestino, anaquelKey, nombreMostrar) {
    e.preventDefault();
    const numParte = e.dataTransfer.getData('text/plain');
    if (!numParte) return;

    const ocupante = window.obtenerPiezaEnCoordenada(anaquelKey, nivelDestino, secDestino);
    if (ocupante && ocupante !== numParte) {
        Swal.fire({ toast: true, position: 'top', icon: 'error', title: `S${secDestino} ocupado por ${ocupante}`, showConfirmButton: false, timer: 3000, background: '#12141c', color: '#fff' });
        return;
    }

    window.ubicacionesAlmacen[numParte].extra = `NIVEL ${nivelDestino} - S${secDestino}`;
    window.ubicacionesAlmacen[numParte].ubicacionStr = `${nombreMostrar} - NIVEL ${nivelDestino} - S${secDestino}`;
    window.cambiosPendientesAnaquel = true;

    window.renderizarInteriorAnaquel(anaquelKey, nombreMostrar);
}

window.confirmarMovimientosDragDrop = async function (anaquelKey) {
    Swal.fire({ title: 'Sincronizando Nube...', background: '#12141c', color: '#fff', didOpen: () => Swal.showLoading() });
    try {
        await setDoc(doc(db, "configuracion", "ubicaciones_almacen"), { datos: window.ubicacionesAlmacen }, { merge: true });
        window.cambiosPendientesAnaquel = false;

        if (window.renderTablaInventario) window.renderTablaInventario();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Movimientos Sincronizados', showConfirmButton: false, timer: 2000, background: '#12141c', color: '#fff' });
        document.getElementById('btn-guardar-movs').style.display = 'none';
    } catch (e) {
        Swal.fire('Error', 'Fallo de red.', 'error');
    }
}

window.borrarUbicacionRapida = function (numParte, anaquelKey, nombreMostrar) {
    Swal.fire({
        title: '¿LIBERAR ESPACIO?',
        text: `La pieza ${numParte} quedará "Sin Asignar".`,
        icon: 'warning', background: '#12141c', color: '#fff', showCancelButton: true, confirmButtonText: 'Sí, liberar', cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            delete window.ubicacionesAlmacen[numParte];
            Swal.fire({ title: 'Liberando...', background: '#12141c', color: '#fff', didOpen: () => Swal.showLoading() });
            try {
                await setDoc(doc(db, "configuracion", "ubicaciones_almacen"), { datos: window.ubicacionesAlmacen }, { merge: false });
                window.renderizarInteriorAnaquel(anaquelKey, nombreMostrar);
                if (window.renderTablaInventario) window.renderTablaInventario();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Espacio Liberado', showConfirmButton: false, timer: 2000, background: '#12141c', color: '#fff' });
            } catch (e) {
                Swal.fire('Error', 'Fallo al borrar.', 'error');
            }
        }
    });
}