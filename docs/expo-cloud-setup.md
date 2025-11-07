# Expo Cloud Setup Guide

## Шаг 1: Инициализация проекта в EAS

Выполните команду для инициализации проекта:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
```

**Что произойдет:**
- Создастся project ID
- `app.json` автоматически обновится с реальным `projectId`
- Проект появится в вашем аккаунте на https://expo.dev

**После выполнения скопируйте project ID** — он понадобится для следующих шагов.

---

## Шаг 2: Настройка Firebase секретов в EAS

Найдите ваши Firebase credentials (в `.env` файле или в Firebase Console).

Выполните команды для каждого секрета:

```bash
npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value "YOUR_API_KEY" --type string

npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value "YOUR_AUTH_DOMAIN" --type string

npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value "YOUR_PROJECT_ID" --type string

npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value "YOUR_STORAGE_BUCKET" --type string

npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value "YOUR_MESSAGING_SENDER_ID" --type string

npx eas-cli@latest secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value "YOUR_APP_ID" --type string
```

**Проверить созданные секреты:**
```bash
npx eas-cli@latest secret:list
```

---

## Шаг 3: Создание EXPO_TOKEN для GitHub Actions

Создайте access token для автоматических билдов:

```bash
npx eas-cli@latest whoami
npx eas-cli@latest token:create
```

**Скопируйте полученный токен** — он нужен для GitHub.

---

## Шаг 4: Настройка GitHub Secrets

Перейдите в Settings вашего GitHub репозитория:

`https://github.com/ozma-io/boss-app/settings/secrets/actions`

Создайте секрет:
- **Name:** `EXPO_TOKEN`
- **Value:** токен из предыдущего шага

---

## Шаг 5: Первая сборка

Запустите первую сборку вручную:

```bash
# Preview сборка для тестирования
npx eas-cli@latest build --platform all --profile preview

# Или production сборка
npx eas-cli@latest build --platform all --profile production
```

**Процесс:**
- Сборка запустится в облаке (5-15 минут)
- Можно отслеживать прогресс в терминале или на https://expo.dev
- После сборки получите ссылки для скачивания .ipa (iOS) и .apk/.aab (Android)

---

## Шаг 6: Проверка автоматических билдов

После пуша в `main` ветку:

1. Зайдите в GitHub Actions вашего репо:
   `https://github.com/ozma-io/boss-app/actions`

2. Должны запуститься два workflow:
   - **EAS Build** — создаст preview сборки для iOS и Android
   - **EAS Update** — опубликует OTA апдейт

3. Отслеживайте статус на https://expo.dev/accounts/ozma-io/projects/boss-app

---

## Шаг 7: Тестирование в вебе (Expo Preview)

После успешной сборки:

1. Зайдите в https://expo.dev/accounts/ozma-io/projects/boss-app/builds
2. Найдите последний preview build
3. Откройте через **QR код** в Expo Go или установите на устройство

**Для веб-версии:**
```bash
npm run web
```

---

## Проверка настройки

### 1. Project ID в app.json

Откройте `app.json` и проверьте, что заполнены:
- `expo.owner` — ваш Expo username (например: `ozma-io`)
- `expo.extra.eas.projectId` — UUID проекта
- `expo.updates.url` — должен содержать правильный project ID

### 2. Секреты в EAS

```bash
npx eas-cli@latest secret:list
```

Должны быть все 6 Firebase переменных.

### 3. GitHub Actions секреты

Проверьте наличие `EXPO_TOKEN` в:
`https://github.com/ozma-io/boss-app/settings/secrets/actions`

---

## Полезные команды

```bash
# Статус проекта
npx eas-cli@latest whoami
npx eas-cli@latest project:info

# Список билдов
npx eas-cli@latest build:list

# Отменить билд
npx eas-cli@latest build:cancel

# Логи последнего билда
npx eas-cli@latest build:view

# OTA апдейт вручную
npx eas-cli@latest update --auto

# Удалить секрет
npx eas-cli@latest secret:delete --name SECRET_NAME
```

---

## Структура конфигурации

### eas.json

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

**Профили:**
- `development` — для разработки с dev-клиентом
- `preview` — для внутреннего тестирования (QA, команда)
- `production` — для публикации в App Store/Google Play

### GitHub Actions

**`.github/workflows/eas-build.yml`** — запускает preview сборки при пуше в main

**`.github/workflows/eas-update.yml`** — публикует OTA апдейты для JS/assets

---

## Troubleshooting

### Ошибка: "No project found"

Запустите `eas init` снова.

### Ошибка: "EXPO_TOKEN not found"

Проверьте GitHub Secrets: `Settings → Secrets → Actions → EXPO_TOKEN`

### Сборка падает с ошибкой Firebase

Проверьте, что все секреты настроены:
```bash
npx eas-cli@latest secret:list
```

### Билды не запускаются автоматически

Проверьте наличие файлов:
- `.github/workflows/eas-build.yml`
- `.github/workflows/eas-update.yml`

И что в GitHub Actions включены workflows.

---

## Ссылки

- Expo Dashboard: https://expo.dev
- EAS Build Docs: https://docs.expo.dev/build/setup/
- EAS Update Docs: https://docs.expo.dev/eas-update/introduction/
- GitHub Actions Integration: https://docs.expo.dev/build/building-on-ci/

