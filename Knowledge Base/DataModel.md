# Модель данных

Основная задача — хранить древовидную структуру так, чтобы поиск был быстрым, а связи — прозрачными.

## Сущности

### 1. Teams & Projects
- `team_id` (PK, string from Figma)
- `name`
- `status` (active, deleted, archived)
- `last_synced_at`

### 2. Files
- `file_key` (PK)
- `name`
- `status` (active, orphaned)
- `last_modified`
- `project_id`
- `version_id`

### 3. Nodes (Элементы дизайна)
- `id` (внутренний figma id)
- `session_id` (FK к scan_sessions)
- `file_key` (FK)
- `file_name`
- `type` (COMPONENT, INSTANCE, FRAME, etc.)
- `name`
- `parent_id`
- `page_name` (Денормализованное имя страницы для производительности)
- `component_id` (для инстансов — ссылка на мастер)
- `is_detached_candidate` (boolean)
- `confidence_score`
- `properties_json` (JSON: свойства компонента)
- `styles_json` (JSON: привязанные стили)
- `text_content` (если есть текстовые слои)
- `fingerprint` (хэш структуры для поиска детачей)
- `order_index` (порядок в Figma)

## Индексация в ElasticSearch
Для поиска по:
- Имени ноды (fuzzy search).
- Текстовому содержимому.
- Именам дочерних слоев.

## Нюансы работы с БД и пути их решения

1. **Масштабируемость**: Секционирование (Partitioning) таблицы `Nodes` по `team_id`.
2. **Деревья**: Использование Recursive CTE или `LTREE` для обхода иерархии нод.
3. **Полнотекстовый поиск**: Использование ElasticSearch как основного движка для имен и контента.
4. **Консистентность**: Теневое обновление (запись в temp-таблицы) и транзакционная замена данных файла.
5. **Массовая вставка**: Использование `COPY` или `UNNEST` для быстрой загрузки тысяч нод.

[[Architecture|К архитектуре]] | [[INDEX|Назад к индексу]]
