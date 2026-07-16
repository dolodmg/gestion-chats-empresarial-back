const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function main() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  const apply = process.argv.includes('--apply');

  if (!mongoUri) {
    console.error('No se encontro MONGO_URI ni MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const Message = mongoose.connection.db.collection('messages');

  const duplicates = await Message.aggregate([
    {
      $match: {
        messageId: { $exists: true, $type: 'string', $ne: '' }
      }
    },
    {
      $group: {
        _id: {
          clientId: '$clientId',
          messageId: '$messageId'
        },
        ids: { $push: '$_id' },
        count: { $sum: 1 }
      }
    },
    {
      $match: {
        count: { $gt: 1 }
      }
    }
  ]).toArray();

  console.log(`Duplicados detectados: ${duplicates.length}`);

  if (!duplicates.length) {
    await mongoose.connection.close();
    return;
  }

  let totalDocsToDelete = 0;

  for (const duplicate of duplicates) {
    const docs = await Message.find({
      _id: { $in: duplicate.ids }
    }).sort({ timestamp: -1, _id: -1 }).toArray();

    const keep = docs[0];
    const remove = docs.slice(1).map((doc) => doc._id);
    totalDocsToDelete += remove.length;

    console.log(
      `clientId=${duplicate._id.clientId} messageId=${duplicate._id.messageId} keep=${keep._id} remove=${remove.join(',')}`
    );

    if (apply && remove.length > 0) {
      await Message.deleteMany({ _id: { $in: remove } });
    }
  }

  console.log(apply
    ? `Documentos eliminados: ${totalDocsToDelete}`
    : `Dry run: se eliminarian ${totalDocsToDelete} documentos. Usa --apply para aplicar cambios.`);

  await mongoose.connection.close();
}

main().catch(async (error) => {
  console.error(error);

  try {
    await mongoose.connection.close();
  } catch (closeError) {
    // noop
  }

  process.exit(1);
});
