/* ============================================================
   MEDICO ZX — Núcleo compartido
   Cliente de Supabase, sesión, guardas de acceso y utilidades
   de interfaz. Se carga en todas las páginas.
   ============================================================ */
(function (global) {
  'use strict';

  const CFG = global.MZX_CONFIG || {};

  /* ---------------- Cliente de Supabase ---------------- */
  let sb = null;
  function cliente() {
    if (sb) return sb;
    if (!global.supabase || !global.supabase.createClient) {
      throw new Error('No se pudo cargar la biblioteca de Supabase. Revisa tu conexión de red.');
    }
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) {
      throw new Error('Falta configurar SUPABASE_URL y SUPABASE_KEY en assets/config.js.');
    }
    sb = global.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return sb;
  }

  /* Identificador de acceso a partir del número de nómina.
     Supabase Auth trabaja con correo; este dominio interno no
     recibe mensajes, sólo da formato al identificador. */
  const correoDe = (nomina) => String(nomina).trim().toLowerCase() + '@' + CFG.DOMINIO_NOMINA;

  /* ---------------- Sesión y perfil ---------------- */
  let perfilCache = null;

  async function perfilActual() {
    if (perfilCache) return perfilCache;
    const { data: { user } } = await cliente().auth.getUser();
    if (!user) return null;
    const { data, error } = await cliente()
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    perfilCache = data;
    return data;
  }

  async function entrar(nomina, contrasena) {
    const { error } = await cliente().auth.signInWithPassword({
      email: correoDe(nomina),
      password: contrasena
    });
    if (error) {
      /* Supabase responde lo mismo ante usuario inexistente y contraseña
         incorrecta, a propósito: así no se puede averiguar qué números de
         nómina existen probando uno por uno. */
      if (/invalid login/i.test(error.message)) {
        throw new Error('Número de nómina o contraseña incorrectos.');
      }
      if (/email not confirmed/i.test(error.message)) {
        throw new Error('La cuenta no está confirmada. En Supabase, apaga "Confirm email" en Authentication → Sign In / Providers → Email.');
      }
      throw error;
    }
    perfilCache = null;
    const p = await perfilActual();
    if (!p) {
      await cerrarSesion();
      throw new Error('Tu usuario existe pero no tiene perfil. Avisa a Recursos Humanos.');
    }
    if (p.activo === false) {
      await cerrarSesion();
      throw new Error('Tu acceso está suspendido. Comunícate con Recursos Humanos.');
    }
    /* Los colaboradores tienen perfil y expediente, pero no acceso:
       esta aplicación es de consulta para el servicio médico. */
    if (p.acceso_habilitado === false) {
      await cerrarSesion();
      throw new Error('Esta aplicación es de uso exclusivo del servicio médico. Si necesitas una copia de tu expediente, solicítala a Recursos Humanos.');
    }
    return p;
  }

  async function salir() {
    await cerrarSesion();
    location.replace('index.html');
  }

  /* Cierra la sesión sin navegar. Hace falta al rechazar un acceso:
     si redirigimos, la recarga se lleva el mensaje que explica por
     qué no puede entrar y la persona se queda sin saber qué pasó. */
  async function cerrarSesion() {
    perfilCache = null;
    try { await cliente().auth.signOut(); } catch (e) {}
  }

  const esClinico = (p) => !!p && (p.rol === 'medico' || p.rol === 'admin');

  /* Guarda de página. Devuelve el perfil o corta la ejecución.
     `exigeClinico` protege las pantallas del servicio médico. */
  async function requiereSesion(exigeClinico) {
    const { data: { session } } = await cliente().auth.getSession();
    if (!session) { location.replace('index.html'); return null; }

    const p = await perfilActual();
    if (!p) { await salir(); return null; }

    /* Contraseña temporal: no se deja avanzar sin cambiarla */
    const enCuenta = /cuenta\.html/.test(location.pathname);
    if (p.debe_cambiar_password && !enCuenta) {
      location.replace('cuenta.html?primera=1');
      return null;
    }
    if (exigeClinico && !esClinico(p)) {
      sinAcceso(p);
      return null;
    }

    return p;
  }

  function sinAcceso(p) {
    document.body.innerHTML =
      '<div style="max-width:460px;margin:14vh auto;text-align:center;font-family:Poppins,Segoe UI,sans-serif">' +
      '<div style="font-size:40px">🔒</div>' +
      '<h1 style="font-size:20px;margin:10px 0">Sin acceso a esta sección</h1>' +
      '<p style="font-size:13.5px;color:#516079">Esta pantalla es exclusiva del servicio médico.</p>' +
      '<p style="margin-top:18px"><a href="index.html">Volver al acceso</a></p></div>';
  }

  /* ---------------- Bitácora ----------------
     Rastro de auditoría. El registro definitivo debe escribirlo el
     servidor; este complementa la trazabilidad de las consultas. */
  async function auditar(accion, entidad, entidadId, afectadoId, detalle) {
    try {
      const p = await perfilActual();
      if (!p) return;
      await cliente().from('bitacora').insert({
        actor_id: p.id, accion: accion, entidad: entidad || null,
        entidad_id: entidadId ? String(entidadId) : null,
        afectado_id: afectadoId || null, detalle: detalle || null
      });
    } catch (e) { /* la auditoría nunca debe romper la operación */ }
  }

  /* ---------------- Utilidades ---------------- */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const $ = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || document).querySelectorAll(s));

  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const hoyISO = () => new Date().toISOString().slice(0, 10);
  function fmt(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d)) return '—';
    return d.getDate() + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function fmtLargo(iso) {
    if (!iso) return '—';
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    if (isNaN(d)) return '—';
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function fmtHora(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    if (isNaN(d)) return '—';
    return fmt(d.toISOString()) + ' ' + d.toTimeString().slice(0, 5);
  }
  function dias(desde, hasta) {
    const a = new Date(String(desde).slice(0, 10) + 'T12:00:00');
    const b = new Date(String(hasta || hoyISO()).slice(0, 10) + 'T12:00:00');
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  const sumaDias = (iso, n) => {
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const iniciales = (n) => String(n || '').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase();
  const TURNOS = ['matutino','vespertino','nocturno','rotativo','mixto','fijo_administrativo'];
  const turnoTexto = (t) => !t ? '—' : String(t).replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

  /* ---------------- Tema ---------------- */
  function temaInicial() {
    let t = null;
    try { t = localStorage.getItem('mzx_tema'); } catch (e) {}
    if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  }
  function alternarTema() {
    const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('mzx_tema', t); } catch (e) {}
  }
  temaInicial();

  /* ---------------- Avisos flotantes ---------------- */
  function flash(msg, tipo) {
    let cont = $('.avisos');
    if (!cont) { cont = document.createElement('div'); cont.className = 'avisos'; document.body.appendChild(cont); }
    const d = document.createElement('div');
    d.className = 'flash ' + (tipo || '');
    d.setAttribute('role', 'status');
    d.textContent = msg;
    cont.appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 250); }, 4000);
  }

  /* ---------------- Modal ---------------- */
  let modalAbierto = null;
  function modal(opts) {
    cerrarModal();
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML =
      '<div class="modal ' + (opts.ancho === 'lg' ? 'lg' : '') + '" role="dialog" aria-modal="true">' +
        '<div class="mo-cab"><span>' + esc(opts.titulo) + '</span><button class="mo-x" aria-label="Cerrar">✕</button></div>' +
        '<div class="mo-cuerpo"></div><div class="mo-pie"></div></div>';
    const cuerpo = $('.mo-cuerpo', velo);
    cuerpo.innerHTML = opts.cuerpo || '';
    const pie = $('.mo-pie', velo);
    (opts.botones || [{ txt: 'Cerrar', clase: 'gh' }]).forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.clase || '');
      btn.textContent = b.txt;
      btn.addEventListener('click', async () => {
        if (!b.accion) return cerrarModal();
        btn.disabled = true;
        try { await b.accion(cuerpo, btn); } finally { btn.disabled = false; }
      });
      pie.appendChild(btn);
    });
    $('.mo-x', velo).addEventListener('click', cerrarModal);
    velo.addEventListener('mousedown', e => { if (e.target === velo) cerrarModal(); });
    document.body.appendChild(velo);
    modalAbierto = velo;
    const primero = cuerpo.querySelector('input,select,textarea');
    if (primero) primero.focus();
    return cuerpo;
  }
  function cerrarModal() { if (modalAbierto) { modalAbierto.remove(); modalAbierto = null; } }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModal(); });

  function confirmar(titulo, texto, alAceptar) {
    modal({
      titulo: titulo,
      cuerpo: '<p style="font-size:13.5px;color:var(--tx2)">' + esc(texto) + '</p>',
      botones: [
        { txt: 'Cancelar', clase: 'gh' },
        { txt: 'Confirmar', accion: async () => { cerrarModal(); await alAceptar(); } }
      ]
    });
  }

  /* ---------------- Estructura de página ---------------- */
  /* propio: sólo para quien captura su propio expediente. El servicio médico
     no lleva historia clínica dentro del sistema que él mismo valida. */
  /* Versión 2.0 — modo consulta: la aplicación es sólo para el
     servicio médico. Los colaboradores no entran; sus expedientes
     se consultan desde Pacientes. */
  const PAGINAS = [
    { url: 'clinico.html', nombre: 'Pacientes', clinico: true },
    { url: 'cuenta.html',  nombre: 'Mi cuenta' }
  ];

  function montar(perfil, activa) {
    const app = document.createElement('div');
    app.className = 'app';
    const nav = PAGINAS
      .filter(p => !p.clinico || esClinico(perfil))
      .map(p => '<a href="' + p.url + '"' + (p.url === activa ? ' class="on"' : '') + '>' + esc(p.nombre) + '</a>')
      .join('');

    app.innerHTML =
      '<header class="topbar">' +
        '<div class="marca"><span class="marca-ico">ZX</span>' +
          '<span>Medico ZX<small>Expediente médico · Etapa 1</small></span></div>' +
        '<div class="tb-der">' +
          '<button class="tema" id="mzx-tema" aria-label="Cambiar tema"></button>' +
          '<div class="tb-user"><b>' + esc(perfil.nombre_completo) + '</b>' +
            '<span>Nómina ' + esc(perfil.numero_nomina) + ' · ' + esc(rolTexto(perfil.rol)) + '</span></div>' +
          '<button class="tb-btn" id="mzx-salir">Salir</button>' +
        '</div>' +
      '</header>' +
      '<nav class="nav">' + nav + '</nav>' +
      '<main id="mzx-main"></main>';

    document.body.innerHTML = '';
    document.body.appendChild(app);
    $('#mzx-tema').addEventListener('click', alternarTema);
    $('#mzx-salir').addEventListener('click', salir);
    return $('#mzx-main');
  }

  const rolTexto = (r) => ({ colaborador: 'Colaborador', medico: 'Servicio médico', admin: 'Administrador' }[r] || r);

  function cargando(el) { el.innerHTML = '<div class="vacio">Cargando…</div>'; }

  function fallo(el, err) {
    const msg = (err && err.message) || String(err || 'Error desconocido');
    console.error('[Medico ZX]', err);
    (el || document.body).innerHTML =
      '<div class="tarjeta" style="max-width:620px;margin:8vh auto;text-align:center">' +
        '<div style="font-size:34px;margin-bottom:8px">⚠️</div>' +
        '<h1 style="margin-bottom:6px">No se pudo cargar</h1>' +
        '<p class="sub" style="margin-bottom:16px">' + esc(msg) + '</p>' +
        '<div class="btn-fila" style="justify-content:center">' +
          '<button class="btn" onclick="location.reload()">Reintentar</button>' +
          '<a class="btn gh" href="clinico.html">Ir a pacientes</a></div></div>';
  }

  /* Arranque protegido: ninguna pantalla se queda cargando para siempre */
  function arranque(fn) {
    const limite = setTimeout(() => {
      const m = $('#mzx-main');
      if (m && m.textContent.indexOf('Cargando') >= 0) {
        fallo(m, new Error('La carga tardó demasiado. Puede ser un problema de red o de configuración.'));
      }
    }, 15000);
    Promise.resolve().then(fn)
      .then(() => clearTimeout(limite))
      .catch(e => { clearTimeout(limite); fallo($('#mzx-main'), e); });
  }

  /* ---------------- Tabla ---------------- */
  function tabla(cols, filas, opts) {
    const o = opts || {};
    if (!filas || !filas.length) {
      return '<div class="tabla-caja"><div class="vacio">' + esc(o.vacio || 'Sin registros.') + '</div></div>';
    }
    let h = '<div class="tabla-caja"><table><thead><tr>';
    cols.forEach(c => { h += '<th>' + esc(c.t) + '</th>'; });
    h += '</tr></thead><tbody>';
    filas.forEach(f => {
      h += '<tr>';
      cols.forEach(c => { h += '<td>' + (c.html ? c.html(f) : esc(c.v ? c.v(f) : f[c.k])) + '</td>'; });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function kpi(l, v, d, clase) {
    return '<div class="kpi"><div class="kpi-l">' + esc(l) + '</div>' +
           '<div class="kpi-v ' + (clase || '') + '">' + esc(v) + '</div>' +
           '<div class="kpi-d">' + esc(d || '') + '</div></div>';
  }
  function cab(t, sub, acciones) {
    return '<div class="cab"><div><h1>' + esc(t) + '</h1>' +
           '<div class="sub">' + esc(sub || '') + '</div></div>' +
           '<div class="btn-fila">' + (acciones || '') + '</div></div>';
  }
  function ro(l, v) {
    return '<div class="campo"><label>' + esc(l) + '</label>' +
           '<div class="solo-lectura">' + esc(v === 0 ? '0' : (v || '—')) + '</div></div>';
  }
  function pie(el, nota) {
    const d = document.createElement('div');
    d.innerHTML = (nota ? '<div class="nota">' + esc(nota) + '</div>' : '') +
      '<div class="pie">Medico ZX · Zubex Industrial S.A. de C.V. · ' + esc(fmtLargo(hoyISO())) +
      ' · <a href="privacidad.html">Aviso de privacidad</a></div>';
    el.appendChild(d);
  }

  /* ---------------- Catálogos de la base ----------------
     Ningún catálogo vive en el código: se leen de Supabase. */
  const CRONICAS = ['Ninguna','Diabetes','Hipertensión','Dislipidemia','Cardiopatía','Asma / EPOC',
                    'Enfermedad renal','Enfermedad tiroidea','Epilepsia','Trastorno músculo-esquelético','Otra'];
  const SANGRE = ['O+','O-','A+','A-','B+','B-','AB+','AB-','No lo sé'];

  const ESTADOS_HISTORIA = {
    borrador:            { n: 'Borrador',              e: 'nt' },
    enviada:             { n: 'Enviada a revisión',    e: 'wa' },
    validada:            { n: 'Validada',              e: 'ok' },
    requiere_correccion: { n: 'Requiere corrección',   e: 'no' }
  };
  const ESTATUS_CASO = {
    pendiente_valoracion:           { n: 'Pendiente de valoración',            e: 'no' },
    en_seguimiento:                 { n: 'En seguimiento',                     e: 'wa' },
    pendiente_valoracion_posterior: { n: 'Pendiente de valoración posterior',  e: 'wa' },
    alta_cierre:                    { n: 'Alta / cierre',                      e: 'ok' },
    no_requiere:                    { n: 'No requiere seguimiento',            e: 'nt' }
  };
  const ORDEN_CASO = ['pendiente_valoracion','en_seguimiento','pendiente_valoracion_posterior','alta_cierre'];
  const VALORACIONES = {
    pendiente_validacion: { n: 'Pendiente de validación', e: 'wa' },
    normal:               { n: 'Normal',                  e: 'ok' },
    desviacion:           { n: 'Desviación',              e: 'no' }
  };
  const ESTADOS_PROG = {
    programado: { n: 'Programado', e: 'wa' },
    realizado:  { n: 'Realizado',  e: 'ok' },
    vencido:    { n: 'Vencido',    e: 'no' }
  };
  const TIPOS_EVAL = {
    anual: 'Anual', bianual: 'Bianual', ingreso: 'De ingreso',
    extraordinaria: 'Extraordinaria', control: 'De control / seguimiento'
  };

  function etq(mapa, valor) {
    const m = mapa[valor] || { n: valor || '—', e: 'nt' };
    return '<span class="etq ' + m.e + '">' + esc(m.n) + '</span>';
  }
  const nombreDe = (mapa, valor) => (mapa[valor] ? mapa[valor].n : (valor || '—'));

  /* ---------------- Privacidad y consentimiento ----------------
     La versión vigente del aviso NO vive en el código: se lee de la
     tabla `ajustes`. Si Jurídico cambia el texto, sube la versión en
     la base y todos vuelven a ver la pantalla de consentimiento. */
  let _versionAviso = null;

  async function versionAviso() {
    if (_versionAviso) return _versionAviso;
    const { data } = await cliente()
      .from('ajustes').select('valor').eq('clave', 'version_aviso_privacidad').maybeSingle();
    _versionAviso = (data && data.valor) || '';
    return _versionAviso;
  }

  /* Devuelve la fila del consentimiento vigente, o null si no lo ha
     otorgado. El candado de verdad está en la base (disparador sobre
     historias_clinicas); esto es sólo para no enseñarle un formulario
     que la base va a rechazar. */
  async function consentimiento(perfil) {
    const v = await versionAviso();
    if (!v) return null;
    const { data } = await cliente()
      .from('consentimientos')
      .select('id, version_aviso, otorgado_en')
      .eq('perfil_id', perfil.id).eq('version_aviso', v)
      .eq('otorgado', true).is('revocado_en', null)
      .maybeSingle();
    return data || null;
  }

  global.ZX = {
    CFG, cliente, correoDe, perfilActual, entrar, salir, cerrarSesion, esClinico, requiereSesion, auditar,
    esc, $, $$, hoyISO, fmt, fmtLargo, fmtHora, dias, sumaDias, iniciales, turnoTexto, TURNOS,
    alternarTema, flash, modal, cerrarModal, confirmar,
    montar, rolTexto, cargando, fallo, arranque, tabla, kpi, cab, ro, pie,
    CRONICAS, SANGRE, ESTADOS_HISTORIA, ESTATUS_CASO, ORDEN_CASO, VALORACIONES,
    ESTADOS_PROG, TIPOS_EVAL, etq, nombreDe,
    versionAviso, consentimiento
  };
})(window);
