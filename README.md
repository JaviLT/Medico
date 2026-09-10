# Medico ZX

Visor de expedientes médicos ocupacionales de Zubex Industrial S.A. de C.V.
Muestra ficha del colaborador, historia clínica y análisis clínicos para exhibirlos en auditoría.

- **Uso interno.** Acceso restringido al servicio médico.
- **Sólo el frontend.** No hay datos de personas: todo vive en Supabase, protegido por políticas
  de acceso a nivel de fila.
- La llave de `assets/config.js` es la **pública** (publishable). Es pública por diseño: sin una
  sesión válida no lee ningún dato.

## Publicación

GitHub Pages, rama `main`, carpeta raíz.
