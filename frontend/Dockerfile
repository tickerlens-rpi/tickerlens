# Stage 1: build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The browser reaches the central API and the ChatGPT relay through this
# image's nginx (see nginx.conf), on the page's own origin.
ARG VITE_API_BASE_URL=/api
ARG VITE_CODEX_RELAY_URL=/ai-proxy/codex
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_CODEX_RELAY_URL=$VITE_CODEX_RELAY_URL
RUN npm run build

# Stage 2: serve
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
