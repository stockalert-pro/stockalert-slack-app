# Alternative: Edge Config statt Datenbank?

## Warum das keine gute Idee ist:

### Edge Config Limitierungen:
- Max 512 KB pro Edge Config Store
- Nur Key-Value Storage
- Optimiert für Reads, nicht Writes
- Keine Queries oder Relationen

### Was wir speichern müssen:
```json
{
  "installations": {
    "T12345": {
      "teamName": "...",
      "botToken": "xoxb-...",
      "channels": ["C123", "C456"],
      // ...
    }
  },
  "oauthStates": {
    "state123": {
      "expires": "2025-01-07T10:00:00Z"
    }
  },
  "webhookEvents": {
    // Tausende Events...
  }
}
```

### Probleme:
1. **Size Limit**: 512 KB reicht nur für ~50-100 Teams
2. **No Cleanup**: Alte OAuth States und Events müssten manuell gelöscht werden
3. **Race Conditions**: Keine atomaren Updates
4. **No Queries**: Kann nicht "alle Events von heute" abfragen

## Fazit:
Edge Config ist für App-Config gedacht, nicht als Datenbank-Ersatz. Eine richtige Datenbank (Neon/Postgres) ist hier die richtige Wahl.