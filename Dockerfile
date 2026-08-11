FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm ci --production --no-audit --no-fund

# Bundle app source
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD [ "node", "server.js" ]
