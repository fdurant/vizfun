# Inspired by https://hub.docker.com/r/jgkim/neo4j/~/dockerfile/
FROM neo4j:3.0.9
MAINTAINER Frederik Durant <frederik.durant@pandora.be>

ENV NEO4J_PLUGINS_PATH /var/lib/neo4j/plugins/

ENV NEO4J_APOC_FILE /tmp/apoc-3.0.8.6-all.jar
ENV NEO4J_APOC_URI https://github.com/neo4j-contrib/neo4j-apoc-procedures/releases/download/3.0.8.6/apoc-3.0.8.6-all.jar

RUN curl --fail --show-error --location --output $NEO4J_APOC_FILE $NEO4J_APOC_URI \
  && mv $NEO4J_APOC_FILE $NEO4J_PLUGINS_PATH
