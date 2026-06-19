const mongoose = require('mongoose');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Campaign = require('../models/Campaign');
const EmailCredential = require('../models/EmailCredential');
const SendingDomain = require('../models/SendingDomain');

const SOURCE_CLIENT_ID = process.argv[2] || '751524394719240';
const TARGET_CLIENT_ID = process.argv[3] || '854878027706123';
const INCLUDE_EMAIL_ASSETS = process.argv.includes('--with-email-assets');

async function loadClientUser(clientId) {
  return User.findOne({ clientId, role: 'client' }).select('_id name email clientId role');
}

async function countAssetsByUser(userId) {
  const [campaigns, emailCredentials, sendingDomains] = await Promise.all([
    Campaign.countDocuments({ createdBy: userId }),
    EmailCredential.countDocuments({ createdBy: userId }),
    SendingDomain.countDocuments({ createdBy: userId })
  ]);

  return { campaigns, emailCredentials, sendingDomains };
}

async function transferCampaignAssets() {
  if (!process.env.MONGO_URI) {
    throw new Error(`MONGO_URI no está definido en ${path.join(__dirname, '..', '.env')}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Conectado a MongoDB');

  const [sourceUser, targetUser] = await Promise.all([
    loadClientUser(SOURCE_CLIENT_ID),
    loadClientUser(TARGET_CLIENT_ID)
  ]);

  if (!sourceUser) {
    throw new Error(`No se encontró usuario cliente origen para clientId ${SOURCE_CLIENT_ID}`);
  }

  if (!targetUser) {
    throw new Error(`No se encontró usuario cliente destino para clientId ${TARGET_CLIENT_ID}`);
  }

  console.log('\n=== TRASPASO DE CAMPAÑAS ENTRE CLIENTES ===\n');
  console.log(`Origen : ${sourceUser.name} <${sourceUser.email}> (${sourceUser.clientId})`);
  console.log(`Destino: ${targetUser.name} <${targetUser.email}> (${targetUser.clientId})`);

  const sourceBefore = await countAssetsByUser(sourceUser._id);
  const targetBefore = await countAssetsByUser(targetUser._id);

  console.log('\n📊 Estado previo');
  console.log(`   Origen  - Campañas: ${sourceBefore.campaigns}, SMTP: ${sourceBefore.emailCredentials}, Dominios: ${sourceBefore.sendingDomains}`);
  console.log(`   Destino - Campañas: ${targetBefore.campaigns}, SMTP: ${targetBefore.emailCredentials}, Dominios: ${targetBefore.sendingDomains}`);

  if (
    sourceBefore.campaigns === 0 &&
    sourceBefore.emailCredentials === 0 &&
    sourceBefore.sendingDomains === 0
  ) {
    console.log('\n⚠️ No hay activos de campañas para mover en el cliente origen.');
    return;
  }

  console.log(`\nModo: ${INCLUDE_EMAIL_ASSETS ? 'campañas + SMTP + dominios' : 'solo campañas'}`);
  console.log('\n⏳ Esperando 5 segundos antes de ejecutar. Cancelá con Ctrl+C si no corresponde...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  const campaignResult = await Campaign.updateMany(
    { createdBy: sourceUser._id },
    { $set: { createdBy: targetUser._id } }
  );

  let credentialResult = { modifiedCount: 0 };
  let domainResult = { modifiedCount: 0 };

  if (INCLUDE_EMAIL_ASSETS) {
    [credentialResult, domainResult] = await Promise.all([
      EmailCredential.updateMany(
        { createdBy: sourceUser._id },
        { $set: { createdBy: targetUser._id } }
      ),
      SendingDomain.updateMany(
        { createdBy: sourceUser._id },
        { $set: { createdBy: targetUser._id } }
      )
    ]);
  }

  const sourceAfter = await countAssetsByUser(sourceUser._id);
  const targetAfter = await countAssetsByUser(targetUser._id);

  console.log('\n✅ Traspaso ejecutado');
  console.log(`   Campañas movidas: ${campaignResult.modifiedCount}`);
  console.log(`   Credenciales SMTP movidas: ${credentialResult.modifiedCount}`);
  console.log(`   Dominios autenticados movidos: ${domainResult.modifiedCount}`);

  console.log('\n📊 Estado final');
  console.log(`   Origen  - Campañas: ${sourceAfter.campaigns}, SMTP: ${sourceAfter.emailCredentials}, Dominios: ${sourceAfter.sendingDomains}`);
  console.log(`   Destino - Campañas: ${targetAfter.campaigns}, SMTP: ${targetAfter.emailCredentials}, Dominios: ${targetAfter.sendingDomains}`);
}

transferCampaignAssets()
  .catch(error => {
    console.error('\n❌ Error en el traspaso:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  });
