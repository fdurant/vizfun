FROM node:6.2.0
MAINTAINER Frederik Durant <frederik.durant@pandora.be>

# Prepare app directory
RUN mkdir -p /usr/src/app
ADD ./node/app /usr/src/app/

# Install dependencies
WORKDIR /usr/src/app
RUN npm install -g bower && \
    npm install && \
    bower install --config.interactive=false --allow-root

# Build the app
RUN npm build

# Expose the app port
EXPOSE 8000

# Start the app
CMD npm start
