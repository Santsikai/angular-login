# AngularLogin

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 15.2.11.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.

## Backend (MySQL)

Se ha anadido un backend en `backend/` con Express + MySQL para persistir:

- Tableros
- Tareas
- Historial de tareas

### 1) Crear base de datos y tablas

Ejecuta el script SQL:

```sql
backend/src/db/schema.sql
```

### 2) Configurar variables de entorno

En `backend/`, copia `.env.example` a `.env` y ajusta tus credenciales de MySQL.

### 3) Instalar dependencias backend

```bash
cd backend
npm install
```

### 4) Ejecutar backend

```bash
cd backend
npm run dev
```

Por defecto levanta en `http://localhost:3001`.

### Endpoints principales

- `GET /api/health`
- `GET /api/boards?userId=1`
- `POST /api/boards`
- `DELETE /api/boards/:boardId`
- `GET /api/tasks?boardId=<boardId>`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/history?boardId=<boardId>&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/history`
- `DELETE /api/history/board/:boardId`

### Nota sobre autenticacion MySQL

Si en `GET /api/health` aparece un error parecido a `auth_gssapi_client`, el usuario de MySQL esta usando un plugin de autenticacion no soportado por `mysql2` en esta configuracion.

Puedes crear un usuario para la app con autenticacion compatible, por ejemplo:

```sql
CREATE USER 'pomodoro_app'@'localhost' IDENTIFIED WITH mysql_native_password BY 'tu_password_segura';
GRANT ALL PRIVILEGES ON pomodoro_pond.* TO 'pomodoro_app'@'localhost';
FLUSH PRIVILEGES;
```

Despues actualiza `MYSQL_USER` y `MYSQL_PASSWORD` en el `.env` del backend.
