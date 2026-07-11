FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
  ffmpeg \
  ca-certificates \
  python3 \
  python3-pip \
  && rm -rf /var/lib/apt/lists/*

ENV PIP_REQUIRE_VIRTUALENV=false
ENV PIP_BREAK_SYSTEM_PACKAGES=1
RUN pip3 install --upgrade edge-tts yt-dlp

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "index.js"]
