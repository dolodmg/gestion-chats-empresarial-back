const certificateRequestService = require('../services/certificateRequestService');

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

exports.createCertificateRequest = async (req, res) => {
  try {
    const dni = String(req.body?.dni || '').trim();
    const correo = String(req.body?.correo || '').trim().toLowerCase();

    if (!dni || !/^\d+$/.test(dni)) {
      return res.status(400).json({
        success: false,
        message: 'El DNI es obligatorio y debe ingresarse solo con números, sin puntos ni guiones.'
      });
    }

    if (!correo || !isValidEmail(correo)) {
      return res.status(400).json({
        success: false,
        message: 'El correo es obligatorio y debe tener un formato válido. Ejemplo: asd@dominio.com'
      });
    }

    const existingRequest = await certificateRequestService.hasExistingRequest(dni);
    if (existingRequest) {
      return res.status(409).json({
        success: false,
        code: 'ALREADY_REQUESTED',
        message: 'Ese DNI ya fue solicitado anteriormente.'
      });
    }

    const job = await certificateRequestService.createJob({
      dni,
      correo
    });

    certificateRequestService.enqueueJob(job.id);

    return res.status(202).json({
      success: true,
      message: 'Datos recibidos',
      jobId: job.id
    });
  } catch (error) {
    console.error('[certificate-requests] error creando solicitud:', error);
    return res.status(500).json({
      success: false,
      message: 'No se pudo recibir la solicitud.'
    });
  }
};

exports.getCertificateRequestStatus = async (req, res) => {
  const job = await certificateRequestService.getJob(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      message: 'Solicitud no encontrada.'
    });
  }

  return res.json({
    success: true,
    job
  });
};
