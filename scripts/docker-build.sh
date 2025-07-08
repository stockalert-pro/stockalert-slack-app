#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="stockalert-slack-app"
IMAGE_TAG="${1:-latest}"
DOCKERFILE="${2:-.docker/Dockerfile}"

echo -e "${GREEN}Building Docker image: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"

# Build the image
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" -f "${DOCKERFILE}" .

echo -e "${GREEN}Build completed successfully${NC}"

# Run security scan with Trivy if available
if command -v trivy &> /dev/null; then
    echo -e "${YELLOW}Running security scan with Trivy...${NC}"
    trivy image --severity HIGH,CRITICAL "${IMAGE_NAME}:${IMAGE_TAG}"
else
    echo -e "${YELLOW}Trivy not found. Install it for security scanning:${NC}"
    echo "brew install trivy"
fi

# Run Docker Scout if available
if docker scout version &> /dev/null; then
    echo -e "${YELLOW}Running security scan with Docker Scout...${NC}"
    docker scout cves "${IMAGE_NAME}:${IMAGE_TAG}"
else
    echo -e "${YELLOW}Docker Scout not available. Update Docker Desktop for built-in scanning.${NC}"
fi

# Display image info
echo -e "${GREEN}Image information:${NC}"
docker images "${IMAGE_NAME}:${IMAGE_TAG}"

# Analyze image layers
echo -e "${GREEN}Image layer analysis:${NC}"
docker history "${IMAGE_NAME}:${IMAGE_TAG}"

# Test the image
echo -e "${GREEN}Testing the image...${NC}"
docker run --rm -d --name test-container \
    -p 3001:3000 \
    -e NODE_ENV=production \
    "${IMAGE_NAME}:${IMAGE_TAG}"

# Wait for container to start
sleep 5

# Check if container is running
if docker ps | grep -q test-container; then
    echo -e "${GREEN}Container started successfully${NC}"
    
    # Test health endpoint
    if curl -f http://localhost:3001/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}Health check passed${NC}"
    else
        echo -e "${RED}Health check failed${NC}"
    fi
    
    # Stop test container
    docker stop test-container
else
    echo -e "${RED}Container failed to start${NC}"
    docker logs test-container
fi

echo -e "${GREEN}Docker build and test completed!${NC}"