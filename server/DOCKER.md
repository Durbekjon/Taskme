# Docker Setup Guide

This guide explains how to run the Eventify server using Docker and Docker Compose.

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- Docker version 20.10 or higher

## Quick Start

1. **Create `.env` file** in the `server` directory with the following variables:
   ```bash
   # Database Configuration
   DATABASE_URL=postgresql://eventify:eventify_password@postgres:5432/eventify_db?schema=public
   POSTGRES_USER=eventify
   POSTGRES_PASSWORD=eventify_password
   POSTGRES_DB=eventify_db
   POSTGRES_PORT=5432

   # Server Configuration
   SERVER_PORT=4000
   NODE_ENV=production
   APP_MODE=production

   # JWT Configuration
   JWT_SECRET=change_this_secret_in_production

   # Stripe Configuration
   STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   FRONTEND_URL=http://localhost:3000

   # AWS S3 Configuration
   S3_BUCKET_NAME=your_s3_bucket_name
   S3_BUCKET_REGION=us-east-1
   S3_ACCESS_KEY_ID=your_s3_access_key_id
   S3_SECRET_ACCESS_KEY=your_s3_secret_access_key
   ```

   **Important:** Update the values above with your actual configuration:
   - Update database credentials for production
   - Generate a strong `JWT_SECRET`
   - Add your Stripe keys
   - Configure AWS S3 credentials (if using file uploads)

3. **Build and start the services:**
   ```bash
   docker-compose up -d
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f server
   ```

5. **Stop the services:**
   ```bash
   docker-compose down
   ```

## Services

### Server
- **Port:** 4000 (configurable via `SERVER_PORT` in `.env`)
- **Health Check:** `http://localhost:4000/api/v1/payment/health`
- **API Documentation:** `http://localhost:4000/public/docs` (development mode only)
- **Auto-migration:** Database migrations run automatically on startup

### PostgreSQL
- **Port:** 5432 (configurable via `POSTGRES_PORT` in `.env`)
- **Database:** eventify_db (configurable via `POSTGRES_DB` in `.env`)
- **User:** eventify (configurable via `POSTGRES_USER` in `.env`)
- **Data Persistence:** Stored in Docker volume `postgres_data`

## Docker Commands

### Build the image
```bash
docker-compose build
```

### Start services in detached mode
```bash
docker-compose up -d
```

### View running containers
```bash
docker-compose ps
```

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f server
docker-compose logs -f postgres
```

### Stop services
```bash
docker-compose down
```

### Stop and remove volumes (⚠️ deletes database data)
```bash
docker-compose down -v
```

### Execute commands in running container
```bash
# Run Prisma commands
docker-compose exec server npx prisma migrate deploy
docker-compose exec server npx prisma studio

# Run database seed
docker-compose exec server npm run seed

# Access shell
docker-compose exec server sh
```

### Rebuild after code changes
```bash
docker-compose up -d --build
```

## Development Workflow

For development, you can:

1. **Mount source code as volume** (modify `docker-compose.yml`):
   ```yaml
   volumes:
     - .:/app
     - /app/node_modules
     - ./public/uploads:/app/public/uploads
   ```

2. **Use watch mode** (modify `docker-compose.yml` command):
   ```yaml
   command: npm run dev
   ```

## Production Deployment

For production:

1. **Set `NODE_ENV=production` and `APP_MODE=production` in `.env`**

2. **Use proper secrets:**
   - Generate a strong `JWT_SECRET`
   - Use production Stripe keys
   - Configure production S3 bucket
   - Set secure database passwords

3. **Consider:**
   - Using Docker secrets or environment variable injection
   - Setting up reverse proxy (nginx/traefik)
   - Configuring SSL/TLS
   - Setting up backup strategy for PostgreSQL volume
   - Using managed database service instead of containerized PostgreSQL

## Troubleshooting

### Database connection issues
- Ensure PostgreSQL container is healthy: `docker-compose ps`
- Check database credentials in `.env` match PostgreSQL service configuration
- Verify `DATABASE_URL` is correctly formatted

### Migration issues
- Check logs: `docker-compose logs server`
- Run migrations manually: `docker-compose exec server npx prisma migrate deploy`

### Port conflicts
- Change `SERVER_PORT` or `POSTGRES_PORT` in `.env` if ports are already in use

### Build failures
- Clear Docker cache: `docker system prune -a`
- Rebuild without cache: `docker-compose build --no-cache`

### Permission issues with uploads
- Ensure `public/uploads` directory exists and has proper permissions
- The Dockerfile creates the directory, but if mounting as volume, ensure permissions match

## Volume Management

### Backup PostgreSQL data
```bash
docker-compose exec postgres pg_dump -U eventify eventify_db > backup.sql
```

### Restore PostgreSQL data
```bash
docker-compose exec -T postgres psql -U eventify eventify_db < backup.sql
```

### Inspect volumes
```bash
docker volume ls
docker volume inspect eventify_postgres_data
```

