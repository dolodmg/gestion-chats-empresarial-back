# Auditoría Fase 3

## Colección

- `auditlogs`

## Campos principales

- `actorId`
- `actorRole`
- `actorEmail`
- `clientId`
- `action`
- `targetType`
- `targetId`
- `metadata`
- `ip`
- `userAgent`
- `createdAt`

## Eventos cubiertos

- login exitoso
- emisión de browser token
- cambio de contraseña
- export de chats
- lectura de todos los chat ids para export
- cambio de estado bot/human
- envío manual
- asignación de asesor
- borrado de mensaje
- borrado de chat
- envío de plantilla
- alta, edición y baja de usuarios

## Principio

La auditoría no debe almacenar secretos.
Por eso se filtran:

- `password`
- `currentPassword`
- `newPassword`
- `whatsappToken`
- `token`
- `browserToken`
