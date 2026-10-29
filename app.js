import { db } from "./firebase-config.js";
import { collection, query, where, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { cargarSobrantesDesdeDB } from "./sobrantes.js";
import { cargarInventarioDesdeDB } from "./inventario.js";
import { cargarObsoletosDesdeDB } from "./obsoletos.js";
import { recrearCotizacion } from "./recrear.js";
import { cargarKPIs } from "./kpi.js";
// NOTA: Se eliminó la importación rota de layout.js porque la volvimos Global.

window.modoPrueba = false;
let secretCode = "";

document.addEventListener('keydown', (e) => {
    secretCode += e.key;
    if (secretCode.length > 4) secretCode = secretCode.substring(secretCode.length - 4);
    if (secretCode === "2099") {
        window.modoPrueba = !window.modoPrueba;
        window.inventarioAlDia = true; 
        window.fechaUltimoInventario = window.modoPrueba ? "HOY (Hack 2099)" : "Desconocida";
        
        document.getElementById('banner-prueba').style.display = window.modoPrueba ? 'block' : 'none';
        
        const lblFecha = document.getElementById('fecha-ultima-carga-lbl');
        if (lblFecha && window.modoPrueba) {
            lblFecha.innerText = `Última vez que se subió: ${window.fechaUltimoInventario}`;
            lblFecha.style.color = '#008A4B';
            lblFecha.parentElement.style.background = '#e6ffe6';
            lblFecha.parentElement.style.borderColor = '#008A4B';
        }

        const menu = document.getElementById('main-menu');
        if(menu) menu.classList.remove('menu-bloqueado');

        Swal.fire({
            toast: true, position: 'top-end', icon: window.modoPrueba ? 'warning' : 'info',
            title: window.modoPrueba ? '🔓 MODO PRUEBA ACTIVO\nCandado Abierto.' : '🔒 MODO PRUEBA DESACTIVADO',
            showConfirmButton: false, timer: 3000
        });
        secretCode = "";
    }
});

window.onload = async () => {
    // 1. Dibuja los mapas en los modales flotantes globales al cargar la página
    if (window.inicializarMapas) window.inicializarMapas(); 

    // 2. Carga bases de datos en memoria 
    await Promise.all([cargarSobrantesDesdeDB(), cargarInventarioDesdeDB(), cargarObsoletosDesdeDB()]);

    document.querySelectorAll('.menu-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const vistaTarget = e.target.id.replace('btn-nav-', '');
            window.cambiarVista(vistaTarget);
        });
    });

    window.cargarModuloKPIs = cargarKPIs;

    if (!window.inventarioAlDia && !window.modoPrueba) {
        window.cambiarVista('inventario'); 
        const menu = document.getElementById('main-menu');
        if(menu) menu.classList.add('menu-bloqueado');
        
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

window.cambiarVista = async function (vista) {
    if (!window.inventarioAlDia && !window.modoPrueba && vista !== 'inventario') {
        Swal.fire({
            icon: 'error', title: '🔒 Acceso Denegado',
            html: `Sube el inventario de hoy primero.<br><br>Última carga: <b>${window.fechaUltimoInventario}</b>`
        });
        vista = 'inventario'; 
    }

    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
    const botonActivo = document.getElementById(`btn-nav-${vista}`);
    if(botonActivo) botonActivo.classList.add('active');

    const contentArea = document.getElementById('content-area');
    let seccion = document.getElementById(`sec-${vista}`);

    if (!seccion) {
        Swal.fire({ title: 'Cargando módulo...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
            const response = await fetch(`${vista}.html`);
            if (!response.ok) throw new Error('Archivo no encontrado');
            
            const htmlText = await response.text();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlText;
            
            seccion = tempDiv.firstElementChild; 
            contentArea.appendChild(seccion);    
            
            // 3. Cuando le das clic a "Layout Almacén", se descarga el HTML y HASTA ENTONCES dibuja los mapas allí adentro.
            if(vista === 'layout' && window.inicializarMapas) window.inicializarMapas(); 
            
            if(vista === 'nueva') {
                if (window.generarFolioYFecha) window.generarFolioYFecha();
                if (window.agregarFila) window.agregarFila();
            }
            if(vista === 'acme' && window.inicializarAcme) window.inicializarAcme(); 
            
            Swal.close();
        } catch (error) {
            Swal.fire('Error de Sistema', `No se encontró el archivo <b>${vista}.html</b>.<br>Asegúrate de estar corriendo el proyecto mediante Live Server.`, 'error');
            return;
        }
    }

    Array.from(contentArea.children).forEach(child => child.style.display = 'none');
    seccion.style.display = 'block';

    if (vista === 'inventario' && window.renderTablaInventario) window.renderTablaInventario();
    if (vista === 'sobrantes') {
        if (window.renderTablaSobrantes) window.renderTablaSobrantes();
        if (window.renderTablaObsoletos) window.renderTablaObsoletos();
    }
    
    if (vista === 'buscador' && document.getElementById('vin-search') && document.getElementById('vin-search').value === '') window.cargarUltimasCotizaciones();
    if (vista === 'kpi' && window.cargarModuloKPIs) window.cargarModuloKPIs();
}

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
    const div = document.getElementById('resultados-busqueda'); 
    if(!div) return;
    div.innerHTML = '<p>Cargando...</p>';
    try {
        const q = query(collection(db, "cotizaciones"), orderBy("timestamp", "desc"), limit(30));
        const qs = await getDocs(q);
        if (qs.empty) { div.innerHTML = '<p>No hay cotizaciones.</p>'; return; }
        div.innerHTML = '<h3>Últimas 30 Cotizaciones</h3>';
        qs.forEach((doc) => div.appendChild(window.armarTarjeta(doc.data())));
    } catch (e) { }
}

document.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'btn-buscar') {
        const vinBusqueda = document.getElementById('vin-search').value.toUpperCase();
        if (vinBusqueda.length !== 17) { Swal.fire('Error', '17 dígitos requeridos', 'error'); return; }
        const div = document.getElementById('resultados-busqueda'); 
        if(!div) return;
        div.innerHTML = '<p>Buscando...</p>';
        try {
            const q = query(collection(db, "cotizaciones"), where("vin", "==", vinBusqueda));
            const qs = await getDocs(q);
            if (qs.empty) { div.innerHTML = '<p>No se encontraron.</p>'; return; }
            div.innerHTML = `<h3>Resultados para VIN: ${vinBusqueda}</h3>`;
            qs.forEach((doc) => div.appendChild(window.armarTarjeta(doc.data())));
        } catch (err) { }
    }
});