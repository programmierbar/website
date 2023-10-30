#!/bin/sh

echo "Use this command to verify the built docker container"
echo "For local development you can also use: 'yarn run start'"

docker run -d --rm \
  -v "./.env:/usr/src/app/directus-cms/.env" \
  -v "./database:/usr/src/app/directus-cms/database" \
  -p "8055:8055" \
  --name "programmierbar-website" \
  "programmierbar/cms"

echo "Started container..."
