FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --build-from-source

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY package.json server.js db.js mailer.js index.html scientific-instrument-booking.html ./

ENV NODE_ENV=production
ENV PORT=8775
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 8775

CMD ["node", "server.js"]
