# Handoff: поддержка `ColumnDiscoveredId` в PColumnBundle (workflow-tengo)

**Статус:** не блокер. Блок обошёлся временным решением (см. «Что сделано вместо
этого»), поэтому задача — про снятие обхода, а не про починку сломанного.
**Репозиторий изменения:** `core/platforma`, пакет `@platforma-sdk/workflow-tengo`
(проверено на 6.8.2 и на текущем `origin/main` — код совпадает).
**Заказчик изменения:** блок `antibody-tcr-lead-selection`, но затрагивает всех
потребителей `pframes/bundle.lib.tengo`.

---

## Зачем это нужно

Блок мигрировал на новый column access API. Модель теперь кладёт в args
(`filters[].value.column`, `rankingOrder[].value.column`) идентификатор
`ColumnUniversalId`, полученный как `recipe.id` из `ColumnsCollection.discover()`
(`model/src/util.ts`, `matchToColumnId`). Тип поля — `ScopedColumnId.column:
ColumnUniversalId` (`model/src/types.ts`).

### Как было раньше

До миграции на проводе была только **идентичность колонки**, без информации о том,
как до неё дойти. Старый `ColumnCollectionBuilder.findColumns()` возвращал
`ColumnMatch = { column, variants }` и раскладывал попадание так:

```ts
const origId = hit.hit.columnId as PObjectId;
const col = this.columnsMap.get(origId) ?? throwError(...);
const path = hit.path.map((step) => ({ linker: ... }));   // линкеры — в variants
return acc.set(origId, { column: col, variants: [{ path, qualifications }] });
```

`matchToColumnId` брал `match.column.id`, а `columnsMap` был построен из
`ctx.resultPool.selectColumns(...)`, который отдаёт `{ id: canonicalize(ref) }` —
глобальный ref-id. Поэтому в args всегда уезжал leaf-id вида
`{__isRef, blockId, name}`, в том числе для попаданий через линкерную цепочку.

Линковку восстанавливал сам воркфлоу, независимо от модели: `main.tpl.tengo`
безусловно тянет все линкеры через `addMulti({... isLinkerColumn: "true" ...},
"linkers")`, а `initializeCloneTable` подмешивает их в джойн, когда этого требуют
выбранные фильтры/ранкинг или диверсификация.

### Что меняется

`ColumnUniversalId` переносит «как дойти» внутрь идентификатора:

```jsonc
// ColumnDiscoveredKey — lib/model/common/src/drivers/pframe/spec/discovered_column.ts
{
  "__isDiscovered": true,
  "column": "<ColumnUniversalId попадания>",
  "path": [{ "type": "linker", "column": "<ColumnUniversalId линкера>" }],
  "columnQualifications": [...],
  "queriesQualifications": { ... }
}
```

Поддержку в `addSingle` надо добавлять не потому, что раньше чего-то не хватало, а
потому что ответственность за путь переезжает из воркфлоу в идентификатор.

---

## Текущее поведение (проверено по коду)

Все ссылки — `sdk/workflow-tengo/src/pframes/bundle.lib.tengo` на `origin/main`.

### Шов 1 — регистрация: `addSingleInner` (строка 82)

Разбирает ровно четыре случая:

| Условие | Строка | Ветка |
|---|---|---|
| `decodedId.__isRef == true` | 119 | резолв по ref |
| `decodedId.resolvePath` определён | 134 | `ll.panic` |
| `decodedId.source` и `decodedId.axisFilters` определены | 138 | filtered id, ключ = `source` |
| иначе | 159 | `queries[keyToUse] = decodedId` — трактуется как anchored query |

`ColumnDiscoveredKey` (`{__isDiscovered, column, path?, …}`) и `ColumnOverriddenKey`
(`{source, specOverrides}` — без `axisFilters`) попадают в последнюю ветку. Ни то, ни
другое не является валидным `AnchoredPColumnSelector`, поэтому запрос уходит в
`bquery.anchoredQuery` (строка 305) в заведомо нерабочем виде.

### Шов 2 — чтение: `processColumnId` (строка 342)

Тот же разбор на стороне потребителя. Вычисляет `columnKey`, по которому
`getColumn` (457) и `getSpec` (502) достают колонку из `pool`. Понимает только
`{source, axisFilters}`; для всего остального `columnKey = id` целиком.

**Оба шва обязаны согласоваться.** Если научить только `addSingleInner`, колонка
зарегистрируется под одним ключом, а искаться будет под другим, и `getColumn`
упадёт на `ll.panic("Column not found: ...")`.

### Затронутые вызовы в блоке

Продюсер — `workflow/src/main.tpl.tengo`: строки 56, 66.
Потребитель — `workflow/src/utils.lib.tengo`: строки 325, 327, 332, 335, 372, 374,
408, 420, 432, 810, 840, 841.

---

## Требования

### Регистрация

The bundle collector shall accept a `ColumnDiscoveredId` wherever it accepts a
`SUniversalPColumnId`.

When `addSingle` receives an id whose decoded form satisfies `__isDiscovered == true`,
the bundle collector shall register the column identified by the `column` field.

When `addSingle` receives an id whose decoded form satisfies `__isDiscovered == true`
and whose `path` is a non-empty array, the bundle collector shall register every
linker column named in `path`.

Where a `queryKey` is supplied, the bundle collector shall store the result under
that `queryKey`.

If `addSingle` receives an id it cannot resolve, then the bundle collector shall fail
with a message naming the unsupported id shape.

### Чтение

When `getColumn` or `getSpec` receives a `ColumnDiscoveredId`, the bundle shall return
the column that `addSingle` registered for that same id.

When `getColumn` receives a `ColumnDiscoveredId`, the bundle shall apply the axis
filters and spec overrides carried by nested `ColumnFilteredKey` and
`ColumnOverriddenKey` layers of that id.

### Совместимость

The bundle collector shall keep resolving a global-form `PObjectId`
(`{__isRef, blockId, name}`) by ref.

The bundle collector shall keep resolving a `FilteredPColumnId`
(`{source, axisFilters}`) against its `source`.

The bundle shall not change the result it returns for any id shape it resolved before
this change.

### Вложенность

`ColumnUniversalId` — рекурсивная структура: `ColumnOverriddenKey.source` и
`ColumnFilteredKey.source` сами являются `ColumnUniversalId`, а
`ColumnDiscoveredKey.column` — тоже. Порядок слоёв, гарантируемый SDK: `Overridden`
всегда снаружи, внутри не более одного `Filtered` и не более одного `Discovered`
(см. `docs/column-access-api.md`, раздел «Id Shapes and Recipe Classes»).

When the bundle collector unwraps an id, it shall unwrap every nested layer until it
reaches a `PObjectId`.

---

## Точки решения

Это не додумано за реализатора — по каждому пункту нужно осознанное решение.

1. **Что делать с `path`.** Регистрировать линкеры и полагаться на существующий
   механизм джойна, или передавать путь в `bquery.anchoredQuery` явно, чтобы
   выбранный моделью маршрут соблюдался буквально. Второе точнее по духу нового API,
   но требует изменений в `anchoredQuery`, а не только в `bundle.lib.tengo`.

2. **`columnQualifications` / `queriesQualifications`.** Сейчас в воркфлоу нет ничего,
   что бы их читало. Нужно решить, переносятся ли они в запрос или игнорируются на
   этом шаге; если игнорируются — зафиксировать это в комментарии, а не молча.

3. **`ColumnOverriddenId`.** `discover()` его не возвращает, но `withSpecs()` и
   `splitByAxes()` возвращают, и в `addSingle` он падает в ту же нерабочую ветку.
   Решить, входит ли он в объём этой задачи. Если нет — как минимум заменить
   молчаливое падение на внятный `ll.panic`.

4. **Двусмысленность leaf-id.** Одна и та же колонка, достижимая двумя разными
   линкерными путями, раньше схлопывалась в один id (старый `findColumns` терял
   варианты). Новый id их различает. Проверить, что `cloneTable` в
   `utils.lib.tengo` корректно обрабатывает две колонки с одинаковым leaf и разными
   маршрутами — раньше такой ситуации не возникало.

---

## Проверка

Тесты воркфлоу-тенго живут рядом с исходниками в `sdk/workflow-tengo/src`.

The change shall be covered by a test that registers a `ColumnDiscoveredId` with a
non-empty `path` and reads it back through `getColumn`.

The change shall be covered by a test that registers a global-form `PObjectId` and a
`FilteredPColumnId` and asserts their results are unchanged.

Сквозная проверка на блоке: снять обход из «Что сделано вместо этого» (вернуть
`recipe.id` в `matchToColumnId`, убрать `dedupByLeafId`) на ветке
`chore/migrate-column-access-mechanism` и открыть проект с апстримной кластеризацией
— чтобы часть колонок в дропдаунах фильтров/ранкинга была достижима только через
линкер. Признак успеха — выбранный «кластерный» фильтр доезжает до `cloneTable` и
таблица считается. Автотестов в блоке нет (`vitest --passWithNoTests`), проверка
только ручная.

---

## Что сделано вместо этого

Блок сознательно вернул дореформенный контракт провода, оставив новый API внутри
модели. Две правки в `chore/migrate-column-access-mechanism`:

- `matchToColumnId` отдаёт `extractPObjectId(recipe.id)` — leaf-id, который
  `addSingle` резолвит по ref. Тип `ScopedColumnId.column` вернулся к `PObjectId`.
- `dedupByLeafId` схлопывает результаты дискавери до одной записи на колонку в
  списках фильтров и ранкинга. Старый `findColumns` делал это сам
  (`Map<PObjectId, ColumnMatch>`, варианты сливались в одну запись); новый
  `discover().getColumns()` возвращает по рецепту на вариант, и без схлопывания в
  дропдаунах появились бы дубли с одинаковым значением.

Обход стоит ровно на этих двух функциях в `model/src/util.ts` — снять его после
этой задачи можно точечно.

Что при этом потеряно: различение маршрутов из точки решения 4. Если одна колонка
достижима двумя линкерными путями, пользователь по-прежнему видит один пункт, а
воркфлоу сам выбирает линковку — как и до миграции.

---

## Источники

- `sdk/workflow-tengo/src/pframes/bundle.lib.tengo` (`origin/main`) — строки 82, 119,
  134, 138, 159, 305, 342, 457, 502.
- `lib/model/common/src/drivers/pframe/spec/discovered_column.ts` — форма
  `ColumnDiscoveredKey`.
- `lib/model/common/src/drivers/pframe/spec/ids.ts` — `ColumnUniversalId`,
  `extractPObjectId`, `reconstructSpecFromId`.
- `docs/column-access-api.md` — раздел «Id Shapes and Recipe Classes» (инварианты
  вложенности).
- `migrations/2026-05-20-new-column-access-mechanism.md` — раздел про
  `resultPool.getOptions`, где переход `PlRef` → `ColumnUniversalId` явно помечен как
  требующий отдельного обновления воркфлоу.
- Историческая реализация: `sdk/model/src/columns/column_collection_builder.ts` на
  коммите `1bfca16c05f0d91e6953d345e4438d75fd8470fc`.
