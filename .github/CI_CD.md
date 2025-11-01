# CI/CD Deployment Guide

This repository uses GitHub Actions to automatically deploy the server to a production server when code is pushed to the `main` branch.

## Overview

The CI/CD workflow:
1. ✅ Triggers on push to `main` branch or manual workflow dispatch
2. 🔐 Sets up SSH authentication
3. 📡 Connects to the production server
4. 🛑 Stops existing Docker containers
5. 🔄 Pulls latest code from git
6. 🏗️ Builds Docker containers
7. 🚀 Starts Docker containers
8. ✅ Verifies deployment

## Prerequisites

### On GitHub Repository

1. **Go to Repository Settings → Secrets and variables → Actions**
2. **Add the following secrets:**

   - `SSH_PRIVATE_KEY`: Your private SSH key (for authentication)
   - `SSH_HOST`: Your server's IP address or hostname
   - `SSH_USER`: SSH username (e.g., `root`, `ubuntu`, `deploy`)

### On Production Server

1. **Set up SSH access:**
   ```bash
   # Generate SSH key pair (if you don't have one)
   ssh-keygen -t ed25519 -C "github-actions"
   
   # Add public key to server's authorized_keys
   cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
   ```

2. **Ensure directory structure:**
   ```bash
   mkdir -p ~/eventify/server
   cd ~/eventify/server
   
   # Clone repository (if not already cloned)
   git clone <your-repo-url> .
   ```

3. **Set up environment file:**
   ```bash
   cd ~/eventify/server
   # Create .env file with your configuration (see DOCKER.md)
   nano .env
   ```

4. **Install Docker and Docker Compose:**
   ```bash
   # Install Docker (Ubuntu/Debian)
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   
   # Verify installation
   docker --version
   docker-compose --version
   ```

5. **Add user to docker group (if not root):**
   ```bash
   sudo usermod -aG docker $USER
   # Log out and back in for changes to take effect
   ```

6. **Add GitHub Actions public key to authorized_keys:**
   - Copy the public key from your GitHub Actions SSH key pair
   - Add it to `~/.ssh/authorized_keys` on the server

## GitHub Secrets Configuration

### SSH_PRIVATE_KEY
The private SSH key used to authenticate with your server.

**To get the private key:**
```bash
cat ~/.ssh/id_ed25519  # or id_rsa, depending on your key type
```

Copy the entire output including `-----BEGIN` and `-----END` lines.

### SSH_HOST
Your server's IP address or hostname.

Examples:
- `192.168.1.100`
- `example.com`
- `server.example.com`

### SSH_USER
The SSH username to connect with.

Examples:
- `root`
- `ubuntu`
- `deploy`

## Workflow Triggers

### Automatic Deployment
- **Trigger:** Push to `main` branch
- **Action:** Automatically deploys to production

### Manual Deployment
1. Go to **Actions** tab in GitHub
2. Select **Deploy to Server** workflow
3. Click **Run workflow**
4. Select branch (usually `main`)
5. Click **Run workflow**

## Troubleshooting

### SSH Connection Issues

**Error: Permission denied (publickey)**
- Verify `SSH_PRIVATE_KEY` secret is set correctly
- Ensure public key is in server's `~/.ssh/authorized_keys`
- Check file permissions: `chmod 600 ~/.ssh/authorized_keys`

**Error: Host key verification failed**
- The workflow automatically adds the host to known_hosts
- If issues persist, manually add: `ssh-keyscan -H $SSH_HOST >> ~/.ssh/known_hosts`

### Deployment Issues

**Error: Directory eventify/server not found**
- Ensure the directory exists on the server: `mkdir -p ~/eventify/server`
- Update the path in the workflow if your directory structure differs

**Error: Git pull failed**
- Verify git repository is initialized in `eventify/server`
- Check that git remote is configured: `git remote -v`
- Ensure SSH key has read access to the repository

**Error: Docker build failed**
- Check Docker is installed and running: `docker --version`
- Verify `Dockerfile` is present in the server directory
- Check Docker daemon is running: `sudo systemctl status docker`

**Error: Docker start failed**
- Verify `.env` file exists and has valid configuration
- Check Docker Compose is installed: `docker-compose --version`
- Review logs: `docker-compose logs`

### Manual Deployment

If automatic deployment fails, you can manually deploy using the provided script:

```bash
# SSH into your server
ssh user@your-server

# Navigate to project directory
cd eventify/server

# Run deployment script
./deploy.sh
```

Or manually run the commands:

```bash
cd eventify/server
docker-compose down
git pull origin main
docker-compose build --no-cache
docker-compose up -d
docker-compose logs -f
```

## Security Best Practices

1. **Use a dedicated deployment user:**
   ```bash
   sudo adduser deploy
   sudo usermod -aG docker deploy
   ```

2. **Restrict SSH access:**
   - Use key-based authentication only
   - Disable password authentication
   - Limit SSH access by IP if possible

3. **Protect secrets:**
   - Never commit secrets to the repository
   - Use GitHub Secrets for sensitive data
   - Rotate SSH keys regularly

4. **Monitor deployments:**
   - Check GitHub Actions logs regularly
   - Set up alerts for failed deployments
   - Monitor server logs: `docker-compose logs -f`

## Workflow File Location

The workflow file is located at:
```
.github/workflows/deploy.yml
```

## Manual Deployment Script

A manual deployment script is available at:
```
server/deploy.sh
```

Make it executable:
```bash
chmod +x server/deploy.sh
```

Run it:
```bash
./deploy.sh
```

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- See `server/DOCKER.md` for Docker-specific documentation

