# Inspired by https://hub.docker.com/r/jgkim/neo4j/~/dockerfile/
#FROM jfloff/alpine-python:2.7
FROM continuumio/anaconda
MAINTAINER Frederik Durant <frederik.durant@pandora.be>

ADD neo4jloader/populate_neo4j.py /
ADD neo4jloader/requirements.txt /

RUN pip install -r requirements.txt

CMD ["python", "./populate_neo4j.py"]
