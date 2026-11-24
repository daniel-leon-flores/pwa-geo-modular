// app.js - Lógica de UI, pre-permiso y consumo de geo-helper.js

const SUCURSALES = [
  { nombre: 'Sucursal UTEZ (Emiliano Zapata)', latitud: 18.8505, longitud: -99.2009 },
  { nombre: 'Sucursal Cuernavaca Centro', latitud: 18.9186, longitud: -99.2342 },
  { nombre: 'Sucursal Jiutepec', latitud: 18.8813, longitud: -99.1774 },
  { nombre: 'Sucursal Temixco', latitud: 18.8540, longitud: -99.2290 },
  { nombre: 'Sucursal CDMX Zócalo', latitud: 19.4326, longitud: -99.1332 }
];

const ui = {
  form: document.getElementById('form-reporte'),
  descripcion: document.getElementById('descripcion'),
  btnAdjuntar: document.getElementById('btn-adjuntar'),
  tarjetaPrePermiso: document.getElementById('tarjeta-prepermiso'),
  btnConfirmarGeo: document.getElementById('btn-confirmar-geo'),
  btnCancelarGeo: document.getElementById('btn-cancelar-geo'),
  estado: document.getElementById('estado'),
  resultado: document.getElementById('resultado'),
  etiquetaPrecision: document.getElementById('etiqueta-precision'),
  resLatitud: document.getElementById('res-latitud'),
  resLongitud: document.getElementById('res-longitud'),
  resPrecision: document.getElementById('res-precision'),
  resHora: document.getElementById('res-hora'),
  enlaceMapa: document.getElementById('enlace-mapa'),
  selectorManual: document.getElementById('selector-manual'),
  ayudaPermiso: document.getElementById('ayuda-permiso'),
  zona: document.getElementById('zona'),
  direccion: document.getElementById('direccion'),
  btnSucursal: document.getElementById('btn-sucursal'),
  listaSucursales: document.getElementById('lista-sucursales'),
  paquete: document.getElementById('paquete'),
  paqueteJson: document.getElementById('paquete-json')
};

let ubicacionAdjunta = null;

// ---------- Mensajes de estado ----------

function mostrarEstado(mensaje, tipo) {
  ui.estado.textContent = mensaje;
  ui.estado.className = 'estado ' + tipo;
}

function mostrarCargando(mensaje) {
  mostrarEstado('⏳ ' + mensaje, 'cargando');
}

function mostrarMensajeError(mensaje) {
  mostrarEstado('⚠️ ' + mensaje, 'error');
}

function mostrarMensajeExito(mensaje) {
  mostrarEstado('✅ ' + mensaje, 'exito');
}

// ---------- Piezas de la interfaz ----------

function ocultarTarjetaPrePermiso() {
  ui.tarjetaPrePermiso.hidden = true;
}

function habilitarSelectorManualZona(mostrarAyudaPermiso) {
  ui.selectorManual.hidden = false;
  ui.ayudaPermiso.hidden = !mostrarAyudaPermiso;
  ui.zona.focus();
}

function renderizarResultadoUbicacion(ubicacion) {
  const calidad = clasificarPrecision(ubicacion.precisionMetros);

  ui.etiquetaPrecision.textContent = calidad.etiqueta;
  ui.etiquetaPrecision.className = 'etiqueta etiqueta-' + calidad.nivel;
  ui.resLatitud.textContent = ubicacion.latitud.toFixed(6);
  ui.resLongitud.textContent = ubicacion.longitud.toFixed(6);
  ui.resPrecision.textContent = '± ' + ubicacion.precisionMetros + ' m';
  ui.resHora.textContent = new Date(ubicacion.timestamp).toLocaleTimeString('es-MX');
  ui.enlaceMapa.href = 'https://www.openstreetmap.org/?mlat=' + ubicacion.latitud +
    '&mlon=' + ubicacion.longitud + '#map=17/' + ubicacion.latitud + '/' + ubicacion.longitud;
  ui.resultado.hidden = false;
}

// ---------- Flujo de pre-permiso ----------

function leerUbicacionReal() {
  ocultarTarjetaPrePermiso();
  ui.btnAdjuntar.disabled = true;
  mostrarCargando('Obteniendo coordenadas...');

  return obtenerUbicacionActual({ enableHighAccuracy: true, timeout: 7000 })
    .then((ubicacion) => {
      ubicacionAdjunta = ubicacion;
      renderizarResultadoUbicacion(ubicacion);
      ui.selectorManual.hidden = true;
      mostrarMensajeExito('Ubicación adjuntada al reporte.');
    })
    .catch((error) => {
      console.warn('[Geo] Fallback activado:', error.message);
      ubicacionAdjunta = null;
      ui.resultado.hidden = true;
      mostrarMensajeError(error.message);
      habilitarSelectorManualZona(error.codigo === 1); // Plan B sin bloquear al usuario
    })
    .then(() => {
      ui.btnAdjuntar.disabled = false;
    });
}

function manejarClicAdjuntar() {
  mostrarCargando('Revisando el permiso de ubicación...');

  consultarEstadoPermisoGeo().then((estado) => {
    console.log('[Geo] Estado del permiso:', estado);

    if (estado === 'granted') {
      leerUbicacionReal();
    } else if (estado === 'denied') {
      ocultarTarjetaPrePermiso();
      mostrarMensajeError('El permiso de ubicación está bloqueado en este navegador.');
      habilitarSelectorManualZona(true);
    } else {
      mostrarEstado('', '');
      ui.tarjetaPrePermiso.hidden = false;
      ui.btnConfirmarGeo.focus();
    }
  });
}

function manejarCancelarGeo() {
  ocultarTarjetaPrePermiso();
  mostrarEstado('Sin problema: selecciona tu zona manualmente.', 'cargando');
  habilitarSelectorManualZona(false);
}

// ---------- Envío del reporte ----------

function enviarReporte(evento) {
  evento.preventDefault();

  const datosFormulario = {
    descripcion: ui.descripcion.value.trim(),
    fecha: new Date().toISOString()
  };

  let ubicacionReporte = null;
  if (ubicacionAdjunta) {
    ubicacionReporte = { tipo: 'gps', coordenadas: ubicacionAdjunta };
  } else if (ui.zona.value) {
    ubicacionReporte = {
      tipo: 'manual',
      zona: ui.zona.value,
      direccion: ui.direccion.value.trim()
    };
  }

  const paqueteCompleto = Object.assign({}, datosFormulario, { ubicacion: ubicacionReporte });
  console.log('Paquete listo para enviar o encolar en IndexedDB:', paqueteCompleto);

  ui.paqueteJson.textContent = JSON.stringify(paqueteCompleto, null, 2);
  ui.paquete.hidden = false;
  ui.paquete.scrollIntoView({ behavior: 'smooth' });
}

// ---------- Reutilización: sucursal más cercana ----------

function pintarListaSucursales(textos) {
  ui.listaSucursales.textContent = '';
  textos.forEach((texto) => {
    const elemento = document.createElement('li');
    elemento.textContent = texto;
    ui.listaSucursales.appendChild(elemento);
  });
}

function buscarSucursalesCercanas() {
  ui.btnSucursal.disabled = true;
  pintarListaSucursales(['⏳ Calculando distancias...']);

  return obtenerUbicacionActual({ enableHighAccuracy: false, maximumAge: 60000 })
    .then((ubicacion) => {
      console.log(`Filtrando sucursales cerca de ${ubicacion.latitud}, ${ubicacion.longitud}`);

      const ordenadas = SUCURSALES
        .map((sucursal) => Object.assign({}, sucursal, {
          distanciaKm: calcularDistanciaKm(
            ubicacion.latitud, ubicacion.longitud, sucursal.latitud, sucursal.longitud
          )
        }))
        .sort((a, b) => a.distanciaKm - b.distanciaKm);

      pintarListaSucursales(ordenadas.map((sucursal, indice) =>
        (indice === 0 ? '⭐ ' : '') + sucursal.nombre + ' — ' + sucursal.distanciaKm.toFixed(1) + ' km'
      ));
    })
    .catch((error) => {
      pintarListaSucursales(['⚠️ ' + error.message]);
    })
    .then(() => {
      ui.btnSucursal.disabled = false;
    });
}

// ---------- Service Worker ----------

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker.register('./sw.js')
    .then((registro) => console.log('[SW] Registrado con alcance:', registro.scope))
    .catch((error) => console.error('[SW] Error al registrar:', error));
}

// ---------- Eventos ----------

ui.btnAdjuntar.addEventListener('click', manejarClicAdjuntar);
ui.btnConfirmarGeo.addEventListener('click', leerUbicacionReal);
ui.btnCancelarGeo.addEventListener('click', manejarCancelarGeo);
ui.form.addEventListener('submit', enviarReporte);
ui.btnSucursal.addEventListener('click', buscarSucursalesCercanas);
window.addEventListener('load', registrarServiceWorker);
