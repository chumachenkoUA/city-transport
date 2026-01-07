#!/bin/bash

# Кольори для виводу
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "=== Перевірка системи City Transport ==="

# 1. Перевірка Docker
echo -n "Docker контейнери: "
if docker compose ps | grep -q "Up"; then
    echo -e "${GREEN}Запущено${NC}"
else
    echo -e "${RED}Зупинено${NC}"
fi

# Витягуємо ім'я власника (POSTGRES_USER) та назву БД безпосередньо з контейнера
DB_USER=$(docker exec city-transport-db env | grep POSTGRES_USER | cut -d'=' -f2)
DB_NAME=$(docker exec city-transport-db env | grep POSTGRES_DB | cut -d'=' -f2)

# 2. Перевірка БД (View) через власника
echo -n "PostGIS Views (guest_api): "
DB_CHECK=$(docker exec city-transport-db psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_views WHERE schemaname = 'guest_api' AND viewname IN ('v_route_geometries', 'v_stop_geometries');" 2>/dev/null | tr -d '[:space:]')

if [ "$DB_CHECK" = "2" ]; then
    echo -e "${GREEN}OK${NC}"
else
    echo -e "${RED}Відсутні або помилка доступу (Користувач: $DB_USER, БД: $DB_NAME)${NC}"
fi

# 3. Перевірка Бекенду
echo -n "Бекенд (API health): "
HTTP_STATUS=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:3000/guest/transport-types)
if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}Працює (200 OK)${NC}"
else
    echo -e "${RED}Не відповідає ($HTTP_STATUS)${NC}"
fi

# 4. Перевірка Фронтенду
echo -n "Фронтенд (Vite): "
FRONT_STATUS=$(curl -o /dev/null -s -w "%{http_code}" http://localhost:5173/)
if [ "$FRONT_STATUS" = "200" ]; then
    echo -e "${GREEN}Працює (200 OK)${NC}"
else
    echo -e "${RED}Не відповідає ($FRONT_STATUS)${NC}"
fi

echo "========================================"
