# City Transport - курсова робота (React + NestJS + PostgreSQL + PostGIS + Drizzle)

## 1. Ідея проєкту
City Transport - інформаційна система -Міський транспорт- з рольовим доступом.
Головний акцент - безпека і цілісність даних на рівні PostgreSQL.

Моє бачення реалізації:
- View - фронт (React)
- Controller - бек (NestJS контролери + role-модулі)
- Model - PostgreSQL + PostGIS + Drizzle + API-схеми (views + функції)

Ключовий принцип:
- бізнес-ролі НЕ мають прямого доступу до public таблиць
- доступ тільки через *_api views та SECURITY DEFINER функції
- бек підключається до БД під реальним DB-логіном користувача (щоб в pgAdmin було видно хто підключився)

## 2. Стек
Backend:
- NestJS 11, TypeScript
- Drizzle ORM + Drizzle Kit (міграції)
- PostgreSQL 16 + PostGIS 3.4
- Redis 7 (сесії)
- Auth: token + Redis session (для вибору DB-login на запит)

Frontend:
- React 19 + Vite 7 + TS
- Tailwind 4, TanStack Router, TanStack Query
- React Hook Form + Zod
- Zustand

Infra:
- Docker Compose (PostgreSQL + Redis)

## 3. Ролі (групові ролі PostgreSQL)
- ct_guest_role
- ct_passenger_role
- ct_controller_role
- ct_driver_role
- ct_dispatcher_role
- ct_manager_role
- ct_municipality_role
- ct_accountant_role
- ct_admin_role

Чек:
- [x] Усі ролі створені
- [x] Є GRANT CONNECT на БД
- [x] Є GRANT USAGE на *_api схеми
- [x] Є GRANT SELECT на потрібні views
- [x] Є GRANT EXECUTE на потрібні функції
- [x] Жодна бізнес-роль не має BYPASSRLS
- [x] Бек не запускається під superuser

## 4. Архітектура БД - thick database
### 4.1 API-схеми
Окремі схеми для ролей:
- guest_api, passenger_api, controller_api, driver_api, dispatcher_api,
  municipality_api, accountant_api, admin_api

У них лежать:
- views для читання
- функції (SECURITY DEFINER) для керуючих операцій (issue fine, start/finish trip, set passenger count тощо)

Чек:
- [ ] views зроблені без SELECT *
- [ ] views з session_user мають security_barrier = true
- [ ] функції мають SET search_path (public, pg_catalog, ...)
- [ ] функції фільтрують дані по session_user (де це потрібно)
- [ ] перевірка вхідних даних у функціях (сума > 0, lon/lat діапазони, reason not empty)

### 4.2 REVOKE доступу до public.*
Після переходу бекенду на *_api:
- [x] REVOKE SELECT/INSERT/UPDATE/DELETE на public таблиці для бізнес-ролей
- [x] REVOKE на sequences (де треба)
- [x] public залишається доступним тільки для адміна або мігратора (за потребою)

Важливо:
- поки бек ще лізе напряму в public - REVOKE не вмикати (інакше все впаде)

## 5. RLS (Row Level Security) - правила, щоб не ламалося
Мета:
- або реальний RLS з політиками,
- або ізоляція через REVOKE + views/функції (без агресивного FORCE).

Чек:
- [x] Для таблиць з RLS: ENABLE ROW LEVEL SECURITY
- [x] FORCE ROW LEVEL SECURITY використовувати обережно
- [x] Якщо SECURITY DEFINER функції читають/оновлюють таблицю (напр trips):
    - або є коректні RLS політики під цей кейс
    - або на таблиці використано NO FORCE ROW LEVEL SECURITY
- [x] Не використовувати хаотично SET row_security = off як -фікс- (потрібно узгоджувати модель доступу)

Стабільність:
- [x] driver_api.finish_trip і start_trip працюють без помилок RLS
- [x] controller_api.issue_fine працює без прямого доступу до public

## 6. Міграції без superuser
Підхід:
- 1 раз bootstrap під postgres (або власник інфри)
- усі drizzle міграції - під ct_migrator (НЕ superuser)

Bootstrap (one-time):
- [ ] створити ct_migrator (LOGIN)
- [ ] зробити owner БД або схем/об-єктів (щоб міграції могли ALTER)
- [ ] CREATE EXTENSION postgis (1 раз)

Drizzle:
- [ ] drizzle.config.ts читає DATABASE_URL_MIGRATOR якщо задано
- [ ] не редагувати meta/_journal.json вручну - тільки нові міграції

## 7. Redis sessions + реальний DB-login
Модель:
- /auth/login видає token
- token -> Redis session (login + секрет)
- на кожен HTTP запит бек дістає session і відкриває пул під user login
- це дає видимість в pgAdmin хто підключився

Чек стабільності:
- [ ] DbService не створює безлімітні пули (кеш по login або контроль закриття)
- [ ] TTL сесії заданий (SESSION_TTL_SECONDS)
- [ ] logout видаляє сесію і прибирає кеш пула (якщо кеш є)

## 8. Контроль в pgAdmin
- [ ] Dashboard - Sessions: видно session_user/current_user і активні підключення
- [ ] (опційно) log_connections = on, log_disconnections = on для демонстрації

## 9. План робіт (що вже зроблено і що ще зробити)
Зроблено:
- [x] Міграції таблиць + PostGIS
- [x] API-схеми + views для ролей
- [x] REVOKE public.* для бізнес-ролей після переходу
- [x] Controller + Driver переведені на *_api views/функції
- [x] Redis session + реальний DB-login
- [x] municipality_api: stops, routes designer, passenger-flow, complaints
- [x] accountant_api: expenses, salaries, report
- [x] Фронт сторінки для municipality + accountant

Треба зробити далі:
- [ ] Фінальні перевірки RLS/FORCE, щоб функції не ламалися і бек не падав
- [ ] Оптимізація продуктивності GPS-трекінгу (якщо знадобиться)
- [ ] Тестування сценаріїв з великою кількістю одночасних поїздок

## 10. Головний sanity checklist (щоб бек не падав)
- [x] бізнес-ролі не мають доступу до public.*
- [x] у кожної ролі є доступ до своїх *_api схем (USAGE + SELECT/EXECUTE)
- [x] SECURITY DEFINER функції мають search_path і перевірки
- [x] RLS/FORCE узгоджені з функціями (немає помилок 42501)
- [ ] DbService не тече пулами (потребує стрес-тесту)
- [x] Redis TTL і logout працюють
