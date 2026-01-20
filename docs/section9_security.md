# 9 БЕЗПЕКА ІНФОРМАЦІЙНОЇ СИСТЕМИ

Забезпечення безпеки даних є критично важливим аспектом для інформаційної системи міського транспорту. Архітектура захисту побудована на механізмах СУБД PostgreSQL і реалізує підхід thick database - доступ до даних надається через рольові схеми, представлення та функції, а прямий доступ до таблиць у схемі public обмежено. Це дозволяє реалізувати розмежування доступу на рівні БД незалежно від прикладного коду.

У системі використовується рольова модель доступу. Замість призначення прав кожному користувачу напряму створено групові ролі: `ct_guest_role`, `ct_passenger_role`, `ct_driver_role`, `ct_dispatcher_role`, `ct_controller_role`, `ct_manager_role`, `ct_municipality_role`, `ct_accountant_role`. Роль `ct_migrator` є власником схем і об’єктів, використовується для виконання міграцій і не призначається кінцевим користувачам.

У таблиці 9.1 наведено узагальнені привілеї ролей на API-схеми системи. Позначення: R - SELECT на представленнях, E - EXECUTE на функціях.

Таблиця 9.1 - Привілеї ролей на API-об’єкти БД

| Об’єкти БД | ct_guest_role | ct_passenger_role | ct_driver_role | ct_dispatcher_role | ct_controller_role | ct_manager_role | ct_municipality_role | ct_accountant_role |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| auth (функції) | E (register_passenger) | - | - | - | - | - | - | - |
| guest_api (VIEW + функції) | R/E | R/E | R/E | R/E | R/E | R/E | R/E | E* |
| passenger_api (VIEW + функції) | - | R/E | - | - | - | - | - | - |
| driver_api (VIEW + функції) | - | - | R/E | - | - | - | - | - |
| dispatcher_api (VIEW + функції) | - | - | - | R/E | - | - | - | - |
| controller_api (VIEW + функції) | - | - | - | - | R/E | - | - | - |
| manager_api (VIEW + функції) | - | - | - | - | - | R/E | - | - |
| municipality_api (VIEW + функції) | - | - | - | - | - | - | R/E | - |
| accountant_api (VIEW + функції) | - | - | - | - | - | - | - | R/E |

*Примітка: EXECUTE на функції `guest_api` додатково надано ролі `ct_accountant_role` у файлі `0010_security_hardening.sql`.

Окремим рівнем захисту є RLS політики для чутливих таблиць. Увімкнено Row Level Security для `transport_cards`, `card_top_ups`, `tickets`, `fines`, `fine_appeals`, `complaints_suggestions`, `user_gps_logs`, `trips`. Політики фільтрують записи за `session_user`, наприклад пасажир бачить лише власні картки, квитки та штрафи, а диспетчер має доступ до рейсів. Це гарантує, що навіть при наявності прав SELECT роль не отримує доступ до чужих даних.

Безпека також підтримується через SECURITY DEFINER функції з явно заданим `search_path = public, pg_catalog`, що захищає від schema poisoning. Права на функції за замовчуванням вилучаються у `ALTER DEFAULT PRIVILEGES` та через явні `REVOKE` на рівні схем, після чого у міграціях застосовуються точкові `GRANT EXECUTE` та `GRANT SELECT`. Фінальне зміцнення безпеки виконано у `0010_security_hardening.sql`, де додатково створено аудиторське представлення `public.v_function_permissions` з доступом лише для `ct_migrator`.

Повні SQL-коди налаштування ролей, RLS та прав доступу наведено у файлах міграцій `0000_init.sql` - `0010_security_hardening.sql`.
