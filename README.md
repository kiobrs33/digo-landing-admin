# digo-landing-admin

Panel administrativo de **DIGO HOGAR** y **DIGO EMPRESAS**: Libro de Reclamaciones, consultas de
contacto, usuarios y (próximamente) contenido de los sitios.

React 19 · Vite · TanStack Query · Tailwind 4. Consume la API de `digo-landing-backend`.

## Desarrollo local

```bash
# 1. Levanta el backend (ver su README) en http://localhost:4110
# 2. Luego:
npm install
npm run dev               # http://localhost:4113
```

En local, Vite reenvía `/api` al backend, así que no hace falta configurar nada.
Usuario inicial: el que crea `npm run db:seed` en el backend.

## Producción (Vercel)

- Dominio sugerido: `admin.digo.net.pe`.
- Variable `VITE_API_URL=https://api.digo.net.pe`.
- En el backend, agrega `https://admin.digo.net.pe` a `CORS_ORIGINS`.
- La sesión es una cookie httpOnly `SameSite=Strict` del dominio de la API: funciona porque
  `admin.digo.net.pe` y `api.digo.net.pe` son el mismo sitio (`digo.net.pe`). Si el panel se
  publicara en otro dominio, la cookie no viajaría.
