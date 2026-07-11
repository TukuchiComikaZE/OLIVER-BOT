FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg \
  ca-certificates \
  python3 \
  python3-pip \
  && rm -rf /var/lib/apt/lists/*

ENV PIP_REQUIRE_VIRTUALENV=false
RUN pip3 install edge-tts yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "index.js"]
