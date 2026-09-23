# Medico ZX

Aplicación web de consulta del expediente médico de Zubex Industrial S.A. de C.V.
Muestra la **historia clínica** y los **análisis clínicos** de cada colaborador al
servicio médico. No captura información: sólo la exhibe.

Uso interno. No indexable, no pública.

## Qué contiene este repositorio

Sólo lo que se publica: HTML, CSS y JavaScript estáticos. No hay proceso de
compilación, no hay dependencias que instalar, no hay servidor propio.

```
index.html          Pantalla de acceso
clinico.html        Listado de pacientes y expediente
cuenta.html         Cambio de contraseña
privacidad.html     Aviso de privacidad y consentimiento
assets/             Estilos, utilidades y la lógica de cada pantalla
.nojekyll           Evita que GitHub procese el sitio con Jekyll
_headers            Cabeceras de caché para Netlify (GitHub Pages lo ignora)
```

**Lo que deliberadamente NO está aquí:** los scripts de carga masiva, los archivos
SQL del esquema y cualquier CSV. Los scripts corren con la llave secreta de
Supabase y los CSV contienen datos de personas; ninguna de las dos cosas debe
vivir en un repositorio. Se conservan aparte, en la carpeta de trabajo.

## Configuración

Todo lo propio de la instalación está en `assets/config.js`: la dirección del
proyecto de Supabase, la llave publicable y el dominio interno con el que se arma
el identificador de acceso a partir del número de nómina.

La llave que aparece ahí es **publicable y pública por diseño**: viaja dentro de
cualquier aplicación web y cualquiera que abra el sitio puede verla. Lo que
protege la información no es esconderla, sino las políticas RLS de la base: sin
una sesión válida no devuelve ni una fila. La llave **secreta** nunca va aquí.

## Publicar en GitHub Pages

1. Sube estos archivos a la raíz del repositorio (no dentro de una subcarpeta).
2. En **Settings → Pages**, elige *Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. Espera a que termine el despliegue y abre la dirección que te da GitHub.

Si el repositorio es **privado**, GitHub Pages requiere un plan de paga. En un
repositorio público, el código queda a la vista de cualquiera — lo cual es
aceptable para este código, pero conviene decidirlo a conciencia.

Después de cada publicación, sube el número de versión en la cadena `?v=` de los
HTML y en `VERSION` de `config.js`. Es lo que obliga al navegador a recoger los
archivos nuevos en vez de servir los que ya tenía en caché.

## Base de datos

La aplicación no funciona sola: necesita el proyecto de Supabase con su esquema,
sus políticas RLS y su bucket de análisis. Eso vive en los archivos SQL de la
carpeta de trabajo, fuera de este repositorio.

## Aviso

Esta aplicación trata **datos personales sensibles de salud**. Cualquier cambio
en quién ve qué debe revisarse contra las políticas RLS de la base, no sólo
contra lo que muestra la interfaz: el navegador no es una barrera de seguridad.
