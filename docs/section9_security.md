# 9 БЕЗПЕКА ІНФОРМАЦІЙНОЇ СИСТЕМИ

Забезпечення безпеки даних є критично важливим аспектом для інформаційної системи міського транспорту. Архітектура захисту побудована на механізмах СУБД PostgreSQL і реалізує підхід thick database - доступ до даних надається через рольові схеми, представлення та функції, а прямий доступ до таблиць у схемі public обмежено. Це дозволяє реалізувати розмежування доступу на рівні БД незалежно від прикладного коду.

У системі використовується рольова модель доступу. Створено групові ролі: `ct_guest_role`, `ct_passenger_role`, `ct_driver_role`, `ct_dispatcher_role`, `ct_controller_role`, `ct_manager_role`, `ct_municipality_role`, `ct_accountant_role`. Роль `ct_guest` є технічним логіном для неавтентифікованих запитів і наслідує `ct_guest_role`. Роль `ct_migrator` є власником схем і об’єктів, використовується для міграцій і має право керувати іншими ролями.

Аутентифікація виконується через серверний API: при вході система намагається встановити підключення до БД від імені користувача з його логіном і паролем, після чого читає членство у ролях через `pg_has_role` і формує токен сесії. Таким чином, рівень доступу користувача прямо пов’язаний з ролями PostgreSQL. Реєстрація пасажира реалізована функцією `auth.register_passenger`, яка створює PostgreSQL роль користувача і надає їй `ct_passenger_role`.

З метою дотримання принципу мінімальних привілеїв у міграціях виконано `REVOKE` прав на public, встановлено `ALTER DEFAULT PRIVILEGES` для заборони PUBLIC EXECUTE і надано явні `GRANT` на рівні схем. Доступ до даних реалізовано через VIEW, а всі мутації виконуються через функції SECURITY DEFINER з фіксованим `search_path = public, pg_catalog` для захисту від schema poisoning. Фінальне зміцнення безпеки виконується у `0010_security_hardening.sql`, де повторно застосовано `REVOKE` і надано цільові `GRANT` для всіх API-схем.

У таблиці 9.1 наведено доступ ролей до представлень у API-схемах. Позначення: R - SELECT, E - EXECUTE, - доступ відсутній.

Таблиця 9.1 - Доступ ролей до представлень (VIEW)

| Об’єкти БД | ct_guest_role | ct_passenger_role | ct_driver_role | ct_dispatcher_role | ct_controller_role | ct_manager_role | ct_municipality_role | ct_accountant_role |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **guest_api (публічні представлення)** |  |  |  |  |  |  |  |  |
| guest_api.v_transport_types | R | R | R | R | R | R | R | - |
| guest_api.v_stops | R | R | R | R | R | R | R | - |
| guest_api.v_routes | R | R | R | R | R | R | R | - |
| guest_api.v_route_stops | R | R | R | R | R | R | R | - |
| guest_api.v_route_points | R | R | R | R | R | R | R | - |
| guest_api.v_schedules | R | R | R | R | R | R | R | - |
| guest_api.v_route_geometries | R | R | R | R | R | R | R | - |
| guest_api.v_stop_geometries | R | R | R | R | R | R | R | - |
| guest_api.v_route_stops_ordered | R | R | R | R | R | R | R | - |
| guest_api.v_route_points_ordered | R | R | R | R | R | R | R | - |
| **passenger_api (кабінет пасажира)** |  |  |  |  |  |  |  |  |
| passenger_api.v_my_cards | - | R | - | - | - | - | - | - |
| passenger_api.v_my_trips | - | R | - | - | - | - | - | - |
| passenger_api.v_my_fines | - | R | - | - | - | - | - | - |
| passenger_api.v_my_appeals | - | R | - | - | - | - | - | - |
| passenger_api.v_my_top_ups | - | R | - | - | - | - | - | - |
| passenger_api.v_my_profile | - | R | - | - | - | - | - | - |
| passenger_api.v_my_gps_history | - | R | - | - | - | - | - | - |
| **driver_api (кабінет водія)** |  |  |  |  |  |  |  |  |
| driver_api.v_profile | - | - | R | - | - | - | - | - |
| driver_api.v_my_trips | - | - | R | - | - | - | - | - |
| driver_api.v_my_scheduled_trips | - | - | R | - | - | - | - | - |
| driver_api.v_my_active_trip | - | - | R | - | - | - | - | - |
| driver_api.v_my_schedule | - | - | R | - | - | - | - | - |
| driver_api.v_my_assignments | - | - | R | - | - | - | - | - |
| driver_api.v_my_today_schedule | - | - | R | - | - | - | - | - |
| **dispatcher_api (диспетчер)** |  |  |  |  |  |  |  |  |
| dispatcher_api.v_trips_list | - | - | - | R | - | - | - | - |
| dispatcher_api.v_schedules_list | - | - | - | R | - | - | - | - |
| dispatcher_api.v_vehicle_monitoring | - | - | - | R | - | - | - | - |
| dispatcher_api.v_active_trips | - | - | - | R | - | - | - | - |
| dispatcher_api.v_scheduled_trips_today | - | - | - | R | - | - | - | - |
| dispatcher_api.v_drivers_list | - | - | - | R | - | - | - | - |
| dispatcher_api.v_vehicles_list | - | - | - | R | - | - | - | - |
| dispatcher_api.v_assignments_history | - | - | - | R | - | - | - | - |
| dispatcher_api.v_active_trip_deviations | - | - | - | R | - | - | - | - |
| **controller_api (контролер)** |  |  |  |  |  |  |  |  |
| controller_api.v_routes | - | - | - | - | R | - | - | - |
| controller_api.v_vehicles | - | - | - | - | R | - | - | - |
| controller_api.v_card_details | - | - | - | - | R | - | - | - |
| **manager_api (менеджер)** |  |  |  |  |  |  |  |  |
| manager_api.v_staff_roles | - | - | - | - | - | R | - | - |
| manager_api.v_drivers | - | - | - | - | - | R | - | - |
| manager_api.v_vehicles | - | - | - | - | - | R | - | - |
| manager_api.v_vehicle_models | - | - | - | - | - | R | - | - |
| **municipality_api (мерія)** |  |  |  |  |  |  |  |  |
| municipality_api.v_stops | - | - | - | - | - | - | R | - |
| municipality_api.v_routes | - | - | - | - | - | - | R | - |
| municipality_api.v_passenger_flow_analytics | - | - | - | - | - | - | R | - |
| municipality_api.v_complaints_dashboard | - | - | - | - | - | - | R | - |
| municipality_api.v_trip_passenger_fact | - | - | - | - | - | - | R | - |
| **accountant_api (бухгалтер)** |  |  |  |  |  |  |  |  |
| accountant_api.v_budgets | - | - | - | - | - | - | - | R |
| accountant_api.v_expenses | - | - | - | - | - | - | - | R |
| accountant_api.v_incomes | - | - | - | - | - | - | - | R |
| accountant_api.v_salary_history | - | - | - | - | - | - | - | R |
| accountant_api.v_drivers_list | - | - | - | - | - | - | - | R |
| accountant_api.v_financial_report | - | - | - | - | - | - | - | R |
| accountant_api.v_financial_transactions | - | - | - | - | - | - | - | R |
| accountant_api.v_fin_by_source | - | - | - | - | - | - | - | R |

У таблиці 9.2 наведено доступ ролей до функцій API-схем.

Таблиця 9.2 - Доступ ролей до функцій (SECURITY DEFINER)

| Об’єкти БД | ct_guest_role | ct_passenger_role | ct_driver_role | ct_dispatcher_role | ct_controller_role | ct_manager_role | ct_municipality_role | ct_accountant_role |
| --- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **auth (реєстрація)** |  |  |  |  |  |  |  |  |
| auth.register_passenger() | E | - | - | - | - | - | - | - |
| **guest_api (публічні функції)** |  |  |  |  |  |  |  |  |
| guest_api.find_nearby_stops() | E | E | E | E | E | E | E | E |
| guest_api.search_stops_by_name() | E | E | E | E | E | E | E | E |
| guest_api.plan_route() | E | E | E | E | E | E | E | E |
| guest_api.plan_route_pgrouting() | E | E | E | E | E | E | E | E |
| guest_api.submit_complaint() | E | E | E | E | E | E | E | E |
| guest_api.get_route_stops_with_timing() | E | E | E | E | E | E | E | E |
| **passenger_api (кабінет пасажира)** |  |  |  |  |  |  |  |  |
| passenger_api.submit_complaint() | - | E | - | - | - | - | - | - |
| passenger_api.submit_fine_appeal() | - | E | - | - | - | - | - | - |
| passenger_api.buy_ticket() | - | E | - | - | - | - | - | - |
| passenger_api.top_up_card() | - | E | - | - | - | - | - | - |
| passenger_api.find_routes_between() | - | E | - | - | - | - | - | - |
| passenger_api.pay_fine() | - | E | - | - | - | - | - | - |
| passenger_api.log_my_gps() | - | E | - | - | - | - | - | - |
| **driver_api (кабінет водія)** |  |  |  |  |  |  |  |  |
| driver_api.cleanup_stale_trips() | - | - | E | - | - | - | - | - |
| driver_api.start_trip() | - | - | E | - | - | - | - | - |
| driver_api.finish_trip() | - | - | E | - | - | - | - | - |
| driver_api.update_passengers() | - | - | E | - | - | - | - | - |
| driver_api.log_vehicle_gps() | - | - | E | - | - | - | - | - |
| **dispatcher_api (диспетчер)** |  |  |  |  |  |  |  |  |
| dispatcher_api.create_trip() | - | - | - | E | - | - | - | - |
| dispatcher_api.generate_daily_trips() | - | - | - | E | - | - | - | - |
| dispatcher_api.cancel_trip() | - | - | - | E | - | - | - | - |
| dispatcher_api.delete_trip() | - | - | - | E | - | - | - | - |
| dispatcher_api.create_schedule() | - | - | - | E | - | - | - | - |
| dispatcher_api.update_schedule() | - | - | - | E | - | - | - | - |
| dispatcher_api.delete_schedule() | - | - | - | E | - | - | - | - |
| dispatcher_api.assign_driver_v2() | - | - | - | E | - | - | - | - |
| dispatcher_api.calculate_delay() | - | - | - | E | - | - | - | - |
| dispatcher_api.get_departure_times() | - | - | - | E | - | - | - | - |
| dispatcher_api.get_dashboard() | - | - | - | E | - | - | - | - |
| **controller_api (контролер)** |  |  |  |  |  |  |  |  |
| controller_api.issue_fine() | - | - | - | - | E | - | - | - |
| controller_api.get_active_trips() | - | - | - | - | E | - | - | - |
| controller_api.check_card() | - | - | - | - | E | - | - | - |
| **manager_api (менеджер)** |  |  |  |  |  |  |  |  |
| manager_api.create_staff_user() | - | - | - | - | - | E | - | - |
| manager_api.remove_staff_user() | - | - | - | - | - | E | - | - |
| manager_api.hire_driver() | - | - | - | - | - | E | - | - |
| manager_api.add_vehicle() | - | - | - | - | - | E | - | - |
| manager_api.add_vehicle_v2() | - | - | - | - | - | E | - | - |
| **municipality_api (мерія)** |  |  |  |  |  |  |  |  |
| municipality_api.create_stop() | - | - | - | - | - | - | E | - |
| municipality_api.update_stop() | - | - | - | - | - | - | E | - |
| municipality_api.create_route_full() | - | - | - | - | - | - | E | - |
| municipality_api.recalculate_route_stop_distances() | - | - | - | - | - | - | E | - |
| municipality_api.get_passenger_flow() | - | - | - | - | - | - | E | - |
| municipality_api.get_complaints() | - | - | - | - | - | - | E | - |
| municipality_api.set_route_active() | - | - | - | - | - | - | E | - |
| municipality_api.update_complaint_status() | - | - | - | - | - | - | E | - |
| municipality_api.get_top_routes() | - | - | - | - | - | - | E | - |
| municipality_api.get_passenger_trend() | - | - | - | - | - | - | E | - |
| municipality_api.get_flow_summary() | - | - | - | - | - | - | E | - |
| **accountant_api (бухгалтер)** |  |  |  |  |  |  |  |  |
| accountant_api.add_income() | - | - | - | - | - | - | - | E |
| accountant_api.upsert_budget() | - | - | - | - | - | - | - | E |
| accountant_api.update_budget_actuals() | - | - | - | - | - | - | - | E |
| accountant_api.add_expense() | - | - | - | - | - | - | - | E |
| accountant_api.pay_salary() | - | - | - | - | - | - | - | E |
| accountant_api.get_financial_report() | - | - | - | - | - | - | - | E |
| accountant_api.calculate_driver_salary() | - | - | - | - | - | - | - | E |

Окремим рівнем захисту є RLS політики для чутливих таблиць. Увімкнено Row Level Security для `transport_cards`, `card_top_ups`, `tickets`, `fines`, `fine_appeals`, `complaints_suggestions`, `user_gps_logs`, `trips`. Політики фільтрують записи за `session_user`, наприклад пасажир бачить лише власні картки, квитки та штрафи, а диспетчер має доступ до рейсів. Це гарантує, що навіть при наявності прав SELECT роль не отримує доступ до чужих даних.

