FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY index.html ./
COPY scientific-instrument-booking.html ./

ENV NODE_ENV=production
ENV PORT=8775
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

RUN mkdir -p /data

EXPOSE 8775

CMD ["node", "server.js"]
