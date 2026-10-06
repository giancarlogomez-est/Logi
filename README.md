# Logi

Control de obra vial con una interfaz 3D tipo videojuego: personal, maquinaria y materiales ubicados
sobre la vía real, que se construye a partir del alineamiento exportado de Civil 3D (LandXML).

## Fase 0 — Prototipo visual (este estado)

- Lectura de LandXML 1.2 en el navegador: eje en planta (tangentes, curvas circulares y clotoides),
  rasante (PVI y curvas verticales parabólicas) y secciones transversales.
- Construcción del "mundo": terreno natural, taludes, plataforma y calzada con demarcación,
  a partir de las superficies de las secciones (terreno y superficie terminada del corredor).
- Todo se ubica por **abscisa + desplazamiento**; la conversión a 3D usa un origen local para no
  perder precisión con coordenadas MAGNA-SIRGAS.
- Fichas de equipos, cuadrillas y acopios (datos de ejemplo) que se seleccionan y se **arrastran**
  sobre la vía; la abscisa se recalcula proyectando sobre el eje.
- Navegación: ir a abscisa (`K3+500`), perfil longitudinal y planta como minimapas.
- Validación geométrica: cierre del eje calculado contra el LandXML y rasante contra las secciones.

## Uso

```bash
cd web
npm install
npm run dev
```

Abre http://localhost:5173 y arrastra tu archivo LandXML, o cópialo como
`web/public/data/proyecto.xml` para que se cargue al iniciar (esa carpeta no se versiona).

Controles: arrastrar = desplazar · clic derecho = rotar · rueda = zoom · clic en una ficha = detalle.

## Estructura

```
web/src/
  landxml/   lectura del LandXML
  geo/       eje, rasante, secciones, mundo (abscisa ↔ 3D) y mallas
  scene/     escena 3D (React Three Fiber) y modelos low-poly
  ui/        paneles: barra superior, recursos, detalle, perfil, planta, etiquetas
  data/      recursos de ejemplo (Fase 0)
```

## Próximas fases

1. **MVP**: registro de personal, equipos y materiales; asignación a frentes; base de datos.
2. **Avance de obra**: avance por capa y por abscisa, la vía "crece", diagrama lineal.
3. **Multiusuario**: roles, parte diario desde el celular, informes.
4. **Avanzado**: GPS/telemetría de equipos, volúmenes, simulación de rendimientos.
