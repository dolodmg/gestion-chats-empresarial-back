# Contrato de datos `messages`

## Objetivo

La colección `messages` debe tener un contrato único para:

- mensajes entrantes desde `n8n`
- mensajes salientes generados por IA
- mensajes manuales enviados desde dashboard
- plantillas de WhatsApp

## Campos mínimos requeridos

- `clientId`
- `chatId`
- `sender`
- `direction`
- `source`
- `provider`
- `content`
- `messageType`
- `status`
- `timestamp`

## Campos recomendados

- `messageId`
- `responseToMessageId`
- `phoneNumber`
- `contactName`
- `workflowId`
- `workflowName`
- `insertedBy`
- `aiGenerated`
- `templateName`
- `mediaUrl`
- `mediaType`
- `fileName`
- `mimeType`
- `metaStatus`
- `errorCode`
- `errorMessage`
- `retentionUntil`

## Reglas por origen

### n8n mensaje entrante

- `sender: "user"`
- `direction: "inbound"`
- `source: "n8n"`
- `provider: "whatsapp_meta"`
- `aiGenerated: false`
- `messageType: "text"` o tipo real de media

### n8n respuesta IA

- `sender: "bot"`
- `direction: "outbound"`
- `source: "n8n"`
- `provider: "whatsapp_meta"`
- `aiGenerated: true`
- `workflowId`: id del workflow
- `workflowName`: nombre del workflow

### dashboard mensaje manual

- `sender: "bot"`
- `direction: "outbound"`
- `source: "dashboard"`
- `provider: "internal"`
- `aiGenerated: false`
- `insertedBy`: `user:<id>` o `advisor:<id>`

### plantilla enviada desde backend

- `sender: "bot"`
- `direction: "outbound"`
- `source: "dashboard"`
- `provider: "whatsapp_meta"`
- `messageType: "template"`
- `templateName`: obligatorio

## Estrategia de deduplicación

La identidad lógica del mensaje es:

- `clientId + messageId`

Si `messageId` existe, no debe haber dos documentos con la misma combinación.

## Cambio requerido en n8n

En vez de insertar sólo:

- `clientId, chatId, contactName, phoneNumber, content, messageId, sender, status, timestamp`

debe insertar además:

- `direction`
- `source`
- `provider`
- `messageType`
- `aiGenerated`
- `workflowId`
- `workflowName`

## Nota

Si un workflow no puede hacer `upsert`, al menos debe consultar antes por `clientId + messageId` o tolerar el error de índice único y no reintentar ciegamente.
