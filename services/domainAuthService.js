const crypto = require('crypto');
const dns = require('dns');
const dnsPromises = dns.promises;

const DOMAIN_REGEX = /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const LABEL_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;

function normalizeDomain(domain) {
    return String(domain || '')
        .trim()
        .toLowerCase()
        .replace(/\.+$/, '');
}

function validateDomain(domain) {
    return DOMAIN_REGEX.test(normalizeDomain(domain));
}

function validateLabel(label) {
    return LABEL_REGEX.test(String(label || '').trim().toLowerCase());
}

function generateVerificationToken() {
    return crypto.randomBytes(24).toString('hex');
}

function generateDkimKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    const publicKeyValue = publicKey
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s+/g, '');

    return {
        publicKey,
        publicKeyValue,
        privateKey
    };
}

function resolveSystemHostname() {
    const configuredUrl =
        process.env.PUBLIC_BASE_URL ||
        process.env.API_PUBLIC_BASE_URL ||
        process.env.BACKEND_PUBLIC_URL ||
        process.env.BACKEND_URL ||
        process.env.FRONTEND_URL ||
        process.env.APP_URL ||
        'https://misistema.com';

    try {
        return new URL(configuredUrl).hostname;
    } catch (error) {
        return configuredUrl
            .replace(/^https?:\/\//i, '')
            .replace(/\/.*$/, '')
            .replace(/\.+$/, '');
    }
}

function buildSpfValue() {
    const includeDomain = normalizeDomain(process.env.SPF_INCLUDE_DOMAIN || 'spf.misistema.com');
    return `v=spf1 include:${includeDomain} ~all`;
}

function buildDmarcRua(domain) {
    return String(process.env.DMARC_REPORT_EMAIL || `postmaster@${domain}`).trim().toLowerCase();
}

function buildDmarcValue(domain, dmarcRua) {
    const rua = dmarcRua || buildDmarcRua(domain);
    return `v=DMARC1; p=none; rua=mailto:${rua}`;
}

function buildTrackingTarget() {
    return normalizeDomain(process.env.TRACKING_CNAME_TARGET || `tracking.${resolveSystemHostname()}`);
}

function buildBounceTarget() {
    return normalizeDomain(process.env.BOUNCE_CNAME_TARGET || `bounce.${resolveSystemHostname()}`);
}

function buildDnsRecords(domainDoc) {
    const domain = normalizeDomain(domainDoc.domain);
    const dkimSelector = domainDoc.dkimSelector || 'default';
    const dmarcRua = domainDoc.dmarcRua || buildDmarcRua(domain);
    const dmarcValue = domainDoc.dmarcValue || buildDmarcValue(domain, dmarcRua);
    const spfValue = domainDoc.spfValue || buildSpfValue();

    return [
        {
            key: 'ownership',
            label: 'Verificación de dominio',
            type: 'TXT',
            host: domainDoc.verificationHost || `_mailauth.${domain}`,
            value: domainDoc.verificationToken
        },
        {
            key: 'spf',
            label: 'SPF',
            type: 'TXT',
            host: domain,
            value: spfValue
        },
        {
            key: 'dkim',
            label: 'DKIM',
            type: 'TXT',
            host: `${dkimSelector}._domainkey.${domain}`,
            value: `v=DKIM1; k=rsa; p=${domainDoc.dkimPublicKey}`
        },
        {
            key: 'dmarc',
            label: 'DMARC',
            type: 'TXT',
            host: `_dmarc.${domain}`,
            value: dmarcValue
        },
        {
            key: 'tracking',
            label: 'Tracking domain',
            type: 'CNAME',
            host: domainDoc.trackingSubdomain,
            value: domainDoc.trackingTarget
        },
        {
            key: 'bounce',
            label: 'Bounce domain',
            type: 'CNAME',
            host: domainDoc.bounceSubdomain,
            value: domainDoc.bounceTarget
        }
    ];
}

async function resolveWithFallback(method, host) {
    try {
        return await dnsPromises[method](host);
    } catch (primaryError) {
        const resolver = new dns.Resolver();
        resolver.setServers(['1.1.1.1', '8.8.8.8']);

        try {
            return await new Promise((resolve, reject) => {
                resolver[method](host, (error, result) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(result);
                });
            });
        } catch (fallbackError) {
            return [];
        }
    }
}

async function resolveTxtValues(host) {
    const rows = await resolveWithFallback('resolveTxt', host);
    return Array.isArray(rows) ? rows.map(parts => Array.isArray(parts) ? parts.join('') : String(parts)) : [];
}

async function resolveCnameValue(host) {
    const rows = await resolveWithFallback('resolveCname', host);
    return Array.isArray(rows) && rows[0] ? normalizeDomain(rows[0]) : '';
}

function normalizeTxt(value) {
    return String(value || '')
        .replace(/^"(.*)"$/, '$1')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTagValueRecord(value) {
    return normalizeTxt(value)
        .split(';')
        .map(part => part.trim())
        .filter(Boolean)
        .reduce((accumulator, part) => {
            const separatorIndex = part.indexOf('=');
            if (separatorIndex === -1) {
                return accumulator;
            }

            const key = part.slice(0, separatorIndex).trim().toLowerCase();
            const tagValue = part.slice(separatorIndex + 1).trim();

            if (key) {
                accumulator[key] = tagValue;
            }

            return accumulator;
        }, {});
}

function buildStatus(host, expectedValue, actualValue, status, errorMessage) {
    return {
        host,
        expectedValue,
        actualValue,
        status,
        errorMessage: status === 'configured' ? '' : (errorMessage || ''),
        checkedAt: new Date()
    };
}

async function verifyDnsConfiguration(domainDoc) {
    const records = buildDnsRecords(domainDoc);
    const statuses = {};

    for (const record of records) {
        if (record.type === 'TXT') {
            const actualValues = await resolveTxtValues(record.host);
            const normalizedExpected = normalizeTxt(record.value);
            const normalizedValues = actualValues.map(normalizeTxt);

            let isConfigured = normalizedValues.includes(normalizedExpected);

            if (!isConfigured && record.key === 'spf') {
                const includeMatch = normalizedExpected.match(/include:([^\s]+)/i);
                if (includeMatch) {
                    isConfigured = normalizedValues.some(value =>
                        /^v=spf1/i.test(value) && value.includes(`include:${includeMatch[1]}`)
                    );
                }
            }

            if (!isConfigured && record.key === 'dkim') {
                isConfigured = normalizedValues.some(value =>
                    value.includes('v=DKIM1') && value.includes(`p=${domainDoc.dkimPublicKey}`)
                );
            }

            if (!isConfigured && record.key === 'dmarc') {
                const expectedTags = parseTagValueRecord(record.value);
                isConfigured = normalizedValues.some(value => {
                    const actualTags = parseTagValueRecord(value);

                    if (String(actualTags.v || '').toUpperCase() !== 'DMARC1') {
                        return false;
                    }

                    if ((actualTags.p || '').toLowerCase() !== String(expectedTags.p || '').toLowerCase()) {
                        return false;
                    }

                    if (expectedTags.rua) {
                        return String(actualTags.rua || '').toLowerCase() === String(expectedTags.rua).toLowerCase();
                    }

                    return true;
                });
            }

            statuses[record.key] = buildStatus(
                record.host,
                record.value,
                actualValues.join(' | '),
                isConfigured ? 'configured' : actualValues.length ? 'error' : 'pending',
                actualValues.length ? 'El valor publicado no coincide con el esperado.' : 'No se encontró el registro todavía.'
            );
        } else if (record.type === 'CNAME') {
            const actualValue = await resolveCnameValue(record.host);
            const expectedValue = normalizeDomain(record.value);
            const isConfigured = actualValue === expectedValue;

            statuses[record.key] = buildStatus(
                record.host,
                record.value,
                actualValue,
                isConfigured ? 'configured' : actualValue ? 'error' : 'pending',
                actualValue ? 'El CNAME apunta a un destino distinto al requerido.' : 'No se encontró el CNAME todavía.'
            );
        }
    }

    return {
        statuses,
        isVerified: statuses.ownership?.status === 'configured',
        isReadyForSending: ['ownership', 'dkim', 'tracking', 'bounce'].every(
            key => statuses[key]?.status === 'configured'
        )
    };
}

function domainMatchesEmail(email, domain) {
    const emailValue = String(email || '').trim().toLowerCase();
    const [, emailDomain = ''] = emailValue.split('@');
    const normalizedDomain = normalizeDomain(domain);

    return emailDomain === normalizedDomain || emailDomain.endsWith(`.${normalizedDomain}`);
}

function serializeSendingDomain(domainDoc) {
    const plain = domainDoc.toJSON ? domainDoc.toJSON() : domainDoc;
    return {
        ...plain,
        dnsRecords: buildDnsRecords(plain)
    };
}

module.exports = {
    buildBounceTarget,
    buildDmarcRua,
    buildDmarcValue,
    buildDnsRecords,
    buildSpfValue,
    buildTrackingTarget,
    domainMatchesEmail,
    generateDkimKeyPair,
    generateVerificationToken,
    normalizeDomain,
    resolveSystemHostname,
    serializeSendingDomain,
    validateDomain,
    validateLabel,
    verifyDnsConfiguration
};
