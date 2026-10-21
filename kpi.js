import { db } from "./firebase-config.js";
import { collection, getDocs, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let kpiChart = null;

export async function cargarKPIs() {
    try {
        Swal.fire({ title: 'Calculando Métricas...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        // 1. Obtener todas las cotizaciones
        const q = query(collection(db, "cotizaciones"));
        const qs = await getDocs(q);
        
        let totalCotizacionesHoy = 0;
        const fechaHoy = new Date().toLocaleDateString('es-MX', {day: '2-digit', month: '2-digit', year: 'numeric'});
        
        const piezasCotizadasCount = {};
        const fechasCount = {};

        qs.forEach(doc => {
            const data = doc.data();
            const fechaCot = data.fecha; // Formato DD/MM/YYYY

            // Conteo diario
            if (fechaCot === fechaHoy) totalCotizacionesHoy++;

            // Conteo por fechas para gráfica
            fechasCount[fechaCot] = (fechasCount[fechaCot] || 0) + 1;

            // Conteo de piezas más cotizadas
            data.refacciones.forEach(ref => {
                const np = ref.numeroParte;
                piezasCotizadasCount[np] = (piezasCotizadasCount[np] || 0) + parseInt(ref.cantidad);
            });
        });

        // Top Refacción
        let topPieza = "Ninguna";
        let maxCotizada = 0;
        for (const [pieza, cant] of Object.entries(piezasCotizadasCount)) {
            if (cant > maxCotizada) { maxCotizada = cant; topPieza = pieza; }
        }

        // Fecha de más cotizaciones
        let topFecha = "N/A";
        let maxFecha = 0;
        for (const [fecha, cant] of Object.entries(fechasCount)) {
            if (cant > maxFecha) { maxFecha = cant; topFecha = fecha; }
        }

        // 2. Cálculos de Inventario
        let valorTotalInventario = 0;
        let piezasUnicas = window.piezasInventario ? window.piezasInventario.length : 0;
        
        if (window.piezasInventario) {
            window.piezasInventario.forEach(p => {
                // Costo * Disponibilidad
                valorTotalInventario += (p.costoPromedio * p.disponible);
            });
        }

        const totalSobrantes = window.piezasSobrantes ? window.piezasSobrantes.length : 0;
        const totalObsoletos = window.piezasObsoletas ? window.piezasObsoletas.length : 0;

        // 3. Pintar en HTML
        document.getElementById('kpi-coti-hoy').innerText = totalCotizacionesHoy;
        document.getElementById('kpi-top-pieza').innerText = `${topPieza} (${maxCotizada} pz)`;
        document.getElementById('kpi-top-fecha').innerText = `${topFecha} (${maxFecha} cots.)`;
        
        document.getElementById('kpi-valor-inv').innerText = '$' + valorTotalInventario.toLocaleString('es-MX', {minimumFractionDigits: 2});
        document.getElementById('kpi-uni-inv').innerText = piezasUnicas.toLocaleString('es-MX');
        document.getElementById('kpi-sobrantes').innerText = totalSobrantes;
        document.getElementById('kpi-obsoletos').innerText = totalObsoletos;

        // 4. Graficar Historial
        dibujarGrafica(fechasCount);

        Swal.close();
    } catch (e) {
        console.error(e);
        Swal.fire('Error', 'No se pudieron cargar los KPIs', 'error');
    }
}

function dibujarGrafica(fechasCount) {
    const ctx = document.getElementById('kpiChart').getContext('2d');
    
    // Ordenar fechas (simplificado)
    const labels = Object.keys(fechasCount).sort();
    const data = labels.map(l => fechasCount[l]);

    if (kpiChart) kpiChart.destroy(); // Destruir la anterior si existe

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