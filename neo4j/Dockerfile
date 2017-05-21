# Inspired by https://hub.docker.com/r/jgkim/neo4j/~/dockerfile/
FROM neo4j:3.2.0
MAINTAINER Frederik Durant <frederik.durant@pandora.be>

ENV NEO4J_PLUGINS_PATH /var/lib/neo4j/plugins/

ENV NEO4J_APOC_FILE /tmp/apoc-3.2.0.3-all.jar
ENV NEO4J_APOC_URI https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/3.2.0.3/apoc-3.2.0.3-all.jar

RUN apk add --update curl && rm -rf /var/cache/apk/*

RUN curl --fail --show-error --location --output $NEO4J_APOC_FILE $NEO4J_APOC_URI \
  && mv $NEO4J_APOC_FILE $NEO4J_PLUGINS_PATH
