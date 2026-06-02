# Cambios de n8n para Fase 2

## Objetivo

Que `n8n` escriba el mismo contrato de datos que usa el backend.

## Nodo "Mensaje Emisor" recomendado

Además de:

- `clientId`
- `chatId`
- `contactName`
- `phoneNumber`
- `content`
- `messageId`
- `sender`
- `status`
- `timestamp`

agregar:

- `direction: "inbound"`
- `source: "n8n"`
- `provider: "whatsapp_meta"`
- `messageType: "text"` o tipo real
- `aiGenerated: false`
- `workflowId`
- `workflowName`

## Nodo "Mensaje Receptor" recomendado

Además de los campos actuales, agregar:

- `direction: "outbound"`
- `source: "n8n"`
- `provider: "whatsapp_meta"`
- `messageType: "text"` o tipo real
- `aiGenerated: true`
- `workflowId`
- `workflowName`

## Dedupe

La clave lógica es:

- `clientId + messageId`

Si el nodo Mongo sólo inserta y no hace `upsert`, tienes dos opciones:

1. Consultar antes si ya existe `messageId` para ese `clientId`.
2. Insertar y, si el backend/DB devuelve error de índice único, tratarlo como duplicado no fatal.

## Campo `messageId`

Debe ser el id real del mensaje de WhatsApp/Meta cuando exista.
No usar `_id` de Mongo como reemplazo.

## Campos mínimos por tipo

### Entrante usuario

```json
{
  "sender": "user",
  "direction": "inbound",
  "source": "n8n",
  "provider": "whatsapp_meta",
  "aiGenerated": false
}
```

### Saliente IA

```json
{
  "sender": "bot",
  "direction": "outbound",
  "source": "n8n",
  "provider": "whatsapp_meta",
  "aiGenerated": true
}
```
