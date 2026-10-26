import { db } from "./firebase-config.js";
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { cargarSobrantesDesdeDB } from "./sobrantes.js";
import { cargarInventarioDesdeDB } from "./inventario.js";
import { cargarObsoletosDesdeDB } from "./obsoletos.js";
import { recrearCotizacion } from "./recrear.js";
import { cargarKPIs } from "./kpi.js";
import { inicializarMapas } from "./layout.js";

window.modoPrueba = false;
let secretCode = "";

// ================= HACK SECRETO (MODO PRUEBA 2099) =================
document.addEventListener('keydown', (e) => {
    secretCode += e.key;
    if (secretCode.length > 4) secretCode = secretCode.substring(secretCode.length - 4);

    if (secretCode === "2099") {
        window.modoPrueba = !window.modoPrueba;
        window.inventarioAlDia = true; // Forzamos el desbloqueo
        window.fechaUltimoInventario = window.modoPrueba ? "HOY (Hack 2099)" : "Desconocida";

        document.getElementById('banner-prueba').style.display = window.modoPrueba ? 'block' : 'none';

        // Pintamos el panel de inventario a verde
        const lblFecha = document.getElementById('fecha-ultima-carga-lbl');
        if (lblFecha && window.modoPrueba) {
            lblFecha.innerText = `Última vez que se subió: ${window.fechaUltimoInventario}`;
            lblFecha.style.color = '#008A4B';
            lblFecha.parentElement.style.background = '#e6ffe6';
            lblFecha.parentElement.style.borderColor = '#008A4B';
        }

        // DESBLOQUEA EL MENÚ VISUALMENTE
        const menu = document.getElementById('main-menu');
        if (menu) menu.classList.remove('menu-bloqueado');

        Swal.fire({
            toast: true, position: 'top-end', icon: window.modoPrueba ? 'warning' : 'info',
            title: window.modoPrueba ? '🔓 MODO PRUEBA ACTIVO\nCandado Abierto.' : '🔒 MODO PRUEBA DESACTIVADO',
            showConfirmButton: false, timer: 3000
        });
        secretCode = "";
    }
});
// ===================================================================

window.onload = async () => {
    if (window.generarFolioYFecha) window.generarFolioYFecha();
    if (window.agregarFila) window.agregarFila();

    inicializarMapas(); // Inyecta el HTML de los mapas

    // Cargamos bases de datos (esto actualiza window.inventarioAlDia internamente)
    await Promise.all([cargarSobrantesDesdeDB(), cargarInventarioDesdeDB(), cargarObsoletosDesdeDB()]);

    document.getElementById('btn-nav-nueva').onclick = () => window.cambiarVista('nueva');
    document.getElementById('btn-nav-historial').onclick = () => window.cambiarVista('buscador');
    document.getElementById('btn-nav-inventario').onclick = () => window.cambiarVista('inventario');
    document.getElementById('btn-nav-almacen').onclick = () => window.cambiarVista('sobrantes');
    document.getElementById('btn-nav-pedido').onclick = () => window.cambiarVista('pedido');
    document.getElementById('btn-nav-layout').onclick = () => window.cambiarVista('layout');
    document.getElementById('btn-nav-kpi').onclick = () => window.cambiarVista('kpi');

    window.cargarModuloKPIs = cargarKPIs;

    // EL GUARDIA DE APERTURA ABSOLUTO (Validación estricta de arranque)
    if (!window.inventarioAlDia && !window.modoPrueba) {
        window.cambiarVista('inventario'); // Te manda a inventario
        const menu = document.getElementById('main-menu');
        if (menu) menu.classList.add('menu-bloqueado'); // Apaga clics en el menú

        Swal.fire({
            icon: 'error',
            title: '🔒 Sistema Bloqueado',
            html: `Debes subir el reporte de inventario de <b>HOY</b>.<br><br><span style="color:#E63312; font-weight:bold;">Última vez que se subió: ${window.fechaUltimoInventario}</span>`,
            confirmButtonText: 'Entendido',
            allowOutsideClick: false,
            allowEscapeKey: false
        });
    } else {
        window.cambiarVista('nueva');
    }
};

window.cambiarVista = function (vista) {
    // BLOQUEO ESTRICTO DE NAVEGACIÓN: Si intentas ir a cualquier lado y no está al día...
    if (!window.inventarioAlDia && !window.modoPrueba && vista !== 'inventario') {
        Swal.fire({
            icon: 'error', title: '🔒 Acceso Denegado',
            html: `Sube el inventario de hoy primero.<br><br>Última carga: <b>${window.fechaUltimoInventario}</b>`
        });
        vista = 'inventario'; // Te forzamos de regreso a inventario
    }

    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.card').forEach(sec => sec.style.display = 'none');

    if (vista === 'nueva') {
        document.getElementById('btn-nav-nueva').classList.add('active');
        document.getElementById('sec-nueva-cotizacion').style.display = 'block';
    } else if (vista === 'buscador') {
        document.getElementById('btn-nav-historial').classList.add('active');
        document.getElementById('sec-buscador').style.display = 'block';
        if (document.getElementById('vin-search').value === '') window.cargarUltimasCotizaciones();
    } else if (vista === 'inventario') {
        document.getElementById('btn-nav-inventario').classList.add('active');
        document.getElementById('sec-inventario').style.display = 'block';
    } else if (vista === 'sobrantes') {
        document.getElementById('btn-nav-almacen').classList.add('active');
        document.getElementById('sec-sobrantes').style.display = 'block';
    } else if (vista === 'pedido') {
        document.getElementById('btn-nav-pedido').classList.add('active');
        document.getElementById('sec-pedido').style.display = 'block';
    } else if (vista === 'layout') {
        document.getElementById('btn-nav-layout').classList.add('active');
        document.getElementById('sec-layout').style.display = 'block';
    } else if (vista === 'kpi') {
        document.getElementById('btn-nav-kpi').classList.add('active');
        document.getElementById('sec-kpi').style.display = 'block';
        window.cargarModuloKPIs();
    }
}

// RESTO DE FUNCIONES DEL HISTORIAL MANTENIDAS EXACTAMENTE IGUAL
window.armarTarjeta = function (data) {
    const totalFmt = '$' + data.totales.total.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    let listaPiezas = `<ul class="lista-piezas">`;
    data.refacciones.forEach(ref => { listaPiezas += `<li><b>${ref.cantidad}x</b> ${ref.numeroParte} - ${ref.descripcion} <i>($${ref.importe.toFixed(2)})</i></li>`; });
    listaPiezas += `</ul>`;
    const card = document.createElement('div');
    card.className = 'history-card toast-cursor';
    card.style = 'transition: 0.3s;';
    card.onmouseover = () => card.style.boxShadow = '0 5px 15px rgba(0,170,210,0.3)';
    card.onmouseout = () => card.style.boxShadow = 'none';
    card.onclick = () => recrearCotizacion(data);
    card.innerHTML = `<div style="display:flex; justify-content:space-between;"><h4 style="margin:0;">Folio: ${data.folio}</h4><span style="font-size:12px; font-weight:bold; color:var(--hyundai-light-blue);">🔄 RECREAR</span></div><p style="font-size:12px; color:#666; margin-bottom:10px;">${data.fecha}</p><p><strong>VIN:</strong> ${data.vin || 'N/A'}</p><p><strong>Total:</strong> ${totalFmt}</p><div style="margin-top:15px; border-top:1px dashed #ccc; padding-top:10px;">${listaPiezas}</div>`;
    return card;
}
window.cargarUltimasCotizaciones = async function () {
    const div = document.getElementById('resultados-busqueda'); div.innerHTML = '<p>Cargando...</p>';
    try {
        const q = query(collection(db, "cotizaciones"), orderBy("timestamp", "desc"), limit(30));
        const qs = await getDocs(q);
        if (qs.empty) { div.innerHTML = '<p>No hay cotizaciones.</p>'; return; }
        div.innerHTML = '<h3>Últimas 30 Cotizaciones</h3>';
        qs.forEach((doc) => div.appendChild(window.armarTarjeta(doc.data())));
    } catch (e) { }
}
document.getElementById('btn-buscar').addEventListener('click', async () => {
    const vinBusqueda = document.getElementById('vin-search').value.toUpperCase();
    if (vinBusqueda.length !== 17) { Swal.fire('Error', '17 dígitos requeridos', 'error'); return; }
    const div = document.getElementById('resultados-busqueda'); div.innerHTML = '<p>Buscando...</p>';
    try {
        const q = query(collection(db, "cotizaciones"), where("vin", "==", vinBusqueda));
        const qs = await getDocs(q);
        if (qs.empty) { div.innerHTML = '<p>No se encontraron.</p>'; return; }
        div.innerHTML = `<h3>Resultados para VIN: ${vinBusqueda}</h3>`;
        qs.forEach((doc) => div.appendChild(window.armarTarjeta(doc.data())));
    } catch (e) { }
});