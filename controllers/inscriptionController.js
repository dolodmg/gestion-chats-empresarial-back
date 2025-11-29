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

// Configuración para normalización de cursos
const COURSE_CONFIG = {
  // Normalizar nombres de cursos
  normalize: function(courseName) {
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
    'de 0 a experto digital': [
      'de 0 a experto digital',
      '0 a experto digital',
      'experto digital'
    ],
    'publicidad avanzada': [
      'publicidad avanzada',
      'marketing avanzado',
      'publicidad'
    ],
    'oratoria y comunicacion efectiva': [
      'oratoria y comunicacion efectiva',
      'oratoria',
      'comunicacion efectiva'
    ],
    'edicion de videos y reels': [
      'edicion de videos y reels',
      'edicion de video',
      'video editing'
    ],
    'diseno grafico': [
      'diseno grafico',
      'diseño grafico',
      'graphic design'
    ],
    'blockchain desde 0': [
      'blockchain desde 0',
      'blockchain',
      'crypto'
    ],
    'asesoria de imagen': [
      'asesoria de imagen',
      'imagen personal'
    ],
    'finanzas personales desde 0': [
      'finanzas personales desde 0',
      'finanzas personales',
      'finanzas'
    ],
    'ugc y marketing de contenidos': [
      'ugc y marketing de contenidos',
      'ugc',
      'marketing de contenidos'
    ],
    'vendedor todoterreno': [
      'vendedor todoterreno',
      'ventas'
    ]
  },

  // Aplicar filtro de curso
  applyFilter: function(query, courseFilter) {
    if (!courseFilter || courseFilter === 'todos') return;

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

    const { dni, provincia, curso, page = 1, limit = 20 } = req.query;
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

    const { dni, provincia, curso } = req.query;
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

    // Obtener todos los cursos únicos
    const allCourses = await Inscription.aggregate([
      { $group: { _id: '$curso', count: { $sum: 1 } } }
    ]);

    console.log('Cursos encontrados en BD:', allCourses.map(c => c._id));

    // Agrupar cursos por versión normalizada
    const groupedCourses = {};

    allCourses.forEach(course => {
      const originalName = course._id;
      const normalizedName = COURSE_CONFIG.normalize(originalName);
      
      // Buscar el grupo al que pertenece
      let groupKey = null;
      let displayName = originalName;

      // Buscar en variantes definidas
      for (const [mainName, variants] of Object.entries(COURSE_CONFIG.variants)) {
        const normalizedVariants = variants.map(v => COURSE_CONFIG.normalize(v));
        if (normalizedVariants.includes(normalizedName)) {
          groupKey = mainName;
          displayName = variants[0]; // Nombre preferido
          break;
        }
      }

      // Si no encontró grupo, crear uno nuevo
      if (!groupKey) {
        groupKey = normalizedName;
        displayName = originalName;
      }

      // Agrupar contadores
      if (groupedCourses[groupKey]) {
        groupedCourses[groupKey].count += course.count;
        // Usar el nombre más corto y limpio
        if (displayName.length < groupedCourses[groupKey].displayName.length) {
          groupedCourses[groupKey].displayName = displayName;
        }
      } else {
        groupedCourses[groupKey] = {
          displayName: displayName,
          normalizedKey: groupKey,
          count: course.count
        };
      }
    });

    // Convertir a array y ordenar por cantidad
    const courses = Object.values(groupedCourses)
      .map(course => ({
        name: course.displayName,
        normalizedName: course.normalizedKey,
        count: course.count
      }))
      .sort((a, b) => b.count - a.count);

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

// ============================================================================
// CREAR NUEVA INSCRIPCIÓN
// ============================================================================
exports.createInscription = async (req, res) => {
  try {
    const { dni, nombreCompleto, curso, correo, provincia, localidad, codigoPostal } = req.body;

    if (!dni || !nombreCompleto || !curso || !correo || !provincia || !localidad || !codigoPostal) {
      return res.status(400).json({
        success: false,
        error: 'Todos los campos son requeridos'
      });
    }

    console.log('=== CREANDO INSCRIPCIÓN ===');
    console.log('Datos recibidos:', { dni, nombreCompleto, curso, correo, provincia, localidad, codigoPostal });

    // Normalizar provincia
    const provinciaLimpia = provincia
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');

    // Mapeo de variantes de provincias
    const VARIANTES_PROVINCIAS = {
      'bs as': 'buenos aires',
      'bsas': 'buenos aires',
      'provincia de buenos aires': 'buenos aires',
      'pba': 'buenos aires',
      'capital': 'caba',
      'capital federal': 'caba',
      'ciudad autonoma de buenos aires': 'caba'
    };

    // Determinar provincia final
    let provinciaFinal;
    
    if (PROVINCIAS_ARGENTINAS.includes(provinciaLimpia)) {
      provinciaFinal = provinciaLimpia;
    } else if (VARIANTES_PROVINCIAS[provinciaLimpia]) {
      provinciaFinal = VARIANTES_PROVINCIAS[provinciaLimpia];
    } else {
      provinciaFinal = provincia.trim(); // Mantener original para extranjeras
    }

    // Crear inscripción
    const inscriptionData = {
      dni,
      nombreCompleto,
      curso,
      correo,
      provincia: provinciaFinal,
      localidad,
      codigoPostal
    };

    const inscription = new Inscription(inscriptionData);
    await inscription.save();

    console.log('✅ Inscripción creada exitosamente');

    res.json({
      success: true,
      message: 'Inscripción creada correctamente',
      inscription: {
        ...inscription.toObject(),
        _debugInfo: {
          provinciaRecibida: provincia,
          provinciaFinal,
          esArgentina: PROVINCIAS_ARGENTINAS.includes(provinciaLimpia) || !!VARIANTES_PROVINCIAS[provinciaLimpia]
        }
      }
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
