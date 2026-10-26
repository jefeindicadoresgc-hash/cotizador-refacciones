import { db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function inicializarMapas() {
    const mapasHTML = `
        <div class="map-section"><h3 class="map-title">📍 ALMACÉN PRINCIPAL</h3>
            <div class="layout-grid" style="grid-template-columns: 80px 1fr 1fr 80px;">
                <div class="pasillo vertical" style="grid-row: 1 / span 9; grid-column: 1;">PASILLOS</div>
                <div class="anaquel" id="anq-E1E2" style="grid-column: 2 / span 2; grid-row: 1;">ANAQUEL E1 Y E2</div>
                <div class="anaquel" id="anq-D2" style="grid-row: 1 / span 3; grid-column: 4; background:#cce5ff;">ANAQUEL D2</div>
                <div class="pasillo" style="grid-row: 2; grid-column: 2 / span 3;">PASILLO</div>
                <div class="anaquel" id="anq-C1" style="grid-column: 2; grid-row: 3;">ANAQUEL C1</div>
                <div class="anaquel" id="anq-C2" style="grid-column: 3; grid-row: 3;">ANAQUEL C2</div>
                <div class="pasillo" style="grid-row: 4; grid-column: 2 / span 3;">PASILLO</div>
                <div class="anaquel" id="anq-B1" style="grid-column: 2; grid-row: 5;">ANAQUEL B1</div>
                <div class="anaquel" id="anq-B2" style="grid-column: 3; grid-row: 5;">ANAQUEL B2</div>
                <div class="pasillo" style="grid-row: 6; grid-column: 2 / span 3;">PASILLO</div>
                <div class="anaquel" id="anq-A1" style="grid-column: 2; grid-row: 7;">ANAQUEL A1</div>
                <div class="anaquel" id="anq-A2" style="grid-column: 3; grid-row: 7;">ANAQUEL A2</div>
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

    const contenedorGeneral = document.getElementById('mapas-general-container');
    if (contenedorGeneral) contenedorGeneral.innerHTML = mapasHTML;

    const contenedorModal = document.getElementById('modal-mapa-content');
    if (contenedorModal) {
        contenedorModal.innerHTML = mapasHTML.replace(/id="anq-/g, 'id="modal-anq-');
    }

    const contenedorAsignar = document.getElementById('modal-asignar-mapas-container');
    if (contenedorAsignar) {
        contenedorAsignar.innerHTML = mapasHTML.replace(/id="anq-/g, 'id="asignar-anq-');

        const anaqueles = contenedorAsignar.querySelectorAll('.anaquel, .anaquel-d2');
        anaqueles.forEach(anq => {
            anq.style.cursor = 'pointer';
            anq.title = "Haz clic para seleccionar";

            anq.addEventListener('click', function () {
                anaqueles.forEach(a => a.classList.remove('highlight'));
                this.classList.add('highlight');
                document.getElementById('modal-ubi-key-seleccionada').value = this.id.replace('asignar-anq-', '');
                document.getElementById('modal-ubi-nombre-seleccionado').value = this.innerText;
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
    document.querySelectorAll('#modal-asignar-mapas-container .anaquel, #modal-asignar-mapas-container .anaquel-d2').forEach(a => a.classList.remove('highlight'));

    // LECTURA LIMPIA (Evita error de guiones)
    const numLimpio = serie.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    const infoPrevia = window.ubicacionesAlmacen[numLimpio];

    if (infoPrevia && infoPrevia.anaquelKey) {
        document.getElementById('modal-ubi-extra').value = infoPrevia.extra || "";
        const target = document.getElementById(`asignar-anq-${infoPrevia.anaquelKey}`);
        if (target) {
            target.click();
            setTimeout(() => { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
        }
    }

    document.getElementById('modal-asignar-ubi').style.display = 'flex';
}

window.guardarUbicacionDefinitiva = async function () {
    if (!window.piezaEnEdicion) return;

    const anaquelKey = document.getElementById('modal-ubi-key-seleccionada').value;
    const anaquelNombre = document.getElementById('modal-ubi-nombre-seleccionado').value;
    const extraInfo = document.getElementById('modal-ubi-extra').value.toUpperCase().trim();
    const fechaHoy = new Date().toLocaleDateString('es-MX');

    if (!anaquelKey) { Swal.fire('Atención', 'Haz clic en un anaquel.', 'warning'); return; }

    const ubicacionFinalStr = extraInfo ? `${anaquelNombre} - ${extraInfo}` : anaquelNombre;

    // GUARDADO LIMPIO (Evita error de guiones)
    const numLimpio = window.piezaEnEdicion.replace(/[^A-Z0-9]/ig, '').toUpperCase();

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
        Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Ubicación guardada con éxito', showConfirmButton: false, timer: 2000 });
    } catch (e) {
        Swal.fire('Error', 'No se pudo guardar la ubicación en la nube', 'error');
    }
}

window.resaltarAnaquelEnMapa = function (claveBuscada, prefijo) {
    document.querySelectorAll('.anaquel').forEach(el => el.classList.remove('highlight'));
    document.querySelectorAll('.anaquel-d2').forEach(el => el.classList.remove('highlight'));
    if (!claveBuscada || claveBuscada === 'N/A') return false;

    let elementoMapa = document.getElementById(`${prefijo}anq-${claveBuscada}`);

    if (!elementoMapa) {
        const match = claveBuscada.match(/([A-I])[^0-9]*([1-2])/i);
        if (match) {
            let idBuscado = match[1].toUpperCase() + match[2];
            if (idBuscado === 'E1' || idBuscado === 'E2') idBuscado = 'E1E2';
            elementoMapa = document.getElementById(`${prefijo}anq-${idBuscado}`);
        }
    }

    if (elementoMapa) {
        elementoMapa.classList.add('highlight');
        elementoMapa.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return true;
    }
    return false;
}

window.buscarEnMapaGeneral = function () {
    const numLimpio = document.getElementById('input-buscar-mapa').value.replace(/[^A-Z0-9]/ig, '').toUpperCase();
    if (!numLimpio) return;

    // BÚSQUEDA LIMPIA
    const info = window.ubicacionesAlmacen[numLimpio];
    const claveParaMapear = info ? (info.anaquelKey || info.ubicacion) : null;
    const nombreMostrar = info ? (info.ubicacionStr || info.ubicacion) : null;

    if (claveParaMapear) {
        const exito = window.resaltarAnaquelEnMapa(claveParaMapear, '');
        if (exito) Swal.fire({ toast: true, position: 'top', icon: 'success', title: `Ubicación: ${nombreMostrar}`, showConfirmButton: false, timer: 3000 });
        else Swal.fire('Info', `El área "${nombreMostrar}" no es mapeable visualmente.`, 'warning');
    } else {
        Swal.fire('No encontrada', 'Esta pieza no tiene ubicación asignada en el sistema.', 'error');
    }
}