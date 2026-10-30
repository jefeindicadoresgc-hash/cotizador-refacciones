import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, set, get, child } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const acmeConfig = {
    apiKey: "AIzaSyA-x8ZZvJXAOK7Q18PVWPybmfPZ7xDBNHo",
    authDomain: "tablero-pruebas.firebaseapp.com",
    databaseURL: "https://tablero-pruebas-default-rtdb.firebaseio.com",
    projectId: "tablero-pruebas",
    storageBucket: "tablero-pruebas.firebasestorage.app",
    messagingSenderId: "900913447132",
    appId: "1:900913447132:web:fd3b5cc73af4263d69b419"
};

const appAcme = initializeApp(acmeConfig, "AcmeApp");
const dbAcme = getDatabase(appAcme);

const formatMoney = (amount) => "$" + parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const parseNum = (val) => parseFloat(String(val).replace(/[^0-9.-]+/g, "")) || 0;

const formatInputWithCommas = (e) => {
    let value = e.target.value.replace(/[^0-9.-]/g, ''); 
    if (value) {
        let parts = value.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        e.target.value = parts.join('.');
    }
    
    if (document.getElementById('comp-obj-total')) {
        if(e.target.id && e.target.id.includes("comp-")) updateComprasUI();
        else updateSalesUI();
    }
};

const lineasCompras = ['MOBIS', 'SEMI-SINTETICO', 'SINTETICO', 'WURTH', 'LLANTAS', 'ACCESORIOS'];

// INICIALIZADOR: Ahora pone el mes actual y simula un click para cargar por default
window.inicializarAcme = function() {
    const today = new Date();
    const acmeMonth = document.getElementById('acme-month');
    
    if(acmeMonth) {
        acmeMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    }
    
    initComprasTable();
    
    // Auto-Carga de la base de datos al abrir el módulo
    setTimeout(() => {
        const btnLoad = document.getElementById('btn-acme-load');
        if (btnLoad) btnLoad.click();
    }, 300);
};

function initComprasTable() {
    const tbody = document.getElementById('compras-tbody');
    if(!tbody) return; 
    tbody.innerHTML = '';
    
    lineasCompras.forEach(linea => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 800; color: var(--text-muted); text-align:left;">${linea}</td>
            <td><input type="text" id="comp-obj-${linea}" style="text-align:center;" value="0"></td>
            <td><input type="text" id="comp-real-${linea}" style="text-align:center;" value="0"></td>
            <td id="comp-alcance-${linea}" style="font-weight: bold; text-align:center;">0%</td>
            <td id="comp-dif-${linea}" style="font-weight: bold; text-align:right;">$0.00</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateComprasUI() {
    let totalObj = 0, totalReal = 0;
    lineasCompras.forEach(linea => {
        const objEl = document.getElementById(`comp-obj-${linea}`);
        const realEl = document.getElementById(`comp-real-${linea}`);
        if(!objEl || !realEl) return; 

        const obj = parseNum(objEl.value);
        const real = parseNum(realEl.value);
        totalObj += obj; totalReal += real;

        const dif = real - obj;
        const alcance = obj > 0 ? Math.round((real / obj) * 100) : 0;
        const difColor = dif < 0 ? 'var(--danger)' : 'var(--success)';
        const alcanceColor = alcance < 100 ? 'var(--danger)' : 'var(--success)';

        const difEl = document.getElementById(`comp-dif-${linea}`);
        const alcEl = document.getElementById(`comp-alcance-${linea}`);
        if(difEl) difEl.innerHTML = `<span style="color:${difColor}">${formatMoney(dif)}</span>`;
        if(alcEl) alcEl.innerHTML = `<span style="color:${alcanceColor}">${alcance}%</span>`;
    });

    const totalDif = totalReal - totalObj;
    const totalAlcance = totalObj > 0 ? Math.round((totalReal / totalObj) * 100) : 0;
    
    const totObjEl = document.getElementById('comp-obj-total');
    if(totObjEl) totObjEl.innerText = formatMoney(totalObj);
    const totRealEl = document.getElementById('comp-real-total');
    if(totRealEl) totRealEl.innerText = formatMoney(totalReal);
    const totAlcEl = document.getElementById('comp-alcance-total');
    if(totAlcEl) totAlcEl.innerText = totalAlcance + "%";
    const totDifEl = document.getElementById('comp-dif-total');
    if(totDifEl) totDifEl.innerText = formatMoney(totalDif);
}

let dataVentas = { mostrador: { venta: 0, costo: 0 }, taller: { venta: 0, costo: 0 } };

const processVentasExcel = (file, tipo) => {
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(event) {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, {header: 1});

        for (let i = json.length - 1; i >= 0; i--) {
            if (json[i] && json[i][0] && typeof json[i][0] === 'string' && json[i][0].includes("Total General")) {
                dataVentas[tipo].venta = parseNum(json[i][9]); 
                dataVentas[tipo].costo = parseNum(json[i][12]);
                updateSalesUI();
                Swal.fire({toast: true, position: 'top', icon: 'success', title: `Ventas de ${tipo} leídas`, showConfirmButton: false, timer: 2000});
                return;
            }
        }
        Swal.fire('Error', `No se encontró "Total General" en el excel de ${tipo}.`, 'error');
    };
    reader.readAsArrayBuffer(file);
};

document.addEventListener('change', (e) => {
    if(e.target && e.target.id === 'acme-file-mostrador') processVentasExcel(e.target.files[0], 'mostrador');
    if(e.target && e.target.id === 'acme-file-taller') processVentasExcel(e.target.files[0], 'taller');
});

document.addEventListener('input', (e) => {
    if(e.target && (e.target.id === 'obj-mostrador' || e.target.id === 'obj-taller' || (e.target.id && e.target.id.includes("comp-")))) {
        formatInputWithCommas(e);
    }
});

function updateSalesUI() {
    const objMostradorEl = document.getElementById('obj-mostrador');
    if(!objMostradorEl) return; 
    
    const objMostrador = parseNum(objMostradorEl.value);
    const objTaller = parseNum(document.getElementById('obj-taller').value);
    const objTotal = objMostrador + objTaller;

    document.getElementById('ven-mostrador').innerText = dataVentas.mostrador.venta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('cos-mostrador').innerText = dataVentas.mostrador.costo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('ven-taller').innerText = dataVentas.taller.venta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById('cos-taller').innerText = dataVentas.taller.costo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const venTotal = dataVentas.mostrador.venta + dataVentas.taller.venta;
    const cosTotal = dataVentas.mostrador.costo + dataVentas.taller.costo;
    const utiMostrador = dataVentas.mostrador.venta - dataVentas.mostrador.costo;
    const utiTaller = dataVentas.taller.venta - dataVentas.taller.costo;
    const utiTotal = venTotal - cosTotal;
    const alcance = objTotal > 0 ? Math.round((venTotal / objTotal) * 100) : 0;

    document.getElementById('obj-total').innerText = formatMoney(objTotal);
    document.getElementById('ven-total').innerText = formatMoney(venTotal);
    document.getElementById('cos-total').innerText = formatMoney(cosTotal);
    document.getElementById('uti-mostrador').innerText = formatMoney(utiMostrador);
    document.getElementById('uti-taller').innerText = formatMoney(utiTaller);
    document.getElementById('uti-total').innerText = formatMoney(utiTotal);
    
    document.getElementById('alcance-total').innerHTML = `<span style="color: ${alcance < 100 ? 'var(--danger)' : 'var(--success)'}">${alcance}%</span>`;
}

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btn-acme-save') {
        if(!window.modoPrueba) {
            Swal.fire('Acceso Denegado 🧨', 'No tienes permiso para sobreescribir los datos en la Nube ACME. Activa el código de seguridad (2099).', 'error');
            return;
        }

        const month = document.getElementById('acme-month').value;
        if(!month) return Swal.fire('Falta el mes', 'Selecciona un mes.', 'warning');

        let ventasData = {
            mostrador: { obj: parseNum(document.getElementById('obj-mostrador').value), venta: parseNum(document.getElementById('ven-mostrador').innerText), costo: parseNum(document.getElementById('cos-mostrador').innerText) },
            taller: { obj: parseNum(document.getElementById('obj-taller').value), venta: parseNum(document.getElementById('ven-taller').innerText), costo: parseNum(document.getElementById('cos-taller').innerText) }
        };

        let comprasData = {};
        lineasCompras.forEach(linea => {
            comprasData[linea] = {
                obj: parseNum(document.getElementById(`comp-obj-${linea}`).value),
                real: parseNum(document.getElementById(`comp-real-${linea}`).value)
            };
        });

        set(ref(dbAcme, `respaldos/${month}`), { ventas: ventasData, compras: comprasData })
            .then(() => Swal.fire('Guardado', `Respaldo de ${month} guardado en la bóveda corporativa 📦`, 'success'));
    }

    if (e.target && e.target.id === 'btn-acme-load') {
        const month = document.getElementById('acme-month').value;
        if(!month) return;

        get(child(ref(dbAcme), `respaldos/${month}`)).then((snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                if(data.ventas) {
                    document.getElementById('obj-mostrador').value = data.ventas.mostrador.obj.toLocaleString('en-US');
                    document.getElementById('obj-taller').value = data.ventas.taller.obj.toLocaleString('en-US');
                    dataVentas.mostrador = { venta: data.ventas.mostrador.venta, costo: data.ventas.mostrador.costo };
                    dataVentas.taller = { venta: data.ventas.taller.venta, costo: data.ventas.taller.costo };
                    updateSalesUI();
                }

                if(data.compras) {
                    lineasCompras.forEach(linea => {
                        if(data.compras[linea]){
                            document.getElementById(`comp-obj-${linea}`).value = data.compras[linea].obj.toLocaleString('en-US');
                            document.getElementById(`comp-real-${linea}`).value = data.compras[linea].real.toLocaleString('en-US');
                        }
                    });
                    updateComprasUI();
                }
                Swal.fire({toast: true, position: 'top-end', icon: 'success', title: `Cargado ${month}`, showConfirmButton: false, timer: 2000});
            } else {
                document.getElementById('obj-mostrador').value = '0'; document.getElementById('obj-taller').value = '0';
                dataVentas = { mostrador: { venta: 0, costo: 0 }, taller: { venta: 0, costo: 0 } };
                updateSalesUI();

                lineasCompras.forEach(linea => {
                    document.getElementById(`comp-obj-${linea}`).value = '0'; document.getElementById(`comp-real-${linea}`).value = '0';
                });
                updateComprasUI();
            }
        });
    }
});