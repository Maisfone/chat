# build stage
FROM node:18 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

# Permite configurar as variáveis do Vite em tempo de build
ARG VITE_API_URL
ARG VITE_SOCKET_URL
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}

COPY . .

RUN npm run build

# production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Configura fallback para SPA (React Router) e gzip básico
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
