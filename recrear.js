export function recrearCotizacion(data) {
    // 1. Cambiar a la pestaña de Nueva Cotización
    document.getElementById('btn-nav-nueva').click();
    
    // 2. Llenar el VIN y disparar el evento para desbloquear el sistema
    const vinInput = document.getElementById('vin');
    vinInput.value = data.vin || '';
    
    // CORRECCIÓN SENIOR: { bubbles: true } obliga al evento a subir hasta el 'document', 
    // donde 'cotizador.js' lo está escuchando para desbloquear los candados.
    vinInput.dispatchEvent(new Event('input', { bubbles: true })); 
    
    // 3. Dar un pequeño tiempo para que el sistema se desbloquee
    setTimeout(() => {
        document.getElementById('modelo').value = data.modelo || '';
        if(data.tipoCotizacion) document.getElementById('tipo-cotizacion').value = data.tipoCotizacion;
        
        const tbody = document.querySelector('#tabla-refacciones tbody');
        if(!tbody) return;
        tbody.innerHTML = ''; // Limpiar tabla actual
        
        // 4. Dibujar las refacciones guardadas
        if (data.refacciones && Array.isArray(data.refacciones)) {
            data.refacciones.forEach(ref => {
                const tr = document.createElement('tr');
                
                // CORRECCIÓN: Estructura HTML idéntica a cotizador.js para que 'verificarPieza' no detenga el ciclo
                tr.innerHTML = `
                    <td style="vertical-align: top;">
                        <input type="number" class="canti" value="${ref.cantidad || 1}" min="1" oninput="window.calcularTotales()">
                    </td>
                    <td style="vertical-align: top;">
                        <input type="text" class="num-parte" value="${ref.numeroParte || ''}" oninput="this.value = this.value.toUpperCase(); window.verificarPieza(this); window.calcularTotales();">
                    </td>
                    <td style="vertical-align: top;">
                        <input type="text" class="descripcion" value="${ref.descripcion || ''}" placeholder="ESCRIBE Y PRESIONA 'TAB' PARA BUSCAR..." style="text-transform: uppercase;">
                    </td>
                    
                    <!-- Faltaba este input, lo cual hacía chocar al sistema -->
                    <td style="vertical-align: top;">
                        <input type="text" class="ubi-pieza" readonly placeholder="-" style="text-align:center; background:#f9f9f9; font-weight:bold; border:none; width:100%;">
                    </td>
                    
                    <!-- Faltaba la clase td-disp en la celda principal -->
                    <td class="td-disp" style="vertical-align: top;">
                        <input type="text" class="disp-pieza" value="${ref.disponibilidad || ref.disp || '0'}" readonly style="text-align: center; background-color: #f4f4f4; color: #333; font-weight: bold; border:none; width:100%;">
                    </td>
                    
                    <td style="vertical-align: top;">
                        <input type="number" class="precio" value="${parseFloat(ref.precioUnitario || 0).toFixed(2)}" min="0" step="0.01" oninput="window.calcularTotales()" style="text-align: right;">
                    </td>
                    <td class="importe-lbl" style="text-align: right; font-weight:bold; vertical-align: middle;">
                        $${parseFloat(ref.importe || 0).toFixed(2)}
                    </td>
                    <td style="text-align: center; vertical-align: top;">
                        <button class="btn-primary" title="Localizar en Mapa" style="padding:4px; font-size:12px; background:#6f42c1; border:none; margin-bottom:4px;" onclick="window.localizarPiezaCotizador(this)">📍</button>
                        <button class="btn-danger" style="padding:4px;" onclick="this.closest('tr').remove(); window.calcularTotales();">X</button>
                    </td>
                `;
                
                // Re-asignamos el buscador TAB a las filas recreadas
                const descInput = tr.querySelector('.descripcion');
                if(descInput) {
                    descInput.addEventListener('keydown', function(e) {
                        if (e.key === 'Tab' && this.value.trim() !== '') {
                            e.preventDefault(); 
                            if(window.abrirBuscadorPiezas) window.abrirBuscadorPiezas(this.value.trim().toUpperCase(), tr);
                        }
                    });
                }
    
                tbody.appendChild(tr);
                
                // Hacer que salgan las alertas de ✅/❌, pero sin borrar el precio viejo
                const inputParte = tr.querySelector('.num-parte');
                if(inputParte && window.verificarPieza) window.verificarPieza(inputParte);
            });
        }
        
        if(window.calcularTotales) window.calcularTotales();
        
        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
            icon: 'success', title: 'Cotización recreada.\nSe mantuvieron los precios antiguos.'
        });
        
    }, 400); // 400 milisegundos de espera
}