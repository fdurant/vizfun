#!/bin/sh
docker run -t --rm -p 443:443 -p 80:80 --name certbotrenewal \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /data/letsencrypt:/data/letsencrypt \
  certbot/certbot \
  renew \
  --webroot --webroot-path=/data/letsencrypt
docker-compose kill -s HUP nginx
