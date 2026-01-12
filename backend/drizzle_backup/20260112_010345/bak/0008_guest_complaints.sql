-- 1. Модифікація таблиці Complaints для підтримки гостьових звернень
ALTER TABLE public.complaints_suggestions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.complaints_suggestions ADD COLUMN route_id INTEGER REFERENCES public.routes(id);
ALTER TABLE public.complaints_suggestions ADD COLUMN vehicle_id BIGINT REFERENCES public.vehicles(id);
ALTER TABLE public.complaints_suggestions ADD COLUMN contact_info TEXT;

-- 2. Функція подачі скарги
CREATE OR REPLACE FUNCTION guest_api.submit_complaint(
    p_type text,
    p_message text,
    p_contact_info text DEFAULT NULL,
    p_route_number text DEFAULT NULL,
    p_transport_type text DEFAULT NULL,
    p_vehicle_number text DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id INT;
    v_vehicle_id BIGINT;
BEGIN
    -- Пошук ID маршруту за номером та типом транспорту
    IF p_route_number IS NOT NULL AND p_transport_type IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;
    END IF;

    -- Пошук ID транспорту за бортовим номером
    IF p_vehicle_number IS NOT NULL THEN
        SELECT id INTO v_vehicle_id
        FROM public.vehicles
        WHERE fleet_number = p_vehicle_number
        LIMIT 1;
    END IF;

    INSERT INTO public.complaints_suggestions (
        user_id, type, message, trip_id, status, created_at,
        route_id, vehicle_id, contact_info
    )
    VALUES (
        NULL, -- user_id порожній для гостей
        p_type,
        p_message,
        NULL, 
        'Подано',
        now(),
        v_route_id,
        v_vehicle_id,
        p_contact_info
    );
END;
$$;

-- 3. Надання прав
GRANT EXECUTE ON FUNCTION guest_api.submit_complaint(text, text, text, text, text, text) TO ct_guest_role;
