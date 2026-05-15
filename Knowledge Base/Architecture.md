# Архитектура системы (v2.0 - High Performance)

Система построена на ультрасовременном стеке 2025 года, оптимизированном для работы с миллионами узлов Figma при минимальном потреблении ресурсов.

## Технологический стек
- **Runtime**: Node.js
- **Backend Framework**: Hono
- **Database**: SQLite (FTS5 enabled)
- **Frontend**: React + Vite

## Модульная структура (Backend)
1. **Core (`src/core/`)**: 
    - `db.ts`: Управление SQLite, FTS5 индексами и триггерами.
    - `settings.controller.ts`: Глобальные настройки приложения.
2. **Modules (`src/modules/`)**:
    - `teams/`: Управление командами и связями с Figma-файлами.
    - `nodes/`: Полнотекстовый поиск и навигация по элементам.
    - `scanner/`: Стриминговый движок парсинга Figma API с пакетной записью.

## Фронтенд утилиты
- [`figmaUtils.ts`](../apps/web/src/utils/figmaUtils.ts): Генерация Deep Links (web/app), форматирование ID нод, слагификация имён файлов. Подробнее — [[FigmaAPI|Работа с Figma API]].

## Схема потоков данных
- [Figma API] -> [Scanner Service (Stream)] -> [SQLite (Batch Insert)]
- [SQLite] -> [Hono Controllers] -> [React Dashboard]

[[DataModel|Смотреть обновленную модель данных]] | [[FigmaAPI|Figma API и Node ID]] | [[INDEX|Назад к индексу]]
