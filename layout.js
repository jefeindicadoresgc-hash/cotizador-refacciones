import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.inicializarMapas = function () {
    const mapasHTML = `
        <div class="map-section"><h3 class="map-title">📍 ALMACÉN PRINCIPAL</h3>
            <div class="layout-grid" style="grid-template-columns: 65px 65px 1fr 1fr 75px; grid-template-rows: 20px repeat(6, 1fr) 25px;">
                <div class="anaquel" id="anq-ACEITES1" style="grid-column: 1; grid-row: 1 / span 4; background:#fff9c4; border-color:#fbc02d; color:#f57f17; font-size:9px;">ACEITES</div>
                <div class="anaquel" id="anq-ACEITES2" style="grid-column: 2; grid-row: 1 / span 2; background:#fff9c4; border-color:#fbc02d; color:#f57f17; font-size:9px;">ACEITES</div>
                <div style="grid-column: 3 / span 3; grid-row: 1; text-align: center; border-bottom: 1px solid #ccc; font-size: 10px; font-weight: bold; color: #666; display:flex; align-items:flex-end; justify-content:center; padding-bottom:2px;">ALMACÉN PRINCIPAL</div>
                <div class="anaquel" id="anq-E1" style="grid-column: 3; grid-row: 2;">ANAQUEL E1</div>
                <div class="anaquel" id="anq-E2" style="grid-column: 4 / span 2; grid-row: 2;">ANAQUEL E2</div>
                <div class="pasillo vertical" style="grid-column: 2; grid-row: 3 / span 5;">PASILLO</div>
                <div class="pasillo" style="grid-column: 3 / span 2; grid-row: 3;">PASILLO</div>
                <div class="anaquel" id="anq-C1C2" style="grid-column: 5; grid-row: 3; font-size: 9px;">ANAQUEL<br>C1 Y C2</div>
                <div class="anaquel" id="anq-B1" style="grid-column: 3; grid-row: 4;">ANAQUEL B1</div>
                <div class="anaquel" id="anq-B2" style="grid-column: 4 / span 2; grid-row: 4;">ANAQUEL B2</div>
                <div class="anaquel" id="anq-ADUANA" style="grid-column: 1; grid-row: 5 / span 3; background:#ffe0b2; border-color:#ffb74d; color:#e65100; font-size:9px;">ADUANA</div>
                <div class="pasillo" style="grid-column: 3 / span 3; grid-row: 5;">PASILLO</div>
                <div class="anaquel" id="anq-A1" style="grid-column: 3; grid-row: 6;">ANAQUEL A1</div>
                <div class="anaquel" id="anq-A2" style="grid-column: 4 / span 2; grid-row: 6;">ANAQUEL A2</div>
                <div class="pasillo" style="grid-column: 3 / span 3; grid-row: 7;">PASILLO</div>
                <div class="pasillo" style="grid-column: 1 / span 3; grid-row: 8;">PASILLO</div>
                <div class="anaquel" id="anq-BATERIAS" style="grid-column: 4 / span 2; grid-row: 8; background:#ffcdd2; border-color:#e57373; color:#c62828; font-size:9px;">BATERIAS</div>
            </div>
        </div>
        <div class="map-section"><h3 class="map-title">📍 BODEGA</h3>
            <div class="layout-grid" style="grid-template-columns: 80px 1fr 80px 1fr;">
                <div class="pasillo" style="grid-column: 1 / span 4; grid-row: 1;">BODEGA</div>
                <div class="pasillo vertical" style="grid-column: 1; grid-row: 2 / span 4;">ZONA EXTRA</div>
                <div class="anaquel" id="anq-F" style="grid-column: 2 / span 3; grid-row: 2; background:#e1bee7; border-color:#ab47bc;">ANAQUEL F</div>
                <div class="anaquel" id="anq-G" style="grid-column: 2; grid-row: 3 / span 3; background:#e1bee7; border-color:#ab47bc;">ANAQUEL G</div>
                <div class="pasillo vertical" style="grid-column: 3; grid-row: 3 / span 3;">PASILLO</div>
                <div class="anaquel" id="anq-I" style="grid-column: 4; grid-row: 3; background:#e1bee7; border-color:#ab47bc;">ANAQUEL I</div>
                <div class="anaquel" id="anq-H" style="grid-column: 4; grid-row: 4; background:#e1bee7; border-color:#ab47bc;">ANAQUEL H</div>
                <div class="anaquel" id="anq-RACK" style="grid-column: 4; grid-row: 5; background:#cfd8dc; border-color:#78909c;">RACK DE LLANTAS</div>
            </div>
        </div>
        <div class="map-section"><h3 class="map-title">📍 PLANTA ALTA</h3>
            <div class="layout-grid" style="grid-template-columns: 1fr 1fr 1fr;">
                <div class="pasillo" style="grid-column: 1 / span 3; grid-row: 1;">PLANTA ALTA</div>
                <div class="anaquel" id="anq-METAL" style="grid-column: 1 / span 3; grid-row: 2; background:#ffccbc; border-color:#ff7043;">PIEZAS METÁLICAS</div>
                <div class="pasillo vertical" style="grid-column: 1; grid-row: 3 / span 3;">ESCALERA</div>
                <div class="anaquel" id="anq-FACIAS" style="grid-column: 2 / span 2; grid-row: 3 / span 3; background:#ffccbc; border-color:#ff7043;">FACIAS</div>
            </div>
        </div>
    `;

    // 1. Pestaña Principal de Layout (Al hacer clic, abre Zoom Inteligente)
    const contenedorGeneral = document.getElementById('mapas-general-container');
    if (contenedorGeneral && contenedorGeneral.innerHTML.trim() === '') {
        contenedorGeneral.innerHTML = mapasHTML;

        contenedorGeneral.querySelectorAll('.anaquel').forEach(anq => {
            anq.style.cursor = 'pointer';
            anq.title = "Ver detalle del Anaquel";
            anq.addEventListener('click', function () {
                const anaquelId = this.id.replace('anq-', '');
                if (window.abrirModalZoomAnaquel) window.abrirModalZoomAnaquel(anaquelId, this.innerText.replace('<br>', ' '));
            });
        });
    }

    // 2. Modal de Localizar Pieza (Solo vista, sin clic)
    const contenedorModal = document.getElementById('modal-mapa-content');
    if (contenedorModal && contenedorModal.innerHTML.trim() === '') {
        contenedorModal.innerHTML = mapasHTML.replace(/id="anq-/g, 'id="modal-anq-');
    }

    // 3. Modal de Asignar (Al hacer clic, dispara la cuadrícula interna abajo)
    const contenedorAsignar = document.getElementById('modal-asignar-mapas-container');
    if (contenedorAsignar && contenedorAsignar.innerHTML.trim() === '') {
        contenedorAsignar.innerHTML = mapasHTML.replace(/id="anq-/g, 'id="asignar-anq-');

        const anaqueles = contenedorAsignar.querySelectorAll('.anaquel');
        anaqueles.forEach(anq => {
            anq.style.cursor = 'pointer';
            anq.title = "Haz clic para seleccionar";

            anq.addEventListener('click', function () {
                anaqueles.forEach(a => a.classList.remove('highlight'));
                this.classList.add('highlight');

                const keyInput = document.getElementById('modal-ubi-key-seleccionada');
                const nombreInput = document.getElementById('modal-ubi-nombre-seleccionado');

                const anaquelId = this.id.replace('asignar-anq-', '');
                if (keyInput) keyInput.value = anaquelId;
                if (nombreInput) nombreInput.value = this.innerText.replace('<br>', ' ');

                // Limpiar la sub-coordenada si cambias de anaquel
                document.getElementById('modal-ubi-extra').value = "";
                document.getElementById('btn-guardar-coordenada').style.display = 'none';

                // Llamar al cerebro geométrico
                if (window.dibujarMicroGridAsignacion) window.dibujarMicroGridAsignacion(anaquelId);
            });
        });
    }
}

window.piezaEnEdicion = "";

window.abrirModalAsignacion = function (serie) {
    window.piezaEnEdicion = serie;
    document.getElementById('modal-ubi-serie').innerText = serie;
    document.getElementById('modal-ubi-key-seleccionada').value = "";
    document.getElementById('modal-ubi-nombre-seleccionado').value = "";
    document.getElementById('modal-ubi-extra').value = "";

    document.getElementById('contenedor-micro-grid-asignar').style.display = 'none';
    document.getElementById('btn-guardar-coordenada').style.display = 'none';

    document.querySelectorAll('#modal-asignar-mapas-container .anaquel').forEach(a => a.classList.remove('highlight'));

    const numLimpio = serie.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    const infoPrevia = window.ubicacionesAlmacen[numLimpio];

    if (infoPrevia && infoPrevia.anaquelKey) {
        document.getElementById('modal-ubi-extra').value = infoPrevia.extra || "";
        let targetKey = infoPrevia.anaquelKey;
        if (targetKey === 'C1' || targetKey === 'C2') targetKey = 'C1C2';

        const target = document.getElementById(`asignar-anq-${targetKey}`);
        if (target) {
            target.click();
            setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);

            // Si ya traía nivel guardado, el anaquel.js se encargará de iluminarlo
        }
    }
    document.getElementById('modal-asignar-ubi').style.display = 'flex';
}

window.guardarUbicacionDefinitiva = async function () {
    if (!window.piezaEnEdicion) return;

    const anaquelKey = document.getElementById('modal-ubi-key-seleccionada').value;
    const anaquelNombre = document.getElementById('modal-ubi-nombre-seleccionado').value;
    const extraInfo = document.getElementById('modal-ubi-extra').value.trim(); // Ej. NIVEL 3 - S4

    if (!anaquelKey) { Swal.fire('Atención', 'Haz clic en un anaquel.', 'warning'); return; }

    // Validamos que si es anaquel normal, forzosamente haya elegido un cajón.
    const zonasEspeciales = ['ACEITES1', 'ACEITES2', 'ADUANA', 'BATERIAS', 'METAL', 'FACIAS', 'RACK'];
    if (!zonasEspeciales.includes(anaquelKey) && extraInfo === "") {
        Swal.fire('Atención', 'Haz clic en un nivel/sección de la cuadrícula de abajo.', 'warning'); return;
    }

    const ubicacionFinalStr = extraInfo ? `${anaquelNombre} - ${extraInfo}` : anaquelNombre;
    const numLimpio = window.piezaEnEdicion.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    const fechaHoy = new Date().toLocaleDateString('es-MX');

    if (!window.ubicacionesAlmacen[numLimpio]) window.ubicacionesAlmacen[numLimpio] = {};

    window.ubicacionesAlmacen[numLimpio] = {
        anaquelKey: anaquelKey,
        ubicacionStr: ubicacionFinalStr,
        extra: extraInfo,
        fecha: fechaHoy
    };

    try {
        await setDoc(doc(db, "configuracion", "ubicaciones_almacen"), { datos: window.ubicacionesAlmacen }, { merge: true });

        const celdaUbi = document.getElementById(`txt-ubi-${window.piezaEnEdicion}`);
        const celdaFec = document.getElementById(`fec-${window.piezaEnEdicion}`);
        if (celdaUbi) celdaUbi.innerText = ubicacionFinalStr;
        if (celdaFec) celdaFec.innerText = fechaHoy;

        document.getElementById('modal-asignar-ubi').style.display = 'none';
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Coordenada guardada', showConfirmButton: false, timer: 2000 });
    } catch (e) {
        Swal.fire('Error', 'No se pudo guardar la ubicación en la nube', 'error');
    }
}

window.resaltarAnaquelEnMapa = function (claveBuscada, prefijo) {
    document.querySelectorAll('.anaquel').forEach(el => el.classList.remove('highlight'));
    if (!claveBuscada || claveBuscada === 'N/A') return false;

    let claveFinal = claveBuscada;
    if (claveFinal === 'C1' || claveFinal === 'C2') claveFinal = 'C1C2';
    if (claveFinal === 'ACEITES') claveFinal = 'ACEITES1';

    let elementoMapa = document.getElementById(`${prefijo}anq-${claveFinal}`);

    if (claveBuscada === 'ACEITES' || claveFinal === 'ACEITES1') {
        const aceites1 = document.getElementById(`${prefijo}anq-ACEITES1`);
        const aceites2 = document.getElementById(`${prefijo}anq-ACEITES2`);
        if (aceites1) aceites1.classList.add('highlight');
        if (aceites2) aceites2.classList.add('highlight');
        if (aceites1) { aceites1.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; }
    }

    if (elementoMapa) {
        elementoMapa.classList.add('highlight');
        elementoMapa.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }
    return false;
}

window.buscarEnMapaGeneral = function () {
    const inputBuscar = document.getElementById('input-buscar-mapa');
    if (!inputBuscar) return;

    const numLimpio = inputBuscar.value.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    if (!numLimpio) return;

    const info = window.ubicacionesAlmacen[numLimpio];
    const claveParaMapear = info ? (info.anaquelKey || info.ubicacion) : null;
    const nombreMostrar = info ? (info.ubicacionStr || info.ubicacion) : null;

    if (claveParaMapear) {
        const exito = window.resaltarAnaquelEnMapa(claveParaMapear, '');
        if (exito) Swal.fire({ toast: true, position: 'top', icon: 'success', title: `Ubicación: ${nombreMostrar}`, showConfirmButton: false, timer: 3000 });
        else Swal.fire('Info', `El área "${nombreMostrar}" no es mapeable visualmente.`, 'warning');
    } else {
        Swal.fire('No encontrada', 'Esta pieza no tiene ubicación asignada.', 'error');
    }
}