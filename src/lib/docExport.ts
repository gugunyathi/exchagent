import { jsPDF } from 'jspdf';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import {
  TailoredCoverLetterDocument,
  TailoredCvDocument,
} from '../types/firestore';

function sanitizeFileSlug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'document'
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Exports a job-tailored CV as an ATS-clean, executive multi-page PDF.
 */
export function downloadCvAsPdf(cv: TailoredCvDocument): string {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const maxWidth = pageWidth - marginX * 2;
  let y = 52;

  const ensureSpace = (needed = 24) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 52;
    }
  };

  const writeWrapped = (
    text: string,
    fontSize: number,
    style: 'normal' | 'bold' | 'italic' = 'normal',
    color: [number, number, number] = [24, 24, 27],
    lineGap = 14
  ) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(lineGap + 4);
      doc.text(line, marginX, y);
      y += lineGap;
    });
  };

  // Header
  writeWrapped(cv.candidateName.toUpperCase(), 18, 'bold', [9, 9, 11], 22);
  writeWrapped(
    `Target Role: ${cv.targetRole} · ${cv.targetCompany} (${cv.targetRegion})`,
    10.5,
    'bold',
    [3, 105, 161],
    15
  );
  const contactLine = [
    cv.candidateHandle,
    cv.email,
    cv.location,
    cv.linkedinUrl ? `https://${cv.linkedinUrl.replace(/^https?:\/\//, '')}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');
  writeWrapped(contactLine, 9, 'normal', [82, 82, 91], 14);

  y += 4;
  doc.setDrawColor(212, 212, 216);
  doc.setLineWidth(0.75);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  // Professional Summary
  writeWrapped('EXECUTIVE PROFILE', 10, 'bold', [9, 9, 11], 14);
  writeWrapped(cv.professionalSummary, 10, 'normal', [39, 39, 42], 14);
  y += 10;

  // Core Competencies & Role Alignment
  ensureSpace(48);
  writeWrapped('CORE COMPETENCIES & SPECIFICATION ALIGNMENT', 10, 'bold', [9, 9, 11], 14);
  writeWrapped(cv.coreCompetencies.join('  •  '), 9.5, 'normal', [39, 39, 42], 14);
  if (cv.matchedKeywords.length > 0) {
    writeWrapped(
      `Verified Spec Keywords: ${cv.matchedKeywords.join(', ')}`,
      9,
      'italic',
      [4, 120, 87],
      13
    );
  }
  y += 10;

  // Experience Highlights
  ensureSpace(50);
  writeWrapped('EXPERIENCE HIGHLIGHTS', 10, 'bold', [9, 9, 11], 15);
  cv.experienceHighlights.forEach((item) => {
    ensureSpace(44);
    writeWrapped(`${item.role} — ${item.org}`, 10.5, 'bold', [9, 9, 11], 14);
    writeWrapped(item.period, 9, 'normal', [113, 113, 122], 13);
    item.bullets.forEach((bullet) => {
      writeWrapped(`•  ${bullet}`, 9.5, 'normal', [39, 39, 42], 13.5);
    });
    y += 6;
  });

  // Education & Certifications
  if (cv.education.length > 0) {
    ensureSpace(40);
    writeWrapped('EDUCATION', 10, 'bold', [9, 9, 11], 14);
    cv.education.forEach((edu) => writeWrapped(`•  ${edu}`, 9.5, 'normal', [39, 39, 42], 13.5));
    y += 8;
  }

  if (cv.certifications.length > 0) {
    ensureSpace(40);
    writeWrapped('CREDENTIALS & PROTOCOL VERIFICATION', 10, 'bold', [9, 9, 11], 14);
    cv.certifications.forEach((cert) => writeWrapped(`•  ${cert}`, 9.5, 'normal', [39, 39, 42], 13.5));
  }

  const filename = `${sanitizeFileSlug(cv.candidateName)}_${sanitizeFileSlug(cv.targetCompany)}_${sanitizeFileSlug(cv.targetRole)}_CV.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Exports a tailored Cover Letter as an executive single-page PDF.
 */
export function downloadCoverLetterAsPdf(cl: TailoredCoverLetterDocument): string {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 52;
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  const ensureSpace = (needed = 20) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 56;
    }
  };

  const writeWrapped = (
    text: string,
    fontSize: number,
    style: 'normal' | 'bold' = 'normal',
    color: [number, number, number] = [24, 24, 27],
    lineGap = 15
  ) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(lineGap + 4);
      doc.text(line, marginX, y);
      y += lineGap;
    });
  };

  writeWrapped(cl.signatureName.toUpperCase(), 16, 'bold', [9, 9, 11], 20);
  writeWrapped(cl.signatureContact, 9, 'normal', [82, 82, 91], 14);
  y += 6;
  doc.setDrawColor(212, 212, 216);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 22;

  writeWrapped(cl.date, 9.5, 'normal', [113, 113, 122], 16);
  writeWrapped(`${cl.recipientName} — ${cl.recipientTitle}`, 10, 'bold', [9, 9, 11], 14);
  writeWrapped(`${cl.companyName} (${cl.companyHandle})`, 9.5, 'normal', [82, 82, 91], 18);

  writeWrapped(`RE: ${cl.subject}`, 10.5, 'bold', [3, 105, 161], 18);
  writeWrapped(cl.greeting, 10.5, 'normal', [24, 24, 27], 18);

  writeWrapped(cl.openingParagraph, 10.5, 'normal', [39, 39, 42], 15.5);
  y += 8;

  cl.bodyParagraphs.forEach((p) => {
    writeWrapped(p, 10.5, 'normal', [39, 39, 42], 15.5);
    y += 8;
  });

  writeWrapped(cl.closingParagraph, 10.5, 'normal', [39, 39, 42], 15.5);
  y += 18;
  writeWrapped('Sincerely,', 10.5, 'normal', [39, 39, 42], 18);
  writeWrapped(cl.signatureName, 11, 'bold', [9, 9, 11], 15);
  writeWrapped(cl.signatureContact, 9, 'normal', [82, 82, 91], 14);

  const filename = `${sanitizeFileSlug(cl.signatureName)}_${sanitizeFileSlug(cl.companyName)}_Cover_Letter.pdf`;
  doc.save(filename);
  return filename;
}

/**
 * Exports a job-tailored CV as an editable Word (.docx) file.
 */
export async function downloadCvAsDocx(cv: TailoredCvDocument): Promise<string> {
  const experienceParagraphs: Paragraph[] = [];
  cv.experienceHighlights.forEach((item) => {
    experienceParagraphs.push(
      new Paragraph({
        spacing: { before: 140, after: 40 },
        children: [
          new TextRun({ text: `${item.role} — ${item.org}`, bold: true, size: 22 }),
          new TextRun({ text: `  (${item.period})`, color: '64748B', size: 20 }),
        ],
      })
    );
    item.bullets.forEach((b) => {
      experienceParagraphs.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 40 },
          children: [new TextRun({ text: b, size: 20 })],
        })
      );
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 60 },
            children: [new TextRun({ text: cv.candidateName, bold: true, size: 34 })],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: `Tailored for: ${cv.targetRole} at ${cv.targetCompany} (${cv.targetRegion})`,
                bold: true,
                color: '0369A1',
                size: 21,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D8' },
            },
            children: [
              new TextRun({
                text: [cv.candidateHandle, cv.email, cv.location, cv.linkedinUrl]
                  .filter(Boolean)
                  .join('  |  '),
                color: '52525B',
                size: 19,
              }),
            ],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 120, after: 60 },
            children: [new TextRun({ text: 'EXECUTIVE PROFILE', bold: true, size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 140 },
            children: [new TextRun({ text: cv.professionalSummary, size: 21 })],
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 100, after: 60 },
            children: [new TextRun({ text: 'CORE COMPETENCIES & ALIGNMENT', bold: true, size: 22 })],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [new TextRun({ text: cv.coreCompetencies.join(' • '), size: 20 })],
          }),
          ...(cv.matchedKeywords.length > 0
            ? [
                new Paragraph({
                  spacing: { after: 140 },
                  children: [
                    new TextRun({
                      text: `Matched Job Spec Keywords: ${cv.matchedKeywords.join(', ')}`,
                      italics: true,
                      color: '047857',
                      size: 19,
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 100, after: 40 },
            children: [new TextRun({ text: 'EXPERIENCE HIGHLIGHTS', bold: true, size: 22 })],
          }),
          ...experienceParagraphs,
          ...(cv.education.length > 0
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 140, after: 60 },
                  children: [new TextRun({ text: 'EDUCATION', bold: true, size: 22 })],
                }),
                ...cv.education.map(
                  (ed) =>
                    new Paragraph({
                      bullet: { level: 0 },
                      spacing: { after: 40 },
                      children: [new TextRun({ text: ed, size: 20 })],
                    })
                ),
              ]
            : []),
          ...(cv.certifications.length > 0
            ? [
                new Paragraph({
                  heading: HeadingLevel.HEADING_2,
                  spacing: { before: 140, after: 60 },
                  children: [new TextRun({ text: 'CERTIFICATIONS & PROTOCOL CREDENTIALS', bold: true, size: 22 })],
                }),
                ...cv.certifications.map(
                  (cert) =>
                    new Paragraph({
                      bullet: { level: 0 },
                      spacing: { after: 40 },
                      children: [new TextRun({ text: cert, size: 20 })],
                    })
                ),
              ]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${sanitizeFileSlug(cv.candidateName)}_${sanitizeFileSlug(cv.targetCompany)}_${sanitizeFileSlug(cv.targetRole)}_CV.docx`;
  triggerBlobDownload(blob, filename);
  return filename;
}

/**
 * Exports a tailored Cover Letter as an editable Word (.docx) file.
 */
export async function downloadCoverLetterAsDocx(
  cl: TailoredCoverLetterDocument
): Promise<string> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: cl.signatureName, bold: true, size: 30 })],
          }),
          new Paragraph({
            spacing: { after: 180 },
            border: {
              bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D4D4D8' },
            },
            children: [new TextRun({ text: cl.signatureContact, color: '52525B', size: 19 })],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 120, after: 80 },
            children: [new TextRun({ text: cl.date, color: '71717A', size: 20 })],
          }),
          new Paragraph({
            spacing: { after: 20 },
            children: [
              new TextRun({
                text: `${cl.recipientName} — ${cl.recipientTitle}`,
                bold: true,
                size: 21,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: `${cl.companyName} (${cl.companyHandle})`,
                color: '52525B',
                size: 20,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 140 },
            children: [
              new TextRun({
                text: `RE: ${cl.subject}`,
                bold: true,
                color: '0369A1',
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: cl.greeting, size: 21 })],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [new TextRun({ text: cl.openingParagraph, size: 21 })],
          }),
          ...cl.bodyParagraphs.map(
            (p) =>
              new Paragraph({
                spacing: { after: 120 },
                children: [new TextRun({ text: p, size: 21 })],
              })
          ),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: cl.closingParagraph, size: 21 })],
          }),
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: 'Sincerely,', size: 21 })],
          }),
          new Paragraph({
            spacing: { after: 20 },
            children: [new TextRun({ text: cl.signatureName, bold: true, size: 22 })],
          }),
          new Paragraph({
            children: [new TextRun({ text: cl.signatureContact, color: '52525B', size: 19 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `${sanitizeFileSlug(cl.signatureName)}_${sanitizeFileSlug(cl.companyName)}_Cover_Letter.docx`;
  triggerBlobDownload(blob, filename);
  return filename;
}
