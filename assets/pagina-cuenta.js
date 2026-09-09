/* ============================================================
   MEDICO ZX — Mi cuenta
   Cambio de contraseña. Obligatorio en el primer ingreso.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, cliente, requiereSesion, montar, arranque, flash, cab, ro, pie, auditar,
          fmt, turnoTexto, rolTexto } = window.ZX;

  arranque(async function () {
    const perfil = await requiereSesion(false);
    if (!perfil) return;

    const main = montar(perfil, 'cuenta.html');
    const primera = /primera=1/.test(location.search) || perfil.debe_cambiar_password;

    main.innerHTML =
      cab('Mi cuenta', 'Datos de acceso y contraseña') +
      (primera
        ? '<div class="aviso">🔑 <div><b>Cambia tu contraseña para continuar.</b> Estás usando la contraseña ' +
          'temporal que te entregaron. Elige una nueva que sólo tú conozcas: con ella se protege tu ' +
          'información de salud.</div></div>'
        : '') +

      '<div class="rejilla g2">' +
        '<div class="tarjeta"><div class="tarjeta-t">Mis datos</div>' +
          '<div class="fila">' +
            ro('Número de nómina', perfil.numero_nomina) +
            ro('Nombre', perfil.nombre_completo) +
            ro('Puesto', perfil.puesto) +
            ro('Área', perfil.area) +
            ro('Turno', turnoTexto(perfil.turno)) +
            ro('Fecha de ingreso', perfil.fecha_ingreso ? fmt(perfil.fecha_ingreso) : '—') +
            ro('Perfil de acceso', rolTexto(perfil.rol)) +
          '</div>' +
          '<p class="pista" style="font-size:11px;color:var(--tx3)">Si algún dato laboral es incorrecto, ' +
          'avisa a Recursos Humanos: estos campos no se editan desde aquí.</p>' +
        '</div>' +

        '<div class="tarjeta"><div class="tarjeta-t">Cambiar contraseña</div>' +
          '<form id="f">' +
            '<div class="campo"><label for="p1">Nueva contraseña</label>' +
              '<input id="p1" type="password" required minlength="8" autocomplete="new-password"></div>' +
            '<div class="campo"><label for="p2">Confirmar nueva contraseña</label>' +
              '<input id="p2" type="password" required minlength="8" autocomplete="new-password"></div>' +
            '<div id="fuerza" class="pista"></div>' +
            '<button class="btn" type="submit" id="btn" style="margin-top:10px">Guardar contraseña</button>' +
          '</form>' +
          '<p class="pista" style="margin-top:14px;font-size:11px;color:var(--tx3)">Mínimo 8 caracteres. ' +
          'Evita tu número de nómina, tu fecha de nacimiento y secuencias como 12345678.</p>' +
        '</div>' +
      '</div>';

    pie(main, 'La contraseña se guarda cifrada en Supabase; ni el servicio médico ni Sistemas pueden verla. Si la olvidas, se restablece con una nueva contraseña temporal.');

    const p1 = $('#p1'), p2 = $('#p2'), fuerza = $('#fuerza');

    p1.addEventListener('input', () => {
      const v = p1.value;
      if (!v) { fuerza.textContent = ''; return; }
      const puntos = [v.length >= 8, v.length >= 12, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)]
        .filter(Boolean).length;
      const txt = puntos <= 2 ? 'Débil' : puntos === 3 ? 'Aceptable' : puntos === 4 ? 'Buena' : 'Fuerte';
      const col = puntos <= 2 ? 'var(--dn)' : puntos === 3 ? 'var(--wnt)' : 'var(--gn)';
      fuerza.innerHTML = '<span style="color:' + col + ';font-weight:600">Seguridad: ' + txt + '</span>';
    });

    $('#f').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = $('#btn');
      if (p1.value.length < 8) return flash('La contraseña debe tener al menos 8 caracteres.', 'wa');
      if (p1.value !== p2.value) return flash('Las dos contraseñas no coinciden.', 'wa');
      if (p1.value.indexOf(String(perfil.numero_nomina)) >= 0) {
        return flash('No uses tu número de nómina dentro de la contraseña.', 'wa');
      }

      btn.disabled = true;
      btn.textContent = 'Guardando…';
      try {
        const { error } = await cliente().auth.updateUser({ password: p1.value });
        if (error) throw error;

        /* El perfil no lo puede editar el colaborador (RLS): una función
           de la base marca la contraseña como cambiada en su propia fila. */
        const { error: e2 } = await cliente().rpc('marcar_password_cambiada');
        if (e2) throw e2;
        await auditar('cuenta.password', 'perfiles', perfil.id, perfil.id, 'Cambio de contraseña');

        flash('Contraseña actualizada.', 'ok');
        setTimeout(() => location.replace('clinico.html'), 900);
      } catch (ex) {
        flash(ex.message || 'No se pudo cambiar la contraseña.', 'no');
        btn.disabled = false;
        btn.textContent = 'Guardar contraseña';
      }
    });
  });
})();
