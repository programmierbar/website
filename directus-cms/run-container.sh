#!/bin/bash

echo "Use this command to verify the built docker container"
echo "For local development you can also use: 'npm run start'"

# Check if the Docker image "programmierbar/cms" is locally available
if [[ "$(docker images -q registry.digitalocean.com/programmierbar/cms 2> /dev/null)" == "" ]]; then
    echo "Docker image 'programmierbar/cms' is not locally available."
    echo "Please pull the image before running the container."
    echo "Or build the image locally from the project root:"
    echo "'docker build -t programmierbar/cms -f Dockerfile.directus .'"
    exit 1
fi

docker run -d --rm \
  -v "./.env:/usr/src/app/directus-cms/.env" \
  -v "./database:/usr/src/app/directus-cms/database" \
  -v "./extensions:/usr/src/app/directus-cms/extensions" \
  -p "8055:8055" \
  --platform linux/amd64 \
  --name "programmierbar-website" \
  "registry.digitalocean.com/programmierbar/cms:latest"

echo "Started container..."
