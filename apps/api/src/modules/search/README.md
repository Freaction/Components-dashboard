# Search Module Architecture

This module handles global search across all Figma nodes and provides analytical statistics about component properties.

## Features
- **Global Search:** Full-text search (FTS5) across names and text content.
- **Advanced Filtering:** Filter by node type, team, and dynamic component properties.
- **Analytical Statistics:** Real-time aggregation of property usage across search results.
- **Interactive Analysis:** Click on properties to drill down into specific configurations.

## Modular Components

### Backend (`apps/api/src/modules/search`)
- `search.service.ts`: Core logic for building SQL queries with JSON property extraction and filtering.
- `search.controller.ts`: API routes for `/global` and `/global/stats`.

### Frontend (`apps/web/src/modules/Search`)
- `SearchView.tsx`: Main orchestrator, manages search state and active filters.
- `components/SearchStats.tsx`: Renders the "Global Search Statistics" panel.
- `components/SearchFilters.tsx`: Search inputs and sort options.

## Data Model & Performance
- **JSON Properties:** Component properties are stored as JSON in `node_metadata.properties_json`. 
- **Indexing:** Filtering uses `json_extract` in SQLite. For massive datasets, consider pre-calculating common properties into a dedicated table or using SQLite's JSON indexes.
- **Stats Calculation:** Statistics are recalculated on every search change to ensure accuracy for the current result set.

## Filtering by Properties
Property filters are passed as a JSON array of `{ key: string, value: string }` via the `props` query parameter.
The backend extracts the `.value` field from the property object in the database for comparison.
