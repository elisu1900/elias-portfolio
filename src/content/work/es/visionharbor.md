---
title: 'Gestión de personal portuario, Puerto de Málaga'
summary: 'Plataforma full-stack para planificar el personal de estiba, los turnos y las titulaciones en el Puerto de Málaga, desarrollada en Vision Harbor Technologies con .NET y React.'
role: 'Ingeniero de software full-stack'
stack: ['C# / .NET', 'React', 'TypeScript', 'SQL', 'CI/CD', 'Claude Code']
year: 2026
locale: 'es'
url: 'https://visionharbor.ai'
productUrl: 'https://visionone.visionharbor.ai'
featured: true
order: 1
---

## El problema

Un buque no espera. Cuando atraca en el Puerto de Málaga, la mano de estibadores tiene que estar en el muelle dentro del turno que toca, con las titulaciones correctas y las habilitaciones de maquinaria en vigor — y el cuadrante que los coloca ahí se monta con restricciones que cambian de hora en hora. Las llegadas de los barcos se mueven. La gente se pone enferma. Una habilitación de grúa caduca. El puerto trabaja las veinticuatro horas, y un equipo al que le falta una persona cualificada no puede trabajar el barco.

Por encima de todo eso hay una pregunta que no tiene nada que ver con la planificación: quién puede ver esto y quién puede cambiarlo. Un capataz que planifica los turnos de mañana, un responsable de operaciones que revisa costes, un administrativo que mantiene el registro de titulaciones y un trabajador que consulta su propio turno son cuatro personas distintas que necesitan cuatro vistas distintas del mismo dato.

## Qué desarrollo

VisionOne es la plataforma con la que Vision Harbor Technologies cubre ese trabajo, y la desarrollo full-stack. Backend en C# y .NET, frontend en React. El trabajo recorre toda la vertical — modelo de datos, API, reglas de negocio e interfaz: fichas de personal y titulaciones, composición de turnos y equipos, disponibilidad y las pantallas operativas que usan los planificadores del puerto mientras el turno está en marcha.

## Accesos y permisos

Hice un análisis de la arquitectura de la aplicación y propuse un rediseño de su modelo de accesos y permisos. El modelo original respondía a «qué rol tiene este usuario» cuando la pregunta operativa es «qué puede hacer este usuario con este registro, en esta operación y ahora mismo». Mapeé la superficie de permisos, localicé dónde se tomaban decisiones de autorización repartidas por demasiados sitios para poder razonarlas con seguridad y propuse un modelo que las concentra en una única capa que se puede hacer cumplir — así una pantalla nueva hereda las reglas en lugar de reimplementarlas.

## Cómo sale a producción

La IA está metida en el ciclo de desarrollo: Claude Code para automatizar tareas y generar código asistido, lo que acorta la distancia entre decidir un cambio y tenerlo revisado. También llevo la parte de DevOps — despliegues, pipelines de CI/CD y la organización del trabajo del equipo desde la rama hasta producción.
