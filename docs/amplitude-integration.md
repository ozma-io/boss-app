# Amplitude Analytics Integration

## Overview

Amplitude SDK с Session Replay интегрирован для всех платформ:
- **iOS/Android**: использует `@amplitude/analytics-react-native`
- **Web**: использует браузерный SDK через CDN

Все события и методы работают одинаково на всех платформах через единый API.

## Конфигурация

- **API Key**: `2ec3617e5449dbc96f374776115b3594`
- **Server Zone**: EU
- **Session Replay**: включен на всех платформах
- **Sample Rate**: 100% (все сессии записываются)

### Web дополнительно
- **Autocapture**: включен для всех типов событий
  - Attribution
  - File Downloads
  - Form Interactions
  - Page Views
  - Sessions
  - Element Interactions
  - Network Tracking
  - Web Vitals
  - Frustration Interactions

## Использование

### Отслеживание событий

```typescript
import { trackAmplitudeEvent } from '@/services/amplitude.service';

// Простое событие
trackAmplitudeEvent("Button Clicked");

// Событие с параметрами
trackAmplitudeEvent("Button Clicked", { 
  buttonColor: 'primary',
  screenName: 'Home',
  userId: '12345'
});
```

### Установка User ID и Email

```typescript
import { setAmplitudeUserId } from '@/services/amplitude.service';

// После аутентификации пользователя
await setAmplitudeUserId(userId, userEmail);

// Примечание: если email - пустая строка, в Amplitude будет установлен '[no_email]'
// (это может произойти при OAuth авторизации, когда пользователь скрывает email)
// Это позволяет отслеживать в аналитике пользователей без email
```

### Сброс пользователя

```typescript
import { resetAmplitudeUser } from '@/services/amplitude.service';

// При выходе пользователя
await resetAmplitudeUser();
```

## Инициализация

SDK автоматически инициализируется при запуске приложения в `app/_layout.tsx`:

- На **iOS/Android**: инициализируется через React Native SDK
- На **Web**: использует глобальный объект `window.amplitude` загруженный через CDN

## Интеграция с авторизацией

Amplitude **автоматически интегрирован** с системой авторизации в `contexts/AuthContext.tsx`:

### При входе пользователя:
- Автоматически вызывается `setAmplitudeUserId(userId, email)`
- User ID и email устанавливаются сразу после успешной авторизации
- Все последующие события будут привязаны к этому пользователю

### При выходе пользователя:
- Автоматически вызывается `resetAmplitudeUser()`
- User ID сбрасывается
- Сессия очищается
- **Важно**: Это предотвращает "склеивание" разных пользователей на одном устройстве

### Сценарий: 2 пользователя на одном устройстве

```
Пользователь A авторизуется
  ↓
  setAmplitudeUserId("user-A-id")
  ↓
События трекаются как user-A ✅
  ↓
Пользователь A выходит
  ↓
  resetAmplitudeUser() → сброс userId и сессии
  ↓
Пользователь B авторизуется
  ↓
  setAmplitudeUserId("user-B-id")
  ↓
События трекаются как user-B ✅
```

**Без reset()** данные разных пользователей могли бы смешаться через device ID.  
**С reset()** каждый пользователь трекается отдельно.

## Файлы

- **Сервис**: `services/amplitude.service.ts`
- **Web HTML**: `app/+html.tsx` (содержит script tag для CDN)
- **Инициализация**: `app/_layout.tsx`
- **Авторизация**: `contexts/AuthContext.tsx` (автоматическая установка/сброс userId)

## Проверка работы

1. Запустите приложение
2. В консоли должно появиться:
   - iOS/Android: `[Amplitude] Native SDK initialized successfully with Session Replay`
   - Web: `[Amplitude] Web SDK initialized successfully with Session Replay`
3. При отправке событий в консоли будет:
   - `[Amplitude] Event tracked (web/native): EventName {...}`

## Платформы

| Платформа | SDK | Session Replay | Autocapture |
|-----------|-----|----------------|-------------|
| iOS | React Native | ✅ | ❌ |
| Android | React Native | ✅ | ❌ |
| Web | Browser SDK | ✅ | ✅ |

Autocapture на Web автоматически отслеживает клики, формы, навигацию и другие взаимодействия пользователя без ручного кода.

