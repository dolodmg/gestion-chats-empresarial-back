// INSTRUCCIONES: Reemplaza las líneas 409-415 en customTableController.js con este código:

// 🔑 NUEVO: Obtener la definición de la tabla (por ID o collectionName)
let customTable;
if (mongoose.Types.ObjectId.isValid(tableId)) {
    customTable = await CustomTable.findById(tableId);
} else {
    console.log(`🔍 Buscando tabla por collectionName: ${tableId}`);
    customTable = await CustomTable.findOne({ collectionName: tableId });
}

if (!customTable) {
    return res.status(404).json({
        success: false,
        error: 'Tabla no encontrada'
    });
}

// CÓDIGO ORIGINAL A REEMPLAZAR (líneas 409-415):
//     // Obtener la definición de la tabla
//     const customTable = await CustomTable.findById(tableId);
//     if (!customTable) {
//       return res.status(404).json({
//         success: false,
//         error: 'Tabla no encontrada'
//       });
//     }
