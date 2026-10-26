import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.piezasInventario = [];
window.inventarioAlDia = false;
window.fechaUltimoInventario = "Nunca";
window.ubicacionesAlmacen = {};

export async function cargarInventarioDesdeDB() {
    try {
        const ubiDoc = await getDoc(doc(db, "configuracion", "ubicaciones_almacen"));
        if (ubiDoc.exists()) {
            const rawUbi = ubiDoc.data().datos || {};
            window.ubicacionesAlmacen = {};
            // MIGRACIÓN INTELIGENTE: Convierte todo a versión "limpia" para evitar problemas de guiones
            for (let key in rawUbi) {
                const cleanKey = key.replace(/[^A-Z0-9]/ig, '').toUpperCase();
                window.ubicacionesAlmacen[cleanKey] = rawUbi[key];
            }
        }

        const metaDoc = await getDoc(doc(db, "configuracion", "inventario_meta"));
        if (metaDoc.exists()) {
            const dataMeta = metaDoc.data();
            const numPartes = dataMeta.partes || 0;

            window.fechaUltimoInventario = dataMeta.fechaActualizacion || "Nunca";
            const fechaHoy = new Date().toLocaleDateString('es-MX');
            const lblFecha = document.getElementById('fecha-ultima-carga-lbl');

            if (dataMeta.fechaActualizacion === fechaHoy) {
                window.inventarioAlDia = true;
                const menu = document.getElementById('main-menu');
                if (menu) menu.classList.remove('menu-bloqueado');

                if (lblFecha) {
                    lblFecha.innerText = `Última vez que se subió: HOY (${window.fechaUltimoInventario})`;
                    lblFecha.style.color = '#008A4B';
                    lblFecha.parentElement.style.background = '#e6ffe6';
                    lblFecha.parentElement.style.borderColor = '#008A4B';
                }
            } else {
                window.inventarioAlDia = false;
                const menu = document.getElementById('main-menu');
                if (menu) menu.classList.add('menu-bloqueado');

                if (lblFecha) {
                    lblFecha.innerText = `Última vez que se subió: ${window.fechaUltimoInventario} (Desactualizado)`;
                    lblFecha.style.color = '#E63312';
                    lblFecha.parentElement.style.background = '#ffe6e6';
                    lblFecha.parentElement.style.borderColor = '#E63312';
                }
            }

            window.piezasInventario = [];
            for (let i = 0; i < numPartes; i++) {
                const docSnap = await getDoc(doc(db, "configuracion", `inventario_parte_${i}`));
                if (docSnap.exists()) { window.piezasInventario = window.piezasInventario.concat(docSnap.data().lista); }
            }

            window.piezasInventario.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            renderTablaInventario();
        }
    } catch (e) {
        console.error("Error al cargar inventario:", e);
    }
}

window.procesarExcelInventario = function (event) {
    const file = event.target.files[0];
    if (!file) return;

    Swal.fire({ title: 'Procesando Inventario...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

            let inventarioArray = [];

            rows.forEach(row => {
                if (row.length >= 6 && row[0]) {
                    const numParte = row[0].toString().trim();
                    const desc = row[1] ? row[1].toString().trim() : 'SIN DESCRIPCIÓN';
                    if (numParte.toUpperCase() === 'TOTAL' || numParte.toUpperCase().includes('ACCESORIOS') || numParte.toUpperCase().includes('ALM.')) return;

                    inventarioArray.push({
                        serie: numParte, descripcion: desc, precio: parseFloat(row[3]) || 0,
                        costoPromedio: parseFloat(row[4]) || 0, disponible: parseFloat(row[5]) || 0
                    });
                }
            });

            if (inventarioArray.length === 0) { Swal.fire('Error', 'No se encontraron piezas.', 'error'); return; }

            const chunkSize = 3000;
            const numOfChunks = Math.ceil(inventarioArray.length / chunkSize);
            const fechaHoy = new Date().toLocaleDateString('es-MX');

            await setDoc(doc(db, "configuracion", "inventario_meta"), { fechaActualizacion: fechaHoy, totalPiezas: inventarioArray.length, partes: numOfChunks });
            for (let i = 0; i < numOfChunks; i++) {
                const chunk = inventarioArray.slice(i * chunkSize, (i + 1) * chunkSize);
                await setDoc(doc(db, "configuracion", `inventario_parte_${i}`), { lista: chunk });
            }

            window.piezasInventario = inventarioArray;
            window.piezasInventario.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());

            window.inventarioAlDia = true;
            window.fechaUltimoInventario = fechaHoy;
            const menu = document.getElementById('main-menu');
            if (menu) menu.classList.remove('menu-bloqueado');

            const lblFecha = document.getElementById('fecha-ultima-carga-lbl');
            if (lblFecha) {
                lblFecha.innerText = `Última vez que se subió: HOY (${fechaHoy})`;
                lblFecha.style.color = '#008A4B';
                lblFecha.parentElement.style.background = '#e6ffe6';
                lblFecha.parentElement.style.borderColor = '#008A4B';
            }

            renderTablaInventario();
            Swal.fire('¡Éxito!', `Inventario actualizado de hoy.\nCandado Desbloqueado.`, 'success');
            document.getElementById('upload-status-inv').innerText = `✅ Actualizado hoy (${inventarioArray.length} pz).`;
            event.target.value = '';

            if (document.getElementById('candado-status').innerText.includes('Candado') && document.getElementById('vin').value.length === 17) {
                document.getElementById('vin').dispatchEvent(new Event('input'));
            }
        } catch (error) { Swal.fire('Error', 'Fallo al procesar el Excel.', 'error'); event.target.value = ''; }
    };
    reader.readAsArrayBuffer(file);
}

function renderTablaInventario() {
    const tbody = document.querySelector('#tabla-inventario-db tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const piezasMostrar = window.piezasInventario.slice(0, 300);

    piezasMostrar.forEach(p => {
        // ENLACE LIMPIO: Usa p.cleanSerie
        const infoUbi = window.ubicacionesAlmacen[p.cleanSerie] || { ubicacionStr: 'Sin Asignar', fecha: 'Nunca' };

        const textoMostrar = infoUbi.ubicacionStr || infoUbi.ubicacion || 'Sin Asignar';

        tbody.innerHTML += `<tr>
            <td style="font-weight:bold; border-bottom: 1px solid #ddd; padding: 8px;">${p.serie}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px;">${p.descripcion}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px;">$${p.precio.toFixed(2)}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; font-weight:bold; text-align:center;">${p.disponible}</td>
            
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center; font-weight:bold; color:#005c32;" id="txt-ubi-${p.serie}">
                ${textoMostrar}
            </td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center; font-size:11px; color:#888;" id="fec-${p.serie}">
                ${infoUbi.fecha || 'Nunca'}
            </td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; text-align:center;">
                <button onclick="window.abrirModalAsignacion('${p.serie}')" class="btn-primary" style="padding:4px 8px; font-size:12px; width:auto; background-color:#FF8C00; border-color:#FF8C00;">⚙️ Asignar Lugar</button>
            </td>
        </tr>`;
    });

    if (window.piezasInventario.length > 300) {
        tbody.innerHTML += `<tr><td colspan="7" style="text-align:center; padding:10px; color:#666;">Mostrando 300 registros...</td></tr>`;
    }
}