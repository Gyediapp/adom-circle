# Adom Circle — production image
# Stage 1: install deps + build the client bundle
FROM node:22-alpine AS build
WORKDIR /app
# Reliable pnpm install (avoids corepack quirks on Alpine)
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml ./
# --no-frozen-lockfile tolerates minor lockfile drift (safer for solo deploys)
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build

# Stage 2: runtime
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN npm install -g pnpm@10
COPY --from=build /app ./
EXPOSE 3000
# .storage (member data) is created on first boot — mount a volume here for persistence:
#   docker run -v adom-data:/app/.storage -p 3000:3000 adomcircle
CMD ["pnpm", "start"]
