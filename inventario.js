import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.piezasInventario = []; 

export async function cargarInventarioDesdeDB() {
    try {
        const docSnap = await getDoc(doc(db, "configuracion", "inventario_principal"));
        if (docSnap.exists()) {
            window.piezasInventario = docSnap.data().lista || [];
            // Cachear el número de serie limpio (sin guiones ni símbolos)
            window.piezasInventario.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
        }
    } catch (e) {
        console.error("Error al cargar inventario:", e);
    }
}

window.procesarExcelInventario = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    document.getElementById('upload-status-inv').innerText = "⏳ Leyendo Inventario...";
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, {header: 1}); 
            
            const inventarioArray = [];
            
            rows.forEach(row => {
                // Verificar que la fila llegue mínimo a la columna N (índice 13) y tenga número de parte
                if(row.length >= 14 && row[0] && row[1]) {
                    const numParte = row[0].toString().trim();
                    const desc = row[1].toString().trim();
                    
                    // Excluir encabezados o filas vacías que digan TOTAL
                    if(numParte.toUpperCase() === 'TOTAL' || numParte.toUpperCase().includes('ACCESORIOS')) return;
                    
                    inventarioArray.push({
                        serie: numParte,
                        descripcion: desc,
                        precio: parseFloat(row[6]) || 0,     // Columna G (Costo / Precio)
                        disponible: parseFloat(row[10]) || 0 // Columna K (Disponibles)
                    });
                }
            });

            document.getElementById('upload-status-inv').innerText = "☁️ Subiendo inventario a la nube...";
            await setDoc(doc(db, "configuracion", "inventario_principal"), { lista: inventarioArray });
            
            window.piezasInventario = inventarioArray;
            window.piezasInventario.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            
            Swal.fire('¡Éxito!', `Se subieron ${inventarioArray.length} refacciones del inventario.`, 'success');
            document.getElementById('upload-status-inv').innerText = `✅ ${inventarioArray.length} piezas listas.`;
            
        } catch (error) {
            Swal.fire('Error', 'Hubo un problema leyendo el archivo XLS.', 'error');
            document.getElementById('upload-status-inv').innerText = "❌ Error en archivo.";
        }
    };
    reader.readAsArrayBuffer(file);
}