const Inscription = require('../models/Inscription');

// Lista de provincias argentinas válidas
const PROVINCIAS_ARGENTINAS = [
  'buenos aires',
  'caba',
  'cordoba',
  'santa fe',
  'tucuman',
  'entre rios',
  'neuquen',
  'rio negro',
  'misiones',
  'corrientes',
  'formosa',
  'chaco',
  'catamarca',
  'la rioja',
  'santiago del estero',
  'salta',
  'jujuy',
  'san juan',
  'san luis',
  'la pampa',
  'mendoza',
  'chubut',
  'santa cruz',
  'tierra del fuego'
];

const COURSE_2026_DEFINITIONS = [
  { normalizedName: 'inteligencia artificial', displayName: 'Inteligencia Artificial', aliases: ['inteligencia artificial'] },
  { normalizedName: 'de 0 a experto en marketing digital', displayName: 'De 0 a experto en marketing digital', aliases: ['de 0 a experto en marketing digital', 'de 0 a experto digital'] },
  { normalizedName: 'ugc y marketing de contenidos', displayName: 'UGC y Marketing de contenidos', aliases: ['ugc y marketing de contenidos'] },
  { normalizedName: 'como emprender desde la mirada del marketing', displayName: '¿Cómo Emprender desde la Mirada del Marketing?' },
  { normalizedName: 'vendedor todoterreno', displayName: 'Vendedor Todoterreno' },
  { normalizedName: 'diseno grafico', displayName: 'Diseño Gráfico' },
  { normalizedName: 'mujeres que lideran', displayName: 'Mujeres que Lideran' },
  { normalizedName: 'edicion de videos y reels', displayName: 'Edición de Videos y Reels' }
];

const COURSE_2026_ALIASES = {
  'como emprender desde la mirada del marketing': [
    'como emprender desde la mirada del marketing',
    'como emprender desde la mirada marketing',
    'emprender marketing'
  ]
};

const EXACT_2026_COURSES = COURSE_2026_DEFINITIONS.flatMap((course) =>
  COURSE_2026_ALIASES[course.normalizedName] || course.aliases || [course.normalizedName]
);

const COURSE_2026_SUFFIX = '__2026';

// Configuración para normalización de cursos
const COURSE_CONFIG = {
  // Normalizar nombres de cursos
  normalize: function (courseName) {
    if (!courseName) return '';
    return courseName
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
      .replace(/\s+/g, ' ') // Normalizar espacios
      .replace(/[^\w\s]/g, '') // Quitar caracteres especiales
      .trim();
  },

  // Mapeo de variantes (para agrupar duplicados)
  variants: {
    'inteligencia artificial': [
      'inteligencia artificial',
      'curso de inteligencia artificial',
      'ia',
      'artificial intelligence'
    ],
    'de 0 a experto en marketing digital': [
      'de 0 a experto en marketing digital',
      'de 0 a experto digital',
      '0 a experto digital',
      'experto digital'
    ],
    'ugc y marketing de contenidos': [
      'ugc y marketing de contenidos',
      'ugc',
      'marketing de contenidos'
    ],
    'como emprender desde la mirada del marketing': [
      '¿cómo emprender desde la mirada del marketing?',
      'como emprender desde la mirada del marketing',
      'emprender marketing'
    ],
    'vendedor todoterreno': [
      'vendedor todoterreno',
      'ventas'
    ],
    'diseno grafico': [
      'diseno grafico',
      'diseño grafico',
      'graphic design'
    ],
    'mujeres que lideran': [
      'mujeres que lideran',
      'lideran mujeres'
    ],
    'edicion de videos y reels': [
      'edicion de videos y reels',
      'edicion de video',
      'video editing'
    ]
  },

  // Aplicar filtro de curso
  applyFilter: function (query, courseFilter) {
    if (!courseFilter || courseFilter === 'todos') return;

    if (courseFilter === 'otros__2026') {
      const cutoffDate = new Date('2026-03-12T00:00:00.000Z');
      query.$and = query.$and || [];
      query.$and.push({
        $expr: {
          $not: {
            $in: [
              buildNormalizedCourseExpression(),
              EXACT_2026_COURSES
            ]
          }
        }
      });
      query.$and.push({ createdAt: { $gte: cutoffDate } });
      return;
    }

    if (courseFilter.endsWith(COURSE_2026_SUFFIX)) {
      const normalizedBaseFilter = courseFilter.slice(0, -COURSE_2026_SUFFIX.length);
      const matchedAliases = COURSE_2026_ALIASES[normalizedBaseFilter] || [normalizedBaseFilter];
      const cutoffDate = new Date('2026-03-12T00:00:00.000Z');

      query.$and = query.$and || [];
      query.$and.push(buildNormalizedCourseExactMatch(matchedAliases));
      query.$and.push({ createdAt: { $gte: cutoffDate } });
      return;
    }

    const normalizedFilter = this.normalize(courseFilter);

    // Buscar si corresponde a un grupo de variantes
    const variants = this.variants[normalizedFilter];
    if (variants) {
      // Crear regex para cada variante
      const regexPatterns = variants.map(variant =>
        new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      );
      query.curso = { $in: regexPatterns };
    } else {
      // Filtro simple
      query.curso = { $regex: courseFilter, $options: 'i' };
    }
  }
};

function buildNormalizedCourseExpression() {
  return {
    $trim: {
      input: {
        $replaceAll: {
          input: {
            $replaceAll: {
              input: {
                $replaceAll: {
                  input: {
                    $replaceAll: {
                      input: {
                        $replaceAll: {
                          input: {
                            $replaceAll: {
                              input: {
                                $replaceAll: {
                                  input: {
                                    $replaceAll: {
                                      input: {
                                        $replaceAll: {
                                          input: {
                                            $replaceAll: {
                                              input: { $toLower: '$curso' },
                                              find: '\u00e1',
                                              replacement: 'a'
                                            }
                                          },
                                          find: '\u00e9',
                                          replacement: 'e'
                                        }
                                      },
                                      find: '\u00ed',
                                      replacement: 'i'
                                    }
                                  },
                                  find: '\u00f3',
                                  replacement: 'o'
                                }
                              },
                              find: '\u00fa',
                              replacement: 'u'
                            }
                          },
                          find: '\u00fc',
                          replacement: 'u'
                        }
                      },
                      find: '\u00f1',
                      replacement: 'n'
                    }
                  },
                  find: '?',
                  replacement: ''
                }
              },
              find: '\u00bf',
              replacement: ''
            }
          },
          find: '\u00a1',
          replacement: ''
        }
      }
    }
  };
}

function buildNormalizedCourseExactMatch(courseNames) {
  return {
    $expr: {
      $in: [
        buildNormalizedCourseExpression(),
        courseNames
      ]
    }
  };
}

function applyCicloLectivoFilter(query, cicloLectivo) {
  if (!cicloLectivo || cicloLectivo === 'todos') {
    return query;
  }

  // Fecha de corte acordada: 12 de Marzo de 2026
  const cutoffDate = new Date('2026-03-12T00:00:00.000Z');

  if (cicloLectivo === '2026') {
    query.createdAt = { $gte: cutoffDate };
  } else if (cicloLectivo === '2025') {
    query.createdAt = { $lt: cutoffDate };
  }

  return query;
}

// Verificar acceso a inscripciones
function hasAccessToInscriptions(user) {
  return user.clientId === '751524394719240' ||
    (user.role === 'admin' && user.selectedClientId === '751524394719240');
}

// ============================================================================
// OBTENER INSCRIPCIONES CON FILTROS
// ============================================================================
exports.getInscriptions = async (req, res) => {
  try {
    if (!hasAccessToInscriptions(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const { dni, provincia, curso, cicloLectivo, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    // Filtro por DNI
    if (dni) {
      query.dni = { $regex: dni, $options: 'i' };
    }

    // Filtro por provincia
    if (provincia && provincia !== 'todas') {
      const provinciaDecoded = decodeURIComponent(provincia).toLowerCase().trim();

      if (provinciaDecoded === 'otros') {
        query.provincia = { $nin: PROVINCIAS_ARGENTINAS };
      } else {
        query.provincia = provinciaDecoded;
      }
    }

    // Filtro por curso (con normalización)
    COURSE_CONFIG.applyFilter(query, curso);

    query = applyCicloLectivoFilter(query, cicloLectivo);

    console.log('Query de búsqueda:', JSON.stringify(query, null, 2));

    const inscriptions = await Inscription.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Inscription.countDocuments(query);

    console.log(`Inscripciones encontradas: ${inscriptions.length} de ${total} total`);

    res.json({
      success: true,
      inscriptions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error obteniendo inscripciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener inscripciones'
    });
  }
};

// ============================================================================
// EXPORTAR INSCRIPCIONES A CSV
// ============================================================================
exports.exportInscriptionsCSV = async (req, res) => {
  try {
    if (!hasAccessToInscriptions(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const { dni, provincia, curso, cicloLectivo } = req.query;
    let query = {};

    // Aplicar los mismos filtros que getInscriptions
    if (dni) {
      query.dni = { $regex: dni, $options: 'i' };
    }

    if (provincia && provincia !== 'todas') {
      const provinciaDecoded = decodeURIComponent(provincia).toLowerCase().trim();

      if (provinciaDecoded === 'otros') {
        query.provincia = { $nin: PROVINCIAS_ARGENTINAS };
      } else {
        query.provincia = provinciaDecoded;
      }
    }

    COURSE_CONFIG.applyFilter(query, curso);

    query = applyCicloLectivoFilter(query, cicloLectivo);

    console.log('Query de exportación CSV:', JSON.stringify(query, null, 2));

    // Obtener todas las inscripciones (sin paginación)
    const inscriptions = await Inscription.find(query).sort({ createdAt: -1 });

    console.log(`Exportando ${inscriptions.length} inscripciones a CSV`);

    // Headers CSV
    const headers = [
      'DNI/ID',
      'Nombre Completo',
      'Curso',
      'Correo',
      'Provincia/Estado',
      'Localidad',
      'Código Postal',
      'Fecha de Inscripción'
    ];

    // Generar contenido CSV
    let csvContent = headers.join(',') + '\n';

    inscriptions.forEach(inscription => {
      const fecha = new Date(inscription.createdAt).toLocaleDateString('es-ES');

      const row = [
        `"${inscription.dni || ''}"`,
        `"${inscription.nombreCompleto || ''}"`,
        `"${inscription.curso || ''}"`,
        `"${inscription.correo || ''}"`,
        `"${inscription.provincia || ''}"`,
        `"${inscription.localidad || ''}"`,
        `"${inscription.codigoPostal || ''}"`,
        `"${fecha}"`
      ];

      csvContent += row.join(',') + '\n';
    });

    // Generar nombre del archivo
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
    let filename = `inscripciones_${timestamp}`;

    if (provincia && provincia !== 'todas') {
      filename += `_${provincia.replace(/\s+/g, '_')}`;
    }
    if (curso && curso !== 'todos') {
      filename += `_${curso.replace(/\s+/g, '_')}`;
    }
    if (dni) {
      filename += `_dni_${dni}`;
    }

    filename += '.csv';

    // Configurar respuesta
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // BOM para UTF-8 (para Excel)
    res.write('\ufeff');
    res.write(csvContent);
    res.end();

  } catch (error) {
    console.error('Error exportando CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al exportar CSV',
      details: error.message
    });
  }
};

// ============================================================================
// OBTENER CURSOS DISPONIBLES (SIN DUPLICADOS)
// ============================================================================
exports.getCourses = async (req, res) => {
  try {
    if (!hasAccessToInscriptions(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const exact2026Counts = await Inscription.aggregate([
      {
        $project: {
          normalizedCourse: buildNormalizedCourseExpression(),
          createdAt: 1
        }
      },
      {
        $match: {
          normalizedCourse: { $in: EXACT_2026_COURSES },
          createdAt: { $gte: new Date('2026-03-12T00:00:00.000Z') }
        }
      },
      {
        $group: {
          _id: '$normalizedCourse',
          count: { $sum: 1 }
        }
      }
    ]);

    const countsByCourse = exact2026Counts.reduce((acc, course) => {
      acc[course._id] = course.count;
      return acc;
    }, {});

    const courses = COURSE_2026_DEFINITIONS.map((course2026) => {
      const aliases = COURSE_2026_ALIASES[course2026.normalizedName] || [course2026.normalizedName];
      const count = aliases.reduce((total, alias) => total + (countsByCourse[alias] || 0), 0);

      return {
        name: `${course2026.displayName} 2026`,
        normalizedName: `${course2026.normalizedName}${COURSE_2026_SUFFIX}`,
        count
      };
    });

    const otros2026Count = await Inscription.aggregate([
      {
        $project: {
          normalizedCourse: buildNormalizedCourseExpression(),
          createdAt: 1
        }
      },
      {
        $match: {
          normalizedCourse: { $nin: EXACT_2026_COURSES },
          createdAt: { $gte: new Date('2026-03-12T00:00:00.000Z') }
        }
      },
      {
        $count: "total"
      }
    ]);

    const otrosCount = otros2026Count.length > 0 ? otros2026Count[0].total : 0;

    courses.push({
      name: 'Otros cursos 2026',
      normalizedName: 'otros__2026',
      count: otrosCount
    });

    console.log('Cursos agrupados:', courses);

    res.json({
      success: true,
      courses: courses
    });

  } catch (error) {
    console.error('Error obteniendo cursos:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener cursos'
    });
  }
};

// Lógica interna para guardar una inscripción (usada por API manual y n8n)
async function _saveInscriptionInternal(data) {
  const { dni, nombreCompleto, curso, correo, provincia, localidad, codigoPostal, fecha, createdAt } = data;

  // Normalizar provincia
  const provinciaLimpia = (provincia || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  const VARIANTES_PROVINCIAS = {
    'bs as': 'buenos aires',
    'bsas': 'buenos aires',
    'provincia de buenos aires': 'buenos aires',
    'pba': 'buenos aires',
    'capital': 'caba',
    'capital federal': 'caba',
    'ciudad autonoma de buenos aires': 'caba'
  };

  let provinciaFinal;
  if (PROVINCIAS_ARGENTINAS.includes(provinciaLimpia)) {
    provinciaFinal = provinciaLimpia;
  } else if (VARIANTES_PROVINCIAS[provinciaLimpia]) {
    provinciaFinal = VARIANTES_PROVINCIAS[provinciaLimpia];
  } else {
    provinciaFinal = (provincia || 'Desconocida').trim();
  }

  let finalCreatedAt;
  if (createdAt) {
    finalCreatedAt = new Date(createdAt);
  } else if (fecha) {
    finalCreatedAt = new Date(fecha);
  }

  const inscriptionData = {
    dni: dni.toString(),
    nombreCompleto,
    curso,
    correo: correo || '-',
    provincia: provinciaFinal,
    localidad: localidad || '-',
    codigoPostal: codigoPostal || '-'
  };

  if (finalCreatedAt && !isNaN(finalCreatedAt.getTime())) {
    inscriptionData.createdAt = finalCreatedAt;
  }

  const inscription = new Inscription(inscriptionData);
  await inscription.save();
  return inscription;
}

// ============================================================================
// CREAR NUEVA INSCRIPCIÓN (API MANUAL)
// ============================================================================
exports.createInscription = async (req, res) => {
  try {
    const { dni, nombreCompleto, curso } = req.body;

    if (!dni || !nombreCompleto || !curso) {
      return res.status(400).json({
        success: false,
        error: 'DNI, Nombre Completo y Curso son requeridos'
      });
    }

    const inscription = await _saveInscriptionInternal(req.body);

    res.json({
      success: true,
      message: 'Inscripción creada correctamente',
      inscription
    });

  } catch (error) {
    console.error('❌ Error creando inscripción:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al crear inscripción',
      details: error.message
    });
  }
};

// ============================================================================
// CREAR INSCRIPCIÓN DESDE N8N (MAPEANDO ID DE CURSO)
// ============================================================================
exports.createInscriptionFromN8N = async (req, res) => {
  try {
    const { dni, nombreCompleto, cursoId, curso, correo, provincia, localidad, codigoPostal, fecha, createdAt } = req.body;

    if (!dni || !nombreCompleto || (!cursoId && !curso)) {
      return res.status(400).json({
        success: false,
        error: 'DNI, Nombre Completo y curso o cursoId son requeridos'
      });
    }

    const CURSOS_MAP = {
      1: 'Inteligencia Artificial',
      2: 'De 0 a experto en marketing digital',
      3: 'UGC y Marketing de contenidos',
      4: '¿Cómo emprender desde la mirada del marketing?',
      5: 'Vendedor todoterreno',
      6: 'Diseño gráfico',
      7: 'Mujeres que lideran',
      8: 'Edición de videos y reels'
    };

    // Normalizar cursoId para que siempre sea un array
    let idsToProcess = [];
    if (cursoId) {
      if (Array.isArray(cursoId)) {
        idsToProcess = cursoId;
      } else if (typeof cursoId === 'string') {
        idsToProcess = cursoId.split(',').map(id => id.trim());
      } else {
        idsToProcess = [cursoId];
      }
    }

    // Si no hay cursoId, pero hay curso literal, lo ponemos en una lista de 1
    let coursesToProcess = [];
    if (idsToProcess.length > 0) {
      coursesToProcess = idsToProcess.map(id => CURSOS_MAP[parseInt(id)] || `Curso ID ${id}`).filter(c => c);
    } else if (curso) {
      coursesToProcess = Array.isArray(curso) ? curso : [curso];
    }

    if (coursesToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No se pudieron identificar los cursos'
      });
    }

    console.log(`=== CREANDO ${coursesToProcess.length} INSCRIPCIONES DESDE N8N ===`);

    const results = [];
    for (const cursoName of coursesToProcess) {
      try {
        const ins = await _saveInscriptionInternal({
          dni,
          nombreCompleto,
          curso: cursoName,
          correo: correo || '-',
          provincia,
          localidad,
          codigoPostal,
          fecha,
          createdAt
        });
        results.push({ curso: cursoName, success: true, id: ins._id });
      } catch (err) {
        console.error(`Error inscribiendo en ${cursoName}:`, err);
        results.push({ curso: cursoName, success: false, error: err.message });
      }
    }

    res.json({
      success: true,
      message: `Se procesaron ${coursesToProcess.length} inscripciones`,
      results
    });

  } catch (error) {
    console.error('❌ Error guardando inscripciones de n8n:', error);
    res.status(500).json({
      success: false,
      error: 'Error procesando solicitud de n8n',
      details: error.message
    });
  }
};

// ============================================================================
// ELIMINAR INSCRIPCIÓN
// ============================================================================
exports.deleteInscription = async (req, res) => {
  try {
    if (!hasAccessToInscriptions(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID de la inscripción'
      });
    }

    const inscription = await Inscription.findById(id);
    if (!inscription) {
      return res.status(404).json({
        success: false,
        error: 'Inscripción no encontrada'
      });
    }

    await Inscription.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Inscripción eliminada correctamente'
    });

  } catch (error) {
    console.error('Error eliminando inscripción:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al eliminar inscripción'
    });
  }
};

// ============================================================================
// OBTENER ESTADÍSTICAS
// ============================================================================
exports.getInscriptionStats = async (req, res) => {
  try {
    if (!hasAccessToInscriptions(req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Acceso denegado'
      });
    }

    const total = await Inscription.countDocuments();

    const byProvince = await Inscription.aggregate([
      { $group: { _id: '$provincia', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byCourse = await Inscription.aggregate([
      { $group: { _id: '$curso', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Estadísticas de inscripciones extranjeras
    const foreignInscriptions = await Inscription.aggregate([
      { $match: { provincia: { $nin: PROVINCIAS_ARGENTINAS } } },
      { $group: { _id: '$provincia', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      stats: {
        total,
        byProvince,
        byCourse,
        foreignBreakdown: foreignInscriptions
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error del servidor al obtener estadísticas'
    });
  }
};
