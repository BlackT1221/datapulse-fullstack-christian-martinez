# --- Etapa 1: compilación ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "docker" anula el reemplazo de environment: la SPA usa /api a través del proxy nginx.
RUN npm run build -- --configuration production,docker

# --- Etapa 2: servidor estático ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
