# Medico ZX

Visor de expedientes médicos ocupacionales de Zubex Industrial S.A. de C.V.
Aplicación de consulta: muestra ficha del colaborador, historia clínica y análisis clínicos
para exhibirlos en auditoría.

- **Uso interno.** Acceso restringido al servicio médico.
- **Este repositorio contiene únicamente el frontend.** No hay datos de personas: todo vive en
  Supabase, protegido por políticas de acceso a nivel de fila.
- La llave que aparece en `assets/config.js` es la **llave pública** (publishable). Es pública por
  diseño: sin una sesión válida no lee ningún dato.

## Publicación

GitHub Pages, desde la rama `main`, carpeta raíz.

## Documentación

La guía de puesta en marcha, el esquema de base de datos y los scripts de carga se resguardan
fuera de este repositorio.
