# Use Node image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the source
COPY . .

# Build Vite app
RUN npm run build

# Expose port (Vite preview or your server port)
EXPOSE 5173

# Command to run app (for production you might use npm run preview)
CMD ["npm", "run", "dev", "--", "--host"]