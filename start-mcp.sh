#!/bin/bash

echo "Starting Valhalla MCP..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "ERROR: Docker is not running. Please start Docker first."
    exit 1
fi

# Build the MCP server
echo "Building MCP server..."
npm run build

if [ $? -ne 0 ]; then
    echo "ERROR: Build failed!"
    exit 1
fi

# Start Valhalla service
echo "Starting Valhalla service..."
docker compose up -d valhalla

# Wait for Valhalla to be ready
echo "Waiting for Valhalla to be ready (Monaco dataset is small, should be quick)..."
timeout=180
counter=0

while [ $counter -lt $timeout ]; do
    if curl -s http://localhost:8002/status > /dev/null; then
        echo "SUCCESS: Valhalla is ready!"
        break
    fi
    sleep 10
    counter=$((counter + 10))
    echo "Still waiting... ($counter/$timeout seconds)"
done

if [ $counter -ge $timeout ]; then
    echo "ERROR: Valhalla failed to start within $timeout seconds"
    echo "TIP: Try running: docker compose logs valhalla"
    exit 1
fi

# Run integration tests
echo "Running integration tests..."
npm test -- tests/integration/

echo ""
echo "MCP Setup Complete!"
echo ""
echo "Next Steps:"
echo "1. Copy claude_mcp_config.json content to your Claude Desktop config"
echo "2. Update the 'cwd' path in the config to match your actual path"
echo "3. Restart Claude Desktop"
echo "4. Test with commands like:"
echo "   - 'Calculate route from Monaco-Ville to Monte Carlo'"
echo "   - 'Show 10-minute drive isochrone from Monaco center'"
echo ""
echo "To stop services: docker compose down" 
