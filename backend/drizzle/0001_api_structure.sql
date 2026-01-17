-- ============================================================================
-- 0001_api_structure.sql - Структура API схем та безпека
-- ============================================================================
-- Цей файл створює:
-- 1. API схеми для кожної ролі (guest_api, passenger_api, тощо)
-- 2. Функцію реєстрації пасажирів
-- 3. Row Level Security (RLS) політики
-- 4. Базові права доступу
--
-- АРХІТЕКТУРА "THICK DATABASE":
-- - Кожна бізнес-роль має свою схему з VIEW та функціями
-- - Ролі НЕ мають прямого доступу до таблиць public.*
-- - Всі мутації через SECURITY DEFINER функції
-- - Всі читання через VIEW з security_barrier
-- ============================================================================

-- ============================================================================
-- 1. СТВОРЕННЯ API СХЕМ
-- ============================================================================
-- Кожна схема належить ct_migrator (користувач для міграцій)
-- Ролі отримують USAGE на свої схеми
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS guest_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS driver_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS manager_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS passenger_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS controller_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS dispatcher_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS municipality_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS accountant_api AUTHORIZATION ct_migrator;

-- ============================================================================
-- 1.1 ALTER DEFAULT PRIVILEGES - Автоматичне скасування PUBLIC EXECUTE
-- ============================================================================
-- ЧОМУ ЦЕ ВАЖЛИВО:
-- За замовчуванням PostgreSQL дає PUBLIC право EXECUTE на нові функції.
-- Це означає, що БУДЬ-ЯКИЙ користувач може викликати функцію!
--
-- ALTER DEFAULT PRIVILEGES автоматично скасовує PUBLIC EXECUTE
-- для всіх нових функцій, створених ct_migrator в цих схемах.
--
-- Потім ми явно даємо GRANT EXECUTE тільки потрібним ролям.
-- Це принцип "least privilege" (мінімальних привілеїв).
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA auth
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA guest_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA driver_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA manager_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA passenger_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA controller_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA dispatcher_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA municipality_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE ct_migrator IN SCHEMA accountant_api
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- ============================================================================
-- 2. ПЕРЕДАЧА ВЛАСНОСТІ ТАБЛИЦЬ ct_migrator
-- ============================================================================
-- Drizzle ORM створює таблиці від імені superuser (postgres).
-- Щоб ct_migrator міг керувати таблицями, передаємо йому власність.
-- Це потрібно для ALTER TABLE, CREATE INDEX, тощо в наступних міграціях.
DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename != 'spatial_ref_sys'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I OWNER TO ct_migrator', obj.schemaname, obj.tablename);
    END LOOP;
END $$;

ALTER SCHEMA public OWNER TO ct_migrator;

-- ============================================================================
-- 3. GRANT USAGE ON SCHEMA - Дозвіл на використання схем
-- ============================================================================
-- USAGE - базовий дозвіл на доступ до об'єктів схеми
-- Без USAGE роль не може бачити об'єкти в схемі навіть з SELECT
--
-- public: всім ролям (для доступу до типів, sequences)
-- auth: guest (реєстрація), passenger (зміна пароля)
-- guest_api: всім (маршрути, зупинки, розклади - публічна інформація)
-- Інші схеми: тільки відповідним ролям
GRANT USAGE ON SCHEMA public TO ct_accountant_role, ct_dispatcher_role, ct_controller_role, ct_driver_role, ct_passenger_role, ct_guest_role, ct_manager_role, ct_municipality_role;
GRANT USAGE ON SCHEMA auth TO ct_guest_role, ct_passenger_role;
GRANT USAGE ON SCHEMA guest_api TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
GRANT USAGE ON SCHEMA driver_api TO ct_driver_role;
GRANT USAGE ON SCHEMA manager_api TO ct_manager_role;
GRANT USAGE ON SCHEMA passenger_api TO ct_passenger_role;
GRANT USAGE ON SCHEMA controller_api TO ct_controller_role;
GRANT USAGE ON SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT USAGE ON SCHEMA municipality_api TO ct_municipality_role;
GRANT USAGE ON SCHEMA accountant_api TO ct_accountant_role;

-- ============================================================================
-- 4. ФУНКЦІЯ РЕЄСТРАЦІЇ ПАСАЖИРІВ
-- ============================================================================
-- SECURITY DEFINER: виконується з правами власника (ct_migrator), не caller
-- Це дозволяє ct_guest_role створювати PostgreSQL ролі та записи в users
--
-- Процес реєстрації:
-- 1. Перевірка унікальності login в таблиці users
-- 2. Перевірка відсутності PostgreSQL ролі з таким іменем
-- 3. CREATE ROLE з LOGIN та паролем
-- 4. GRANT ct_passenger_role новій ролі
-- 5. INSERT в таблицю users
-- 6. При помилці - відкат (DROP ROLE)
--
-- search_path = public, pg_catalog: захист від SQL injection через schema poisoning
CREATE OR REPLACE FUNCTION auth.register_passenger(
    p_login TEXT,
    p_password TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_full_name TEXT
)
RETURNS TABLE (
    id BIGINT,
    login TEXT,
    email TEXT,
    phone TEXT,
    full_name TEXT,
    registered_at TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM users u WHERE u.login = p_login) THEN
        RAISE EXCEPTION 'Login already exists';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        RAISE EXCEPTION 'Role already exists';
    END IF;

    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
    EXECUTE format('GRANT ct_passenger_role TO %I', p_login);

    RETURN QUERY
    INSERT INTO users (login, email, phone, full_name, registered_at)
    VALUES (p_login, p_email, p_phone, p_full_name, NOW())
    RETURNING
        users.id,
        users.login::TEXT,
        users.email::TEXT,
        users.phone::TEXT,
        users.full_name::TEXT,
        users.registered_at;

EXCEPTION WHEN others THEN
    EXECUTE format('DROP ROLE IF EXISTS %I', p_login);
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION auth.register_passenger(text, text, text, text, text) TO ct_guest_role;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) - Захист на рівні рядків
-- ============================================================================
-- RLS дозволяє фільтрувати записи на рівні БД, а не додатку.
-- Навіть якщо роль отримає SELECT на таблицю, вона побачить тільки
-- "свої" записи згідно з політикою.
--
-- ENABLE ROW LEVEL SECURITY: вмикає RLS для таблиці
-- Після цього ПОТРІБНО створити політики, інакше ніхто нічого не побачить
--
-- ВАЖЛИВО: RLS НЕ діє на суперюзера та власника таблиці!
-- Тому для тестування використовуйте SET ROLE
ALTER TABLE transport_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_top_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5.1 RLS POLICIES - Політики доступу
-- ============================================================================
-- Синтаксис: CREATE POLICY name ON table FOR operation TO role USING (condition)
--
-- FOR SELECT/INSERT/UPDATE/DELETE - тип операції
-- TO role - для якої ролі діє політика
-- USING (condition) - умова для SELECT/UPDATE/DELETE (фільтр існуючих рядків)
-- WITH CHECK (condition) - умова для INSERT/UPDATE (перевірка нових значень)
--
-- session_user - PostgreSQL login поточного користувача (thick database!)
-- Це дозволяє фільтрувати записи без передачі user_id через додаток

-- Транспортні картки: пасажир бачить тільки свою картку
CREATE POLICY passenger_cards_select ON transport_cards FOR SELECT TO ct_passenger_role USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY staff_cards_select ON transport_cards FOR SELECT TO ct_controller_role, ct_dispatcher_role USING (true);

CREATE POLICY passenger_topups_select ON card_top_ups FOR SELECT TO ct_passenger_role USING (EXISTS (SELECT 1 FROM transport_cards tc WHERE tc.id = card_top_ups.card_id AND tc.user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY staff_topups_select ON card_top_ups FOR SELECT TO ct_accountant_role USING (true);

CREATE POLICY passenger_tickets_select ON tickets FOR SELECT TO ct_passenger_role USING (EXISTS (SELECT 1 FROM transport_cards tc WHERE tc.id = tickets.card_id AND tc.user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY staff_tickets_select ON tickets FOR SELECT TO ct_controller_role, ct_accountant_role USING (true);

CREATE POLICY passenger_fines_select ON fines FOR SELECT TO ct_passenger_role USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY staff_fines_select ON fines FOR SELECT TO ct_controller_role, ct_accountant_role USING (true);

CREATE POLICY driver_trips_select ON trips FOR SELECT TO ct_driver_role USING (driver_id = (SELECT id FROM drivers WHERE login = session_user));
CREATE POLICY staff_trips_select ON trips FOR SELECT TO ct_dispatcher_role USING (true);

-- fine_appeals policies
CREATE POLICY passenger_appeals_select ON fine_appeals FOR SELECT TO ct_passenger_role USING (fine_id IN (SELECT id FROM fines WHERE user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY staff_appeals_select ON fine_appeals FOR SELECT TO ct_controller_role, ct_accountant_role USING (true);

-- complaints_suggestions policies
CREATE POLICY passenger_complaints_select ON complaints_suggestions FOR SELECT TO ct_passenger_role USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY municipality_complaints_select ON complaints_suggestions FOR SELECT TO ct_municipality_role USING (true);

-- user_gps_logs policies
-- ВАЖЛИВО: це для ПАСАЖИРІВ (ct_passenger_role), не водіїв!
-- Водії логують GPS транспорту в vehicle_gps_logs через driver_api
-- Пасажири можуть логувати свою локацію (для пошуку найближчих зупинок)
CREATE POLICY passenger_gps_select ON user_gps_logs FOR SELECT TO ct_passenger_role USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY passenger_gps_insert ON user_gps_logs FOR INSERT TO ct_passenger_role WITH CHECK (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY dispatcher_user_gps_select ON user_gps_logs FOR SELECT TO ct_dispatcher_role USING (true);

-- ============================================================================
-- 6. FINAL REVOKE - Забираємо прямий доступ до public.*
-- ============================================================================
-- ПРИНЦИП THICK DATABASE:
-- Бізнес-ролі НЕ повинні мати прямого доступу до таблиць!
-- Весь доступ тільки через VIEW (читання) та SECURITY DEFINER функції (запис)
--
-- Цей блок забирає ВСІ права на таблиці, послідовності та функції в public
-- від усіх бізнес-ролей. Потім кожна міграція явно дає права на свої VIEW/функції.
DO $$
DECLARE
    role_name text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY[
        'ct_guest_role', 'ct_passenger_role', 'ct_driver_role', 'ct_dispatcher_role',
        'ct_controller_role', 'ct_manager_role', 'ct_municipality_role', 'ct_accountant_role'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', role_name);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
    END LOOP;
END $$;

-- ============================================================================
-- 7. SECURITY HARDENING - Додаткове зміцнення безпеки
-- ============================================================================
-- Цей блок забирає PUBLIC EXECUTE з УСІХ існуючих функцій.
-- ALTER DEFAULT PRIVILEGES (секція 1.1) працює тільки для НОВИХ функцій.
-- Тому для існуючих функцій потрібен явний REVOKE.
--
-- Після цього кожна міграція явно дає GRANT EXECUTE потрібним ролям.
DO $$
DECLARE
    schema_name text;
BEGIN
    -- Забираємо EXECUTE від PUBLIC на всі функції в API схемах
    FOREACH schema_name IN ARRAY ARRAY[
        'auth', 'guest_api', 'passenger_api', 'driver_api', 'dispatcher_api',
        'controller_api', 'manager_api', 'municipality_api', 'accountant_api'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', schema_name);
    END LOOP;

    -- Також забираємо на public схемі (тригери, внутрішні хелпери)
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
END $$;

-- ============================================================================
-- 8. GRANT CONNECT - Дозвіл на підключення до БД
-- ============================================================================
-- Після всіх REVOKE потрібно переконатися, що PUBLIC може підключатися.
-- Без цього нові користувачі не зможуть підключитися до БД.
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO PUBLIC', current_database());
END $$;
