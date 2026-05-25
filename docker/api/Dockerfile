FROM php:8.3-fpm-alpine AS php-base

RUN apk add --no-cache nginx wget \
    && addgroup -g 1001 rms && adduser -u 1001 -G rms -s /bin/sh -D rms

WORKDIR /var/www/html

COPY docker/api/public /var/www/html/public
COPY docker/api/nginx-default.conf /etc/nginx/http.d/default.conf

RUN chown -R rms:rms /var/www/html /var/lib/nginx /var/log/nginx \
    && mkdir -p /var/run/nginx && chown -R rms:rms /var/run/nginx

USER rms

EXPOSE 8080

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/health || exit 1

CMD ["sh", "-c", "php-fpm -D && nginx -g 'daemon off;'"]
