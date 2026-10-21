import { db } from "./firebase-config.js";
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { cargarSobrantesDesdeDB } from "./sobrantes.js";
import { cargarInventarioDesdeDB } from "./inventario.js";
import { cargarObsoletosDesdeDB } from "./obsoletos.js";
import { recrearCotizacion } from "./recrear.js";
import { cargarKPIs } from "./kpi.js"; // <-- NUEVO: Importación del Dashboard KPI

window.onload = async () => {
    // Estas funciones ahora viven en cotizador.js, las llamamos globalmente
    if(window.generarFolioYFecha) window.generarFolioYFecha();
    if(window.agregarFila) window.agregarFila(); 
    
    // Cargar todas las bases de datos en segundo plano al abrir el sistema
    await Promise.all([ 
        cargarSobrantesDesdeDB(), 
        cargarInventarioDesdeDB(), 
        cargarObsoletosDesdeDB() 
    ]);
    
    // Configurar botones del menú lateral
    document.getElementById('btn-nav-nueva').onclick = () => window.cambiarVista('nueva');
    document.getElementById('btn-nav-historial').onclick = () => window.cambiarVista('buscador');
    document.getElementById('btn-nav-inventario').onclick = () => window.cambiarVista('inventario');
    document.getElementById('btn-nav-almacen').onclick = () => window.cambiarVista('sobrantes');
    document.getElementById('btn-nav-pedido').onclick = () => window.cambiarVista('pedido');
    document.getElementById('btn-nav-kpi').onclick = () => window.cambiarVista('kpi'); // <-- NUEVO

    // Hacer global la función para que el botón "Actualizar Datos" funcione
    window.cargarModuloKPIs = cargarKPIs;

    // ALERTA 7 DÍAS (OBSOLETOS)
    if(window.alertaObsoletos7Dias) {
        Swal.fire({
            toast: true, position: 'bottom-end', icon: 'warning', 
            title: '⚠️ El reporte de piezas obsoletas tiene más de 7 días.\nSe recomienda actualizarlo.',
            showConfirmButton: false, timer: 7000
        });
    }

    // CANDADO DIARIO (INVENTARIO)
    if(!window.inventarioAlDia) {
        Swal.fire({
            icon: 'warning', title: 'Inventario Desactualizado',
            text: 'Debes cargar el inventario del día de hoy antes de realizar cualquier cotización.',
            confirmButtonText: 'Ir a cargar Inventario', allowOutsideClick: false
        }).then(() => { window.cambiarVista('inventario'); });
    }
};

window.cambiarVista = function(vista) {
    // Limpiar estilos y ocultar todas las pantallas
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.card').forEach(sec => sec.style.display = 'none');
    
    // Rutas
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
        if(document.getElementById('vin-search').value === '') window.cargarUltimasCotizaciones();
    } else if(vista === 'inventario') {
        document.getElementById('btn-nav-inventario').classList.add('active');
        document.getElementById('sec-inventario').style.display = 'block';
    } else if(vista === 'sobrantes') {
        document.getElementById('btn-nav-almacen').classList.add('active');
        document.getElementById('sec-sobrantes').style.display = 'block';
    } else if(vista === 'pedido') {
        document.getElementById('btn-nav-pedido').classList.add('active');
        document.getElementById('sec-pedido').style.display = 'block';
    } else if(vista === 'kpi') { // <-- NUEVO RUTEO
        document.getElementById('btn-nav-kpi').classList.add('active');
        document.getElementById('sec-kpi').style.display = 'block';
        window.cargarModuloKPIs(); // Carga los cálculos y la gráfica automáticamente
    }
}

// ================= HISTORIAL DE COTIZACIONES =================
window.armarTarjeta = function(data) {
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
    
    // Clic para Recrear
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

window.cargarUltimasCotizaciones = async function() {
    const div = document.getElementById('resultados-busqueda');
    div.innerHTML = '<p>Cargando las últimas cotizaciones...</p>';
    try {
        const q = query(collection(db, "cotizaciones"), orderBy("timestamp", "desc"), limit(30));
        const qs = await getDocs(q);
        if(qs.empty) { div.innerHTML = '<p style="color: #888;">No hay cotizaciones registradas aún.</p>'; return; }
        
        div.innerHTML = '<h3 style="color:var(--hyundai-blue); margin-bottom:15px;">Últimas 30 Cotizaciones Registradas</h3>';
        qs.forEach((doc) => div.appendChild(window.armarTarjeta(doc.data())));
    } catch(e) { console.error(e); }
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
        qs.forEach((doc) => div.appendChild(window.armarTarjeta(doc.data())));
    } catch(e) { div.innerHTML = 'Error al consultar la base de datos.'; }
});