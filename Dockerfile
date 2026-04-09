# syntax=docker/dockerfile:1.7-labs
# This dockerfile is used to publish the `ohif/app` image on dockerhub.
#
# It's a good example of how to build our static application and package it
# with a web server capable of hosting it as static content.
#
# docker build
# --------------
# If you would like to use this dockerfile to build and tag an image, make sure
# you set the context to the project's root directory:
# https://docs.docker.com/engine/reference/commandline/build/
#
#
# SUMMARY
# --------------
# This dockerfile has two stages:
#
# 1. Building the React application for production
# 2. Setting up our Nginx (Alpine Linux) image w/ step one's output
#
# Stage 1: Build the application
# docker build -t ohif/viewer:latest .
# Copy Files
FROM node:20.18.1-slim as builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ca-certificates \
    curl \
    python3 \
    && rm -rf /var/lib/apt/lists/*

COPY .docker/ca-certificates/*.crt /usr/local/share/ca-certificates/
RUN update-ca-certificates

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV NODE_OPTIONS=--use-openssl-ca

RUN curl -fsSL https://github.com/yarnpkg/yarn/releases/download/v1.22.22/yarn-v1.22.22.tar.gz \
    | tar xz -C /opt \
    && ln -sf /opt/yarn-v1.22.22/bin/yarn /usr/local/bin/yarn \
    && ln -sf /opt/yarn-v1.22.22/bin/yarn /usr/local/bin/yarnpkg

RUN mkdir /usr/src/app
WORKDIR /usr/src/app
ENV PATH=/usr/src/app/node_modules/.bin:$PATH

# Do an initial install and then a final install
COPY package.json yarn.lock preinstall.js lerna.json ./
COPY --parents ./addOns/package.json ./addOns/*/*/package.json ./extensions/*/package.json ./modes/*/package.json ./platform/*/package.json ./
# Run the install before copying the rest of the files

RUN yarn config set cafile /etc/ssl/certs/ca-certificates.crt \
    && yarn install --network-timeout 600000
RUN yarn add -W ajv@8.12.0 --exact
# Copy the local directory
COPY --link --exclude=yarn.lock --exclude=package.json --exclude=Dockerfile . .

# Build here
# After install it should hopefully be stable until the local directory changes
ENV QUICK_BUILD true
# ENV GENERATE_SOURCEMAP=false
ARG APP_CONFIG=config/default.js
ARG PUBLIC_URL=/
ENV PUBLIC_URL=${PUBLIC_URL}

RUN yarn run show:config
RUN yarn run build

# Precompress files
RUN chmod u+x .docker/compressDist.sh
RUN ./.docker/compressDist.sh

# Stage 3: Bundle the built application into a Docker container
# which runs Nginx using Alpine Linux
FROM nginxinc/nginx-unprivileged:1.27-alpine as final
#RUN apk add --no-cache bash
ARG PUBLIC_URL=/
ENV PUBLIC_URL=${PUBLIC_URL}
ARG PORT=80
ENV PORT=${PORT}
RUN rm /etc/nginx/conf.d/default.conf
USER nginx
COPY --chown=nginx:nginx .docker/Viewer-v3.x /usr/src
RUN chmod 777 /usr/src/entrypoint.sh
COPY --from=builder /usr/src/app/platform/app/dist /usr/share/nginx/html${PUBLIC_URL}
# Copy paths that are renamed/redirected generally
# Microscopy libraries depend on root level include, so must be copied
COPY --from=builder /usr/src/app/platform/app/dist/dicom-microscopy-viewer /usr/share/nginx/html/dicom-microscopy-viewer

# In entrypoint.sh, app-config.js might be overwritten, so chmod it to be writeable.
# The nginx user cannot chmod it, so change to root.
USER root
RUN chown -R nginx:nginx /usr/share/nginx/html && chmod -R 777 /usr/share/nginx/html
USER nginx
ENTRYPOINT ["/usr/src/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
