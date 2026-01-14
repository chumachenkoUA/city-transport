# Задачі користувачів інформаційної системи "Міський транспорт"

## Табл. 1 - Задачі користувачів

| Задачі | Вхідна інформація | Вихідна інформація |
|--------|-------------------|-------------------|
| **Пасажир (не зареєстрований)** |||
| 1. Перегляд типів транспорту | - | Список типів транспорту: ID, назва |
| 2. Перегляд маршрутів | ID типу транспорту (опційно) | Список маршрутів: ID, номер, напрямок, тип транспорту |
| 3. Перегляд зупинок | |||
| 3.1 Перегляд найближчих зупинок | GPS дані користувача (довжина, широта), радіус (м), ліміт | Список найближчих зупинок: ID, назва, координати, відстань (м) |
| 3.2 Пошук зупинок за назвою | Текст запиту, ліміт | Список зупинок: ID, назва, координати |
| 4. Перегляд руху транспорту через зупинку | ID зупинки | Список маршрутів: ID маршруту, номер маршруту, тип транспорту, напрямок, інтервал (хв), приблизний час прибуття (хв) |
| 5. Перегляд маршруту | |||
| 5.1 Перегляд зупинок маршруту | ID маршруту або (номер маршруту + ID типу транспорту + напрямок) | Список зупинок: ID, назва, координати, відстань до наступної (км) |
| 5.2 Перегляд точок маршруту | ID маршруту або (номер маршруту + ID типу транспорту + напрямок) | Список точок: ID, координати, посилання на попередню/наступну точку |
| 5.3 Перегляд геометрії маршруту | ID маршруту або (номер маршруту + ID типу транспорту + напрямок) | GeoJSON геометрія маршруту: routeId, number, transportType, direction, geometry |
| 5.4 Перегляд геометрії всіх маршрутів | ID типу транспорту (опційно) | Список GeoJSON геометрій всіх маршрутів |
| 5.5 Перегляд геометрій зупинок | - | Список зупинок з GeoJSON геометрією: ID, назва, geometry |
| 6. Планування поїздки з точки А в точку Б | |||
| 6.1 Пошук маршрутів між точками | Координати точки А, координати точки Б, радіус пошуку (м) | Список маршрутів: routeId, routeNumber, transportType, direction, fromStopId, toStopId, distanceKm, travelMinutes |
| 6.2 Планування маршруту з пересадками | Координати точки А, координати точки Б, радіус, макс. час очікування, макс. кількість результатів | Список варіантів маршруту: totalTimeMin, totalDistanceKm, transferCount, segments (з інформацією про кожен сегмент та пересадки) |
| 6.3 Перегляд геометрії сегменту маршруту | ID маршруту, ID початкової зупинки, ID кінцевої зупинки | GeoJSON LineString з координатами сегменту |
| 7. Перегляд розкладу руху | ID маршруту або (номер + тип транспорту + напрямок), ID зупинки (опційно) | Інформація про маршрут, розклад (час початку/закінчення, інтервал), список відправлень, список прибуттів на зупинку |
| 8. Подача скарги чи пропозиції | Тип (скарга/пропозиція), текст повідомлення, контактна інформація (опційно), номер маршруту (опційно), тип транспорту (опційно), номер транспорту (опційно) | - |
| **Пасажир (зареєстрований)** |||
| 1. Перегляд зупинок | GPS дані користувача (довжина, широта), радіус, ліміт | Список найближчих зупинок: ID, назва, координати, відстань (м) |
| 2. Перегляд руху транспорту через зупинку | ID зупинки | Список маршрутів: stopId, routeId, routeNumber, transportType, approximateInterval |
| 3. Перегляд зупинок маршруту | ID маршруту або (номер + тип транспорту + напрямок) | Список зупинок: ID, назва, координати |
| 4. Перегляд точок маршруту | ID маршруту або (номер + тип транспорту + напрямок) | Список точок маршруту |
| 5. Планування маршруту з пересадками | Координати точки А, координати точки Б, радіус, макс. час очікування, макс. результатів | Список варіантів маршруту з сегментами та пересадками |
| 6. Перегляд розкладу руху | ID маршруту або (номер + тип транспорту + напрямок) | Розклад маршруту: час початку/закінчення, інтервал, список відправлень |
| 7. Перегляд профілю | - | Дані профілю: ID, login, fullName, email, phone, registeredAt |
| 8. Перегляд транспортної картки | - | Дані картки: ID, cardNumber, balance, lastUsedAt |
| 9. Поповнення транспортної картки | Номер картки, сума | - |
| 10. Купівля квитка | ID картки, ID рейсу, ціна | ID квитка |
| 11. Перегляд списку здійснених поїздок | - | Список поїздок: ID, routeNumber, transportType, cost, startedAt |
| 12. Перегляд штрафів | - | Список штрафів: ID, amount, reason, status, issuedAt |
| 13. Перегляд деталей штрафу | ID штрафу | Деталі штрафу: ID, amount, reason, status, issuedAt |
| 14. Оскарження штрафу | ID штрафу, текст пояснення | ID апеляції |
| 15. Оплата штрафу | ID штрафу, ID картки | - |
| 16. Подача скарги чи пропозиції | Тип, текст повідомлення, номер маршруту (опційно), тип транспорту (опційно), номер транспорту (опційно) | - |
| **Водій** |||
| 1. Перегляд профілю | - | Дані водія: ID, login, fullName, email, phone, driverLicenseNumber, licenseCategories |
| 2. Перегляд робочого графіка | Дата (опційно) | Дані водія, дата, призначений транспорт, маршрут, тип транспорту, розклад, список рейсів (з часами, затримкою, зупинками) |
| 3. Перегляд запланованих рейсів | - | Список запланованих рейсів: ID, routeId, routeNumber, direction, transportType, vehicleId, fleetNumber, plannedStartsAt, plannedEndsAt, status |
| 4. Перегляд активного рейсу | - | Інформація про активний рейс: ID, routeId, routeNumber, direction, transportType, vehicleId, fleetNumber, plannedStartsAt, actualStartsAt, passengerCount, startDelayMin |
| 5. Перегляд маршруту | |||
| 5.1 Перегляд зупинок маршруту | ID маршруту або номер маршруту | Список зупинок: ID, stopId, stopName, координати, distanceToNextKm, prevRouteStopId, nextRouteStopId |
| 5.2 Перегляд точок маршруту | ID маршруту або номер маршруту | Список точок: ID, routeId, координати, prevRoutePointId, nextRoutePointId |
| 6. Початок та завершення рейсу | |||
| 6.1 Відмітка "Початок рейсу" | ID рейсу (опційно), час початку (опційно) | ID рейсу |
| 6.2 Відмітка "Завершення рейсу" | Час завершення (опційно) | ID рейсу |
| 7. Введення кількості пасажирів | ID рейсу, кількість пасажирів | ok: true |
| 8. Логування GPS позиції | Довжина, широта, час (опційно) | ok: true |
| **Диспетчер** |||
| 1. Перегляд списку маршрутів | - | Список маршрутів: ID, number, direction, transportTypeId, transportTypeName |
| 2. Формування/оновлення розкладу | |||
| 2.1 Створення нового розкладу | routeId, vehicleId/fleetNumber, workStartTime, workEndTime, intervalMin | ID розкладу |
| 2.2 Редагування наявного розкладу | ID розкладу, routeId (опційно), vehicleId (опційно), workStartTime (опційно), workEndTime (опційно), intervalMin (опційно) | ok: true |
| 2.3 Видалення розкладу | ID розкладу | ok: true |
| 3. Перегляд розкладів | - | Список розкладів: ID, routeId, routeNumber, direction, transportType, workStartTime, workEndTime, intervalMin, vehicleId, fleetNumber |
| 4. Перегляд деталей розкладу | ID розкладу | Детальна інформація: routeNumber, routeDirection, transportType, fleetNumber, workStartTime, workEndTime, intervalMin, routeDurationMin, routeEndTime, список відправлень, список зупинок |
| 5. Перегляд транспортних засобів | - | Список транспорту: ID, fleetNumber, routeId, routeNumber, capacity |
| 6. Перегляд водіїв | - | Список водіїв: ID, login, fullName, phone, driverLicenseNumber |
| 7. Призначення водія на маршрут | driverId/driverLogin, vehicleId/fleetNumber | ok: true |
| 8. Перегляд призначень | - | Історія призначень: ID, driverId, driverName, driverLogin, driverPhone, vehicleId, fleetNumber, routeId, routeNumber, direction, transportTypeId, transportType, assignedAt |
| 9. Управління рейсами | |||
| 9.1 Перегляд рейсів | status (опційно) | Список рейсів: ID, routeId, routeNumber, direction, transportType, vehicleId, fleetNumber, driverId, driverName, driverLogin, plannedStartsAt, plannedEndsAt, actualStartsAt, actualEndsAt, status, passengerCount, startDelayMin |
| 9.2 Створення рейсу | routeId, driverId, plannedStartsAt, plannedEndsAt (опційно) | ID рейсу |
| 9.3 Генерування денних рейсів | routeId, driverId, date, startTime, endTime, intervalMin, tripDurationMin (опційно) | count (кількість створених рейсів) |
| 9.4 Скасування рейсу | ID рейсу | ok: true |
| 9.5 Видалення рейсу | ID рейсу | ok: true |
| 10. Контроль за виконанням графіка | |||
| 10.1 Перегляд активних рейсів | - | Список активних рейсів: ID, routeNumber, fleetNumber, fullName, plannedStartsAt, actualStartsAt, startDelayMin |
| 10.2 Перегляд відхилень від розкладу | - | Список відхилень: tripId, routeNumber, fleetNumber, driverName, plannedStartsAt, actualStartsAt, delayMinutes |
| 10.3 Моніторинг позиції транспорту | Номер транспорту | Дані моніторингу: vehicleId, fleetNumber, routeId, routeNumber, routeDirection, transportType, lon, lat, lastRecordedAt, status, driverName; routePoints |
| 10.4 Виявлення відхилень транспорту | Номер транспорту, lon (опційно), lat (опційно), currentTime (опційно) | fleetNumber, tripId, routeNumber, driverName, startsAt, delayMinutes, status |
| 11. Перегляд дашборду | - | activeTrips, deviations, schedulesToday, unassignedDrivers, unassignedVehicles |
| 12. Перегляд точок маршруту | ID маршруту | Список точок маршруту |
| **Контролер** |||
| 1. Перевірка транспортної картки | Номер картки | Дані картки: ID, cardNumber, balance, userFullName, lastUsageAt, lastRouteNumber, lastTransportType |
| 2. Реєстрація штрафу | Номер картки, сума, причина, номер транспорту (опційно), час перевірки (опційно), ID рейсу (опційно) | ID штрафу |
| 3. Перегляд активних рейсів | Номер транспорту, час перевірки (опційно) | Список рейсів: tripId, plannedStartsAt, actualStartsAt, routeNumber, transportType, driverName, status |
| 4. Перегляд маршрутів | - | Список маршрутів: ID, number, transportType |
| 5. Перегляд транспортних засобів | ID маршруту (опційно) | Список транспорту: ID, fleetNumber, routeId, routeNumber, transportType, modelName |
| **Бухгалтер** |||
| 1. Управління бюджетом | |||
| 1.1 Створення/оновлення бюджету | Місяць (date), income, expenses, note (опційно) | ID бюджету |
| 1.2 Перегляд бюджетів | limit (опційно) | Список бюджетів: ID, month, plannedIncome, plannedExpenses, note |
| 2. Облік витрат | |||
| 2.1 Створення витрати | Категорія, сума, опис (опційно), documentRef (опційно), occurredAt (опційно) | ID витрати |
| 2.2 Перегляд витрат | limit (опційно) | Список витрат |
| 3. Облік заробітної плати | |||
| 3.1 Нарахування зарплати | driverId, rate (опційно), units (опційно), total (опційно) | ID виплати |
| 3.2 Перегляд історії зарплат | limit (опційно) | Список виплат: ID, paidAt, driverId, driverName, licenseNumber, rate, units, total |
| 4. Перегляд водіїв | - | Список водіїв: ID, fullName, driverLicenseNumber |
| 5. Формування фінансових звітів | |||
| 5.1 Перегляд фінансового звіту | startDate, endDate (опційно - за замовчуванням поточний місяць) | period, items (category, amount, type), summary (totalIncome, totalExpenses, netProfit) |
| 5.2 Перегляд доходів | startDate, endDate (опційно) | Список доходів (income та income_flow) |
| **Департамент мерії** |||
| 1. Перегляд типів транспорту | - | Список типів: ID, name |
| 2. Управління зупинками | |||
| 2.1 Перегляд зупинок | - | Список зупинок: ID, name, lon, lat |
| 2.2 Створення зупинки | Назва, координати (lon, lat) | ID зупинки |
| 2.3 Оновлення зупинки | ID зупинки, назва, координати | success: true |
| 3. Управління маршрутами | |||
| 3.1 Перегляд маршрутів | - | Список маршрутів: ID, number, direction, isActive, transportTypeId, transportType |
| 3.2 Перегляд зупинок маршруту | ID маршруту | Список зупинок маршруту (впорядкований) |
| 3.3 Перегляд точок маршруту | ID маршруту | Список точок маршруту (впорядкований) |
| 3.4 Проектування нового маршруту | number, transportTypeId, direction, stops (масив зупинок з stopId або name/lon/lat та distanceToNextKm), points (масив координат) | route, routeStops, routePoints |
| 3.5 Активація/деактивація маршруту | ID маршруту, isActive | success: true |
| 4. Аналітика пасажиропотоку | Період (from, to), номер маршруту (опційно), ID типу транспорту (опційно) | Список: tripDate, routeNumber, transportType, passengerCount |
| 5. Перегляд скарг та пропозицій | Період (from, to), номер маршруту (опційно), ID типу транспорту (опційно), номер транспорту (опційно), тип (опційно), статус (опційно) | Список: ID, type, message, status, createdAt, routeNumber, transportType, fleetNumber, contactInfo |
| 6. Оновлення статусу скарги | ID скарги, status | success: true |
| **Менеджер** |||
| 1. Перегляд водіїв | - | Список водіїв: ID, login, fullName, email, phone, driverLicenseNumber, licenseCategories |
| 2. Прийняття на роботу водіїв | login, password (опційно), email, phone, fullName, driverLicenseNumber, licenseCategories (масив), passportData (об'єкт) | ID водія |
| 3. Перегляд транспорту | - | Список транспорту: ID, fleetNumber, routeNumber, transportType, modelName, capacity |
| 4. Додавання транспорту | fleetNumber, modelId, routeId або routeNumber | ID транспорту |
| 5. Перегляд маршрутів | - | Список маршрутів: ID, number, direction, transportTypeId, transportTypeName |
| 6. Перегляд типів транспорту | - | Список типів: ID, name |
| 7. Перегляд моделей транспорту | - | Список моделей: ID, name, capacity, typeId, transportType |
| 8. Управління персоналом | |||
| 8.1 Створення працівника | login, password, role, fullName (опційно), email (опційно), phone (опційно) | ok: true |
| 8.2 Видалення працівника | login | ok: true |
| 8.3 Перегляд доступних ролей | - | Список ролей: roleName, description |
