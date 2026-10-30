import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const ZONAS_ESPECIALES = ['ACEITES1', 'ACEITES2', 'ADUANA', 'BATERIAS', 'METAL', 'FACIAS', 'RACK'];
window.cambiosPendientesAnaquel = false;

// =========================================================================
// INYECCIÓN DE ESTILOS DINÁMICOS (FLEXBOX Y SCROLL PARA MAPAS)
// =========================================================================
const style = document.createElement('style');
style.innerHTML = `
    /* 1. Mapas Retráctiles (Scroll) */
    #modal-asignar-mapas-container { 
        max-height: 350px; 
        overflow-y: auto; 
        border: 1px solid #e2e8f0; 
        padding: 10px; 
        border-radius: 8px; 
        background: #f8fafc;
    }
    #modal-asignar-mapas-container::-webkit-scrollbar { width: 6px; }
    #modal-asignar-mapas-container::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 10px; }
    #modal-asignar-mapas-container::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    
    /* 2. Cajas Inteligentes (Flexbox) */
    .micro-sec { transition: all 0.3s ease; overflow: hidden; display: flex; flex-direction: column; align-items: center; position: relative; padding: 10px 5px; border-radius: 6px; }
    .micro-sec .sec-title { position: absolute; top: 6px; left: 8px; font-size: 10px; transition: 0.3s; }
    
    /* Secciones Ocupadas (Se estiran al 100% o 50% según la cantidad) */
    .micro-sec.ocupada { flex: 1 1 0; min-width: 140px; background: #ffffff; border: 1px solid #94a3b8; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .micro-sec.ocupada .sec-title { color: #94a3b8; }
    
    /* Secciones Vacías (Se contraen para no estorbar, pero siguen siendo áreas de "Drop") */
    .micro-sec.vacia { flex: 0 1 30px; min-width: 30px; background: rgba(241, 245, 249, 0.4); border: 1px dashed #cbd5e1; cursor: crosshair; }
    .micro-sec.vacia .sec-title { color: transparent; }
    .micro-sec.vacia:hover { flex: 0 1 50px; background: #f1f5f9; }
    .micro-sec.vacia:hover .sec-title { color: #cbd5e1; }
    
    /* MAGIA: Al arrastrar una pieza encima de una caja vacía, se expande al instante */
    .micro-sec.vacia.drag-over { flex: 1 1 0 !important; background: #e0f2fe !important; border: 2px dashed #00AAD2 !important; }
    .micro-sec.vacia.drag-over .sec-title { color: #00AAD2 !important; }
`;
document.head.appendChild(style);

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
// 1. MODO ASIGNAR (Bloqueo Inteligente y Diseño Flex)
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
    
    for (let nivel = 5; nivel >= 1; nivel--) {
        html += `<div style="display: flex; gap: 6px; margin-bottom: 8px; width: 100%; height: 50px;">`;
        
        for (let sec = totalColumnas; sec >= 1; sec--) {
            const ocupante = window.obtenerPiezaEnCoordenada(anaquelKey, nivel, sec);
            let estiloCelda = ocupante ? 'background: rgba(255, 51, 102, 0.1); border: 1px solid #ff3366; color: #ff3366; cursor: not-allowed;' : 'background: #fff; border: 1px solid #94a3b8; cursor: pointer;';

            html += `<div class="micro-sec" style="flex: 1; justify-content: center; ${estiloCelda}" onclick="window.verificarYSeleccionarSeccion('${anaquelKey}', ${nivel}, ${sec}, this)">
                        <span style="font-size:11px; font-weight:bold;">S${sec}</span>
                        ${ocupante ? `<span style="font-size:8px;">Ocupado</span>` : '<span style="font-size:8px; color:#00AAD2;">Libre</span>'}
                     </div>`;
        }
        html += `<div style="width: 70px; flex-shrink: 0; background: var(--hyundai-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border-radius: 6px;">NIVEL ${nivel}</div>`;
        html += `</div>`;
    }

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
            html: `La sección <b>S${sec}</b> está reservada para:<br><br><b style="font-size:20px; color:#00AAD2;">${ocupante}</b>`,
            showCancelButton: true, confirmButtonText: `Modificar ${ocupante}`, cancelButtonText: 'Cancelar'
        }).then((result) => {
            if (result.isConfirmed) { window.abrirModalAsignacion(ocupante); }
        });
        return;
    }

    document.querySelectorAll('#contenedor-micro-grid-asignar .micro-sec').forEach(d => {
        d.style.boxShadow = 'none';
        d.style.borderColor = '#94a3b8';
    });
    
    divDOM.style.boxShadow = '0 0 0 3px rgba(0, 170, 210, 0.3)';
    divDOM.style.borderColor = 'var(--hyundai-light)';

    document.getElementById('modal-ubi-extra').value = `NIVEL ${nivel} - S${sec}`;
    document.getElementById('btn-guardar-coordenada').style.display = 'block';
}

// =========================================================================
// 2. MODO ZOOM (FLEXBOX DINÁMICO Y DRAG & DROP)
// =========================================================================
window.abrirModalZoomAnaquel = function (anaquelKey, nombreMostrar) {
    if (ZONAS_ESPECIALES.includes(anaquelKey)) {
        Swal.fire({ title: 'ZONA GENERAL', text: `${nombreMostrar} es un área libre a piso.`, icon: 'info' });
        return;
    }
    window.cambiosPendientesAnaquel = false;
    document.getElementById('titulo-ver-anaquel').innerHTML = `🔍 COMMAND CENTER: <span style="color:var(--hyundai-light);">${nombreMostrar}</span>`;
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

    let html = `<div id="btn-guardar-movs" style="display:${window.cambiosPendientesAnaquel ? 'block' : 'none'}; background: rgba(0, 170, 210, 0.1); border: 2px solid var(--hyundai-light); color: var(--hyundai-blue); padding: 12px; border-radius: 6px; cursor: pointer; font-weight: 800; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;" onclick="window.confirmarMovimientosDragDrop('${anaquelKey}')">
                    ⚠️ Movimientos detectados. Clic aquí para guardar en la Nube.
                </div>`;

    // MATRIZ INTELIGENTE (FLEXBOX)
    for (let nivel = 5; nivel >= 1; nivel--) {
        html += `<div style="display: flex; gap: 8px; margin-bottom: 10px; width: 100%; min-height: 80px;">`;
        
        for (let sec = capacidadMax; sec >= 1; sec--) {
            let chipsHtml = window.obtenerChipsDePiezas(piezasEnEsteAnaquel, nivel, sec, anaquelKey, nombreMostrar);
            
            // Si la sección tiene contenido se expande (ocupada), si no, se contrae (vacia)
            let estadoClase = chipsHtml !== "" ? "ocupada" : "vacia";

            html += `<div class="micro-sec ${estadoClase}" 
                          ondragover="event.preventDefault(); this.classList.add('drag-over');" 
                          ondragleave="this.classList.remove('drag-over');" 
                          ondrop="this.classList.remove('drag-over'); window.soltarPieza(event, ${nivel}, ${sec}, '${anaquelKey}', '${nombreMostrar}')">
                        <span class="sec-title">S${sec}</span>
                        <div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:center; width:100%;">${chipsHtml}</div>
                     </div>`;
        }
        
        html += `<div style="width: 75px; flex-shrink: 0; background: var(--hyundai-blue); color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; border-radius: 6px; letter-spacing: 1px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">NIVEL ${nivel}</div>`;
        html += `</div>`;
    }

    contenedor.innerHTML = html;
}

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
        Swal.fire({ toast: true, position: 'top', icon: 'error', title: `S${secDestino} ocupado por ${ocupante}`, showConfirmButton: false, timer: 3000 });
        return;
    }

    window.ubicacionesAlmacen[numParte].extra = `NIVEL ${nivelDestino} - S${secDestino}`;
    window.ubicacionesAlmacen[numParte].ubicacionStr = `${nombreMostrar} - NIVEL ${nivelDestino} - S${secDestino}`;
    window.cambiosPendientesAnaquel = true;

    window.renderizarInteriorAnaquel(anaquelKey, nombreMostrar);
}

window.confirmarMovimientosDragDrop = async function (anaquelKey) {
    Swal.fire({ title: 'Sincronizando Nube...', didOpen: () => Swal.showLoading() });
    try {
        await setDoc(doc(db, "configuracion", "ubicaciones_almacen"), { datos: window.ubicacionesAlmacen }, { merge: true });
        window.cambiosPendientesAnaquel = false;

        if (window.renderTablaInventario) window.renderTablaInventario();
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Movimientos Sincronizados', showConfirmButton: false, timer: 2000 });
        document.getElementById('btn-guardar-movs').style.display = 'none';
    } catch (e) {
        Swal.fire('Error', 'Fallo de red.', 'error');
    }
}

window.borrarUbicacionRapida = function (numParte, anaquelKey, nombreMostrar) {
    Swal.fire({
        title: '¿LIBERAR ESPACIO?',
        text: `La pieza ${numParte} quedará "Sin Asignar".`,
        icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, liberar', cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            delete window.ubicacionesAlmacen[numParte];
            Swal.fire({ title: 'Liberando...', didOpen: () => Swal.showLoading() });
            try {
                await setDoc(doc(db, "configuracion", "ubicaciones_almacen"), { datos: window.ubicacionesAlmacen }, { merge: false });
                window.renderizarInteriorAnaquel(anaquelKey, nombreMostrar);
                if (window.renderTablaInventario) window.renderTablaInventario();
                Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Espacio Liberado', showConfirmButton: false, timer: 2000 });
            } catch (e) {
                Swal.fire('Error', 'Fallo al borrar.', 'error');
            }
        }
    });
}