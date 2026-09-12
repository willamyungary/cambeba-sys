const PDFDocument = require('pdfkit');
const path = require('path');

// Paleta baseada na identidade visual da IP Cambeba:
// anel cinza metálico, cruz marrom/bronze, texto cinza-chumbo
const COLORS = {
  gray: '#5b5f66',
  bronze: '#8b5a2b',
  bronzeLight: '#a67c52',
  charcoal: '#2f333a',
  bg: '#f5f5f5'
};

const MEMBER_CARD_WIDTH = 85.6 * 72 / 25.4;
const MEMBER_CARD_HEIGHT = 53.98 * 72 / 25.4;
const MEMBER_CARD_LOGO = path.join(__dirname, '../public/img/logo-igreja2.png');

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  return date.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

// ---------- Carteirinha de membro (padrão ID-1: 85,60 x 53,98 mm) ----------
function generateMemberCard(member) {
  const doc = new PDFDocument({ size: [MEMBER_CARD_WIDTH, MEMBER_CARD_HEIGHT], margin: 0 });

  // Fundo e contorno do cartão
  doc.roundedRect(0.5, 0.5, MEMBER_CARD_WIDTH - 1, MEMBER_CARD_HEIGHT - 1, 5)
    .fillAndStroke('#ffffff', COLORS.gray);

  // Identidade visual
  doc.image(MEMBER_CARD_LOGO, 8, 4, { fit: [43, 43] });
  doc.fillColor(COLORS.gray).fontSize(7).font('Helvetica-Bold')
    .text('CARTEIRA DE MEMBRO', 58, 13, { width: 105, align: 'left' });
  doc.fillColor(COLORS.bronze).fontSize(5.5).font('Helvetica')
    .text('Igreja Presbiteriana do Cambeba', 58, 24, { width: 105, align: 'left' });
  doc.rect(0, 51, MEMBER_CARD_WIDTH, 2).fill(COLORS.bronze);

  // Foto
  const photoX = 187, photoY = 61, photoSize = 45;
  doc.roundedRect(photoX - 2, photoY - 2, photoSize + 4, photoSize + 4, 4).fill('#ffffff');
  if (member.photo) {
    try {
      doc.image(member.photo, photoX, photoY, { width: photoSize, height: photoSize, fit: [photoSize, photoSize] });
    } catch (e) {
      doc.rect(photoX, photoY, photoSize, photoSize).fill('#dddddd');
    }
  } else {
    doc.rect(photoX, photoY, photoSize, photoSize).fill('#dddddd');
    doc.fillColor('#888888').fontSize(8).text('SEM FOTO', photoX, photoY + 36, { width: photoSize, align: 'center' });
  }
  doc.rect(photoX, photoY, photoSize, photoSize).strokeColor(COLORS.bronze).lineWidth(1.5).stroke();

  // Nome
  doc.fillColor(COLORS.charcoal).fontSize(9).font('Helvetica-Bold')
    .text(member.full_name || '', 10, 61, { width: 168, height: 12, ellipsis: true });

  // Função/cargo
  if (member.role_in_church) {
    doc.fontSize(6.5).font('Helvetica-Oblique').fillColor(COLORS.bronze)
      .text(member.role_in_church, 10, 75, { width: 168, height: 9, ellipsis: true });
  }

  // Linha divisória
  doc.moveTo(10, 88).lineTo(177, 88).strokeColor(COLORS.gray).lineWidth(0.5).stroke();

  // Dados
  let y = 95;
  const rowH = 10;
  const addRow = (label, value) => {
    doc.fontSize(5.5).font('Helvetica-Bold').fillColor(COLORS.gray).text(label, 10, y);
    doc.fontSize(6.5).font('Helvetica').fillColor(COLORS.charcoal).text(value || '-', 67, y - 0.5, { width: 108, height: 8, ellipsis: true });
    y += rowH;
  };

  addRow('Nº MEMBRO:', String(member.id).padStart(5, '0'));
  addRow('NASCIMENTO:', formatDate(member.birth_date));
  addRow('ADMISSÃO:', formatDate(member.admission_date));
  addRow('TIPO:', member.admission_type || '-');
  addRow('SITUAÇÃO:', (member.membership_status || '').toUpperCase());

  // Rodapé
  doc.rect(0, 133, MEMBER_CARD_WIDTH, 20).fill(COLORS.gray);
  doc.fillColor('#ffffff').fontSize(5).font('Helvetica')
    .text('Esta carteira é pessoal e intransferível.', 8, 138, { width: MEMBER_CARD_WIDTH - 16, align: 'center' });
  doc.fontSize(5).text(`Emitida em ${formatDate(new Date())}`, 8, 146, { width: MEMBER_CARD_WIDTH - 16, align: 'center' });

  return doc;
}

// ---------- Relatório de membros ativos ----------
function generateActiveMembersReport(members) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  doc.rect(0, 0, doc.page.width, 60).fill(COLORS.gray);
  doc.rect(0, 56, doc.page.width, 4).fill(COLORS.bronze);
  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
    .text('Igreja Presbiteriana do Cambeba', 40, 16);
  doc.fontSize(10).font('Helvetica').text('Relatório de Membros Ativos', 40, 38);

  doc.fillColor(COLORS.charcoal).fontSize(9).font('Helvetica')
    .text(`Gerado em ${formatDate(new Date())}  •  Total: ${members.length} membro(s)`, 40, 76);

  let y = 100;
  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#ffffff');
    doc.rect(40, y, doc.page.width - 80, 20).fill(COLORS.bronzeLight);
    doc.fillColor('#ffffff');
    doc.text('Nome', 46, y + 6, { width: 190 });
    doc.text('Nascimento', 236, y + 6, { width: 70 });
    doc.text('Admissão', 306, y + 6, { width: 70 });
    doc.text('Tipo', 376, y + 6, { width: 80 });
    doc.text('Função', 456, y + 6, { width: 80 });
    y += 22;
  };

  drawHeader();

  members.forEach((m, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      drawHeader();
    }
    if (i % 2 === 0) {
      doc.rect(40, y - 2, doc.page.width - 80, 18).fill('#eceeef');
    }
    doc.fillColor(COLORS.charcoal).font('Helvetica').fontSize(8.5);
    doc.text(m.full_name || '', 46, y + 2, { width: 190 });
    doc.text(formatDate(m.birth_date), 236, y + 2, { width: 70 });
    doc.text(formatDate(m.admission_date), 306, y + 2, { width: 70 });
    doc.text(m.admission_type || '-', 376, y + 2, { width: 80 });
    doc.text(m.role_in_church || '-', 456, y + 2, { width: 80 });
    y += 18;
  });

  return doc;
}

// ---------- Relatório de aniversariantes do mês ----------
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function generateBirthdaysReport(members, month) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  doc.rect(0, 0, doc.page.width, 60).fill(COLORS.gray);
  doc.rect(0, 56, doc.page.width, 4).fill(COLORS.bronze);
  doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold')
    .text('Igreja Presbiteriana do Cambeba', 40, 16);
  doc.fontSize(10).font('Helvetica').text(`Aniversariantes de ${MESES[month - 1]}`, 40, 38);

  doc.fillColor(COLORS.charcoal).fontSize(9).font('Helvetica')
    .text(`Gerado em ${formatDate(new Date())}  •  Total: ${members.length} aniversariante(s)`, 40, 76);

  let y = 100;
  const drawHeader = () => {
    doc.rect(40, y, doc.page.width - 80, 20).fill(COLORS.bronzeLight);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
    doc.text('Dia', 46, y + 6, { width: 40 });
    doc.text('Nome', 90, y + 6, { width: 260 });
    doc.text('Telefone', 356, y + 6, { width: 100 });
    doc.text('Idade', 460, y + 6, { width: 60 });
    y += 22;
  };
  drawHeader();

  members.forEach((m, i) => {
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 40;
      drawHeader();
    }
    if (i % 2 === 0) {
      doc.rect(40, y - 2, doc.page.width - 80, 18).fill('#eceeef');
    }
    const bd = new Date(m.birth_date);
    const day = bd.getUTCDate();
    const age = new Date().getUTCFullYear() - bd.getUTCFullYear();

    doc.fillColor(COLORS.charcoal).font('Helvetica').fontSize(8.5);
    doc.text(String(day).padStart(2, '0'), 46, y + 2, { width: 40 });
    doc.text(m.full_name || '', 90, y + 2, { width: 260 });
    doc.text(m.phone || '-', 356, y + 2, { width: 100 });
    doc.text(`${age} anos`, 460, y + 2, { width: 60 });
    y += 18;
  });

  return doc;
}

module.exports = { generateMemberCard, generateActiveMembersReport, generateBirthdaysReport, COLORS };
