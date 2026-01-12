-- 0013_controller_api_update.sql

-- Оновлюємо view для контролера, щоб бачити деталі останньої поїздки (Вимога 1)
DROP VIEW IF EXISTS controller_api.v_card_details CASCADE;

CREATE OR REPLACE VIEW controller_api.v_card_details AS
SELECT
    tc.id,
    tc.card_number,
    tc.balance,
    tc.user_id,
    -- Отримуємо дані про останній квиток
    (SELECT t.purchased_at
     FROM public.tickets t
     WHERE t.card_id = tc.id
     ORDER BY t.purchased_at DESC LIMIT 1) as last_usage_at,

    (SELECT r.number
     FROM public.tickets t
              JOIN public.trips tr ON tr.id = t.trip_id
              JOIN public.routes r ON r.id = tr.route_id
     WHERE t.card_id = tc.id
     ORDER BY t.purchased_at DESC LIMIT 1) as last_route_number,

    (SELECT tt.name
     FROM public.tickets t
              JOIN public.trips tr ON tr.id = t.trip_id
              JOIN public.routes r ON r.id = tr.route_id
              JOIN public.transport_types tt ON tt.id = r.transport_type_id
     WHERE t.card_id = tc.id
     ORDER BY t.purchased_at DESC LIMIT 1) as last_transport_type

FROM public.transport_cards tc;

GRANT SELECT ON controller_api.v_card_details TO ct_controller_role;
