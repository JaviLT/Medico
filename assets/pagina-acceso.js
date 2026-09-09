/* ============================================================
   MEDICO ZX — Pantalla de acceso
   Entrada con número de nómina y contraseña.
   ============================================================ */
(function () {
  'use strict';
  const { esc, $, cliente, entrar, auditar } = window.ZX;

  const raiz = document.getElementById('raiz');

  raiz.innerHTML =
    '<div class="acceso">' +
      '<section class="acceso-art">' +
        '<div class="marca" style="font-size:17px"><span class="marca-ico">ZX</span><span>Zubex Industrial</span></div>' +
        '<div>' +
          '<h2>Tu expediente médico, en un solo lugar.</h2>' +
          '<p>Mantén tu historia clínica al día y consulta el resultado de tus análisis y su seguimiento.</p>' +
          '<div class="acceso-lista">' +
            '<div><i>📝</i><span>Actualiza tu historia clínica y envíala a revisión</span></div>' +
            '<div><i>🩺</i><span>El servicio médico la valida y te avisa si falta algo</span></div>' +
            '<div><i>🧪</i><span>Consulta tus análisis clínicos y su seguimiento</span></div>' +
            '<div><i>🔒</i><span>Sólo tú y el servicio médico ven tu información</span></div>' +
          '</div>' +
        '</div>' +
        '<small style="opacity:.7;font-size:11px">Zubex Industrial S.A. de C.V. · Uso interno</small>' +
      '</section>' +

      '<section class="acceso-form"><div class="acceso-caja">' +
        '<h1>Iniciar sesión</h1>' +
        '<p>Entra con tu número de nómina.</p>' +
        '<div id="err" class="error oculto" role="alert"></div>' +
        '<form id="f" autocomplete="off">' +
          '<div class="campo"><label for="nomina">Número de nómina</label>' +
            '<input id="nomina" name="nomina" required inputmode="numeric" autocomplete="username" placeholder="Ej. 1002"></div>' +
          '<div class="campo"><label for="pass">Contraseña</label>' +
            '<input id="pass" name="pass" type="password" required autocomplete="current-password" placeholder="••••••••"></div>' +
          '<button class="btn" style="width:100%;justify-content:center" id="btn" type="submit">Entrar</button>' +
        '</form>' +
        '<p style="font-size:11.5px;color:var(--tx2);margin-top:20px;line-height:1.6">' +
          '¿Olvidaste tu contraseña o es tu primer ingreso? Comunícate con el servicio médico o con ' +
          'Recursos Humanos para que te la restablezcan.</p>' +
        '<p style="margin-top:14px;font-size:10.5px;color:var(--tx3)">Medico ZX · versión ' +
          esc((window.MZX_CONFIG || {}).VERSION || '') + '</p>' +
      '</div></section>' +
    '</div>';

  /* Si ya hay sesión, no tiene sentido mostrar el formulario */
  (async function () {
    try {
      const { data: { session } } = await cliente().auth.getSession();
      if (session) location.replace('clinico.html');
    } catch (e) {
      mostrarError(e.message);
    }
  })();

  function mostrarError(msg) {
    const err = $('#err');
    err.textContent = msg;
    err.classList.remove('oculto');
  }

  $('#f').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#btn');
    $('#err').classList.add('oculto');
    btn.disabled = true;
    btn.textContent = 'Verificando…';
    try {
      const p = await entrar($('#nomina').value, $('#pass').value);
      await auditar('sesion.entrar', 'perfiles', p.id, p.id, 'Inicio de sesión');
      location.replace(p.debe_cambiar_password ? 'cuenta.html?primera=1' : 'clinico.html');
    } catch (ex) {
      mostrarError(ex.message || 'No fue posible iniciar sesión.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  });
})();
