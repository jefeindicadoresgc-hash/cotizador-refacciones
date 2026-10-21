import { db } from "./firebase-config.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

window.piezasInventario = []; 
window.inventarioAlDia = false; 

export async function cargarInventarioDesdeDB() {
    try {
        const metaDoc = await getDoc(doc(db, "configuracion", "inventario_meta"));
        
        if (metaDoc.exists()) {
            const dataMeta = metaDoc.data();
            const numPartes = dataMeta.partes || 0;
            
            // VERIFICACIÓN DEL CANDADO DIARIO
            const fechaHoy = new Date().toLocaleDateString('es-MX');
            if(dataMeta.fechaActualizacion === fechaHoy) {
                window.inventarioAlDia = true;
            }

            // Descargar y unir los bloques de inventario
            window.piezasInventario = [];
            for (let i = 0; i < numPartes; i++) {
                const docSnap = await getDoc(doc(db, "configuracion", `inventario_parte_${i}`));
                if (docSnap.exists()) {
                    window.piezasInventario = window.piezasInventario.concat(docSnap.data().lista);
                }
            }

            // Cachear serie limpia para búsquedas rápidas
            window.piezasInventario.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            renderTablaInventario();
        }
    } catch (e) {
        console.error("Error al cargar inventario:", e);
    }
}

window.procesarExcelInventario = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    Swal.fire({
        title: 'Cargando Nuevo Inventario...',
        html: `<div style="display:flex; justify-content:center; margin:15px 0;"><div class="wheel-and-hamster"><div class="wheel"></div><div class="hamster"><div class="hamster__body"><div class="hamster__head"><div class="hamster__ear"></div><div class="hamster__eye"></div><div class="hamster__nose"></div></div><div class="hamster__limb hamster__limb--fr"></div><div class="hamster__limb hamster__limb--fl"></div><div class="hamster__limb hamster__limb--br"></div><div class="hamster__limb hamster__limb--bl"></div><div class="hamster__tail"></div></div></div><div class="spoke"></div></div></div><br><b>Sobrescribiendo datos y actualizando existencias...</b>`,
        showConfirmButton: false,
        allowOutsideClick: false
    });

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, {header: 1}); 
            
            let inventarioArray = [];
            
            rows.forEach(row => {
                // Validación para el nuevo formato "rptvaloracagen.xls"
                // Col A(0)=Código, B(1)=Desc, D(3)=Precio, E(4)=Costo, F(5)=Disp
                if(row.length >= 6 && row[0]) {
                    const numParte = row[0].toString().trim();
                    const desc = row[1] ? row[1].toString().trim() : 'SIN DESCRIPCIÓN';
                    
                    // Excluir títulos o etiquetas de categorías
                    if(numParte.toUpperCase() === 'TOTAL' || numParte.toUpperCase().includes('ACCESORIOS') || numParte.toUpperCase().includes('ALM.')) return;
                    
                    inventarioArray.push({
                        serie: numParte,
                        descripcion: desc,
                        precio: parseFloat(row[3]) || 0,        // Col D: Precio Lista
                        costoPromedio: parseFloat(row[4]) || 0, // Col E: Costo (Para el KPI)
                        disponible: parseFloat(row[5]) || 0     // Col F: Existencia
                    });
                }
            });

            if(inventarioArray.length === 0) {
                 Swal.fire('Error', 'No se encontraron piezas. Verifica que sea el formato correcto.', 'error');
                 event.target.value = '';
                 return;
            }

            // División en bloques para evitar error de tamaño en Firebase
            const chunkSize = 3000;
            const numOfChunks = Math.ceil(inventarioArray.length / chunkSize);
            const fechaHoy = new Date().toLocaleDateString('es-MX');

            // 1. Guardar Metadatos y Fecha de hoy
            await setDoc(doc(db, "configuracion", "inventario_meta"), {
                fechaActualizacion: fechaHoy,
                totalPiezas: inventarioArray.length,
                partes: numOfChunks
            });

            // 2. Sobrescribir cada bloque
            for (let i = 0; i < numOfChunks; i++) {
                const chunk = inventarioArray.slice(i * chunkSize, (i + 1) * chunkSize);
                await setDoc(doc(db, "configuracion", `inventario_parte_${i}`), { lista: chunk });
            }
            
            window.piezasInventario = inventarioArray;
            window.piezasInventario.forEach(p => p.cleanSerie = p.serie.replace(/[^A-Z0-9]/ig, '').toUpperCase());
            window.inventarioAlDia = true; // Desbloquear candado
            
            renderTablaInventario();
            
            Swal.fire('¡Éxito!', `Inventario sobrescrito exitosamente.\nSe cargaron ${inventarioArray.length} refacciones.`, 'success');
            document.getElementById('upload-status-inv').innerText = `✅ Actualizado hoy (${inventarioArray.length} pz).`;
            event.target.value = '';
            
            // Si el candado estaba activo, forzar validación del VIN para desbloquear la pantalla
            if(document.getElementById('candado-status').innerText.includes('Candado') && document.getElementById('vin').value.length === 17) {
                document.getElementById('vin').dispatchEvent(new Event('input')); 
            }

        } catch (error) {
            console.error("ERROR AL LEER O SUBIR EL INVENTARIO: ", error);
            Swal.fire('Error', 'No se pudo leer el archivo Excel.', 'error');
            event.target.value = '';
        }
    };
    reader.readAsArrayBuffer(file);
}

function renderTablaInventario() {
    const tbody = document.querySelector('#tabla-inventario-db tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    const piezasMostrar = window.piezasInventario.slice(0, 300);
    
    piezasMostrar.forEach(p => {
        tbody.innerHTML += `<tr>
            <td style="font-weight:bold; border-bottom: 1px solid #ddd; padding: 8px;">${p.serie}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px;">${p.descripcion}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px;">$${p.precio.toFixed(2)}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; color: #888;">$${p.costoPromedio.toFixed(2)}</td>
            <td style="border-bottom: 1px solid #ddd; padding: 8px; font-weight:bold;">${p.disponible}</td>
        </tr>`;
    });

    if(window.piezasInventario.length > 300) {
        tbody.innerHTML += `<tr><td colspan="5" style="text-align:center; padding:10px; color:#666;">Mostrando 300 de ${window.piezasInventario.length} registros (El resto está oculto por rendimiento)...</td></tr>`;
    }
}