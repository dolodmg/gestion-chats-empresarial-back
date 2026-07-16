# Cambios de n8n para Fase 1

## Header obligatorio

Todos los requests a integraciones del backend deben enviar:

- `x-n8n-token: <N8N_API_TOKEN>`

## Endpoints que quedan autenticados

- `GET /api/n8n/check-chat-state`
- `POST /api/n8n/mark-chat-attention`
- `POST /api/n8n/register-template-send`
- `POST /api/n8n/register-member-template-send`
- `POST /api/n8n/change-chat-state/:chatId`
- `POST /api/message-notification`
- rutas bajo `/api/leads/*` ya usan el mismo token

## Cambio puntual en workflow

Si hoy llamas a `POST /api/n8n/change-chat-state/:chatId` sin headers, debes agregar:

```json
{
  "name": "x-n8n-token",
  "value": "={{ $env.N8N_API_TOKEN }}"
}
```

Si el token no vive en variables de entorno de n8n, usa una credencial o variable segura del workflow.

## Recomendacion de payload

Para `change-chat-state` enviar siempre:

```json
{
  "clientId": "phone_number_id",
  "status": "bot"
}
```
o
```json
{
  "clientId": "phone_number_id",
  "status": "human"
}
```

## Nota operativa

El dashboard ya no debe usar el JWT principal en query string para SSE o media. Ahora usa un `browserToken` corto emitido por el backend.
