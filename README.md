# Mujer Emprendedora

PWA de demostración para apoyar emprendimientos de mujeres rurales de Palmira, Valle del Cauca. Incluye capacitación TIC, perfil, creación de cuentas de demostración, inventario, registro de ventas, reportes, almacenamiento local con IndexedDB y una base inicial de API REST/ PostgreSQL.

## Estructura del repositorio

```text
mujer-emprendedora/
├── public/
│   ├── index.html       # Interfaz web y lógica local IndexedDB
│   ├── manifest.json    # Metadatos PWA
│   └── sw.js             # Caché offline del shell de la aplicación
├── src/
│   └── server.js         # Servidor Express y API REST
├── db/
│   └── schema.sql        # Tablas PostgreSQL
├── package.json
├── Dockerfile
├── .env.example
└── README.md
```

## Ejecutar localmente

Requiere Node.js 20 o superior.

```bash
npm install
npm start
```

Abre `http://localhost:3000`. La interfaz de demostración guarda perfil, productos, ventas, cursos y registros de ejemplo en IndexedDB del navegador. Los datos locales no se comparten automáticamente entre dispositivos.

## API incluida

- `GET /api/health` — estado del servidor y de la base de datos.
- `GET /api/entrepreneurs` y `POST /api/entrepreneurs`.
- `GET /api/products` y `POST /api/products`.
- `GET /api/sales?entrepreneurId=UUID` y `POST /api/sales`.

La API de datos requiere `DATABASE_URL`. Las tablas se crean ejecutando `db/schema.sql` contra una base PostgreSQL. En Railway, se puede añadir un servicio PostgreSQL y configurar la variable `DATABASE_URL` en el servicio web.

> **Importante sobre el alcance actual:** la interfaz conserva su almacenamiento IndexedDB local; las rutas REST y PostgreSQL son una base de servidor preparada en este repositorio, pero la sincronización automática entre la interfaz y el servidor todavía debe conectarse antes de afirmar que los datos se comparten entre dispositivos. El endpoint `/api/health` permite verificar que el despliegue arranca.

## Subir a GitHub desde el navegador

1. Descarga y descomprime el ZIP.
2. En GitHub, crea un repositorio llamado `mujer-emprendedora`.
3. En la raíz del repositorio, pulsa **Add file → Upload files**.
4. Abre la carpeta descomprimida y selecciona **los archivos y carpetas que están dentro** de `mujer-emprendedora-repo` (`package.json`, `src`, `public`, `db`, etc.). No subas únicamente `index.html` ni dejes todo dentro de una segunda carpeta anidada.
5. Espera a que terminen de cargarse los archivos y pulsa **Commit changes**.

Comprueba que `package.json` aparece en la primera pantalla del repositorio y que `src/server.js` y `public/index.html` aparecen dentro de sus carpetas.

## Desplegar en Railway

1. Crea un proyecto desde el repositorio de GitHub.
2. Railway detectará `package.json` y ejecutará `npm start` (también hay un Dockerfile en la raíz).
3. Para solo comprobar la aplicación, no hace falta configurar PostgreSQL: abre el dominio HTTPS generado y verifica `/api/health`.
4. Para activar las rutas de datos, añade PostgreSQL, configura `DATABASE_URL` y ejecuta `db/schema.sql` en esa base.

No subas contraseñas ni archivos `.env` a GitHub.
