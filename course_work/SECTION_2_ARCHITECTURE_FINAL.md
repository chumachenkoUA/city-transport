# 2 ПРОЄКТУВАННЯ ІНФОРМАЦІЙНОЇ СИСТЕМИ

## 2.1 Обґрунтування вибору архітектури

Для розв'язання поставлених задач автоматизації управління міським транспортом було обрано **дворівневу клієнт-серверну архітектуру** з реалізацією концепції «товстої бази даних» (thick database) [1].

Дворівнева архітектура передбачає поділ системи на два основних рівні:

1. **Клієнтський рівень** — включає шар представлення та частину шару бізнес-логіки. У розробленій системі клієнтська частина складається з:
   - *веб-інтерфейсу* на базі React 19 [2], який відповідає за відображення даних користувачеві та отримання команд;
   - *серверу-шлюзу* на базі NestJS 11 [3], який виконує функції автентифікації, валідації вхідних даних, управління сесіями (через Redis [4]) та маршрутизації запитів до бази даних.

2. **Серверний рівень (рівень даних)** — включає шар даних та основну частину шару бізнес-логіки. Реалізований на базі СУБД PostgreSQL 16 [5] з розширеннями:
   - *PostGIS* [6] — для геопросторових операцій (пошук найближчих зупинок, розрахунок відстаней);
   - *pgRouting* [7] — для побудови оптимальних маршрутів.

Вибір дворівневої архітектури з товстою базою даних для системи «Міський транспорт» зумовлений наступними факторами:

**1. Критичність фінансових операцій.** Система обробляє фінансові транзакції: продаж квитків, поповнення транспортних карток, облік штрафів. Винесення бізнес-логіки на рівень СУБД у вигляді SECURITY DEFINER функцій [8] гарантує атомарність операцій та цілісність даних незалежно від стану клієнтського програмного забезпечення. Наприклад, функція `passenger_api.buy_ticket()` виконує перевірку балансу, списання коштів та створення квитка в межах однієї транзакції з блокуванням рядка (`FOR UPDATE`).

**2. Багаторольова модель доступу.** Система підтримує 8 типів користувачів із різними правами: гість, пасажир, водій, диспетчер, контролер, менеджер, бухгалтер та департамент мерії. Реалізація розмежування доступу на рівні PostgreSQL через окремі ролі (`ct_guest_role`, `ct_passenger_role`, `ct_driver_role` тощо) та схеми API (`guest_api`, `passenger_api`, `driver_api` тощо) забезпечує надійний захист даних. Навіть при компрометації серверу-шлюзу зловмисник не зможе виконати операції поза межами прав своєї ролі.

**3. Геопросторові обчислення.** Операції пошуку найближчих зупинок за GPS-координатами, розрахунку відстаней між точками маршруту та побудови оптимальних шляхів ефективніше виконуються безпосередньо в PostgreSQL з використанням PostGIS, ніж на рівні додатку.

**4. Спрощення клієнтської частини.** Сервер-шлюз NestJS виступає «тонким клієнтом» по відношенню до бази даних: він не містить бізнес-логіки, а лише транслює запити користувачів до відповідних функцій PostgreSQL. Це спрощує розробку, тестування та підтримку системи.

Схему взаємодії компонентів дворівневої архітектури наведено на рисунку 2.1.

**[ВСТАВИТИ ДІАГРАМУ: Дворівнева архітектура:**
- **Рівень клієнта:** React (браузер) ↔ HTTP/HTTPS ↔ NestJS + Redis (сервер-шлюз)
- **Рівень даних:** PostgreSQL 16 + PostGIS + pgRouting
- Показати: JWT токен, сесії в Redis, per-user DB connections]

Рисунок 2.1 – Схема дворівневої архітектури системи «Міський транспорт»

Взаємодія компонентів відбувається наступним чином:

1. Користувач виконує дію у веб-інтерфейсі (React).
2. React надсилає HTTP-запит до сервера-шлюзу (NestJS) із JWT-токеном у заголовку Authorization.
3. Middleware NestJS витягує токен та завантажує сесію з Redis, яка містить логін і пароль користувача для підключення до БД.
4. NestJS валідує вхідні дані та створює (або перевикористовує) пул з'єднань для конкретного користувача.
5. SQL-запит виконується від імені користувача (`current_user` в PostgreSQL дорівнює логіну користувача).
6. PostgreSQL перевіряє права доступу через систему ролей та виконує SECURITY DEFINER функцію.
7. Результат повертається через NestJS до React із трансформацією у camelCase.

Порівняння обраної архітектури з альтернативою наведено в таблиці 2.1.

Таблиця 2.1 – Порівняння архітектурних підходів

| Критерій | Трирівнева (бізнес-логіка на сервері додатків) | Дворівнева з товстою БД (обрана) |
|----------|-----------------------------------------------|----------------------------------|
| Розташування бізнес-логіки | Сервер додатків (Java/Node.js) | СУБД (PL/pgSQL функції) |
| Гарантія цілісності даних | Залежить від коду додатку | Гарантується СУБД |
| Безпека при компрометації сервера | Повний доступ до БД | Обмежений правами ролі |
| Геопросторові операції | Потребує додаткових бібліотек | Нативна підтримка PostGIS |
| Складність розробки | Вища (дублювання логіки) | Нижча (логіка в одному місці) |
| Масштабованість читання | Горизонтальна (репліки додатку) | Горизонтальна (репліки БД) |

## 2.2 Обґрунтування вибору шаблону проєктування

В якості шаблону проєктування програмного додатку обрано **MVP** (Model-View-Presenter) [9]. Вибір даного патерну обумовлений специфікою веб-застосунків, де компонент представлення (View) не має прямого зв'язку з моделлю даних (Model), а вся взаємодія відбувається через посередника (Presenter).

Патерн MVP дозволяє розділити систему на три окремі блоки:

1. **Модель (Model)** — здійснює маніпулювання даними застосунку, надання даних Представнику і реагування на команди Представника шляхом зміни свого стану. У розробленій системі Модель реалізована на рівні PostgreSQL та включає:
   - *таблиці* схеми `public` (users, routes, stops, vehicles, trips, tickets, fines тощо);
   - *представлення* (Views) у схемах API для кожної ролі з фільтрацією за `current_user`;
   - *SECURITY DEFINER функції* для виконання бізнес-операцій (купівля квитка, старт рейсу, виписування штрафу).

2. **Представлення (View)** — відповідає за відображення даних користувачеві та отримання від користувача команд для роботи з даними. Представлення реалізовано на React 19 з використанням:
   - *TanStack Router* [10] — для файлової маршрутизації односторінкового застосунку;
   - *TanStack Query* [11] — для кешування та синхронізації даних із сервером;
   - *shadcn/ui + Radix UI* [12] — для побудови компонентів інтерфейсу;
   - *MapLibre GL* [13] — для візуалізації маршрутів та зупинок на інтерактивній карті.

   Важливо, що View **не має прямого з'єднання** з базою даних PostgreSQL — усі запити надсилаються до Представника.

3. **Представник (Presenter)** — відповідає за перетворення команд користувача, одержуваних від Представлення, в набір дій над Моделлю з метою її зміни, а також виконує функції передачі даних від Моделі до Представлення. У розробленій системі роль Представника виконує сервер-шлюз NestJS, який:
   - *отримує HTTP-запити* від React із командами користувача;
   - *валідує вхідні дані* за допомогою class-validator [14];
   - *автентифікує користувача* через JWT-токен та завантажує сесію з Redis;
   - *транслює команди* у виклики SECURITY DEFINER функцій PostgreSQL;
   - *трансформує відповіді* з snake_case у camelCase для зручності використання у JavaScript;
   - *обробляє помилки* PostgreSQL та повертає зрозумілі повідомлення клієнту.

Вибір патерну MVP замість MVC обумовлений наступними факторами:

**1. Відсутність прямого зв'язку View-Model.** У класичному MVC компонент View безпосередньо спостерігає за змінами в Model (паттерн Observer). У веб-застосунках це неможливо: React-компоненти не можуть підписатися на зміни в PostgreSQL. Усі дані View отримує виключно через Presenter (NestJS API).

**2. Presenter як посередник.** NestJS виконує функції посередника між View та Model:
   - View надсилає команду → Presenter валідує та транслює → Model виконує;
   - Model повертає дані → Presenter трансформує → View відображає.

**3. Тестованість.** Патерн MVP дозволяє тестувати кожен компонент окремо:
   - Model (PostgreSQL функції) — через SQL-тести;
   - Presenter (NestJS сервіси) — через unit-тести з mock-об'єктами;
   - View (React компоненти) — через component-тести.

Схему взаємодії компонентів MVP у розробленій системі наведено на рисунку 2.2.

**[ВСТАВИТИ ДІАГРАМУ: MVP патерн:**
```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│      VIEW       │         │    PRESENTER    │         │      MODEL      │
│    (React)      │         │    (NestJS)     │         │  (PostgreSQL)   │
├─────────────────┤         ├─────────────────┤         ├─────────────────┤
│ - Components    │ ──1──→  │ - Controllers   │ ──3──→  │ - Tables        │
│ - TanStack Query│         │ - Services      │         │ - Views (API)   │
│ - MapLibre GL   │ ←──6──  │ - Validators    │ ←──4──  │ - Functions     │
│                 │         │ - Redis Sessions│         │ - Triggers      │
└─────────────────┘         └─────────────────┘         └─────────────────┘

1. HTTP Request (команда користувача)
2. Валідація + автентифікація
3. SQL запит (виклик функції)
4. Результат виконання
5. Трансформація (snake_case → camelCase)
6. HTTP Response (JSON)
```
]

Рисунок 2.2 – Схема взаємодії компонентів MVP у системі «Міський транспорт»

### Приклад реалізації MVP для функції «Купівля квитка»

**View (React Component):**
```typescript
// /frontend/src/routes/passenger.tsx
function PassengerDashboard() {
  const buyTicketMutation = useMutation({
    mutationFn: (data: { cardId: number; tripId: number; price: number }) =>
      apiPost('/passenger/tickets/buy', data),
    onSuccess: () => {
      queryClient.invalidateQueries(['passenger-balance']);
      toast.success('Квиток придбано!');
    },
    onError: (error) => {
      toast.error(error.message); // "Insufficient balance"
    },
  });

  return (
    <Button onClick={() => buyTicketMutation.mutate({ cardId, tripId, price: 8 })}>
      Купити квиток (8 грн)
    </Button>
  );
}
```

**Presenter (NestJS Controller + Service):**
```typescript
// /backend/src/roles/ct-passenger/ct-passenger.controller.ts
@Controller('passenger')
export class CtPassengerController {
  @Post('tickets/buy')
  buyTicket(@Body() payload: BuyTicketDto) {
    return this.ctPassengerService.buyTicket(payload);
  }
}

// /backend/src/roles/ct-passenger/ct-passenger.service.ts
@Injectable()
export class CtPassengerService {
  async buyTicket(payload: BuyTicketDto) {
    // Presenter транслює команду до Model
    const result = await this.dbService.db.execute(sql`
      SELECT passenger_api.buy_ticket(
        ${payload.cardId}::bigint,
        ${payload.tripId}::bigint,
        ${payload.price}::numeric
      ) AS "ticketId"
    `);
    return result.rows[0];
  }
}
```

**Model (PostgreSQL SECURITY DEFINER Function):**
```sql
CREATE FUNCTION passenger_api.buy_ticket(
    p_card_id BIGINT,
    p_trip_id BIGINT,
    p_price NUMERIC
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
    v_balance NUMERIC;
    v_user_id BIGINT;
    v_ticket_id BIGINT;
BEGIN
    -- Блокування рядка для атомарності
    SELECT user_id, balance INTO v_user_id, v_balance
    FROM transport_cards WHERE id = p_card_id FOR UPDATE;

    -- Перевірка власника картки
    IF (SELECT id FROM users WHERE login = session_user) != v_user_id THEN
        RAISE EXCEPTION 'Not your card';
    END IF;

    -- Перевірка балансу
    IF v_balance < p_price THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Списання коштів
    UPDATE transport_cards SET balance = balance - p_price
    WHERE id = p_card_id;

    -- Створення квитка
    INSERT INTO tickets (card_id, trip_id, price, purchased_at)
    VALUES (p_card_id, p_trip_id, p_price, now())
    RETURNING id INTO v_ticket_id;

    RETURN v_ticket_id;
END;
$$;
```

Порівняння патернів MVC та MVP для веб-застосунків наведено в таблиці 2.2.

Таблиця 2.2 – Порівняння патернів MVC та MVP

| Критерій | MVC | MVP (обраний) |
|----------|-----|---------------|
| Зв'язок View-Model | Прямий (Observer) | Через Presenter |
| Роль Controller/Presenter | Обробка команд | Посередник + трансформація |
| Типове застосування | Desktop-додатки | Веб-застосунки |
| Тестування View | Складне (залежить від Model) | Просте (mock Presenter) |
| Придатність для REST API | Низька | Висока |

Таким чином, застосування патерну MVP у поєднанні з дворівневою архітектурою та концепцією товстої бази даних забезпечує:
- **надійність** — бізнес-логіка захищена на рівні СУБД;
- **безпеку** — розмежування доступу через PostgreSQL ролі;
- **тестованість** — кожен компонент тестується окремо;
- **масштабованість** — можливість горизонтального масштабування кожного рівня.

---

## Список використаних джерел для розділу 2

[1] Kyte T. Expert Oracle Database Architecture. — Apress, 2014. — 816 p.

[2] React Documentation. — URL: https://react.dev/

[3] NestJS Documentation. — URL: https://docs.nestjs.com/

[4] Redis Documentation. — URL: https://redis.io/documentation

[5] PostgreSQL 16 Documentation. — URL: https://www.postgresql.org/docs/16/

[6] PostGIS Documentation. — URL: https://postgis.net/documentation/

[7] pgRouting Documentation. — URL: https://docs.pgrouting.org/

[8] PostgreSQL Documentation. CREATE FUNCTION. — URL: https://www.postgresql.org/docs/16/sql-createfunction.html

[9] Potel M. MVP: Model-View-Presenter. The Taligent Programming Model for C++ and Java. — Taligent Inc., 1996.

[10] TanStack Router Documentation. — URL: https://tanstack.com/router/latest

[11] TanStack Query Documentation. — URL: https://tanstack.com/query/latest

[12] shadcn/ui Documentation. — URL: https://ui.shadcn.com/docs

[13] MapLibre GL JS Documentation. — URL: https://maplibre.org/maplibre-gl-js/docs/

[14] class-validator Documentation. — URL: https://github.com/typestack/class-validator
