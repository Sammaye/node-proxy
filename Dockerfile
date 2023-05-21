FROM node:hydrogen-alpine3.15 AS base

FROM base AS setup
ENV LANG="C.UTF-8" \
    TZ="Etc/UTC"
RUN apk add --no-cache git make gcc g++ python3
WORKDIR /usr/src/app
COPY package.json .
COPY package-lock.json .
RUN npm install
COPY . .
RUN rm -rf docker

FROM setup as dev
CMD ["sh", "-c", "while sleep 3600; do :; done"]
EXPOSE 80 443

FROM setup as prod
CMD ["npm", "run", "start"]
EXPOSE 80 443
