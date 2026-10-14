import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.piezasSobrantes = []; 

export async function cargarSobrantesDesdeDB() {
    try {
        const docSnap = await getDoc(doc(db, "configuracion", "almacen"));
        if (docSnap.exists()) {
            window.piezasSobrantes = docSnap.data().lista || [];
            // Limpiar símbolos para búsquedas exactas
            window.piezasSobrantes.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            renderTablaSobrantes();
        }
    } catch (e) {
        console.error("Error al cargar sobrantes:", e);
    }
}

window.procesarExcelSobrantes = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    document.getElementById('upload-status').innerText = "⏳ Leyendo Excel...";
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            
            const sobrantesArray = json.map(row => {
                const keySerie = Object.keys(row).find(k => k.toLowerCase().includes('serie'));
                const keyDesc = Object.keys(row).find(k => k.toLowerCase().includes('descripc'));
                const keyCant = Object.keys(row).find(k => k.toLowerCase().includes('cantidad'));

                return {
                    serie: (row[keySerie] || '').toString().trim(),
                    descripcion: (row[keyDesc] || '').toString().trim(),
                    cantidad: row[keyCant] || 1
                };
            }).filter(item => item.serie !== '');

            document.getElementById('upload-status').innerText = "☁️ Subiendo a la nube...";
            await setDoc(doc(db, "configuracion", "almacen"), { lista: sobrantesArray });
            
            window.piezasSobrantes = sobrantesArray;
            window.piezasSobrantes.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            renderTablaSobrantes();
            
            Swal.fire('¡Éxito!', `Se guardaron ${sobrantesArray.length} piezas sobrantes.`, 'success');
            document.getElementById('upload-status').innerText = `✅ ${sobrantesArray.length} piezas actualizadas.`;
        } catch (error) {
            Swal.fire('Error', 'Hubo un problema leyendo el archivo Excel.', 'error');
            document.getElementById('upload-status').innerText = "❌ Error en archivo.";
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderTablaSobrantes() {
    const tbody = document.querySelector('#tabla-sobrantes-db tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    window.piezasSobrantes.forEach(p => {
        tbody.innerHTML += `<tr><td style="font-weight:bold;">${p.serie}</td><td>${p.descripcion}</td><td>${p.cantidad}</td></tr>`;
    });
}