Para mejorar la experiencia en dispositivos móviles (celulares y tablets), propongo realizar los siguientes ajustes de diseño "responsive" en la página de Dirección:

1.  **Lista de Documentos Adaptable**:
    *   **Actualmente**: Los elementos de la lista se muestran en una sola fila, lo que puede aplastar el texto o el botón de estado en pantallas estrechas.
    *   **Mejora**: Cambiar el diseño a **columna** en móviles y mantener la **fila** en escritorio.
        *   En móvil: El título y detalles estarán arriba, y el botón de estado debajo (con ancho completo para facilitar el toque).
        *   En escritorio: Se mantendrá la alineación lateral actual.

2.  **Modal de "Nueva Actividad" con Scroll**:
    *   **Problema**: En pantallas pequeñas (o al girar el celular), el formulario puede ser muy alto y salirse de la pantalla, haciendo imposible llegar al botón de "Registrar".
    *   **Mejora**: Limitar la altura del modal al 90% de la pantalla y añadir **scroll vertical** automático para asegurar que siempre se pueda acceder a todos los campos y botones.

3.  **Ajuste de Espaciados**:
    *   Reducir los márgenes verticales (`space-y`) en móviles para aprovechar mejor el espacio y que no se sienta todo tan separado.

4.  **Botones Táctiles**:
    *   Asegurar que los botones de acción (como el de cambiar estado) sean lo suficientemente grandes y fáciles de tocar en una pantalla táctil.

**Resumen técnico de cambios en `Direccion.tsx`:**
*   Clases `flex-col sm:flex-row` en los items de la lista.
*   Añadir `max-h-[90vh] overflow-y-auto` al contenedor del modal.
*   Ajustes de `gap` y `padding` condicionales (`p-4` en móvil, `p-6` en escritorio).

¿Te parece bien este plan para proceder con los cambios?