# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/engine/reference/builder/

ARG NODE_VERSION=21.3.0
ARG PNPM_VERSION=8.12.0


FROM node:21-alpine3.18 as DA
RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /usr/src/app

COPY DA DA/
COPY .env .
COPY docker_scripts/da_setup.sh .
COPY client client/
RUN sh da_setup.sh

# Run the application.
CMD ["pnpm", "-C", "DA", "dev"]



FROM node as contracts-build
RUN apt-get update

RUN npm install -g pnpm@${PNPM_VERSION}

RUN apt-get install -y build-essential cmake libgmp-dev libsodium-dev nasm curl m4


WORKDIR /usr/src/app
COPY circuits circuits/
COPY contracts contracts/
COPY .env .
COPY docker_scripts/contracts_redstone.sh .
RUN curl -L https://foundry.paradigm.xyz | bash

RUN sh contracts_redstone.sh

FROM node as enclave-image

RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /usr/src/app

COPY --from=contracts-build /usr/src/app /usr/src/app
COPY .env .
COPY enclave enclave/
COPY game game/
COPY client client/
RUN pnpm install -C game
RUN pnpm install -C enclave
EXPOSE 3000

CMD ["pnpm", "-C", "enclave", "dev"]
# CMD ["sleep", "3600"]


FROM node:21-alpine3.18 as client
RUN npm install -g pnpm@${PNPM_VERSION}

WORKDIR /usr/src/app
COPY --from=contracts-build /usr/src/app /usr/src/app
COPY .env .
COPY client client/
COPY game game/
RUN pnpm install -C game
RUN pnpm install -C client

# Run the application.
CMD ["sleep", "3600"]