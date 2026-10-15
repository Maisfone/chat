FROM node:22-bookworm

# Cliente do PostgreSQL (pg_dump/psql) para o backup/restauração pelo painel admin
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# npm ci instala exatamente o que está no package-lock.json
# (inclui o CLI do prisma, usado no "prisma migrate deploy" ao iniciar)
RUN npm ci

COPY . .

RUN npx prisma generate

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "start"]
