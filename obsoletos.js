import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.piezasObsoletas = [];
window.alertaObsoletos7Dias = false;

export async function cargarObsoletosDesdeDB() {
    try {
        const docSnap = await getDoc(doc(db, "configuracion", "obsoletos"));
        if (docSnap.exists()) {
            const data = docSnap.data();
            window.piezasObsoletas = data.lista || [];
            window.piezasObsoletas.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());

            if (data.fechaActualizacionTS) {
                const diasPasados = (Date.now() - data.fechaActualizacionTS) / (1000 * 60 * 60 * 24);
                if (diasPasados > 7) window.alertaObsoletos7Dias = true;
            } else {
                window.alertaObsoletos7Dias = true;
            }

            if(window.renderTablaObsoletos) window.renderTablaObsoletos();
        } else {
            window.alertaObsoletos7Dias = true;
        }
    } catch (e) {
        console.error("Error al cargar obsoletos:", e);
    }
}

window.procesarExcelObsoletos = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    Swal.fire({
        title: 'Cargando Obsoletos...',
        html: 'Leyendo y guardando en la nube...',
        showConfirmButton: false, allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, {header: 1});

            let obsoletosArray = [];

            rows.forEach(row => {
                if (row.length >= 10 && row[0] && row[9]) {
                    const numParte = row[0].toString().trim();
                    const clasif = row[9].toString().trim().toUpperCase();

                    if (clasif.includes('G3') || clasif.includes('G4')) {
                        obsoletosArray.push({ serie: numParte, clasificacion: clasif });
                    }
                }
            });

            await setDoc(doc(db, "configuracion", "obsoletos"), {
                lista: obsoletosArray,
                fechaActualizacionTS: Date.now(), 
                fechaActualizacionStr: new Date().toLocaleDateString('es-MX')
            });

            window.piezasObsoletas = obsoletosArray;
            window.piezasObsoletas.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            window.alertaObsoletos7Dias = false;
            
            if(window.renderTablaObsoletos) window.renderTablaObsoletos();

            Swal.fire('¡Éxito!', `Se registraron ${obsoletosArray.length} piezas como obsoletas (G3 y G4).`, 'success');
            event.target.value = '';

        } catch (error) {
            Swal.fire('Error', 'No se pudo leer el archivo Excel.', 'error');
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

// === EXPORTACIÓN GLOBAL PARA PERMITIR REPINTADO ===
window.renderTablaObsoletos = function() {
    const tbody = document.querySelector('#tabla-obsoletos-db tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const mostrar = window.piezasObsoletas.slice(0, 100); 
    mostrar.forEach(p => {
        tbody.innerHTML += `<tr>
            <td style="font-weight:bold; border-bottom:1px solid #ddd; padding:8px;">${p.serie}</td>
            <td style="border-bottom:1px solid #ddd; padding:8px;">${p.clasificacion}</td>
        </tr>`;
    });
}