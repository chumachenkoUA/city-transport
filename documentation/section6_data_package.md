# 6 СТВОРЕННЯ БАЗИ ДАНИХ

База даних системи City Transport реалізована на PostgreSQL і формується послідовністю SQL-міграцій 0000-0010. У міграціях визначено структуру таблиць, обмеження цілісності, індекси, уявлення та програмну логіку, що відображає бізнес-процеси предметної області.

Безпека реалізована через рольову модель доступу, RLS та security_barrier у представленнях, а модифікації даних виконуються через SECURITY DEFINER функції. Автоматизацію забезпечують тригери, які синхронізують фінансові й операційні дані без дублювання логіки в застосунку.

## 6.1 Створення типів даних і доменів (або їх заміна)

У проєкті не використано явні CREATE TYPE або CREATE DOMAIN. Контроль допустимих значень реалізовано через CHECK constraints, що виконують роль перелічуваних типів.

```sql
CREATE TABLE "routes" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "transport_type_id" bigint NOT NULL,
  "number" varchar(10) NOT NULL,
  "direction" varchar(10) NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "paired_route_id" bigint,
  CONSTRAINT "routes_transport_type_number_direction_unique" UNIQUE("transport_type_id","number","direction"),
  CONSTRAINT "routes_direction_check" CHECK ("direction" in ('forward', 'reverse'))
);
```

Лістинг 6.1 - Приклад використання CHECK constraint як заміни ENUM для напрямку маршруту

У схемі немає окремих типів або доменів, тому значення стовпця direction обмежується через CHECK. Перелік 'forward' і 'reverse' повністю замінює enum і не дозволяє зберегти сторонні значення. Тип varchar(10) залишає гнучкість у зберіганні тексту, але контроль відбувається на рівні БД. Первинний ключ id має тип bigserial, тож PostgreSQL створює приховану sequence для автоінкременту без явного CREATE SEQUENCE. Унікальне обмеження на (transport_type_id, number, direction) гарантує унікальність маршруту в межах типу транспорту і напрямку. Поле is_active має значення за замовчуванням true і використовується для відсіву неактивних маршрутів у представленнях. Поле paired_route_id допускає NULL і використовується для зв'язку прямого та зворотного напрямків.

Джерело: 0000_init.sql

## 6.2 Створення таблиці

Нижче наведено приклад ключової таблиці trips, яка фіксує всі рейси транспорту і містить важливі обмеження цілісності.

```sql
CREATE TABLE "trips" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "route_id" bigint NOT NULL,
  "driver_id" bigint NOT NULL,
  "planned_starts_at" timestamp NOT NULL,
  "planned_ends_at" timestamp,
  "actual_starts_at" timestamp,
  "actual_ends_at" timestamp,
  "status" varchar(20) DEFAULT 'scheduled' NOT NULL,
  "passenger_count" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "trips_status_check" CHECK ("status" in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT "trips_actual_ends_after_starts_check" CHECK ("actual_ends_at" is null or "actual_starts_at" is null or "actual_ends_at" > "actual_starts_at"),
  CONSTRAINT "trips_passenger_count_check" CHECK ("passenger_count" >= 0)
);
```

Лістинг 6.2 - Запит створення таблиці trips

Таблиця trips зберігає факти рейсів і є центральною для обліку руху транспорту. Первинний ключ id має тип bigserial, що забезпечує унікальні ідентифікатори рейсів. Поля route_id і driver_id є обов'язковими та прив'язують рейс до конкретного маршруту і водія, а зовнішні ключі додаються окремо в міграції. Поля planned_starts_at і planned_ends_at описують план, сформований диспетчером. Поля actual_starts_at і actual_ends_at відображають фактичні часи та можуть бути NULL до завершення рейсу. Статус рейсу зберігається в status, має значення за замовчуванням 'scheduled' і перевіряється CHECK переліком допустимих станів. Перевірка trips_actual_ends_after_starts_check не дозволяє завершити рейс раніше його старту, якщо обидві дати задані. Лічильник пасажирів passenger_count має значення за замовчуванням 0 і контролюється на невід'ємність для коректної аналітики.

Джерело: 0000_init.sql

## 6.3 Приклад створення пов'язаних таблиць із зовнішнім ключем

Як приклад зв'язку "батьківська-дочірня" наведено таблицю tickets та її зовнішні ключі до trips і transport_cards.

```sql
CREATE TABLE "tickets" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "trip_id" bigint NOT NULL,
  "card_id" bigint NOT NULL,
  "price" numeric(12, 2) NOT NULL,
  "purchased_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "tickets_price_check" CHECK ("price" >= 0)
);

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_card_id_transport_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."transport_cards"("id") ON DELETE no action ON UPDATE no action;
```

Лістинг 6.3 - Приклад створення таблиці tickets з двома зовнішніми ключами

Таблиця tickets фіксує факт покупки квитка і пов'язує його з конкретним рейсом та карткою. Поля trip_id і card_id оголошені як NOT NULL, тому квиток не може існувати без рейсу і без платіжної картки. CHECK tickets_price_check гарантує невід'ємну вартість квитка. Зовнішній ключ tickets_trip_id_trips_id_fk контролює існування рейсу, на який куплено квиток. Зовнішній ключ tickets_card_id_transport_cards_id_fk гарантує, що оплата виконана реальною транспортною карткою. ON DELETE NO ACTION у обох зв'язках забороняє видалення рейсу або картки, якщо існують історичні квитки, що зберігає облік. ON UPDATE NO ACTION стабілізує ключі, оскільки ідентифікатори не повинні змінюватися після створення. Таким чином підтримується цілісність транзакційних даних і коректність аналітики по поїздках.

Джерело: 0000_init.sql

## 6.4 Уявлення, тригери, функції або процедури

Нижче наведені приклади реалізації читання через представлення, автоматизації через тригери та бізнес-логіки через функції API.

```sql
CREATE OR REPLACE VIEW passenger_api.v_my_trips WITH (security_barrier = true) AS
SELECT t.id as ticket_id, t.purchased_at, t.price, r.number AS route_number,
       tt.name AS transport_type,
       COALESCE(tr.actual_starts_at, tr.planned_starts_at) AS starts_at
FROM public.tickets t
JOIN public.transport_cards tc ON tc.id = t.card_id
JOIN public.users u ON u.id = tc.user_id
JOIN public.trips tr ON tr.id = t.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE u.login = session_user
ORDER BY t.purchased_at DESC;
```

Лістинг 6.4 - Приклад представлення passenger_api.v_my_trips

Представлення passenger_api.v_my_trips надає пасажиру читання власної історії поїздок без доступу до базових таблиць. Опція security_barrier = true блокує оптимізатору переміщення умов у запит і захищає від витоків через leaky views. Фільтрація WHERE u.login = session_user прив'язує результат до поточного PostgreSQL користувача, що відповідає архітектурі thick database. JOIN по transport_cards і users гарантує, що обираються лише квитки, які належать цьому пасажиру. Дані рейсу підтягуються через trips і routes, а тип транспорту - через transport_types, щоб повернути бізнес-орієнтовані атрибути. COALESCE(tr.actual_starts_at, tr.planned_starts_at) підставляє фактичний старт, якщо він відомий, інакше плановий час. ORDER BY t.purchased_at DESC формує історію від останніх покупок, що зручно для клієнтського інтерфейсу.

Джерело: 0003_passenger_api.sql

```sql
CREATE OR REPLACE FUNCTION public.trg_ticket_to_ft() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.financial_transactions(
        tx_type, source, amount, occurred_at,
        ticket_id, trip_id, card_id
    )
    VALUES (
        'income', 'ticket', NEW.price, NEW.purchased_at,
        NEW.id, NEW.trip_id, NEW.card_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_income ON public.tickets;
CREATE TRIGGER trg_ticket_income AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_to_ft();
```

Лістинг 6.5 - Приклад тригера автоматичного створення фінансової операції

Функція public.trg_ticket_to_ft є тригерною і виконується після вставки нового квитка. Вона використовує запис NEW, щоб взяти ціну, час покупки, ідентифікатор квитка, рейсу та картки. INSERT у financial_transactions створює уніфікований запис доходу з типом 'income' і джерелом 'ticket'. Така схема забезпечує єдину книгу проводок без дублювання логіки на рівні застосунку. CREATE TRIGGER trg_ticket_income визначає момент виконання AFTER INSERT, тому запис у фінансовому журналі з'являється одразу після створення квитка. FOR EACH ROW означає, що функція спрацьовує для кожного квитка окремо, включно з пакетними вставками. DROP TRIGGER IF EXISTS робить міграцію ідемпотентною і дозволяє безпечно перестворювати тригер при оновленнях. У результаті фінансові операції автоматично синхронізуються з операційними даними.

Джерело: 0006_accountant_api.sql

```sql
CREATE OR REPLACE FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_bal numeric; v_tid bigint; v_uid bigint;
BEGIN
    IF p_price <= 0 THEN
        RAISE EXCEPTION 'Price must be positive';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id) THEN
        RAISE EXCEPTION 'Trip not found';
    END IF;

    SELECT user_id, balance INTO v_uid, v_bal
    FROM public.transport_cards
    WHERE id = p_card_id
    FOR UPDATE;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Card not found';
    END IF;

    IF (SELECT id FROM public.users WHERE login = session_user) != v_uid THEN
        RAISE EXCEPTION 'Not your card';
    END IF;

    IF v_bal < p_price THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.transport_cards SET balance = balance - p_price WHERE id = p_card_id;
    INSERT INTO public.tickets (card_id, trip_id, price, purchased_at)
    VALUES (p_card_id, p_trip_id, p_price, now()) RETURNING id INTO v_tid;
    RETURN v_tid;
END;
$$;
```

Лістинг 6.6 - Приклад функції passenger_api.buy_ticket

Функція passenger_api.buy_ticket виконується як SECURITY DEFINER, тому може змінювати баланси і створювати записи, навіть якщо роль пасажира не має прямого доступу до таблиць. SET search_path = public, pg_catalog захищає від підміни об'єктів у інших схемах. Перша перевірка відсікає некоректну ціну, а друга гарантує існування рейсу. SELECT ... FOR UPDATE блокує рядок картки, щоб уникнути конкурентного списання і подвійних витрат. Порівняння user_id з (SELECT id FROM users WHERE login = session_user) забезпечує, що пасажир оплачує тільки свою картку. Перевірка балансу запобігає списанню понад доступні кошти. Операції UPDATE transport_cards і INSERT INTO tickets виконуються в межах транзакції функції, тому зберігається атомарність. Повернення id квитка дозволяє клієнтському застосунку одразу показати результат покупки.

Джерело: 0003_passenger_api.sql

У розділі наведено репрезентативні приклади створення об'єктів БД, які відображають підхід до забезпечення цілісності, безпеки і автоматизації. Повні тексти SQL-запитів створення всіх об'єктів доцільно винести в додатки, зокрема у вигляді файлів міграцій 0000_init.sql, 0001_api_structure.sql, 0002_guest_api.sql, 0003_passenger_api.sql, 0004_operational_api.sql, 0005_dispatcher_api.sql, 0006_accountant_api.sql, 0007_manager_api.sql, 0008_municipality_api.sql, 0009_controller_api.sql, 0010_security_hardening.sql.
