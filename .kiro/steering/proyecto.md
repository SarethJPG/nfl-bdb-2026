
1. Visión General y Alcance del Producto
Nombre de la aplicación: kalk NFL
Usuario objetivo (Stakeholder): Coach de Línea Defensiva(Coach)
Propuesta de valor: Determinar la asignación óptima de jugadores en el frente defensivo (Pass Rush) para situaciones de pase, maximizando la probabilidad esperada de generar presión al mariscal de campo (QB) bajo la restricción de no repetir jugadores, y explicar tácticamente el porqué mediante una visualización interactiva en campo.
Fuentes de datos principales (NFL Big Data Bowl):
pffScoutingData.csv: Posición de alineación pre-snap (pff_positionLinedUp), rol (pff_role), y métricas de presión (pff_hit, pff_hurry, pff_sack).
plays.csv: Contexto situacional de la jugada (down, distancia por avanzar yardsToGo, formación ofensiva, personal defensivo, tipo de pase/dropback).
players.csv: Identificación, posición oficial y atributos físicos de los jugadores.
games.csv: Metadatos del partido y equipos involucrados (para filtrar por roster real de un equipo).
2. Requerimientos Funcionales (RF)
Módulo A: Ingesta y Cálculo de Métricas de Presión
RF-01 (Filtrado de jugadas de pase): El sistema debe filtrar el dataset para considerar únicamente jugadas de pase válidas (excluyendo carreras, jugadas anuladas por castigos pre-snap o spikes), donde exista un pass rush activo (pff_role == 'Pass rush').
RF-02 (Definición de tasa de presión): El sistema debe calcular una variable binaria de Presión Generada por jugada y jugador, definida como 1 si pff_hit == 1 OR pff_hurry == 1 OR pff_sack == 1, y 0 en caso contrario.
RF-03 (Matriz de rendimiento por hueco/técnica): El sistema debe agrupar el historial de cada jugador por su posición de alineación (pff_positionLinedUp, ej. LEO, LE, DLT, NT, DRT, RE, REO, ROLB, LOLB) para calcular su Tasa de Presión Histórica (TotalPresiones/TotalSnapsenesaposición).
RF-04 (Suavizado estadístico / Tamaño de muestra): Para evitar sesgos por muestras pequeñas (ej. un jugador con 1 presión en 1 snap = 100%), el sistema debe aplicar un suavizado bayesiano (promedio ponderado hacia la media de la posición) o exigir un umbral mínimo configurable de snaps (ej. 10 snaps) para validar la tasa en un hueco específico.
Módulo B: Motor de Optimización del Frente Defensivo
RF-05 (Selección de paquete defensivo / huecos objetivo): El usuario debe poder seleccionar el esquema o paquete frontal deseado (ej. Base 4-3, Nickel 4-2-5, Dime 3-2-6 o selección manual de K posiciones de alineación disponibles en la línea).
RF-06 (Pool de jugadores disponibles): El usuario debe poder filtrar el roster disponible por equipo (ej. seleccionar los jugadores activos de un equipo de la NFL) o armar un pool personalizado de N defensivos (NK).
RF-07 (Asignación óptima sin repetición): Dado un conjunto de N jugadores y K huecos de alineación seleccionados, el motor debe resolver un Problema de Asignación Lineal (mediante el Algoritmo Húngaro / numpy / itertools.permutations ) que maximice la suma total de tasas de presión esperadas:


i=1Nj=1KPijxij
sujeto a que cada hueco j reciba exactamente 1 jugador (ixij=1) y cada jugador i ocupe como máximo 1 hueco (jxij1), donde xij{0,1}.
RF-08 (Filtros situacionales): El usuario debe poder segmentar el cálculo de tasas de presión según el contexto del partido:
Down y distancia (ej. 3rd & Long 7 yardas, Situaciones estándar, Red Zone).
Formación ofensiva o agrupación de personal rival.
Módulo C: Visualización Táctica y Explicabilidad ("El Porqué")
RF-09 (Cancha interactiva pre-snap): La interfaz debe renderizar la zona de la línea de golpeo (Line of Scrimmage) mostrando una línea ofensiva estándar (LT, LG, C, RG, RT + TE opcional) y los huecos defensivos (pff_positionLinedUp) mapeados a sus coordenadas espaciales reales (técnicas 0, 1, 2i, 3, 5, 7, 9).
RF-10 (Despliegue de la alineación óptima): Sobre la cancha deben aparecer los jugadores asignados en sus respectivos huecos, mostrando su nombre, dorsal/posición base, su tasa de presión en ese hueco específico y su volumen de snaps de respaldo.
RF-11 (Comparativa contra alineación tradicional / baseline): El sistema debe mostrar cuánto mejora la presión total esperada de la alineación óptima frente a una alineación convencional (ej. poner a cada jugador en su posición nominal más frecuente), expresado en puntos porcentuales de ganancia ($\Delta\%$).
RF-12 (Explicación táctica automatizada): Para cada jugador asignado, la app debe generar una ficha o tooltip explicativo indicando por qué conviene esa ubicación (ej. "El Edge #97 genera 18.4% de presión alineado como DT interior (DLT) frente a 11.2% por fuera (REO) en situaciones de 3er down largo").
RF-13 (Modo "What-If" / Intercambio manual): El coach debe poder intercambiar manualmente dos jugadores o bloquear un jugador en un hueco fijo y recalcular en tiempo real el impacto en la presión total del frente.
MVP de 1 Sola Pantalla
RF-01 (Filtros): Selector de Equipo Defensivo (defensiveTeam) y Situación de Juego, soportando al menos:
Todas las jugadas (all / pass rush general)
3er Down (3rd_down: down == 3)
3er Down y Largo (3rd_long: down == 3 y yardsToGo >= 7)
RF-02 (API Backend en backend/main.py): Exponer los endpoints necesarios para la vista única:
GET /api/teams → Devuelve la lista de equipos defensivos disponibles (defensiveTeam).
GET /api/optimize?team=DAL&situation=3rd_long → Devuelve:
La alineación óptima: 4 jugadores con su posición asignada, pressure_rate, sacks, hits, hurries, snaps y datos base de ficha (displayName, officialPosition, height, weight).
El puntaje total óptimo vs. la alineación habitual (y la ganancia resultante).
La matriz de alternativas / explicabilidad de desplazamientos.
RF-03 (Cancha Interactiva en dashboard/): Renderizar en la pantalla principal un diagrama SVG/CSS de la línea de golpeo (Line of Scrimmage) con los 4 defensivos colocados en su posición óptima (LE, DLT, DRT, RE), mostrando en cada marcador su nombre y su % de PressureRate.
RF-04 (Ficha del Jugador al dar clic): Al seleccionar cualquiera de los 4 defensivos en la cancha, abrir o actualizar un panel lateral o inferior con dos bloques concretos:
Sus métricas reales en el contexto/posición: Sacks, Hits, Hurries y Snaps.
Una gráfica de barras en Recharts comparando su PressureRate en la posición asignada frente a sus otras posiciones (pff_positionLinedUp).
3. Requerimientos No Funcionales (RNF)
RNF-01 (Tiempo de respuesta): El recálculo de la optimización al cambiar filtros situacionales o paquetes defensivos debe ejecutarse en menos de 500 ms (precalculando las matrices agregadas en memoria).
RNF-02 (Claridad visual para toma de decisiones): La interfaz debe seguir una estética de pizarra táctica limpia (alto contraste, código de colores intuitivo para tasas de presión bajas, medias y altas), evitando saturar al coach con tablas crudas.
RNF-03 (Trazabilidad de datos): Ningún resultado debe mostrarse sin indicar el tamaño de muestra (snaps) que respalda la estadística, garantizando rigor analítico frente al staff técnico.
RNF-04 (Reproducibilidad): Todo el procesamiento de datos y el modelo de optimización deben estar encapsulados en código modular en Python, ejecutándose localmente sin depender de servicios externos de pago.

4. Reglas de Negocio (backend/)
Métrica de eficiencia (PressureRate): Para cada jugador i en cada posición alineada j (pff_positionLinedUp), calcular su tasa ponderada de presión:


PressureRatei,j=1.5Sacksi,j+1.0Hitsi,j+0.7Hurriesi,jSnapsdePassRushi,j
PressureRate = (1.5 * Sacks + 1.0 * Hits + 0.7 * Hurries) / Snaps
Elegibilidad (limpieza): Considerar únicamente combinaciones jugador–posición con un mínimo de 5 snaps (snaps >= 5) para evitar falsos 100% en muestras pequeñas.
Restricciones realistas: Seleccionar los 4 huecos principales del frente defensivo del equipo (por ejemplo, LE, DLT, DRT, RE o los 4 valores de pff_positionLinedUp más frecuentes del equipo).
Algoritmo de asignación óptima: Buscar la asignación uno-a-uno (4 jugadores distintos → 4 posiciones) que maximice la suma total de PressureRate del frente. Puede resolverse de forma exacta sobre el Top 8 de pass rushers del equipo usando numpy o itertools.permutations.
Explicabilidad: Para cada jugador asignado, devolver su alternativa desplazada o comparación de roles (ej. "Jugador A tiene 18% en LE y 14% en RE; como Jugador B tiene 24% en LE, el algoritmo asigna B→LE y A→RE, ganando +X% de presión total").
5. Mapeo Exacto del Dataset (Solo 3 archivos para el MVP)
pffScoutingData.csv (llaves: gameId, playId, nflId): Filtrar únicamente filas donde pff_role == "Pass rush". Usar pff_positionLinedUp, pff_sack, pff_hit, pff_hurry.
plays.csv (llaves: gameId, playId): Usar defensiveTeam, down, yardsToGo, offenseFormation (para filtrar por equipo y situación).
players.csv (llave: nflId): Usar displayName, officialPosition, height, weight para la ficha del jugador.
6. Arquitectura Técnica (Stack Fijo Obligatorio)
Capa
Tecnología Fija
Propósito
Procesamiento de Datos
pandas 2.2.3, numpy 2.1.3
Carga en memoria, limpieza, cruce de tablas (plays + pffScoutingData + players) y cálculo de PressureRate por jugador y hueco.
Motor de Optimización
numpy 2.1.3 + itertools.permutations (Python 3.12.12)
Resolución exacta y ultrarrápida (< 500 ms) del problema de asignación uno-a-uno (4 jugadores → 4 huecos) sobre el Top 8 de pass rushers del equipo, sin dependencias externas.
API Backend
FastAPI 0.115.14, Uvicorn 0.34.3, Pydantic 2.11.7
Exposición de endpoints (/api/teams, /api/optimize), validación estricta de entradas y sanitización de parámetros.
Interfaz Web (UI)
React 18.3.1, TypeScript 5.7.3, Vite 5.4.21, Tailwind CSS 3.4.19
Aplicación de una sola pantalla, responsiva, con filtros cerrados, paleta NFL y panel interactivo de ficha del jugador.
Visualización de Cancha y Métricas
SVG / CSS nativo + Recharts 3.10.1
Diagrama interactivo de la línea de golpeo (Line of Scrimmage) con los 4 defensivos en su hueco óptimo y gráfica de barras comparativa de PressureRate por posición.
Pruebas
pytest 8.3.5, httpx 0.28.1
Validación de endpoints, reglas de negocio y casos borde (muestras pequeñas / parámetros inválidos).
IA (Opcional)
strands-agents 1.64.0, boto3 1.44.0 (Amazon Nova)
Generación opcional de resumen táctico en lenguaje natural para el coach (usando credenciales únicamente en .env local).


7. Criterios de Aceptación del MVP
GET /api/teams retorna los equipos disponibles y GET /api/optimize?team=DAL&situation=3rd_long devuelve exactamente 4 jugadores únicos asignados a los 4 huecos principales, junto con el puntaje óptimo vs. habitual y la matriz de alternativas.
En el dashboard se visualiza la línea de golpeo en SVG/CSS con los 4 defensivos (LE, DLT, DRT, RE), su nombre y su % de PressureRate.
Al hacer clic en un jugador, el panel lateral o inferior muestra sus Sacks, Hits, Hurries, Snaps y la gráfica en Recharts comparando su PressureRate en la posición asignada contra sus demás posiciones.
Si un jugador no tiene snaps registrados en un hueco específico, el modelo le asigna una penalización o probabilidad base baja para evitar asignaciones irreales (ej. un Nose Tackle de 330 lbs alineado como Wide-9 Edge).
La cancha muestra visualmente dónde se para cada defensivo respecto a los linieros ofensivos (C, LG, RG, LT, RT).
Se presenta claramente la ganancia esperada () frente a la alineación por defecto y una justificación legible para el coach.

8. Restricciones Técnicas y Entregables
Stack fijo: Python 3.12 (FastAPI, pandas, numpy) + React 18 / TypeScript / Tailwind / Recharts (sin instalar paquetes nuevos).
Entregables (12:40 PM meta): Repo público actualizado, README.md de 3–5 oraciones explicando el hallazgo, y .zip generado con sh .hackathon/setup.sh --entregar.
9. Reglas y Requerimientos de UX/UI y Validación de Entradas
Identidad visual y paleta de colores (NFL):
Usar una paleta sobria de alto contraste inspirada en la NFL: azul marino oficial (#013369), rojo acento (#D50A0A), blanco puro (#FFFFFF), fondos oscuros/neutros tipo pizarra táctica (#0F172A / #1E293B) y verde césped profesional (#1B5E20 / #2E7D32) exclusivamente para la cancha interactiva.
Código semántico de rendimiento en la cancha y gráficas: verde para PressureRate alto, ámbar para medio y rojo/gris para bajo.
Diseño responsivo y adaptable:
Interfaz 100% responsiva con Tailwind CSS: adaptable a teléfonos móviles (vista apilada en 1 columna, controles táctiles cómodos y cancha escalable sin desbordamiento horizontal), tablets y pantallas de escritorio/monitores amplios (layout de 2 columnas: cancha a la izquierda, ficha y gráfica a la derecha).
Usabilidad e interfaz intuitiva (Cero duplicidad):
Regla de acción única: prohibida la duplicidad de botones, filtros redundantes o controles que ejecuten la misma acción en distintas partes de la pantalla.
Jerarquía visual clara: el coach debe entender la alineación óptima y la ganancia ($\Delta\%$) en menos de 5 segundos sin necesidad de instrucciones.
Estados claros de interfaz: indicadores de carga (loading skeletons), mensajes amigables si un filtro no tiene suficientes snaps, y confirmación visual del jugador seleccionado en la cancha.
Entradas estrictas, validación y seguridad (Sanitización):
Preferir selectores cerrados: Todos los filtros principales (Equipo, Situación de Juego, Esquema) deben implementarse como menús desplegables (<select>) o botones de opción con valores predefinidos, evitando campos de texto libre innecesarios.
Validación numérica estricta: Cualquier parámetro numérico configurable (ej. umbral mínimo de snaps) debe usar inputs numéricos estrictos (type="number", rangos min/max definidos) que bloqueen letras, símbolos y valores negativos o decimales inválidos tanto en frontend como en backend (Pydantic).
Prevención de inyección de código: Sanitizar y validar todos los parámetros en FastAPI con Pydantic (lista blanca de equipos y situaciones válidas); rechazar cualquier entrada con caracteres especiales, etiquetas HTML, scripts o fragmentos de código (<script>, SQL, etc.) devolviendo 422 Unprocessable Entity.


