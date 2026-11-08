# ToGo website — production image: the public info page, the operations console
# (/console) and the legal pages, served by nginx.
#
# Settings are BUILD TIME (Vite inlines them), so pass them as build args. All are
# public values; never pass a Supabase service_role key.
#
#   docker build -t togo-web \
#     --build-arg VITE_SUPABASE_URL=https://YOUR-ref.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=YOUR-anon-key \
#     --build-arg EXPO_PUBLIC_SUPPORT_EMAIL=help@example.com .
#   docker run -p 8080:80 togo-web      # http://localhost:8080

# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Operations console (Supabase public config)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
# Info site and legal pages (same names as the phone apps)
ARG EXPO_PUBLIC_SUPPORT_EMAIL
ARG EXPO_PUBLIC_LEGAL_NAME
ARG EXPO_PUBLIC_LEGAL_ADDRESS
ARG EXPO_PUBLIC_APP_STORE_URL
ARG EXPO_PUBLIC_PLAY_STORE_URL
ARG EXPO_PUBLIC_SENTRY_DSN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    EXPO_PUBLIC_SUPPORT_EMAIL=$EXPO_PUBLIC_SUPPORT_EMAIL \
    EXPO_PUBLIC_LEGAL_NAME=$EXPO_PUBLIC_LEGAL_NAME \
    EXPO_PUBLIC_LEGAL_ADDRESS=$EXPO_PUBLIC_LEGAL_ADDRESS \
    EXPO_PUBLIC_APP_STORE_URL=$EXPO_PUBLIC_APP_STORE_URL \
    EXPO_PUBLIC_PLAY_STORE_URL=$EXPO_PUBLIC_PLAY_STORE_URL \
    EXPO_PUBLIC_SENTRY_DSN=$EXPO_PUBLIC_SENTRY_DSN
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine AS serve
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx's default CMD serves the site.
