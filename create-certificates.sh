#!/bin/sh

# Inspired by https://certbot.eff.org/docs/install.html#running-with-docker
docker run -it --rm -p 443:443 -p 80:80 --name certbot \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /data/letsencrypt:/data/letsencrypt \
  certbot/certbot \
  certonly \
  --webroot --webroot-path=/data/letsencrypt \
  --cert-name viz.fun -d viz.fun -d music.viz.fun
