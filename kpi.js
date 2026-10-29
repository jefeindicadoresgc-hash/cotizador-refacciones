import { db } from "./firebase-config.js";
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let kpiChart = null;

export async function cargarKPIs() {
    try {
        Swal.fire({ title: 'Calculando Métricas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        const q = query(collection(db, "cotizaciones"));
        const qs = await getDocs(q);
        
        let totalCotizacionesHoy = 0;
        const fechaHoy = new Date().toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'});
        
        const piezasCotizadasCount = {};
        const fechasCount = {};

        qs.forEach(doc => {
            const data = doc.data();
            const fechaCot = data.fecha;

            if (fechaCot === fechaHoy) totalCotizacionesHoy++;
            fechasCount[fechaCot] = (fechasCount[fechaCot] || 0) + 1;

            if(data.refacciones) {
                data.refacciones.forEach(ref => {
                    const np = ref.numeroParte;
                    piezasCotizadasCount[np] = (piezasCotizadasCount[np] || 0) + parseInt(ref.cantidad);
                });
            }
        });

        let topPieza = "Ninguna";
        let maxCotizada = 0;
        for (const [pieza, cant] of Object.entries(piezasCotizadasCount)) {
            if (cant > maxCotizada) { maxCotizada = cant; topPieza = pieza; }
        }

        let topFecha = "N/A";
        let maxFecha = 0;
        for (const [fecha, cant] of Object.entries(fechasCount)) {
            if (cant > maxFecha) { maxFecha = cant; topFecha = fecha; }
        }

        let valorTotalInventario = 0;
        let piezasUnicas = window.piezasInventario ? window.piezasInventario.length : 0;
        
        if (window.piezasInventario) {
            window.piezasInventario.forEach(p => {
                valorTotalInventario += (p.costoPromedio * p.disponible);
            });
        }

        const totalSobrantes = window.piezasSobrantes ? window.piezasSobrantes.length : 0;
        const totalObsoletos = window.piezasObsoletas ? window.piezasObsoletas.length : 0;

        // INYECCIÓN SEGURA (Previene errores si cambias de pestaña muy rápido)
        const elCotiHoy = document.getElementById('kpi-coti-hoy');
        if(elCotiHoy) elCotiHoy.innerText = totalCotizacionesHoy;
        
        const elTopPieza = document.getElementById('kpi-top-pieza');
        if(elTopPieza) elTopPieza.innerText = `${topPieza} (${maxCotizada} pz)`;
        
        const elTopFecha = document.getElementById('kpi-top-fecha');
        if(elTopFecha) elTopFecha.innerText = `${topFecha} (${maxFecha} cots.)`;
        
        const elValorInv = document.getElementById('kpi-valor-inv');
        if(elValorInv) elValorInv.innerText = '$' + valorTotalInventario.toLocaleString('es-MX', {minimumFractionDigits: 2});
        
        const elUniInv = document.getElementById('kpi-uni-inv');
        if(elUniInv) elUniInv.innerText = piezasUnicas.toLocaleString('es-MX');
        
        const elSobrantes = document.getElementById('kpi-sobrantes');
        if(elSobrantes) elSobrantes.innerText = totalSobrantes;
        
        const elObsoletos = document.getElementById('kpi-obsoletos');
        if(elObsoletos) elObsoletos.innerText = totalObsoletos;

        dibujarGrafica(fechasCount);
        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudieron cargar los KPIs', 'error');
    }
}

function dibujarGrafica(fechasCount) {
    const canvas = document.getElementById('kpiChart');
    if(!canvas) return; // Blindaje: Si el canvas no existe, no intenta dibujar

    const ctx = canvas.getContext('2d');
    const labels = Object.keys(fechasCount).sort();
    const data = labels.map(l => fechasCount[l]);

    if (kpiChart) kpiChart.destroy(); 

    kpiChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cotizaciones Generadas',
                data: data,
                backgroundColor: 'rgba(0, 44, 95, 0.7)',
                borderColor: 'rgba(0, 44, 95, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}