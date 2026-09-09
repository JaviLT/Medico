/* ============================================================
   MEDICO ZX — Expedientes (modo consulta)
   ------------------------------------------------------------
   Versión 2.0. La aplicación ya no captura: muestra. Sirve para
   exhibir en auditoría la ficha del colaborador, su historia
   clínica y el PDF de sus análisis.

   Los datos entran por carga masiva desde los archivos de RRHH;
   lo único que se escribe desde aquí son los PDF de análisis.
   Sólo perfiles medico / admin (las políticas RLS lo respaldan).
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, $$, cliente, requiereSesion, montar, arranque, flash, modal, cerrarModal,
          confirmar, auditar, cab, pie, tabla, etq, ro, fmt, fmtHora, dias, turnoTexto,
          ESTADOS_HISTORIA } = window.ZX;

  const PESTANAS = [
    { id: 'ficha',    n: 'Ficha del colaborador' },
    { id: 'historia', n: 'Historia clínica' },
    { id: 'analisis', n: 'Análisis clínicos' }
  ];

  const BUCKET = 'analisis';

  let perfil = null, main = null;
  let pacienteSel = null;
  let pestana = 'ficha';          // al abrir un expediente arranca en la ficha
  let busca = '';
  let lista = [];                 // pacientes cargados, para moverse entre ellos
  let exp = null;                 // expediente abierto

  arranque(async function () {
    perfil = await requiereSesion(true);   // exige rol clínico
    if (!perfil) return;
    main = montar(perfil, 'clinico.html');
    await render();
  });

  async function render() {
    window.ZX.cargando(main);
    try {
      if (pacienteSel) await expediente();
      else await pacientes();
    } catch (e) { window.ZX.fallo(main, e); }
  }

  /* ==================== LISTA DE PACIENTES ==================== */
  async function pacientes() {
    const { data, error } = await cliente()
      .from('perfiles')
      .select('*, historias_clinicas!perfil_id(estado)')
      .eq('activo', true)
      .order('numero_nomina');
    if (error) throw error;

    lista = data || [];
    const filtrada = lista.filter(p => !busca ||
      (p.nombre_completo + ' ' + p.numero_nomina + ' ' + (p.area || ''))
        .toLowerCase().indexOf(busca.toLowerCase()) >= 0);

    main.innerHTML =
      cab('Pacientes', lista.length + ' personas con expediente') +
      '<div class="filtros"><div class="campo" style="min-width:300px"><label>Buscar</label>' +
        '<input id="q" value="' + esc(busca) + '" placeholder="Nombre, nómina o área"></div></div>' +
      tabla([
        { t: 'Nómina', k: 'numero_nomina' },
        { t: 'Nombre', k: 'nombre_completo' },
        { t: 'Puesto', v: p => p.puesto || '—' },
        { t: 'Área', v: p => p.area || '—' },
        { t: 'Turno', v: p => turnoTexto(p.turno) },
        { t: 'Historia clínica', html: p => {
            const h = (p.historias_clinicas || [])[0];
            return h ? etq(ESTADOS_HISTORIA, h.estado) : '<span class="etq nt">Sin capturar</span>'; } },
        { t: '', html: p => '<button class="btn sm" data-pac="' + esc(p.id) + '">Expediente</button>' }
      ], filtrada, { vacio: 'Sin coincidencias.' });

    pie(main, 'Cada apertura de expediente queda registrada en la bitácora de auditoría.');

    const q = $('#q');
    q.addEventListener('input', () => {
      const pos = q.selectionStart;
      busca = q.value;
      pacientes().then(() => {
        const n = $('#q');
        if (n) { n.focus(); n.setSelectionRange(pos, pos); }
      });
    });
    $$('[data-pac]').forEach(b => b.addEventListener('click', () => {
      pacienteSel = b.dataset.pac; pestana = 'ficha'; render();
    }));
  }

  /* ==================== EXPEDIENTE ==================== */
  async function expediente() {
    const id = pacienteSel;

    /* Si se entra directo a un expediente sin haber pasado por la
       lista, se carga para poder moverse entre pacientes. */
    if (!lista.length) {
      const { data } = await cliente().from('perfiles')
        .select('id, numero_nomina, nombre_completo, puesto, area, turno')
        .eq('activo', true).order('numero_nomina');
      lista = data || [];
    }

    const [{ data: p }, { data: h }, { data: arch }] = await Promise.all([
      cliente().from('perfiles').select('*').eq('id', id).single(),
      cliente().from('historias_clinicas').select('*').eq('perfil_id', id).maybeSingle(),
      cliente().from('archivos_analisis').select('*').eq('perfil_id', id)
        .order('subido_en', { ascending: false })
    ]);
    if (!p) throw new Error('No se encontró el expediente.');

    exp = { id: id, p: p, h: h, arch: arch || [] };
    await auditar('expediente.consultar', 'perfiles', id, id, 'Apertura de expediente');

    const i = lista.findIndex(x => x.id === id);
    const anterior = i > 0 ? lista[i - 1] : null;
    const siguiente = (i >= 0 && i < lista.length - 1) ? lista[i + 1] : null;

    main.innerHTML =
      cab('Expediente · ' + (p.nombre_completo || ''),
          p.numero_nomina + ' · ' + (p.puesto || '—') + ' · ' + (p.area || '—') +
            ' · turno ' + turnoTexto(p.turno),
          '<button class="btn gh" id="volver">← Pacientes</button>') +

      navegador(i, anterior, siguiente) +

      '<div class="filtros" style="margin-bottom:6px">' +
        PESTANAS.map(t => '<button class="btn ' + (t.id === pestana ? '' : 'gh') + ' sm" data-tab="' +
          t.id + '">' + esc(t.n) + '</button>').join('') +
      '</div>' +

      ({ ficha: tabFicha, historia: tabHistoria, analisis: tabAnalisis }[pestana] || tabFicha)();

    pie(main, 'Los datos provienen de los registros del servicio médico y de Recursos Humanos. Esta aplicación los muestra; no los captura.');

    $('#volver').addEventListener('click', () => { pacienteSel = null; pestana = 'ficha'; render(); });
    $$('[data-tab]').forEach(b => b.addEventListener('click', () => { pestana = b.dataset.tab; render(); }));
    $$('[data-ir]').forEach(b => b.addEventListener('click', () => { pacienteSel = b.dataset.ir; render(); }));

    const sel = $('#saltar');
    if (sel) sel.addEventListener('change', () => { pacienteSel = sel.value; render(); });

    if ($('#subir'))  $('#subir').addEventListener('click', popupSubir);
    if ($('#archivo')) $('#archivo').addEventListener('change', subir);
    $$('[data-ver]').forEach(b => b.addEventListener('click', () => verArchivo(b.dataset.ver)));
    $$('[data-borrar]').forEach(b => b.addEventListener('click', () => borrarArchivo(b.dataset.borrar)));
  }

  /* Moverse entre pacientes sin volver a la lista */
  function navegador(i, anterior, siguiente) {
    return '<div class="filtros" style="margin-bottom:12px;align-items:flex-end">' +
      '<button class="btn gh sm" ' + (anterior ? 'data-ir="' + esc(anterior.id) + '"' : 'disabled') + '>' +
        '‹ ' + esc(anterior ? nombreCorto(anterior) : 'Anterior') + '</button>' +
      '<div class="campo" style="min-width:320px;margin:0"><label for="saltar">Ir a otro paciente</label>' +
        '<select id="saltar">' +
          lista.map(x => '<option value="' + esc(x.id) + '"' + (x.id === pacienteSel ? ' selected' : '') + '>' +
            esc(x.numero_nomina + ' — ' + x.nombre_completo) + '</option>').join('') +
        '</select></div>' +
      '<button class="btn gh sm" ' + (siguiente ? 'data-ir="' + esc(siguiente.id) + '"' : 'disabled') + '>' +
        esc(siguiente ? nombreCorto(siguiente) : 'Siguiente') + ' ›</button>' +
      '<div style="font-size:12px;color:var(--tx3);padding-bottom:9px">' +
        (i >= 0 ? (i + 1) + ' de ' + lista.length : '') + '</div>' +
      '</div>';
  }

  const nombreCorto = (x) => String(x.nombre_completo || '').split(' ').slice(0, 2).join(' ');

  /* ---------------- Ficha ---------------- */
  function tabFicha() {
    const p = exp.p;
    return '<div class="tarjeta"><div class="tarjeta-t">Datos laborales</div><div class="fila">' +
        ro('Número de nómina', p.numero_nomina) + ro('Nombre completo', p.nombre_completo) +
        ro('Puesto', p.puesto) + ro('Área', p.area) +
        ro('Turno', turnoTexto(p.turno)) +
        ro('Fecha de ingreso', p.fecha_ingreso ? fmt(p.fecha_ingreso) : '—') +
        ro('Antigüedad', p.fecha_ingreso ? Math.floor(dias(p.fecha_ingreso) / 365) + ' años' : '—') +
        ro('Estado', p.activo ? 'Activo' : 'Baja') +
      '</div>' +
      '<p class="pista" style="font-size:11.5px;color:var(--tx3)">Estos datos provienen de Recursos ' +
      'Humanos y no se editan desde aquí.</p></div>';
  }

  /* ---------------- Historia clínica ---------------- */
  function tabHistoria() {
    const h = exp.h;
    if (!h) {
      return '<div class="tarjeta"><div class="tarjeta-t">Historia clínica</div>' +
        '<p class="sub">Este colaborador todavía no tiene historia clínica cargada.</p></div>';
    }
    return '<div class="tarjeta"><div class="tarjeta-t"><span>Historia clínica</span>' +
        etq(ESTADOS_HISTORIA, h.estado) + '</div><div class="fila">' +
        ro('Tipo sanguíneo', h.tipo_sanguineo) +
        ro('Alergias', h.alergias) +
        ro('Enfermedades crónicas', (h.enfermedades_cronicas || []).join(', ')) +
        ro('Medicamentos habituales', h.medicamentos_habituales) +
        ro('Antecedentes médicos', h.antecedentes_medicos) +
        ro('Antecedentes quirúrgicos', h.antecedentes_quirurgicos) +
        ro('Contacto de emergencia', h.contacto_emergencia) +
        ro('Teléfono de emergencia', h.telefono_emergencia) +
        ro('Última actualización', h.actualizado_en ? fmtHora(h.actualizado_en) : '—') +
      '</div></div>';
  }

  /* ---------------- Análisis clínicos ---------------- */
  function tabAnalisis() {
    return '<div class="cab" style="margin-bottom:10px">' +
        '<div><h2 style="margin:0">Análisis clínicos</h2>' +
          '<div class="sub">' + exp.arch.length + ' archivo(s) en el expediente</div></div>' +
        '<div class="btn-fila">' +
          '<button class="btn" id="subir">＋ Cargar archivo</button>' +
          '<input type="file" id="archivo" accept="application/pdf" style="display:none">' +
        '</div></div>' +

      tabla([
        { t: 'Archivo', k: 'nombre' },
        { t: 'Descripción', v: a => a.descripcion || '—' },
        { t: 'Tamaño', v: a => tam(a.bytes) },
        { t: 'Cargado', v: a => fmtHora(a.subido_en) },
        { t: '', html: a => '<button class="btn sm" data-ver="' + esc(a.id) + '">Ver PDF</button>' +
            '<button class="btn gh sm" data-borrar="' + esc(a.id) + '">Eliminar</button>' }
      ], exp.arch, { vacio: 'Sin archivos cargados. Usa «Cargar archivo» para agregar el PDF del laboratorio.' }) +

      '<p class="pista" style="font-size:11.5px;color:var(--tx3);margin-top:10px">Sólo archivos PDF, ' +
      'hasta 20 MB. El archivo se guarda cifrado y no es accesible sin una sesión válida: el enlace para ' +
      'verlo se genera en el momento y caduca en un minuto.</p>';
  }

  function tam(b) {
    if (!b) return '—';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return Math.round(b / 1024) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  const popupSubir = () => $('#archivo').click();

  async function subir(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { flash('Sólo se aceptan archivos PDF.', 'wa'); return; }
    if (f.size > 20971520) { flash('El archivo pasa de 20 MB.', 'wa'); return; }

    const btn = $('#subir');
    btn.disabled = true; btn.textContent = 'Cargando…';
    try {
      /* La ruta empieza con el identificador de la persona: así cada
         expediente queda en su propia carpeta dentro del bucket. */
      const limpio = f.name.replace(/[^A-Za-z0-9._-]/g, '_');
      const ruta = exp.id + '/' + Date.now() + '-' + limpio;

      const { error: errSub } = await cliente().storage.from(BUCKET)
        .upload(ruta, f, { contentType: 'application/pdf', upsert: false });
      if (errSub) throw errSub;

      const { error: errReg } = await cliente().from('archivos_analisis').insert({
        perfil_id: exp.id, ruta: ruta, nombre: f.name, bytes: f.size, subido_por: perfil.id
      });
      if (errReg) {
        /* Si el registro falla, no dejamos el archivo huérfano en el bucket. */
        await cliente().storage.from(BUCKET).remove([ruta]);
        throw errReg;
      }

      await auditar('analisis.archivo_cargado', 'archivos_analisis', null, exp.id, f.name);
      flash('Archivo cargado.', 'ok');
      await render();
    } catch (ex) {
      flash(ex.message || 'No se pudo cargar el archivo.', 'no');
      btn.disabled = false; btn.textContent = '＋ Cargar archivo';
    }
  }

  async function verArchivo(id) {
    const a = exp.arch.find(x => x.id === id);
    if (!a) return;
    try {
      const { data, error } = await cliente().storage.from(BUCKET).createSignedUrl(a.ruta, 60);
      if (error) throw error;
      await auditar('analisis.archivo_consultado', 'archivos_analisis', id, exp.id, a.nombre);
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch (ex) {
      flash(ex.message || 'No se pudo abrir el archivo.', 'no');
    }
  }

  function borrarArchivo(id) {
    const a = exp.arch.find(x => x.id === id);
    if (!a) return;
    confirmar('Eliminar el archivo',
      'Se eliminará «' + a.nombre + '» del expediente. La acción queda registrada en la bitácora y no se puede deshacer.',
      async () => {
        try {
          const { error } = await cliente().storage.from(BUCKET).remove([a.ruta]);
          if (error) throw error;
          const { error: e2 } = await cliente().from('archivos_analisis').delete().eq('id', id);
          if (e2) throw e2;
          await auditar('analisis.archivo_eliminado', 'archivos_analisis', id, exp.id, a.nombre);
          flash('Archivo eliminado.', 'ok');
          await render();
        } catch (ex) { flash(ex.message || 'No se pudo eliminar.', 'no'); }
      });
  }
})();
