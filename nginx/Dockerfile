FROM nginx:1.13
MAINTAINER Frederik Durant <frederik.durant@pandora.be>

# Replace original configuration file
RUN rm -v /etc/nginx/nginx.conf
COPY nginx/nginx.conf /etc/nginx/nginx.conf

# Just to try
COPY nginx/public /usr/share/nginx/html/public

# Start in foreground
CMD ["nginx", "-g", "daemon off;"]
