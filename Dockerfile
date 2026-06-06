# Use the official Node.js image
FROM node:22

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json yarn.lock ./

# Install dependencies

RUN corepack enable && yarn install --frozen-lockfile


# # Rebuild native modules (such as argon2) inside the container
# RUN yarn add argon2

# Copy the rest of the application
COPY . .

# Generate the Prisma client
RUN yarn prisma generate

# Build the NestJS app
RUN yarn build

# Expose the port the app will run on
EXPOSE 3000

RUN mkdir -p /app/public/image/cover /app/public/image/original /app/public/image/low_res

# Command to run the app
CMD ["sh", "-c", "yarn prisma migrate deploy && yarn start:prod"]
