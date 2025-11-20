# Facebook Attribution Matching Process

Техническое описание процесса сохранения и matching attribution данных при установке приложения через Facebook рекламу.

---

## 📍 Этап 1: КЛИК на рекламу

### Что происходит:

```
Пользователь кликает на рекламу
       ↓
Redirect через l.facebook.com
       ↓
Facebook генерирует fbclid и сохраняет данные
```

### Что Facebook СОХРАНЯЕТ:

#### Deterministic Identifiers (точные, если доступны):

```javascript
{
  // Уникальный ID клика
  fbclid: "IwAR2xYz...",
  
  // IDFA (если пользователь залогинен в Facebook app)
  // Facebook получает через cross-app communication с Facebook app
  // До iOS 14.5: всегда доступен
  // После iOS 14.5: только если ATT уже было дано ранее
  idfa: "XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX",
  
  // IDFV (если клик из Facebook app)
  idfv: "YYYYYYYY-YYYY-YYYY-YYYY-YYYYYYYYYYYY",
  
  // Facebook User ID (если залогинен)
  fb_user_id: "1234567890",
  
  // Facebook Browser Cookie (если клик в FB app)
  fb_browser_id: "cookie_value",
}
```

**⚠️ Важно:** IDFA при клике доступен ТОЛЬКО если:
- Клик происходит **внутри Facebook/Instagram app** (не Safari)
- ИЛИ пользователь ранее дал ATT разрешение другому приложению
- ИЛИ iOS < 14.5

#### Probabilistic Signals (вероятностные, всегда доступны):

```javascript
{
  // Network
  ip: "192.168.1.1",
  ip_subnet: "192.168.1.0/24",
  isp: "AT&T",
  
  // Device (из User-Agent)
  user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0...",
  device_model: "iPhone 14 Pro",
  os_version: "16.0",
  browser: "Safari",
  
  // Screen
  screen_width: 1179,
  screen_height: 2556,
  screen_density: 3.0,
  
  // Locale
  language: "en-US",
  timezone: "America/New_York",
  timezone_offset: -240,
  
  // Timestamp
  click_time: "2024-11-19T16:30:45.123Z",
}
```

#### Campaign Data:

```javascript
{
  campaign_id: "123456789",
  ad_set_id: "987654321",
  ad_id: "111222333",
  
  // UTM параметры
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "install_campaign",
}
```

### Где сохраняется:

Facebook сохраняет данные в нескольких таблицах для быстрого поиска:

```javascript
// Главная таблица
Table: clicks
Key: fbclid = "IwAR2xYz..."
Value: {
  // Deterministic
  idfa: "XXXX-..." (если есть),
  idfv: "YYYY-...",
  fb_user_id: "1234567890" (если есть),
  
  // Probabilistic
  ip: "192.168.1.1",
  ip_subnet: "192.168.1.0/24",
  user_agent: "...",
  screen: { width: 1179, height: 2556, density: 3.0 },
  timezone: "America/New_York",
  language: "en-US",
  
  // Campaign
  campaign_id: "123456789",
  ad_id: "111222333",
  utm_source: "facebook",
  utm_campaign: "install_campaign",
  
  // Metadata
  click_time: "2024-11-19T16:30:45.123Z",
  expires_at: "2024-11-26T16:30:45.123Z", // +7 дней
}

// Индексные таблицы для быстрого поиска
Table: clicks_by_idfa
Key: "XXXX-XXXX-..."
Value: fbclid = "IwAR2xYz..."

Table: clicks_by_idfv
Key: "YYYY-YYYY-..."
Value: fbclid = "IwAR2xYz..."

Table: clicks_by_fb_user
Key: "1234567890"
Value: fbclid = "IwAR2xYz..."

Table: clicks_by_fingerprint
Key: SHA256(ip + user_agent + screen + timezone + language)
Value: fbclid = "IwAR2xYz..."
```

**TTL: 7 дней** (потом данные автоматически удаляются)

---

## 📍 Этап 2: УСТАНОВКА приложения

### Что происходит:

```
App Store → Установка → Первый запуск
       ↓
Facebook SDK инициализируется
       ↓
Собирает такую же информацию
       ↓
Отправляет на Facebook Attribution API
```

### Что Facebook SDK СОБИРАЕТ:

```typescript
// React Native код (происходит автоматически при инициализации SDK)
import { getIDFA } from 'react-native-idfa';
import DeviceInfo from 'react-native-device-info';
import { Dimensions, Platform } from 'react-native';

const installData = {
  // IDFA (КЛЮЧЕВОЙ для deterministic matching!)
  // Доступен ТОЛЬКО если:
  // - iOS < 14.5 (всегда)
  // - iOS >= 14.5 + ATT permission granted
  idfa: await getIDFA(), // "XXXX-..." или null
  
  // IDFV (Identifier for Vendor - всегда доступен)
  idfv: await DeviceInfo.getUniqueId(), // "YYYY-..."
  
  // IP адрес (определяется на сервере Facebook при HTTP запросе)
  ip: request.ip, // "192.168.1.1"
  
  // Device info (из React Native API)
  user_agent: await DeviceInfo.getUserAgent(),
  // "Aida/1.0.0 (iPhone; iOS 16.0; Scale/3.00)"
  
  device_model: await DeviceInfo.getModel(), // "iPhone 14 Pro"
  os_version: await DeviceInfo.getSystemVersion(), // "16.0"
  
  screen_width: Dimensions.get('screen').width,   // 1179
  screen_height: Dimensions.get('screen').height, // 2556
  screen_scale: Dimensions.get('screen').scale,   // 3.0
  
  // Locale
  language: await DeviceInfo.getDeviceLocale(), // "en-US"
  timezone: await DeviceInfo.getTimezone(),     // "America/New_York"
  
  // Tracking permissions (получаем из ATT API)
  advertiser_tracking_enabled: attStatus === 'authorized', // true/false
  application_tracking_enabled: true,
  
  // Timestamp
  install_time: new Date().toISOString(), // "2024-11-19T17:00:00.000Z"
};

// Отправляется на Facebook Attribution API
await fetch('https://graph.facebook.com/v18.0/PIXEL_ID/activities', {
  method: 'POST',
  body: JSON.stringify({
    event: 'MOBILE_APP_INSTALL',
    advertiser_id: installData.idfa,
    advertiser_tracking_enabled: installData.advertiser_tracking_enabled,
    application_tracking_enabled: true,
    extinfo: await buildExtinfo(), // 16-element array (см. ниже)
    install_timestamp: Math.floor(Date.now() / 1000),
  }),
});
```

### Структура extinfo массива (16 элементов):

```typescript
// utils/deviceInfo.ts - buildExtinfo()
const extinfo = [
  'i2',                                    // [0] version (always 'i2')
  await DeviceInfo.getBundleId(),         // [1] com.aida.app
  await DeviceInfo.getVersion(),          // [2] 1.0.0
  await DeviceInfo.getSystemVersion(),    // [3] 16.0
  await DeviceInfo.getModel(),            // [4] iPhone14,3
  await DeviceInfo.getDeviceLocale(),     // [5] en-US
  await DeviceInfo.getTimezone(),         // [6] America/New_York
  await DeviceInfo.getCarrier(),          // [7] AT&T
  Dimensions.get('screen').width,         // [8] 1179
  Dimensions.get('screen').height,        // [9] 2556
  Dimensions.get('screen').scale,         // [10] 3.0
  await DeviceInfo.getTotalMemory(),      // [11] 6442450944
  await DeviceInfo.getTotalDiskCapacity(),// [12] 128000000000
  await DeviceInfo.getFreeDiskStorage(),  // [13] 50000000000
  '',                                     // [14] reserved
  '',                                     // [15] reserved
];
```

---

## 📍 Этап 3: MATCHING

Facebook Attribution API пробует несколько методов в порядке приоритета:

### Метод 1: Deterministic Match (100% точность)

#### 1A. Match по IDFA (самый надежный):

```python
if install_data.idfa:
    click = db.find_by_idfa(install_data.idfa)
    if click and not expired(click):
        return {
            'method': 'deterministic_idfa',
            'confidence': 100,
            'fbclid': click.fbclid,
            'attribution': click.campaign_data
        }
```

**Требования:**
- ✅ ATT permission granted
- ✅ IDFA доступен при клике И при установке
- ✅ Клик не старше 7 дней

#### 1B. Match по IDFV + IP:

```python
if install_data.idfv:
    clicks = db.find_by_idfv_and_ip_subnet(
        install_data.idfv,
        install_data.ip_subnet
    )
    if len(clicks) == 1:
        return {
            'method': 'deterministic_idfv',
            'confidence': 95,
            'fbclid': clicks[0].fbclid
        }
```

**Ограничение:** IDFV меняется при переустановке приложений одного разработчика

#### 1C. Match по Facebook User ID:

```python
if install_data.fb_user_id:
    click = db.find_by_fb_user_id(install_data.fb_user_id)
    if click:
        return {
            'method': 'deterministic_fb_user',
            'confidence': 100,
            'fbclid': click.fbclid
        }
```

**Требования:**
- ✅ Пользователь залогинен в Facebook app
- ✅ Приложение использует Facebook Login

---

### Метод 2: Probabilistic Match (85-95% точность)

Если deterministic не сработал, используется fingerprinting:

```python
# Создаем fingerprint из install данных
install_fingerprint = create_fingerprint(install_data)

# Ищем похожие клики за последние 24 часа
recent_clicks = db.find_recent_clicks(
    ip_subnet=install_data.ip_subnet,
    platform='ios',
    time_window=24_hours
)

# Считаем similarity score
best_match = None
best_score = 0

for click in recent_clicks:
    score = calculate_similarity(
        install_fingerprint,
        click.fingerprint
    )
    if score > best_score:
        best_score = score
        best_match = click

# Порог 85%
if best_score > 0.85:
    return {
        'method': 'probabilistic',
        'confidence': int(best_score * 100),
        'fbclid': best_match.fbclid
    }
```

#### Similarity Score (взвешенная сумма):

| Параметр | Вес | Описание |
|----------|-----|----------|
| **IP адрес** | 40% | Точное совпадение или та же подсеть |
| **User-Agent** | 20% | Сравнение строк User-Agent |
| **Screen resolution** | 15% | Width + Height + Density |
| **Timezone** | 10% | Точное совпадение timezone |
| **Language** | 10% | Locale совпадение |
| **Device model** | 5% | Модель устройства |

**Пример:**
```
IP совпал: +0.40
User-Agent совпал на 95%: +0.19
Screen совпал: +0.15
Timezone совпал: +0.10
Language совпал: +0.10
Device совпал: +0.05
───────────────────────────
Total: 0.99 (99% confidence) ✅
```

---

## 📊 Сценарии

### Сценарий 1: ✅ С ATT разрешением (идеальный)

```
1. Клик (t=0):
   Facebook сохраняет: fbclid + IDFA + fingerprint

2. Установка (t=30 мин):
   ATT permission granted ✅
   SDK отправляет: IDFA + fingerprint

3. Matching:
   IDFA совпал → Deterministic match (100%)
   Возвращает: fbclid + campaign_id

4. App Install event:
   {
     fbclid: "IwAR2x...",
     advertiserTrackingEnabled: true,
     attribution: 'deterministic',
     confidence: 100
   }
```

**Результат:** Facebook точно знает, какая реклама привела к установке ✅

**Что происходит в коде:**
```typescript
// 1. Запрашиваем ATT разрешение
const attStatus = await requestTrackingPermission();
// attStatus = 'authorized' ✅

// 2. Получаем deferred deep link от Facebook SDK
const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
// deferredUrl = "https://yourapp.com/?fbclid=IwAR2x..." ✅

// 3. Парсим параметры
const attribution = parseDeepLinkParams(deferredUrl);
// { fbclid: "IwAR2x...", utm_source: "facebook", ... }

// 4. Отправляем App Install event
await sendAppInstallEventDual(attribution, { email: userEmail });
// Facebook получает: fbclid + advertiserTrackingEnabled: true ✅
```

---

### Сценарий 2: ⚠️ БЕЗ ATT разрешения (probabilistic)

```
1. Клик (t=0):
   Facebook сохраняет: fbclid + fingerprint (БЕЗ IDFA)

2. Установка (t=30 мин):
   ATT permission denied ❌
   SDK отправляет: fingerprint (БЕЗ IDFA)

3. Matching:
   IDFA недоступен → Probabilistic match
   Сравнивает: IP + User-Agent + Screen + Timezone
   Similarity: 92% → MATCH ⚠️
   Возвращает: fbclid + campaign_id

4. App Install event:
   {
     fbclid: "IwAR2x...",
     advertiserTrackingEnabled: false,
     attribution: 'probabilistic',
     confidence: 92
   }
```

**Результат:** Facebook вероятно знает источник (92% уверенность) ⚠️

**Что происходит в коде:**
```typescript
// 1. Запрашиваем ATT разрешение
const attStatus = await requestTrackingPermission();
// attStatus = 'denied' ❌

// 2. Получаем deferred deep link (все равно работает через fingerprint)
const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
// deferredUrl = "https://yourapp.com/?fbclid=IwAR2x..." ⚠️ (92% confidence)

// 3. Парсим параметры
const attribution = parseDeepLinkParams(deferredUrl);
// { fbclid: "IwAR2x...", utm_source: "facebook", ... }

// 4. Отправляем App Install event
await sendAppInstallEventDual(attribution, { email: userEmail });
// Facebook получает: fbclid + advertiserTrackingEnabled: false ⚠️
```

**⚠️ Примечание:** Facebook SDK может не вернуть deferred link, если probabilistic matching confidence < 85%

---

### Сценарий 3: ❌ IP изменился (WiFi → LTE)

```
1. Клик (t=0, WiFi):
   IP: 192.168.1.1

2. Установка (t=30 мин, LTE):
   IP: 10.20.30.40

3. Matching:
   IP не совпал ❌ (-40%)
   User-Agent совпал ✅ (+20%)
   Screen совпал ✅ (+15%)
   Timezone совпал ✅ (+10%)
   Language совпал ✅ (+10%)
   Device совпал ✅ (+5%)
   ────────────────────────
   Total: 60% < 85% threshold

   Similarity: 60% → НЕ MATCH ❌

4. App Install event:
   {
     fbclid: null,
     attribution: 'organic'
   }
```

**Результат:** Facebook НЕ знает источник (считает organic install) ❌

**Что происходит в коде:**
```typescript
// 1. Запрашиваем ATT разрешение
const attStatus = await requestTrackingPermission();
// attStatus = 'denied' ❌

// 2. Пытаемся получить deferred deep link
const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
// deferredUrl = null ❌ (similarity 60% < 85% threshold)

// 3. Нет attribution данных
const attribution = deferredUrl ? parseDeepLinkParams(deferredUrl) : {};
// attribution = {}

// 4. Отправляем App Install event БЕЗ fbclid
await sendAppInstallEventDual(attribution, { email: userEmail });
// Facebook получает: fbclid: null, attribution: 'organic' ❌
```

---

## 🎯 Ключевые выводы

### Что влияет на успешность matching:

| Фактор | Влияние на точность |
|--------|-------------------|
| **ATT разрешение** | 100% vs 85-95% |
| **IP адрес стабилен** | +40% к probabilistic |
| **Facebook app установлен** | Может дать IDFA при клике |
| **Время между кликом и установкой** | < 24ч лучше (probabilistic) |
| **VPN/Proxy** | Ухудшает probabilistic |

### Что Facebook получает в App Install event:

```typescript
{
  eventName: 'AppInstall',
  eventTime: 1700412000,
  eventId: 'unique-uuid',
  
  // ❗ КЛЮЧЕВЫЕ ПОЛЯ
  advertiserTrackingEnabled: true/false,  // ATT status
  applicationTrackingEnabled: true,
  
  // Attribution (если нашли match)
  fbclid: 'IwAR2x...',                    // или null
  
  // Device info
  extinfo: [/* 16 элементов */],
  
  // User data (hashed)
  userData: {
    email: 'hashed...'
  },
  
  // Campaign (если нашли match)
  customData: {
    campaign_id: '123456789',
    utm_source: 'facebook',
    utm_campaign: 'install_campaign'
  }
}
```

---

## 📝 Рекомендации для разработчиков

### Для максимальной точности attribution:

1. **✅ Всегда запрашивайте ATT разрешение**
   - Показывайте onboarding экран с объяснением
   - Запрашивайте при первом запуске
   
2. **✅ Используйте Facebook SDK `fetchDeferredAppLink()`**
   - Вызывайте ПОСЛЕ получения ATT разрешения
   - Обрабатывайте случай, когда deferred link отсутствует

3. **✅ Отправляйте App Install event с правильными параметрами**
   - Используйте dual-send (client + server)
   - Включайте `advertiserTrackingEnabled` status
   - Передавайте `fbclid` если нашли

4. **⚠️ Учитывайте ограничения probabilistic matching**
   - Точность 85-95% vs 100% с IDFA
   - Может не работать при смене IP
   - Требует стабильного интернета

### Для надежности при любом сценарии:

- Используйте **Branch.io** или **AppsFlyer** для deferred deep linking
- Они комбинируют deterministic + probabilistic методы
- Имеют лучшие ML модели для matching (95-98% точность)
- Работают для всех ad networks (не только Facebook)

---

## 💻 Пример интеграции в React Native

### Вариант 1: Facebook SDK (бесплатно, только FB реклама)

```typescript
// app/_layout.tsx
import { AppEventsLogger } from 'react-native-fbsdk-next';
import { requestTrackingPermission } from '@/services/tracking.service';
import { sendAppInstallEventDual } from '@/services/facebook.service';
import { isFirstLaunch, markAppAsLaunched } from '@/services/attribution.service';

useEffect(() => {
  const handleFirstLaunch = async () => {
    const firstLaunch = await isFirstLaunch();
    
    if (!firstLaunch) return;
    
    try {
      // 1. Запрашиваем ATT разрешение
      logger.info('[App] Requesting ATT permission...');
      const attStatus = await requestTrackingPermission();
      logger.info('[App] ATT status:', { attStatus });
      
      // 2. Получаем deferred deep link от Facebook
      // ВАЖНО: вызывать ПОСЛЕ ATT разрешения для лучшей точности
      logger.info('[App] Fetching deferred app link from Facebook...');
      const deferredUrl = await AppEventsLogger.fetchDeferredAppLink();
      
      if (deferredUrl) {
        logger.info('[App] Got deferred deep link! 🎉', { deferredUrl });
        
        // 3. Парсим attribution параметры
        const attribution = parseDeepLinkParams(deferredUrl);
        logger.info('[App] Attribution data:', attribution);
        
        // 4. Отправляем App Install event с fbclid
        await sendAppInstallEventDual(attribution, {
          email: userEmail, // если есть
        });
        
        logger.info('[App] App Install event sent successfully ✅');
      } else {
        logger.info('[App] No deferred deep link (organic install)');
        
        // Отправляем App Install без attribution
        await sendAppInstallEventDual({});
      }
      
      await markAppAsLaunched();
    } catch (error) {
      logger.error('[App] Error handling first launch:', error);
    }
  };

  handleFirstLaunch();
}, []);
```

**Требования:**
- ✅ Установлен `react-native-fbsdk-next`
- ⚠️ На устройстве ДОЛЖЕН быть установлен Facebook app
- ⚠️ Пользователь ДОЛЖЕН быть залогинен в Facebook app
- ⚠️ Работает ТОЛЬКО для Facebook/Instagram рекламы

---

### Вариант 2: Branch.io (платно, все источники)

```typescript
// app/_layout.tsx
import branch from 'react-native-branch';
import { requestTrackingPermission } from '@/services/tracking.service';
import { sendAppInstallEventDual } from '@/services/facebook.service';
import { isFirstLaunch, markAppAsLaunched } from '@/services/attribution.service';

useEffect(() => {
  const handleFirstLaunch = async () => {
    const firstLaunch = await isFirstLaunch();
    
    if (!firstLaunch) return;
    
    try {
      // 1. Запрашиваем ATT разрешение
      const attStatus = await requestTrackingPermission();
      logger.info('[App] ATT status:', { attStatus });
      
      // 2. Подписываемся на Branch events
      const unsubscribe = branch.subscribe({
        onOpenStart: () => {
          logger.info('[Branch] Session starting...');
        },
        onOpenComplete: async ({ error, params }) => {
          if (error) {
            logger.error('[Branch] Error:', error);
            return;
          }
          
          // 3. Проверяем, пришел ли пользователь по Branch ссылке
          if (params['+clicked_branch_link']) {
            logger.info('[Branch] Got attribution! 🎉', params);
            
            // Извлекаем attribution данные
            const attribution = {
              fbclid: params.fbclid,
              utm_source: params.utm_source,
              utm_medium: params.utm_medium,
              utm_campaign: params.utm_campaign,
              utm_content: params.utm_content,
              email: params.email,
            };
            
            // 4. Отправляем App Install event
            await sendAppInstallEventDual(attribution, {
              email: params.email,
            });
            
            logger.info('[Branch] App Install event sent ✅');
            
            // Branch автоматически отправит postback в Facebook
            // если настроена интеграция в Branch dashboard
          } else {
            logger.info('[Branch] Organic install');
            await sendAppInstallEventDual({});
          }
          
          await markAppAsLaunched();
        },
      });
      
      return () => unsubscribe();
    } catch (error) {
      logger.error('[App] Error handling first launch:', error);
    }
  };

  handleFirstLaunch();
}, []);
```

**Преимущества:**
- ✅ НЕ требует Facebook app на устройстве
- ✅ Работает для ВСЕХ источников (FB, Google, TikTok, email, SMS, etc.)
- ✅ Probabilistic matching 95-98% (vs 85-95% у Facebook SDK)
- ✅ Автоматические postbacks во все ad networks
- ✅ Cross-device tracking (клик на iPad → установка на iPhone)

**Цена:**
- Free tier: до 10K MAU (Monthly Active Users)
- Paid: $299-999/месяц

---

## 📁 Реализация в BossUp

### Файлы:

1. **`services/facebook.service.ts`**
   - `sendAppInstallEventDual()` - отправка App Install event (строки 548-566)
   - `buildEventData()` - формирование payload с ATT status (строки 178-210)
   - `parseDeepLinkParams()` - парсинг URL параметров (строки 356-378)

2. **`utils/deviceInfo.ts`**
   - `buildExtinfo()` - создание 16-element array для Facebook
   - `getAdvertiserTrackingEnabled()` - получение ATT status

3. **`services/tracking.service.ts`**
   - `requestTrackingPermission()` - запрос ATT разрешения
   - `getTrackingPermissionStatus()` - проверка текущего статуса

4. **`app/_layout.tsx`**
   - Обработка первого запуска (строки 200-250)
   - Парсинг deep links
   - Отправка Facebook events

5. **`functions/src/facebook.ts`** (Cloud Function)
   - `sendFacebookConversionEvent` - отправка на Conversions API
   - Хеширование user data
   - Retry логика

### Пример использования в BossUp:

```typescript
// app/_layout.tsx (упрощенная версия)

const firstLaunch = await isFirstLaunch();

if (firstLaunch) {
  // Получаем initial URL (deep link)
  const url = await Linking.getInitialURL();
  let attributionData = null;
  
  if (url) {
    // Парсим attribution из URL
    attributionData = parseDeepLinkParams(url);
    logger.info('[App] Got attribution from deep link', attributionData);
  }
  
  // Если есть Facebook attribution
  if (attributionData?.fbclid || attributionData?.utm_source === 'facebook') {
    // iOS: показываем tracking onboarding перед ATT
    if (Platform.OS === 'ios') {
      router.push('/tracking-onboarding');
      // Там запросим ATT и отправим App Install event
    } else {
      // Android: отправляем сразу
      await sendAppInstallEventDual(attributionData);
    }
  }
  
  await markAppAsLaunched();
}
```

---

## ⚠️ Важные ограничения

### Facebook SDK `fetchDeferredAppLink()`:

1. **Требует Facebook app на устройстве**
   - Если у пользователя нет Facebook app → метод вернет `null`
   - Если пользователь не залогинен в FB app → точность снижается

2. **Работает только для Facebook/Instagram рекламы**
   - Не работает для Google Ads, TikTok, email campaigns, etc.

3. **Probabilistic matching ограничен**
   - Если IP изменился → может не найти match
   - Если VPN/Proxy → может не найти match
   - Если много времени прошло (>24ч) → точность падает

4. **iOS 14.5+ проблемы**
   - ~70% пользователей отказывают в ATT
   - Без IDFA точность падает с 100% до 85-95%

### Альтернативы для production:

| Решение | Точность | Требует FB app | Все источники | Цена |
|---------|----------|---------------|---------------|------|
| **Facebook SDK** | 85-95% | Да ⚠️ | Нет ❌ | Бесплатно ✅ |
| **Branch.io** | 95-98% | Нет ✅ | Да ✅ | $0-299/мес |
| **AppsFlyer** | 95-98% | Нет ✅ | Да ✅ | $0-449/мес |
| **Adjust** | 95-98% | Нет ✅ | Да ✅ | Custom pricing |

---

**Последнее обновление:** 2024-11-19

