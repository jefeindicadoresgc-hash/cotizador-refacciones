export function recrearCotizacion(data) {
    // 1. Cambiar a la pestaña de Nueva Cotización
    document.getElementById('btn-nav-nueva').click();
    
    // 2. Llenar el VIN y disparar el evento para desbloquear el sistema
    const vinInput = document.getElementById('vin');
    vinInput.value = data.vin || '';
    vinInput.dispatchEvent(new Event('input')); 
    
    // 3. Dar un pequeño tiempo para que el sistema se desbloquee
    setTimeout(() => {
        document.getElementById('modelo').value = data.modelo || '';
        if(data.tipoCotizacion) document.getElementById('tipo-cotizacion').value = data.tipoCotizacion;
        
        const tbody = document.querySelector('#tabla-refacciones tbody');
        tbody.innerHTML = ''; // Limpiar tabla actual
        
        // 4. Dibujar las refacciones guardadas (Ahora incluye la celda disp-pieza)
        data.refacciones.forEach(ref => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="vertical-align: top;"><input type="number" class="canti" value="${ref.cantidad}" min="1" oninput="window.calcularTotales()"></td>
                <td style="vertical-align: top;"><input type="text" class="num-parte" value="${ref.numeroParte}" oninput="this.value = this.value.toUpperCase(); window.verificarPieza(this); window.calcularTotales();"></td>
                <td style="vertical-align: top;"><input type="text" class="descripcion" value="${ref.descripcion}" placeholder="ESCRIBE Y PRESIONA 'TAB' PARA BUSCAR..." style="text-transform: uppercase;"></td>
                <!-- NUEVO CAMPO DE DISPONIBILIDAD AL RECREAR -->
                <td style="vertical-align: top;"><input type="text" class="disp-pieza" value="${ref.disponibilidad || '0'}" readonly style="text-align: center; background-color: #f4f4f4; color: #333; font-weight: bold;"></td>
                <td style="vertical-align: top;"><input type="number" class="precio" value="${ref.precioUnitario}" min="0" step="0.01" oninput="window.calcularTotales()" style="text-align: right;"></td>
                <td class="importe-lbl" style="text-align: right; font-weight:bold; vertical-align: middle;">$${ref.importe.toFixed(2)}</td>
                <td style="text-align: center; vertical-align: top;"><button class="btn-danger" onclick="this.closest('tr').remove(); window.calcularTotales();">X</button></td>
            `;
            
            // Re-asignamos el buscador TAB a las filas recreadas por si quiere modificar la descripción
            const descInput = tr.querySelector('.descripcion');
            descInput.addEventListener('keydown', function(e) {
                if (e.key === 'Tab' && this.value.trim() !== '') {
                    e.preventDefault(); 
                    window.abrirBuscadorPiezas(this.value.trim().toUpperCase(), tr);
                }
            });

            tbody.appendChild(tr);
            
            // Hacer que salgan las alertas de ✅/❌, pero sin borrar el precio viejo
            const inputParte = tr.querySelector('.num-parte');
            window.verificarPieza(inputParte);
        });
        
        window.calcularTotales();
        
        Swal.fire({
            toast: true, position: 'top-end', showConfirmButton: false, timer: 4000,
            icon: 'success', title: 'Cotización recreada.\nSe mantuvieron los precios antiguos.'
        });
        
    }, 400); // 400 milisegundos de espera
}