# Caddy with the DuckDNS plugin, which the certificate's DNS challenge needs.
FROM caddy:2-builder-alpine AS build
RUN xcaddy build --with github.com/caddy-dns/duckdns

FROM caddy:2-alpine
COPY --from=build /usr/bin/caddy /usr/bin/caddy
