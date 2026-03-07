// =============================================================
// CONSTANCIA DE PARTICIPACION / INSTRUCTOR - Google Apps Script
// Spreadsheet: 1ZNOunBLHVLiGN2lCxgoUI32YTAgJKSm6_upWFjNU7k0
//   Hoja 0: "Inscripciones"  → participantes → Slide 0
//   Hoja 1: "Instructores"   → instructores  → Slide 1
//
// Columnas (indice base 0) — mismas en ambas hojas:
//   0:Folio personal  1:NombreCompleto  2:Curp  3:Email
//   4:Genero  5:Departamento  6:Curso  7:FechaCurso
//   8:Horas  9:tipo  10:Estado
// =============================================================

var SHEET_ID      = "1ZNOunBLHVLiGN2lCxgoUI32YTAgJKSm6_upWFjNU7k0";
var TEMPLATE_ID   = "1ooP8iWCI8CsvO5lUY-UO1rEmu16oVaVXNhE6TTh2A0A";
var OUTPUT_FOLDER = "1PDc9-4DsTTbx6JijFoPbiqCjvr5BaLMu";
var ADMIN_EMAIL   = "alejandro.calderon@itdurango.edu.mx";

var SLIDE_PARTICIPANTE = 0;   // Diapositiva 1 → participantes
var SLIDE_INSTRUCTOR   = 1;   // Diapositiva 2 → instructores

// -------------------------------------------------------------
// Web App entry point
// -------------------------------------------------------------
function doGet(e) {
  var emailParam = (e && e.parameter && e.parameter.email) ? e.parameter.email : "";
  var html = HtmlService.createHtmlOutputFromFile("index")
    .setTitle("Constancia de Participacion")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  var content = html.getContent();
  content = content.replace(
    "var cursosDisponibles = [];",
    "var cursosDisponibles = [];\n  var EMAIL_PARAM = " + JSON.stringify(emailParam) + ";"
  );
  return HtmlService.createHtmlOutput(content)
    .setTitle("Constancia de Participacion")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// -------------------------------------------------------------
// OBTENER CURSOS DEL USUARIO — busca en AMBAS hojas
// Cada registro incluye campo "tipoHoja": "participante" | "instructor"
// -------------------------------------------------------------
function obtenerMisCursos(emailManual) {
  try {
    // Email viene siempre por parametro URL — no usamos Session.getActiveUser()
    var email = emailManual ? emailManual.trim().toLowerCase() : "";

    if (!email) {
      return { ok: false, mensaje: "No se recibio el correo. Accede desde el portal ITD." };
    }

    var esAdmin = (email === ADMIN_EMAIL.toLowerCase());
    var ss      = SpreadsheetApp.openById(SHEET_ID);
    var activos   = [];
    var inactivos = [];

    var hojas = [
      { hoja: ss.getSheets()[0], tipoHoja: "participante" },
      { hoja: ss.getSheets()[1], tipoHoja: "instructor"   }
    ];

    for (var h = 0; h < hojas.length; h++) {
      var data     = hojas[h].hoja.getDataRange().getValues();
      var tipoHoja = hojas[h].tipoHoja;

      for (var i = 1; i < data.length; i++) {
        var r         = data[i];
        var emailFila = String(r[3]).trim().toLowerCase();

        if (esAdmin || emailFila === email) {
          var registro = {
            folio        : r[0],
            nombre       : r[1],
            curp         : r[2],
            email        : r[3],
            departamento : r[5],
            curso        : r[6],
            fechaCurso   : (r[7] instanceof Date)
                             ? Utilities.formatDate(r[7], Session.getScriptTimeZone(), "dd/MM/yyyy")
                             : String(r[7]),
            horas        : r[8],
            tipo         : r[9],
            estado       : String(r[10]).toUpperCase(),
            tipoHoja     : tipoHoja
          };

          if (registro.estado === "ACTIVO") activos.push(registro);
          else inactivos.push(registro);
        }
      }
    }

    if (activos.length === 0 && inactivos.length === 0) {
      return { ok: false, mensaje: "No se encontro ningun registro con el correo: " + email + ". Contacta a Desarrollo Academico." };
    }
    if (activos.length === 0) {
      return { ok: false, mensaje: "No tienes cursos activos. Verifica que hayas completado el curso y la encuesta." };
    }

    var tieneParticipante = activos.some(function(c) { return c.tipoHoja === "participante"; });
    var tieneInstructor   = activos.some(function(c) { return c.tipoHoja === "instructor";   });

    return {
      ok               : true,
      email            : email,
      nombre           : esAdmin ? "Administrador" : activos[0].nombre,
      esAdmin          : esAdmin,
      hayInactivos     : inactivos.length > 0,
      tieneParticipante: tieneParticipante,
      tieneInstructor  : tieneInstructor,
      cursos           : activos
    };

  } catch(e) {
    Logger.log("obtenerMisCursos ERROR: " + e.message);
    return { ok: false, mensaje: "Error interno: " + e.message };
  }
}

// -------------------------------------------------------------
// BUSCAR CURSOS POR CORREO (solo admin) — busca en ambas hojas
// -------------------------------------------------------------
function buscarCursosPorCorreo(emailBusqueda) {
  try {
    // Esta funcion solo es llamada desde el frontend admin — no validamos sesion

    var emailTarget = String(emailBusqueda).trim().toLowerCase();
    if (!emailTarget) return { ok: false, mensaje: "Correo de busqueda no valido." };

    var ss      = SpreadsheetApp.openById(SHEET_ID);
    var activos = [];

    var hojas = [
      { hoja: ss.getSheets()[0], tipoHoja: "participante" },
      { hoja: ss.getSheets()[1], tipoHoja: "instructor"   }
    ];

    for (var h = 0; h < hojas.length; h++) {
      var data     = hojas[h].hoja.getDataRange().getValues();
      var tipoHoja = hojas[h].tipoHoja;

      for (var i = 1; i < data.length; i++) {
        var r         = data[i];
        var emailFila = String(r[3]).trim().toLowerCase();

        if (emailFila === emailTarget && String(r[10]).toUpperCase() === "ACTIVO") {
          activos.push({
            folio        : r[0],
            nombre       : r[1],
            curp         : r[2],
            email        : r[3],
            departamento : r[5],
            curso        : r[6],
            fechaCurso   : (r[7] instanceof Date)
                             ? Utilities.formatDate(r[7], Session.getScriptTimeZone(), "dd/MM/yyyy")
                             : String(r[7]),
            horas        : r[8],
            tipo         : r[9],
            estado       : "ACTIVO",
            tipoHoja     : tipoHoja
          });
        }
      }
    }

    if (activos.length === 0) {
      return { ok: false, mensaje: "No se encontraron cursos activos para: " + emailBusqueda };
    }

    return { ok: true, cursos: activos, nombre: activos[0].nombre };

  } catch(e) {
    Logger.log("buscarCursosPorCorreo ERROR: " + e.message);
    return { ok: false, mensaje: "Error al buscar: " + e.message };
  }
}

// -------------------------------------------------------------
// GENERAR CONSTANCIA EN PDF
// dc.tipoHoja → "participante" usa Slide 0, "instructor" usa Slide 1
// Se elimina la slide no usada para que el PDF tenga solo 1 pagina
// -------------------------------------------------------------
function generarConstancia(dc) {
  try {
    // El email ya fue validado al buscar los cursos — confiamos en dc.email
    var emailCurso = String(dc.email).trim().toLowerCase();
    if (!emailCurso) {
      return { ok: false, mensaje: "No se recibio el correo del usuario." };
    }

    var slideIndex = (dc.tipoHoja === "instructor") ? SLIDE_INSTRUCTOR : SLIDE_PARTICIPANTE;

    var folder     = DriveApp.getFolderById(OUTPUT_FOLDER);
    // Prefijo P_ o I_ para diferenciar participante e instructor en Drive
    var prefijo    = (dc.tipoHoja === "instructor") ? "Instructor_" : "Participante_";
    var nombrePDF  = prefijo + dc.curp + "_" + sanitizar(dc.curso);
    var ahora      = new Date();
    var tz         = Session.getScriptTimeZone();
    var fechaHoy   = Utilities.formatDate(ahora, tz, "dd/MM/yyyy");
    var horaHoy    = Utilities.formatDate(ahora, tz, "HH:mm");
    var fechaYHora = fechaHoy + " " + horaHoy;

    // Si ya existe lo devuelve sin regenerar
    var iter = folder.getFilesByName(nombrePDF + ".pdf");
    if (iter.hasNext()) {
      var archivo = iter.next();
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return { ok: true, url: archivo.getDownloadUrl(), nombre: dc.nombre, esDuplicado: true, fechaHoy: fechaYHora, tipoHoja: dc.tipoHoja };
    }

    // Clonar plantilla completa
    var copiaFile = DriveApp.getFileById(TEMPLATE_ID).makeCopy("TEMP_" + nombrePDF, folder);
    var copiaId   = copiaFile.getId();
    Utilities.sleep(800);

    // Rellenar solo la slide correspondiente
    var pres  = SlidesApp.openById(copiaId);
    var slide = pres.getSlides()[slideIndex];

    var reemplazos = {
      "{{NombreCompleto}}" : dc.nombre                       || "",
      "{{Folio personal}}" : dc.folio                        || "",
      "{{Departamento}}"   : dc.departamento                 || "",
      "{{Curso}}"          : dc.curso                        || "",
      "{{FechaCurso}}"     : dc.fechaCurso                   || "",
      "{{Horas}}"          : String(dc.horas)                || "",
      "{{fecha}}"          : extraerFechaFinal(dc.fechaCurso),
      "{{FECHA_CREACION}}" : "Generado el " + fechaYHora
    };

    var shapes = slide.getShapes();
    for (var s = 0; s < shapes.length; s++) {
      try {
        var txt  = shapes[s].getText();
        var keys = Object.keys(reemplazos);
        for (var k = 0; k < keys.length; k++) {
          txt.replaceAllText(keys[k], reemplazos[keys[k]]);
        }
      } catch(ex) {}
    }
    pres.saveAndClose();
    Utilities.sleep(600);

    // Eliminar la slide que NO se usa → PDF de 1 sola pagina
    var presLimpio = SlidesApp.openById(copiaId);
    var slides     = presLimpio.getSlides();
    if (slides.length > 1) {
      // Eliminar en orden inverso para no afectar indices
      if (slideIndex === SLIDE_PARTICIPANTE) {
        slides[1].remove();   // quitar slide de instructor
      } else {
        slides[0].remove();   // quitar slide de participante
      }
    }
    presLimpio.saveAndClose();
    Utilities.sleep(600);

    var pdfBlob = DriveApp.getFileById(copiaId)
      .getAs("application/pdf")
      .setName(nombrePDF + ".pdf");

    var pdfFile = folder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    DriveApp.getFileById(copiaId).setTrashed(true);

    return {
      ok         : true,
      url        : pdfFile.getDownloadUrl(),
      nombre     : dc.nombre,
      esDuplicado: false,
      fechaHoy   : fechaYHora,
      tipoHoja   : dc.tipoHoja
    };

  } catch(e) {
    Logger.log("generarConstancia ERROR: " + e.message);
    return { ok: false, mensaje: "Error al generar la constancia: " + e.message };
  }
}

// -------------------------------------------------------------
// DIAGNOSTICO
// -------------------------------------------------------------
function diagnostico() {
  var log = [];
  log.push("Admin configurado: " + ADMIN_EMAIL);

  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var h0 = ss.getSheets()[0];
    var h1 = ss.getSheets()[1];
    log.push("Hoja 0 [" + h0.getName() + "]: " + (h0.getLastRow() - 1) + " registros");
    log.push("Hoja 1 [" + h1.getName() + "]: " + (h1.getLastRow() - 1) + " registros");
  } catch(e) { log.push("ERROR Sheets: " + e.message); }

  try {
    var pres   = SlidesApp.openById(TEMPLATE_ID);
    var slides = pres.getSlides();
    log.push("Plantilla: " + pres.getName() + " — " + slides.length + " slide(s)");
    log.push("  Slide 0 → participantes");
    log.push("  Slide 1 → instructores");
  } catch(e) { log.push("ERROR Plantilla: " + e.message); }

  try { log.push("Carpeta: " + DriveApp.getFolderById(OUTPUT_FOLDER).getName()); }
  catch(e) { log.push("ERROR Carpeta: " + e.message); }

  var reporte = log.join("\n");
  Logger.log(reporte);
  Browser.msgBox(reporte);
}

// -------------------------------------------------------------
// HELPERS
// -------------------------------------------------------------
function sanitizar(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 40);
}

function extraerFechaFinal(texto) {
  if (!texto) return "";
  var str   = String(texto).trim();
  var match = str.match(/AL\s+(\d{1,2}\s+.+)$/i);
  if (match) return match[1].trim();
  if (texto instanceof Date) {
    return Utilities.formatDate(texto, Session.getScriptTimeZone(), "dd 'DE' MMMM 'DEL' yyyy").toUpperCase();
  }
  return str;
}
