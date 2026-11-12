# Sunset Beach Camp

App web del recorrido de 5 experiencias, con roles de **Guía** y **Turista**.
Hecha con HTML, CSS y JavaScript puro, sin frameworks ni build. Usa **Supabase** como base de datos, login y tiempo real.
Font Awesome y supabase-js se cargan desde CDN, así que no hay que instalar nada.

## Estructura

```
sunset-beach-camp/
├── index.html            Página principal
├── css/styles.css        Estilos
├── js/config.js          URL y llave pública de Supabase
├── js/datos.js           Todo lo que habla con Supabase
├── js/app.js             Pantallas y lógica
├── database/schema.sql   Tablas, permisos (RLS), funciones, Realtime y las 5 experiencias
├── database/reset.sql    Borra TODAS las cuentas (para dejar la base en cero)
├── database/migracion_dias.sql  Agrega los 2 días a una base que ya tiene datos
└── assets/logo.webp      Logo
```

## 1. Preparar Supabase (una sola vez)

1. **SQL Editor > New query**: si quieres empezar de cero, corre primero `database/reset.sql`. Después pega todo `database/schema.sql` y dale **Run**.
2. **Authentication > Sign In / Providers > Email**: desactiva **Confirm email**. La app no usa verificación de correo: al registrarte entras directo.
3. Revisa que `js/config.js` tenga el Project URL y la Publishable key del proyecto.

## 2. Correrlo en local

Con XAMPP: prende Apache y entra a `http://localhost/sunset-beach-camp/`.
También sirve la extensión *Live Server* de VS Code o `npx serve .`

## 3. Cómo funciona

1. Un **guía** crea el grupo y queda como **admin**. Comparte el código `SBC-####`.
2. Los demás **guías** y los **turistas** se unen con ese código.
3. El admin le asigna a cada actividad su guía (se puede asignar él mismo) y le da **Iniciar recorrido**.
4. **Orden fijo:** el guía de la actividad 1 la abre; la 2 se puede abrir cuando la 1 termine, y así.
5. Cuando una actividad está abierta, el turista la ve a color y toca **Entrar**.
6. El guía ve la lista de los que entraron y **sella** a cada uno (o a todos). Solo ellos reciben la insignia.
7. El guía le da **Terminar actividad** y se habilita la siguiente.

**Recorrido de 2 días:** al crear el grupo el admin pone la fecha del día 1. En la lista de actividades elige si cada una va el Día 1 o el Día 2 (el orden fijo se respeta). Todos ven el día, la fecha y la hora de cada actividad.

Si tu base ya tenía datos antes de este cambio, corre una vez `database/migracion_dias.sql` (no borra nada).

Para probar en una sola compu: cada pestaña guarda su propia sesión, así que puedes abrir una pestaña por usuario.
Si cierras la pestaña, se cierra la sesión.

## Cambiar las experiencias

Las actividades viven en la tabla `actividades` de Supabase (Table Editor).
El campo `icono` acepta: `pot`, `leaf`, `bike`, `dice`, `tent` (se definen en el objeto `I` de `js/app.js`).

## Deploy en Vercel

Sube la carpeta a GitHub e impórtala en Vercel. No hace falta configurar nada: Vercel la sirve como sitio estático.
