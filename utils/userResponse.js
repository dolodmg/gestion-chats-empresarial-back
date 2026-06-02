function serializeUser(user) {
  if (!user) {
    return null;
  }

  const source = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  const hasWhatsappToken = Boolean(source.whatsappToken);

  delete source.password;
  delete source.whatsappToken;

  return {
    ...source,
    hasWhatsappToken
  };
}

module.exports = {
  serializeUser
};
