/* ============================================================
   MEDICO ZX — Aviso de privacidad, consentimiento y derechos ARCO
   ------------------------------------------------------------
   Cubre en la aplicación tres obligaciones de la LFPDPPP
   (DOF 20/03/2025): entregar el aviso antes de recolectar
   (arts. 14 y 15), recabar el consentimiento expreso para datos
   sensibles (art. 8) y ofrecer el mecanismo para ejercer los
   derechos ARCO (art. 15).

   El TEXTO del aviso es una plantilla. Los datos entre « » los
   completa Jurídico. Mientras existan marcas « » la pantalla
   muestra un recuadro de borrador, a propósito: es la forma de
   que nadie dé por cerrado el trámite antes de tiempo.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, cliente, requiereSesion, montar, arranque, flash, cab, pie, auditar,
          fmtLargo, esClinico, versionAviso, consentimiento } = window.ZX;

  /* --- Datos del responsable: los completa Jurídico --- */
  const RESPONSABLE = {
    razon_social: 'Zubex Industrial S.A. de C.V.',
    domicilio:    '«domicilio fiscal completo»',
    area:         '«área o persona responsable de datos personales»',
    correo:       '«correo de contacto para datos personales»',
    telefono:     '«teléfono de contacto»'
  };

  const pendiente = (t) => /«/.test(String(t));

  arranque(async function () {
    const perfil = await requiereSesion(false);
    if (!perfil) return;
    const main = montar(perfil, 'privacidad.html');
    window.ZX.cargando(main);

    const version = await versionAviso();
    const cons = await consentimiento(perfil);
    const clinico = esClinico(perfil);

    const { data: solicitudes } = await cliente()
      .from('solicitudes_arco')
      .select('tipo, detalle, estado, recibida_en, respuesta, respondida_en')
      .eq('perfil_id', perfil.id)
      .order('recibida_en', { ascending: false });

    const borrador = Object.keys(RESPONSABLE).some(k => pendiente(RESPONSABLE[k]));

    /* Si llegó aquí sin consentimiento, la aplicación lo trajo: no eligió
       entrar. La pantalla se comporta distinto — explica por qué está aquí
       y no le ofrece nada más hasta que decida. */
    const primeraVez = !cons && !clinico;

    main.innerHTML =
      cab('Aviso de privacidad', 'Tratamiento de datos personales · versión ' + esc(version || '—')) +

      (borrador
        ? '<div class="aviso wa">📝 <div><b>Texto en borrador.</b> Este aviso todavía tiene campos por ' +
          'completar y debe ser revisado y aprobado por el área jurídica antes de recolectar datos de ' +
          'personas reales. Los campos pendientes aparecen marcados abajo.</div></div>'
        : '') +

      (primeraVez ? intro() : '') +
      seccionAviso() +
      seccionConsentimiento(cons, clinico) +
      (primeraVez ? '' : seccionArco(solicitudes || []));

    pie(main, 'Aviso elaborado conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares, publicada en el Diario Oficial de la Federación el 20 de marzo de 2025.');

    if ($('#btnConsentir')) $('#btnConsentir').addEventListener('click', () => otorgar(perfil, version));
    if ($('#btnRechazar')) $('#btnRechazar').addEventListener('click', rechazar);
    if ($('#btnRevocar'))   $('#btnRevocar').addEventListener('click', () => revocar(perfil, cons));
    if ($('#fArco'))        $('#fArco').addEventListener('submit', (e) => enviarArco(e, perfil));
  });

  function intro() {
    return '<div class="aviso">📄 <div><b>Antes de continuar, lee este aviso.</b> Medico ZX trata ' +
      'información sobre tu salud, y la ley pide que la empresa te explique qué hace con ella y que tú ' +
      'lo autorices expresamente. Al final de la página decides.</div></div>';
  }

  function rechazar() {
    window.ZX.confirmar(
      'No otorgar el consentimiento',
      'Se cerrará tu sesión. Puedes volver a entrar cuando quieras y el aviso aparecerá de nuevo. ' +
      'Si tienes dudas antes de decidir, acércate al servicio médico o a Recursos Humanos.',
      async () => { await window.ZX.salir(); });
  }

  /* ---------------- Consentimiento ---------------- */
  const TEXTO_CONSENTIMIENTO =
    'Otorgo mi consentimiento expreso para que Zubex Industrial S.A. de C.V. trate mis datos ' +
    'personales sensibles relativos a mi estado de salud, con las finalidades y en los términos ' +
    'descritos en este aviso de privacidad. Se me informó que puedo revocarlo en cualquier momento.';

  function seccionConsentimiento(cons, clinico) {
    if (clinico) {
      return '<div class="tarjeta"><div class="tarjeta-t">Consentimiento</div>' +
        '<p style="font-size:13.5px;color:var(--tx2)">Los perfiles del servicio médico no capturan su ' +
        'propio expediente en esta aplicación, por lo que no se les solicita consentimiento aquí. ' +
        'Puedes consultar quién lo ha otorgado desde el panel de Servicio médico.</p></div>';
    }

    if (cons) {
      return '<div class="tarjeta" style="border-left:4px solid var(--gn)">' +
        '<div class="tarjeta-t">✓ Consentimiento otorgado</div>' +
        '<p style="font-size:13.5px;color:var(--tx2);margin-bottom:6px">Lo otorgaste el <b>' +
          esc(fmtLargo(String(cons.otorgado_en).slice(0, 10))) + '</b> para la versión <b>' +
          esc(cons.version_aviso) + '</b> de este aviso.</p>' +
        '<p style="font-size:12.5px;color:var(--tx3);margin-bottom:12px">Puedes revocarlo cuando quieras. ' +
          'Al hacerlo dejarás de poder capturar o modificar tu historia clínica, y el servicio médico lo ' +
          'sabrá para darle el trámite que corresponda. Lo ya registrado se conserva el tiempo que exigen ' +
          'las normas de salud y laborales.</p>' +
        '<button class="btn gh" id="btnRevocar">Revocar mi consentimiento</button></div>';
    }

    return '<div class="tarjeta" style="border-left:4px solid var(--wnt)">' +
      '<div class="tarjeta-t">Falta tu consentimiento</div>' +
      '<p style="font-size:13.5px;color:var(--tx2);margin-bottom:10px">Tu información de salud es un ' +
        '<b>dato personal sensible</b>. La ley exige tu consentimiento expreso antes de tratarla, así que ' +
        'no podrás capturar tu historia clínica hasta que lo otorgues.</p>' +
      '<div class="solo-lectura" style="font-size:13px;line-height:1.6;margin-bottom:12px">' +
        esc(TEXTO_CONSENTIMIENTO) + '</div>' +
      '<label style="display:flex;gap:9px;align-items:flex-start;font-size:13px;margin-bottom:12px">' +
        '<input type="checkbox" id="acepto" style="margin-top:3px;width:auto">' +
        '<span>Leí el aviso de privacidad y otorgo mi consentimiento expreso.</span></label>' +
      '<div class="btn-fila">' +
        '<button class="btn" id="btnConsentir">Otorgar mi consentimiento</button>' +
        '<button class="btn gh" id="btnRechazar">No acepto</button>' +
      '</div>' +
      '<p class="pista" style="font-size:11.5px;color:var(--tx3);margin-top:10px">Si eliges «No acepto» se ' +
        'cerrará tu sesión; no pasa nada más y puedes volver a entrar cuando quieras. ' +
        'Si lo otorgas, queda registrado con tu ' +
        'usuario y la fecha. Entraste con tu número de nómina y tu contraseña: esa autenticación es la que ' +
        'acredita que fuiste tú.</p></div>';
  }

  async function otorgar(perfil, version) {
    if (!$('#acepto').checked) return flash('Marca la casilla para confirmar que lo otorgas.', 'wa');
    const btn = $('#btnConsentir');
    btn.disabled = true; btn.textContent = 'Registrando…';
    try {
      const { error } = await cliente().from('consentimientos').insert({
        perfil_id: perfil.id,
        version_aviso: version,
        otorgado: true,
        medio: 'aplicacion_web',
        evidencia: TEXTO_CONSENTIMIENTO
      });
      if (error) throw error;
      await auditar('privacidad.consentimiento_otorgado', 'consentimientos', null, perfil.id,
                    'Versión ' + version);
      flash('Consentimiento registrado.', 'ok');
      setTimeout(() => location.reload(), 800);
    } catch (ex) {
      flash(ex.message || 'No se pudo registrar.', 'no');
      btn.disabled = false; btn.textContent = 'Otorgar mi consentimiento';
    }
  }

  async function revocar(perfil, cons) {
    window.ZX.confirmar(
      'Revocar el consentimiento',
      'Dejarás de poder capturar o modificar tu historia clínica. El servicio médico será notificado. ¿Continuar?',
      async () => {
        const { error } = await cliente().from('consentimientos')
          .update({ otorgado: false, revocado_en: new Date().toISOString() })
          .eq('id', cons.id);
        if (error) return flash(error.message, 'no');
        await auditar('privacidad.consentimiento_revocado', 'consentimientos', cons.id, perfil.id, null);
        flash('Consentimiento revocado.', 'ok');
        setTimeout(() => location.reload(), 800);
      });
  }

  /* ---------------- El aviso ---------------- */
  function campo(v) {
    return pendiente(v)
      ? '<span style="background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:4px;font-weight:600">' + esc(v) + '</span>'
      : esc(v);
  }

  function seccionAviso() {
    return '<div class="tarjeta"><div class="tarjeta-t">Aviso de privacidad integral</div>' +
      '<div style="font-size:13.5px;line-height:1.7;color:var(--tx2)">' +

      '<h3 style="font-size:14px;color:var(--tx);margin:4px 0 6px">Quién trata tus datos</h3>' +
      '<p>' + campo(RESPONSABLE.razon_social) + ', con domicilio en ' + campo(RESPONSABLE.domicilio) +
      ', es responsable del tratamiento de tus datos personales.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Qué datos se tratan</h3>' +
      '<p>Datos de identificación y laborales (número de nómina, nombre, puesto, área, turno y fecha de ' +
      'ingreso) y <b>datos personales sensibles relativos a tu estado de salud</b>: tipo sanguíneo, ' +
      'alergias, enfermedades crónicas, medicamentos, antecedentes médicos y quirúrgicos, contacto de ' +
      'emergencia y resultados de análisis clínicos.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Para qué</h3>' +
      '<p>Finalidades necesarias:</p>' +
      '<ul style="margin:6px 0 6px 18px">' +
        '<li>Integrar y conservar tu expediente clínico laboral.</li>' +
        '<li>Cumplir el programa de vigilancia de la salud y los análisis clínicos que exige la ' +
            'certificación de inocuidad alimentaria aplicable al centro de trabajo.</li>' +
        '<li>Dar seguimiento médico a los resultados que presenten alguna desviación.</li>' +
        '<li>Atender emergencias médicas y contactar a la persona que designaste.</li>' +
        '<li>Cumplir las obligaciones de salud y seguridad en el trabajo a cargo del patrón.</li>' +
      '</ul>' +
      '<p><b>Tus datos de salud no se utilizan para decisiones de contratación, permanencia, ascenso o ' +
      'terminación de la relación laboral.</b> Los resultados individuales sólo son accesibles para el ' +
      'personal del servicio médico; ninguna jefatura tiene acceso a ellos.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Con quién se comparten</h3>' +
      '<p>Con el personal del servicio médico de la empresa y, cuando corresponda, con el laboratorio o ' +
      'la institución de salud que practique los estudios. También con la autoridad que los requiera por ' +
      'mandato legal. <b>No se transfieren con fines comerciales.</b></p>' +
      '<p>La información se almacena en servicios de cómputo en la nube que pueden ubicarse fuera del ' +
      'territorio nacional, contratados por la empresa bajo acuerdos de tratamiento de datos que los ' +
      'obligan a las mismas condiciones de este aviso.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Cuánto tiempo se conservan</h3>' +
      '<p>El expediente se conserva por el plazo que exigen las disposiciones sanitarias y laborales ' +
      'aplicables, contado a partir del último acto registrado, y se suprime al vencer ese plazo.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Cómo se protegen</h3>' +
      '<p>El acceso está restringido por perfil dentro de la propia base de datos, las contraseñas se ' +
      'almacenan cifradas y toda consulta o modificación queda registrada en una bitácora que no puede ' +
      'borrarse. Si ocurriera una vulneración que afecte de forma significativa tus derechos, se te ' +
      'informará de inmediato.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Cómo limitar el uso o revocar</h3>' +
      '<p>Puedes revocar tu consentimiento desde esta misma pantalla o dirigiéndote a ' +
      campo(RESPONSABLE.area) + '. La revocación no tiene efectos retroactivos y no impide conservar la ' +
      'información que la normativa obligue a resguardar.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Cambios a este aviso</h3>' +
      '<p>Cualquier modificación se publicará en esta pantalla con un número de versión nuevo y se te ' +
      'solicitará otorgar nuevamente tu consentimiento.</p>' +

      '<h3 style="font-size:14px;color:var(--tx);margin:16px 0 6px">Contacto</h3>' +
      '<p>' + campo(RESPONSABLE.area) + ' · ' + campo(RESPONSABLE.correo) + ' · ' +
      campo(RESPONSABLE.telefono) + '</p>' +

      '</div></div>';
  }

  /* ---------------- Derechos ARCO ---------------- */
  const TIPOS_ARCO = {
    acceso:        { n: 'Acceso',        d: 'Conocer qué datos míos tienen y cómo los usan' },
    rectificacion: { n: 'Rectificación', d: 'Corregir un dato inexacto o incompleto' },
    cancelacion:   { n: 'Cancelación',   d: 'Pedir que se supriman mis datos' },
    oposicion:     { n: 'Oposición',     d: 'Oponerme a que se usen para una finalidad' }
  };
  const ESTADOS_ARCO = {
    recibida:     { n: 'Recibida',     e: 'wa' },
    en_tramite:   { n: 'En trámite',   e: 'in' },
    atendida:     { n: 'Atendida',     e: 'ok' },
    improcedente: { n: 'Improcedente', e: 'nt' }
  };

  function seccionArco(solicitudes) {
    const opciones = Object.keys(TIPOS_ARCO)
      .map(k => '<option value="' + k + '">' + esc(TIPOS_ARCO[k].n) + ' — ' + esc(TIPOS_ARCO[k].d) + '</option>')
      .join('');

    const historial = solicitudes.length
      ? '<div class="tarjeta"><div class="tarjeta-t">Mis solicitudes</div>' +
        window.ZX.tabla([
          { t: 'Tipo',     v: s => (TIPOS_ARCO[s.tipo] || {}).n || s.tipo },
          { t: 'Recibida', v: s => fmtLargo(String(s.recibida_en).slice(0, 10)) },
          { t: 'Estado',   html: s => window.ZX.etq(ESTADOS_ARCO, s.estado) },
          { t: 'Respuesta', v: s => s.respuesta || '—' }
        ], solicitudes, {}) + '</div>'
      : '';

    return '<div class="tarjeta"><div class="tarjeta-t">Ejercer mis derechos ARCO</div>' +
      '<p style="font-size:13.5px;color:var(--tx2);margin-bottom:12px">Puedes pedir acceso a tus datos, ' +
      'corregirlos, solicitar su cancelación u oponerte a alguna finalidad. Al enviar la solicitud queda ' +
      'registrada con la fecha de recepción, que es desde la que corre el plazo de respuesta.</p>' +
      '<form id="fArco">' +
        '<div class="campo"><label for="tipoArco">Qué quiero ejercer</label>' +
          '<select id="tipoArco">' + opciones + '</select></div>' +
        '<div class="campo"><label for="detalleArco">Descríbelo con detalle</label>' +
          '<textarea id="detalleArco" rows="3" required placeholder="Ejemplo: mi fecha de ingreso está incorrecta, dice 2019 y entré en 2021."></textarea></div>' +
        '<button class="btn" type="submit" id="btnArco">Enviar solicitud</button>' +
      '</form></div>' + historial;
  }

  async function enviarArco(e, perfil) {
    e.preventDefault();
    const btn = $('#btnArco');
    const detalle = $('#detalleArco').value.trim();
    if (detalle.length < 10) return flash('Describe tu solicitud con un poco más de detalle.', 'wa');
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const { error } = await cliente().from('solicitudes_arco').insert({
        perfil_id: perfil.id,
        tipo: $('#tipoArco').value,
        detalle: detalle
      });
      if (error) throw error;
      await auditar('privacidad.arco_solicitada', 'solicitudes_arco', null, perfil.id, $('#tipoArco').value);
      flash('Solicitud enviada. El servicio médico le dará trámite.', 'ok');
      setTimeout(() => location.reload(), 900);
    } catch (ex) {
      flash(ex.message || 'No se pudo enviar.', 'no');
      btn.disabled = false; btn.textContent = 'Enviar solicitud';
    }
  }
})();
