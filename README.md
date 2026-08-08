# Lighthouse Dashboard

Aplicación operativa para el registro de clientes, cortes y administración de catálogos de The Lighthouse Barber Studio.

## Arquitectura

- React, Vite y TypeScript para la interfaz.
- Supabase Auth para acceso de propietarios y administradores.
- PostgreSQL con RLS como fuente operativa para clientes y cortes.
- Google Sheets se mantiene temporalmente para el resumen financiero existente.
- `message_outbox` deja preparada la integración posterior de bienvenida por WhatsApp.

## Configuración de Supabase

1. Ejecute `supabase/migrations/202607230001_lighthouse_foundation.sql` en el SQL Editor del proyecto.
2. Cree el usuario propietario en `Authentication > Users`.
3. Edite el correo de `supabase/bootstrap_owner.sql` y ejecute el archivo.
4. Desactive el registro público en Supabase Auth si no será utilizado.

La llave que recibe el navegador debe ser `publishable` o `anon`. Nunca configure una llave `secret` o `service_role` como `SUPABASE_KEY_LIGHT`; el contenedor la bloqueará si la detecta.

## Variables en Easypanel

```text
SUPABASE_URL_LIGHT=https://PROJECT_REF.supabase.co
SUPABASE_KEY_LIGHT=sb_publishable_...
VITE_GOOGLE_API_KEY=...
```

El contenedor genera `runtime-config.js` al iniciar. Las variables de Supabase no se incorporan al bundle durante el build.

## Desarrollo

```bash
npm install
npm run dev
npm run check
```

Para desarrollo local también se aceptan `VITE_SUPABASE_URL_LIGHT` y `VITE_SUPABASE_KEY_LIGHT`.

## Catálogos dinámicos

Los barberos y servicios se administran desde `Configuración`. Los registros históricos conservan una instantánea del nombre del barbero y del servicio. Un integrante con historial debe desactivarse, no eliminarse.

Cada barbero puede guardar:

- Nombre y alias.
- Estado activo.
- Orden de aparición.
- Color identificador.
- Google Calendar ID.
- Telegram Chat ID.
- Teléfono.

Los flujos de n8n deberán leer este catálogo en la fase de integración, reemplazando los ramales estáticos por barbero. La migración publica el RPC `get_integration_catalog`, que entrega en una sola consulta los barberos y servicios activos ordenados.

Desde n8n se consulta con un nodo HTTP `POST` a:

```text
https://PROJECT_REF.supabase.co/rest/v1/rpc/get_integration_catalog
```

La credencial `service_role` para esa llamada debe permanecer exclusivamente en n8n. El dashboard nunca la recibe ni la expone. Al agregar, renombrar o desactivar un barbero en `Configuración`, el siguiente llamado del flujo obtiene el catálogo actualizado sin modificar código.
