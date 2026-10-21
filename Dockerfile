# ToGo web — production image.
#
# Multi-stage: build the Vite app with Node, then serve the static bundle with nginx
# (SPA fallback so client-side routes resolve). The Supabase public config is BUILD
# TIME for Vite, so pass it as build args; only the public URL + anon key belong here.
#
#   docker build -t togo-web \
#     --build-arg VITE_SUPABASE_URL=https://YOUR-ref.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=YOUR-anon-key .
#   docker run -p 8080:80 togo-web      # http://localhost:8080

# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# --- serve stage ---
FROM nginx:1.27-alpine AS serve
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# nginx's default CMD serves the site.
