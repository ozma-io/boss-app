# Facebook actionSource Fix

## Проблема

Третье событие (web-proxy) при отправке событий в Meta НЕ отправлялось с правильным `action_source`.

**Причина:**
- В Cloud Function `functions/src/facebook.ts` был жестко прописан `action_source: 'app'`
- Параметр `actionSource` не передавался из клиента в Cloud Function
- Все события (включая web-proxy) отправлялись с `action_source: 'app'`

**Результат:**
Facebook не видел третье событие как веб-конверсию, что нарушало цель отправки web-proxy событий для оптимизации веб-кампаний.

## Решение

### 1. Создали общий тип `FacebookActionSource`

Чтобы избежать дублирования, создали тип `FacebookActionSource`:

**Клиент** (`services/facebook.service.ts`):
```typescript
export type FacebookActionSource = 
  | 'app'                    // Mobile app or desktop app
  | 'website'                // Website
  | 'email'                  // Email
  | 'phone_call'             // Phone call
  | 'chat'                   // Chat (e.g., Messenger, WhatsApp)
  | 'physical_store'         // Physical store
  | 'system_generated'       // System generated (e.g., server-side logic)
  | 'business_messaging'     // Business messaging
  | 'other';                 // Other
```

**Cloud Function** (`functions/src/facebook.ts`):
- Тот же тип с комментарием, что он должен совпадать с клиентским
- (Cloud Functions - отдельный проект, не можем импортировать из клиента)

### 2. Cloud Function (`functions/src/facebook.ts`)

- ✅ Создали тип `FacebookActionSource` с комментарием синхронизации
- ✅ Используем `FacebookActionSource` в интерфейсе `FacebookConversionEventData`
- ✅ Добавили валидацию `actionSource` в начале функции
- ✅ Используем `action_source: eventData.actionSource` вместо `'app'`
- ✅ Добавили `actionSource` в логи

### 3. Клиент (`services/facebook.service.ts`)

- ✅ Создали и экспортировали тип `FacebookActionSource`
- ✅ Используем `FacebookActionSource` в `ConversionEventParams`
- ✅ Используем `FacebookActionSource` в `ConversionEventData`
- ✅ Используем `FacebookActionSource` в `sendConversionEvent()` (4-я позиция)
- ✅ Убрали все дефолтные значения `|| 'app'`
- ✅ Обновили все вызовы с явной передачей `actionSource`
- ✅ Добавили `actionSource` в логи

### Изменения в сигнатуре функции

**Было:**
```typescript
sendConversionEvent(
  userId: string | undefined,
  eventId: string,
  eventName: string,
  userData?: {...},
  customData?: Record<string, string | number | boolean>,
  attributionData?: AttributionData,
  actionSource?: 'app' | 'website' | ... // опциональный, последний параметр
): Promise<void>
```

**Стало:**
```typescript
sendConversionEvent(
  userId: string | undefined,
  eventId: string,
  eventName: string,
  actionSource: FacebookActionSource, // ОБЯЗАТЕЛЬНЫЙ, 4-й параметр
  userData?: {...},
  customData?: Record<string, string | number | boolean>,
  attributionData?: AttributionData
): Promise<void>
```

**Преимущества:**
- ✅ Невозможно забыть указать `actionSource`
- ✅ TypeScript выдаст ошибку при неправильном порядке параметров
- ✅ Единый тип `FacebookActionSource` вместо дублирования union type
- ✅ Нет неявных дефолтных значений

## Примеры использования

### AppInstall (только 'app')
```typescript
sendConversionEvent(userId, eventId, FB_MOBILE_ACTIVATE_APP, 'app', userData, undefined, attributionData)
```

### Registration (triple-send)
```typescript
// Событие #1: app
sendConversionEvent(userId, eventId, FB_MOBILE_COMPLETE_REGISTRATION, 'app', { email }, customData, attributionData)

// Событие #2: website
sendConversionEvent(userId, webProxyEventId, 'AppWebProxyLogin', 'website', { email }, customData, attributionData)
```

### First Chat Message (triple-send)
```typescript
// Событие #1: app
sendConversionEvent(userId, eventId, FB_MOBILE_ACHIEVEMENT_UNLOCKED, 'app', { email }, customData, attributionData)

// Событие #2: website
sendConversionEvent(userId, webProxyEventId, 'AppWebProxyFirstChatMessage', 'website', { email }, customData, attributionData)
```

## Деплой

После изменений необходимо задеплоить Cloud Function:

```bash
cd functions
npm run deploy
```

Или только эту функцию:

```bash
firebase deploy --only functions:sendFacebookConversionEvent
```

## Проверка

После деплоя в логах Cloud Function должно появиться:

```
Facebook sending conversion event {
  eventName: "AppWebProxyFirstChatMessage",
  eventId: "...",
  actionSource: "website",  // ✅ было "app"
  hasUserData: true,
  hasFbc: true,
  hasFbp: true
}
```

В Facebook Events Manager третье событие должно появиться с правильным `action_source: website`.
