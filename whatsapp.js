window.enviarWhatsApp = function() {
    const telefono = document.getElementById('telefono-cliente').value.replace(/\D/g, ''); 
    
    if(telefono.length !== 10) {
        Swal.fire('Atención', 'Ingresa un número de WhatsApp válido de 10 dígitos.', 'warning');
        return;
    }

    const folio = document.getElementById('folio-txt').innerText;
    const subtotal = document.getElementById('lbl-subtotal').innerText;
    const total = document.getElementById('lbl-total').innerText;
    let modelo = document.getElementById('modelo').value;
    
    if(!modelo || modelo.trim() === "") modelo = "tu vehículo";

    // Recopilar piezas de la tabla
    let listaPiezas = "";
    document.querySelectorAll('#tabla-refacciones tbody tr').forEach(fila => {
        const canti = fila.querySelector('.canti').value;
        const num = fila.querySelector('.num-parte').value;
        const desc = fila.querySelector('.descripcion').value;
        
        if(num || desc) {
            listaPiezas += `\n🔸 ${canti}x ${num} - ${desc}`;
        }
    });

    const mensaje = `Hola, somos *Hyundai Coatzacoalcos*.\n\nTe compartimos el resumen de tu cotización *(Folio: ${folio})* para ${modelo}.\n\n*PIEZAS COTIZADAS:*${listaPiezas}\n\n🔹 *Subtotal:* ${subtotal}\n🔹 *Total:* ${total}\n\nQuedamos a tu disposición para cualquier duda. _(Te enviaremos el archivo PDF por este medio)_`;

    // Abre WhatsApp Web o App
    const url = `https://wa.me/52${telefono}?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
}