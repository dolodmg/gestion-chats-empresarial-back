const crypto = require('crypto');
const axios = require('axios');

const Inscription = require('../models/Inscription');
const CertificateRequest = require('../models/CertificateRequest');
const EmailService = require('./emailService');

const CERTIFICATE_CUTOFF_2026 = new Date('2026-03-12T00:00:00.000Z');

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

class CertificateRequestService {
  constructor() {
    this.jobs = new Map();
    this.emailService = new EmailService();
    this.queue = [];
    this.isProcessingQueue = false;
  }

  async hasExistingRequest(dni) {
    const normalizedDni = normalizeDigits(dni);

    const [existingRequest] = await CertificateRequest.aggregate([
      {
        $addFields: {
          normalizedDni: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: { $toString: '$dni' },
                      find: '.',
                      replacement: ''
                    }
                  },
                  find: '-',
                  replacement: ''
                }
              },
              find: ' ',
              replacement: ''
            }
          }
        }
      },
      {
        $match: {
          normalizedDni,
          status: { $ne: 'failed' }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $limit: 1
      }
    ]);

    return existingRequest || null;
  }

  async createJob(payload) {
    const id = crypto.randomUUID();
    const now = new Date();
    const job = {
      id,
      status: 'queued',
      payload: {
        dni: normalizeDigits(payload.dni),
        correo: String(payload.correo || '').trim().toLowerCase(),
        nombreCompleto: String(payload.nombreCompleto || '').trim()
      },
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      finishedAt: null,
      result: null,
      error: null
    };

    await CertificateRequest.create({
      dni: job.payload.dni,
      correo: job.payload.correo,
      nombreCompleto: job.payload.nombreCompleto,
      jobId: job.id,
      status: job.status,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    });

    this.jobs.set(id, job);
    return this.serializeJob(job);
  }

  async getJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job) {
      return this.serializeJob(job);
    }

    const persistedJob = await CertificateRequest.findOne({ jobId }).lean();
    return persistedJob ? this.serializePersistedJob(persistedJob) : null;
  }

  enqueueJob(jobId) {
    this.queue.push(jobId);
    this.processQueue().catch((error) => {
      console.error('[certificate-requests] error procesando cola:', error);
      this.isProcessingQueue = false;
    });
  }

  async processQueue() {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.queue.length > 0) {
        const nextJobId = this.queue.shift();
        await this.processJob(nextJobId);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async processJob(jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'queued') {
      return;
    }

    job.status = 'processing';
    job.startedAt = new Date();
    job.updatedAt = new Date();
    await this.persistJob(job);

    try {
      const inscriptions = await this.findEligibleInscriptions(job.payload.dni);
      if (inscriptions.length === 0) {
        throw new Error('No se encontraron inscripciones 2026 para el DNI recibido.');
      }

      const payload = this.buildDelegationPayload(job, inscriptions);
      const responseData = await this.notifyAppScript(payload);

      if (!responseData || responseData.success !== true) {
        throw new Error(responseData?.error || responseData?.message || 'Apps Script no devolvio una respuesta valida.');
      }

      if (responseData.status === 'failed') {
        throw new Error(responseData?.error || 'Apps Script informo un fallo procesando la solicitud.');
      }

      await this.sendSuccessEmail({
        to: job.payload.correo,
        nombreCompleto: responseData?.result?.nombreCompleto || payload.nombreCompleto || '',
        generatedCourses: responseData?.result?.cursosGenerados || [],
        failedCourses: responseData?.result?.cursosFallidos || []
      });

      job.status = responseData.status || 'completed';
      job.result = responseData.result || null;
      job.error = null;
    } catch (error) {
      job.status = 'failed';
      job.result = null;
      job.error = error.message;
    } finally {
      job.finishedAt = new Date();
      job.updatedAt = new Date();
      await this.persistJob(job);
    }
  }

  async findEligibleInscriptions(dni) {
    const normalizedDni = normalizeDigits(dni);
    const inscriptions = await Inscription.aggregate([
      {
        $match: {
          createdAt: { $gte: CERTIFICATE_CUTOFF_2026 }
        }
      },
      {
        $addFields: {
          normalizedDni: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: { $toString: '$dni' },
                      find: '.',
                      replacement: ''
                    }
                  },
                  find: '-',
                  replacement: ''
                }
              },
              find: ' ',
              replacement: ''
            }
          }
        }
      },
      {
        $match: {
          normalizedDni
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $project: {
          dni: 1,
          nombreCompleto: 1,
          correo: 1,
          curso: 1,
          createdAt: 1
        }
      }
    ]);

    const deduped = new Map();
    for (const inscription of inscriptions) {
      const key = normalizeText(inscription.curso);
      if (!deduped.has(key)) {
        deduped.set(key, inscription);
      }
    }

    return Array.from(deduped.values());
  }

  buildDelegationPayload(job, inscriptions) {
    const resolvedStudentName = inscriptions.find((item) => String(item.nombreCompleto || '').trim())?.nombreCompleto || '';

    return {
      requestSecret: process.env.CERTIFICATE_APPS_SCRIPT_SECRET || '',
      jobId: job.id,
      dni: job.payload.dni,
      correo: job.payload.correo,
      nombreCompleto: job.payload.nombreCompleto || resolvedStudentName,
      period: '2026',
      inscriptions: inscriptions.map((item) => ({
        curso: String(item.curso || '').trim(),
        nombreCompleto: String(item.nombreCompleto || '').trim(),
        correo: String(item.correo || '').trim().toLowerCase(),
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null
      }))
    };
  }

  async notifyAppScript(payload) {
    const webhookUrl = process.env.CERTIFICATE_APPS_SCRIPT_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error('Falta configurar CERTIFICATE_APPS_SCRIPT_WEBHOOK_URL.');
    }

    const response = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.CERTIFICATE_APPS_SCRIPT_TIMEOUT_MS || 330000),
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      validateStatus: () => true
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        response.data?.error ||
        response.data?.message ||
        `Apps Script respondio con status ${response.status}.`
      );
    }

    return response.data;
  }

  async sendSuccessEmail({ to, nombreCompleto, generatedCourses, failedCourses }) {
    const htmlCourses = generatedCourses
      .map((course) => {
        const safeCurso = String(course.curso || '');
        const safeCodigo = String(course.codigoCSB || '');
        const safeUrl = String(course.driveUrl || '');

        return `<li><strong>${safeCurso}</strong> - Codigo: ${safeCodigo}${safeUrl ? ` - <a href="${safeUrl}">Descargar certificado</a>` : ''}</li>`;
      })
      .join('');

    const htmlFailedCourses = failedCourses.length > 0
      ? `
        <p>Los siguientes cursos no pudieron generarse:</p>
        <ul>${failedCourses.map((course) => `<li><strong>${String(course.curso || '')}</strong>: ${String(course.error || '')}</li>`).join('')}</ul>
      `
      : '';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827;">
        <h2>Certificados generados</h2>
        <p>Hola ${nombreCompleto || 'alumno/a'},</p>
        <p>Te enviamos los certificados generados para tus cursos 2026.</p>
        <p>Links de descarga:</p>
        <ul>${htmlCourses}</ul>
        ${htmlFailedCourses}
      </div>
    `;

    const text = [
      `Hola ${nombreCompleto || 'alumno/a'},`,
      '',
      'Te enviamos los certificados generados para tus cursos 2026.',
      'Links de descarga:',
      ...generatedCourses.map((course) => `- ${String(course.curso || '')} (Codigo: ${String(course.codigoCSB || '')}) ${String(course.driveUrl || '')}`),
      failedCourses.length > 0 ? '' : null,
      failedCourses.length > 0 ? 'Cursos no generados:' : null,
      ...failedCourses.map((course) => `- ${String(course.curso || '')}: ${String(course.error || '')}`)
    ].filter(Boolean).join('\n');

    await this.emailService.sendMail({
      to,
      subject: process.env.CERTIFICATE_SUCCESS_SUBJECT || 'Tus certificados ya estan listos',
      html,
      text,
      fromName: process.env.CERTIFICATE_EMAIL_FROM_NAME || 'Certificados'
    });
  }

  async persistJob(job) {
    await CertificateRequest.updateOne(
      { jobId: job.id },
      {
        $set: {
          dni: job.payload.dni,
          correo: job.payload.correo,
          nombreCompleto: job.payload.nombreCompleto || '',
          status: job.status,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          result: job.result,
          error: job.error,
          updatedAt: job.updatedAt
        },
        $setOnInsert: {
          createdAt: job.createdAt
        }
      }
    );
  }

  serializeJob(job) {
    return {
      id: job.id,
      status: job.status,
      payload: {
        dni: job.payload.dni,
        correo: job.payload.correo,
        nombreCompleto: job.payload.nombreCompleto
      },
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.result,
      error: job.error
    };
  }

  serializePersistedJob(job) {
    return {
      id: job.jobId,
      status: job.status,
      payload: {
        dni: job.dni,
        correo: job.correo,
        nombreCompleto: job.nombreCompleto || ''
      },
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.result,
      error: job.error
    };
  }
}

module.exports = new CertificateRequestService();
