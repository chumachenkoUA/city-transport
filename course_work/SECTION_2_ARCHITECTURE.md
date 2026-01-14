# 2 ПРОЄКТУВАННЯ ІНФОРМАЦІЙНОЇ СИСТЕМИ

Для розв'язання поставлених задач автоматизації управління міським транспортом було обрано **триланкову архітектуру** (Three-Tier Architecture) [1]. Вибір даної архітектури для проєкту міського транспорту зумовлений тим, що система обслуговує транспортну мережу міста з різними типами користувачів (пасажири, водії, диспетчери, контролери, бухгалтери тощо), тому необхідно мати єдине сховище даних, до якого звертаються всі ролі. Відокремлення рівня даних дозволяє масштабувати систему при додаванні нових маршрутів, транспортних засобів та користувачів без зміни логіки клієнтської частини.

Триланкова архітектура дозволяє реалізувати механізм **динамічної безпеки**, де сервер додатків виступає надійним посередником, що перемикає права доступу на рівні БД залежно від ролі користувача [2]. Оскільки транспортна система передбачає фінансові операції (продаж квитків, поповнення карток, облік штрафів) та критичні операції диспетчеризації (призначення водіїв, управління рейсами), де неприпустимі помилки (наприклад, подвійний продаж квитка або одночасний старт рейсу двома водіями), доцільним рішенням є винесення бізнес-логіки на рівень даних у вигляді SECURITY DEFINER функцій PostgreSQL, що забезпечує цілісність даних незалежно від роботи клієнтського ПЗ [3].

Архітектура системи складається з наступних рівнів:

- **Рівень представлення** — клієнтська частина, реалізована у вигляді односторінкового веб-застосунку (SPA) на основі бібліотеки React 19 [4] з використанням збірника Vite 7 [5], який відображається у браузері користувача. Для візуалізації маршрутів та зупинок застосовано бібліотеку MapLibre GL [6]. Взаємодія з сервером відбувається через протокол HTTP/HTTPS із використанням REST API;

- **Рівень додатку** — серверна частина, розроблена мовою TypeScript [7] з використанням фреймворку NestJS 11 [8]. Цей рівень відповідає за обробку запитів, маршрутизацію, автентифікацію користувачів та управління сесіями. Особливістю даного рівня у розробленій системі є **динамічне створення пулів з'єднань** залежно від автентифікованого користувача: кожен користувач підключається до PostgreSQL під власним логіном, а не під загальним сервісним акаунтом. Сесії зберігаються у Redis [9] з TTL 6 годин;

- **Рівень даних** — сервер бази даних PostgreSQL 16 [3] з розширеннями PostGIS [10] для геопросторових операцій та pgRouting [11] для маршрутизації. На цьому рівні реалізовано зберігання інформації, а також значну частину бізнес-логіки у вигляді збережених функцій (SECURITY DEFINER) та представлень (Views з security_barrier), що забезпечує цілісність та безпеку даних незалежно від клієнтського коду.

Взаємодія компонентів відбувається наступним чином: клієнт надсилає HTTP-запит через браузер із JWT-токеном в заголовку Authorization, middleware NestJS витягує токен та завантажує сесію з Redis (яка містить логін та пароль користувача БД), DbService створює або перевикористовує пул з'єднань для цього користувача, виконує SQL-запит від імені користувача (current_user в PostgreSQL дорівнює логіну користувача), після чого результат трансформується у camelCase та повертається клієнту у вигляді JSON.

**[ВСТАВИТИ ДІАГРАМУ: схема триланкової архітектури з React (клієнт), NestJS (сервер додатків), Redis (сесії) та PostgreSQL+PostGIS (сервер БД). Показати потік: Browser → HTTP/HTTPS → NestJS → Redis (сесія) → PostgreSQL (per-user connection)]**

Рисунок 2.1 – Схема взаємодії компонентів триланкової архітектури

## 2.1 Обґрунтування вибору архітектури

Вибір триланкової архітектури для системи «Міський транспорт» обумовлений наступними факторами:

1. **Багаторольова система.** Система підтримує 8 типів користувачів з різними правами доступу: гість, пасажир, водій, диспетчер, контролер, менеджер, бухгалтер та департамент мерії. Кожна роль має власну схему API в PostgreSQL (guest_api, passenger_api, driver_api тощо), що забезпечує ізоляцію даних на рівні СУБД.

2. **Критичність фінансових операцій.** Операції з транспортними картками (поповнення, списання за квитки) та штрафами вимагають атомарності та консистентності даних. Винесення логіки на рівень БД через SECURITY DEFINER функції гарантує коректність навіть при збоях клієнтського ПЗ.

3. **Геопросторові операції.** Пошук найближчих зупинок, розрахунок відстаней між зупинками та побудова маршрутів вимагають використання PostGIS та pgRouting, які ефективніше працюють на рівні БД, ніж на рівні додатку.

4. **Масштабованість.** Відокремлення рівнів дозволяє горизонтально масштабувати кожен компонент: додавати репліки PostgreSQL для читання, збільшувати кількість екземплярів NestJS за load balancer, використовувати Redis Cluster для сесій.

5. **Безпека.** Кожен користувач має реальний PostgreSQL-логін. Навіть якщо зловмисник отримає доступ до бекенд-коду, він не зможе виконати операції поза межами своєї ролі, оскільки права перевіряються на рівні СУБД.

Порівняння з альтернативними архітектурами наведено в таблиці 2.1.

Таблиця 2.1 – Порівняння архітектурних підходів

| Критерій | Дворівнева | Триланкова (обрана) |
|----------|------------|---------------------|
| Безпека на рівні БД | Обмежена | Повна (RLS, SECURITY DEFINER) |
| Масштабованість | Обмежена | Висока |
| Складність розробки | Низька | Середня |
| Підтримка багатьох ролей | Складна | Природна (окремі схеми API) |
| Геопросторові операції | На клієнті | На сервері БД (PostGIS) |

## 2.2 Обґрунтування вибору шаблону проєктування

В якості шаблону проєктування програмного додатку обрано **MVC** (Model-View-Controller), реалізований на базі модульної архітектури NestJS [8]. Використання даного патерну є обґрунтованим тим, що специфіка транспортної системи вимагає різного представлення для ролей: графік рейсів для водія, панель моніторингу для диспетчера, фінансові звіти для бухгалтера та карта маршрутів для пасажира. MVC дозволяє легко змінювати представлення для кожної ролі, не зачіпаючи логіку обробки даних.

Також, оскільки завдання на кшталт розрахунку відстаней через PostGIS, генерації розкладу відправлень або атомарної купівлі квитка з перевіркою балансу є складними, патерн MVC дозволяє інкапсулювати ці розрахунки в моделі (рівень БД), залишаючи контролер легким і відповідальним лише за маршрутизацію та валідацію.

Патерн MVC дозволяє розділити логіку обробки даних, інтерфейс користувача та керування потоком виконання:

- **Модель (Model)** — представляє структуру даних та правила їх обробки. У даному проєкті модель реалізована на двох рівнях:
  - *Drizzle ORM схеми* (`/backend/src/db/schema/*.ts`) — TypeScript-визначення таблиць для типобезпечних запитів;
  - *PostgreSQL функції та представлення* (`*_api` схеми) — бізнес-логіка у вигляді SECURITY DEFINER функцій.

- **Представлення (View)** — відповідає за відображення даних користувачеві. Реалізовано на React 19 з використанням:
  - *TanStack Router* [12] для файлової маршрутизації SPA;
  - *TanStack Query* [13] для кешування та синхронізації серверних даних;
  - *shadcn/ui + Radix UI* [14] для компонентів інтерфейсу;
  - *MapLibre GL* [6] для інтерактивних карт.

- **Контролер (Controller)** — забезпечує зв'язок між користувачем та системою. У NestJS контролери організовані за двома принципами:
  - *Ресурсні контролери* (`/modules/{entity}/{entity}.controller.ts`) — CRUD-операції для сутностей (routes, vehicles, stops);
  - *Рольові контролери* (`/roles/{ct-role}/{ct-role}.controller.ts`) — ендпоінти для конкретних ролей (ct-driver, ct-passenger, ct-dispatcher).

Схему взаємодії між компонентами MVC наведено на рисунку 2.2.

**[ВСТАВИТИ ДІАГРАМУ: схема MVC з показом потоку даних:
1. React Component (View) → HTTP Request
2. NestJS Controller → validates input, calls service
3. NestJS Service → executes SQL via DbService
4. PostgreSQL (Model) → RLS filter, SECURITY DEFINER
5. Response → TransformInterceptor (snake_case → camelCase)
6. TanStack Query cache → React re-render]**

Рисунок 2.2 – Схема взаємодії компонентів MVC у системі «Міський транспорт»

### Приклад реалізації MVC для функції «Старт рейсу водієм»

**View (React Component):**
```typescript
// /frontend/src/routes/driver.tsx
function DriverDashboard() {
  const startTripMutation = useMutation({
    mutationFn: (tripId: number) =>
      apiPost('/driver/trips/start', { tripId, startedAt: new Date() }),
    onSuccess: () => {
      queryClient.invalidateQueries(['driver-schedule']);
      toast.success('Рейс розпочато!');
    },
  });

  return (
    <Button onClick={() => startTripMutation.mutate(tripId)}>
      Розпочати рейс
    </Button>
  );
}
```

**Controller (NestJS):**
```typescript
// /backend/src/roles/ct-driver/ct-driver.controller.ts
@Controller('driver')
export class CtDriverController {
  @Post('trips/start')
  startTrip(@Body() payload: StartTripDto) {
    return this.ctDriverService.startTrip(payload);
  }
}
```

**Service (NestJS):**
```typescript
// /backend/src/roles/ct-driver/ct-driver.service.ts
@Injectable()
export class CtDriverService {
  async startTrip(payload: StartTripDto) {
    return this.dbService.db.execute(sql`
      SELECT driver_api.start_trip(
        ${payload.tripId}::bigint,
        ${payload.startedAt}::timestamp
      ) AS "tripId"
    `);
  }
}
```

**Model (PostgreSQL SECURITY DEFINER Function):**
```sql
-- driver_api.start_trip()
CREATE FUNCTION driver_api.start_trip(p_trip_id BIGINT, p_started_at TIMESTAMP)
RETURNS BIGINT AS $$
BEGIN
    -- Перевірка: користувач є водієм
    IF NOT EXISTS (SELECT 1 FROM drivers WHERE login = session_user) THEN
        RAISE EXCEPTION 'driver not found';
    END IF;

    -- Перевірка: рейс призначений цьому водію
    UPDATE trips SET status = 'in_progress', actual_starts_at = p_started_at
    WHERE id = p_trip_id
      AND driver_id = (SELECT id FROM drivers WHERE login = session_user)
      AND status = 'scheduled';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip not found or not scheduled for you';
    END IF;

    RETURN p_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Таким чином, патерн MVC забезпечує:
- **Розділення відповідальності:** View відповідає лише за відображення, Controller — за маршрутизацію, Model — за бізнес-логіку;
- **Тестованість:** кожен шар можна тестувати окремо (unit-тести для сервісів, e2e-тести для контролерів);
- **Безпеку:** валідація на рівні Controller (class-validator), авторизація на рівні Model (session_user);
- **Масштабованість:** додавання нових ролей або функцій не впливає на існуючий код.

---

## Список посилань для розділу 2

[1] Martin Fowler. Patterns of Enterprise Application Architecture. Addison-Wesley, 2002.

[2] PostgreSQL Documentation. Row Security Policies. — URL: https://www.postgresql.org/docs/16/ddl-rowsecurity.html

[3] PostgreSQL 16 Documentation. — URL: https://www.postgresql.org/docs/16/

[4] React Documentation. — URL: https://react.dev/

[5] Vite Documentation. — URL: https://vitejs.dev/

[6] MapLibre GL JS Documentation. — URL: https://maplibre.org/maplibre-gl-js/docs/

[7] TypeScript Documentation. — URL: https://www.typescriptlang.org/docs/

[8] NestJS Documentation. — URL: https://docs.nestjs.com/

[9] Redis Documentation. — URL: https://redis.io/documentation

[10] PostGIS Documentation. — URL: https://postgis.net/documentation/

[11] pgRouting Documentation. — URL: https://docs.pgrouting.org/

[12] TanStack Router Documentation. — URL: https://tanstack.com/router/latest

[13] TanStack Query Documentation. — URL: https://tanstack.com/query/latest

[14] shadcn/ui Documentation. — URL: https://ui.shadcn.com/docs
