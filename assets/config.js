/* ============================================================
   MEDICO ZX — Configuración
   ------------------------------------------------------------
   Único archivo con valores propios de la instalación.
   No contiene ningún dato de personas: todo vive en Supabase.

   Los dos valores de abajo son PÚBLICOS por diseño: viajan
   dentro de cualquier aplicación web y cualquiera que abra el
   sitio puede verlos. Lo que protege la información no es
   esconderlos, sino las políticas RLS de la base: sin una sesión
   válida, esta llave no devuelve ni una fila.
   ============================================================ */
window.MZX_CONFIG = {
  SUPABASE_URL: 'https://hpheqabqglvgrmaofher.supabase.co',
  SUPABASE_KEY: 'sb_publishable_GnYLhdWI3PE9bsTmGgT5Mw_pWWcyYt-',

  /* Dominio interno con el que se arma el identificador de acceso
     a partir del número de nómina. No recibe correo; sólo existe
     porque Supabase Auth necesita un identificador con formato de
     correo electrónico. Debe coincidir con DOMINIO_NOMINA del
     script de carga inicial. */
  DOMINIO_NOMINA: 'nomina.zubex.com.mx',

  VERSION: '2.0.0'
};
