# Choose a base image
FROM node:lts

# Set working directory
WORKDIR /usr/src/app

# Add package.json and package-lock.json (if available)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the app
RUN npm run build

# Start the app
CMD [ "npm", "run", "start" ]

# Expose port
EXPOSE 8055