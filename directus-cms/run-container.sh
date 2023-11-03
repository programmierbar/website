#!/bin/bash

echo "Use this command to verify the built docker container"
echo "For local development you can also use: 'yarn run start'"

# Check if the Docker image "programmierbar/cms" is locally available
if [[ "$(docker images -q programmierbar/cms 2> /dev/null)" == "" ]]; then
    echo "Docker image 'programmierbar/cms' is not locally available."
    echo "Please pull the image before running the container."
    echo "Or build the image locally from the project root:"
    echo "'docker build -t programmierbar/cms -f Dockerfile.directus .'"
    exit 1
fi

docker run -d --rm \
  -v "./.env:/usr/src/app/directus-cms/.env" \
  -v "./database:/usr/src/app/directus-cms/database" \
  -p "8055:8055" \
  --name "programmierbar-website" \
  "programmierbar/cms"

echo "Started container..."
