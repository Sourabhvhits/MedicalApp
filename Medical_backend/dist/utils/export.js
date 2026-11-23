"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCsv = sendCsv;
exports.sendExcel = sendExcel;
exports.sendPdf = sendPdf;
exports.sendExport = sendExport;
const exceljs_1 = __importDefault(require("exceljs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const time_1 = require("./time");
const cellValue = (row, key) => {
    const value = key.split('.').reduce((acc, part) => {
        if (acc && typeof acc === 'object')
            return acc[part];
        return undefined;
    }, row);
    if (value instanceof Date)
        return (0, time_1.dayjs)(value).format('YYYY-MM-DD');
    if (value === null || value === undefined)
        return '';
    return value;
};
const escapeCsv = (value) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
function sendCsv(res, options) {
    const lines = [
        options.columns.map((column) => escapeCsv(column.header)).join(','),
        ...options.rows.map((row) => options.columns.map((column) => escapeCsv(cellValue(row, column.key))).join(',')),
    ];
    if (options.totals) {
        lines.push(options.columns
            .map((column, index) => index === 0 ? 'TOTAL' : escapeCsv(options.totals?.[column.key] ?? ''))
            .join(','));
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename}.csv"`);
    // BOM so Excel opens UTF-8 (₹, names) correctly.
    res.send(`﻿${lines.join('\n')}`);
}
async function sendExcel(res, options) {
    const workbook = new exceljs_1.default.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(options.title.slice(0, 30));
    sheet.mergeCells(1, 1, 1, options.columns.length);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = options.title;
    titleCell.font = { size: 14, bold: true };
    if (options.subtitle) {
        sheet.mergeCells(2, 1, 2, options.columns.length);
        const subtitleCell = sheet.getCell(2, 1);
        subtitleCell.value = options.subtitle;
        subtitleCell.font = { size: 10, color: { argb: 'FF666666' } };
    }
    const headerRowIndex = options.subtitle ? 4 : 3;
    const headerRow = sheet.getRow(headerRowIndex);
    options.columns.forEach((column, index) => {
        const cell = headerRow.getCell(index + 1);
        cell.value = column.header;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
        cell.alignment = { vertical: 'middle', horizontal: column.numeric ? 'right' : 'left' };
        sheet.getColumn(index + 1).width = column.width ?? Math.max(14, column.header.length + 4);
    });
    headerRow.commit();
    options.rows.forEach((row, rowIndex) => {
        const sheetRow = sheet.getRow(headerRowIndex + 1 + rowIndex);
        options.columns.forEach((column, columnIndex) => {
            const cell = sheetRow.getCell(columnIndex + 1);
            const value = cellValue(row, column.key);
            cell.value = column.numeric ? Number(value || 0) : value;
            if (column.numeric) {
                cell.numFmt = '#,##0.00';
                cell.alignment = { horizontal: 'right' };
            }
        });
        sheetRow.commit();
    });
    if (options.totals) {
        const totalRow = sheet.getRow(headerRowIndex + 1 + options.rows.length);
        options.columns.forEach((column, index) => {
            const cell = totalRow.getCell(index + 1);
            cell.value = index === 0 ? 'TOTAL' : column.numeric ? Number(options.totals?.[column.key] ?? 0) : '';
            cell.font = { bold: true };
            if (column.numeric)
                cell.numFmt = '#,##0.00';
        });
        totalRow.commit();
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
}
function sendPdf(res, options) {
    const doc = new pdfkit_1.default({ size: 'A4', layout: 'landscape', margin: 32 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${options.filename}.pdf"`);
    doc.pipe(res);
    doc.fontSize(16).fillColor('#0f172a').text(options.title);
    if (options.subtitle)
        doc.fontSize(9).fillColor('#64748b').text(options.subtitle);
    doc.moveDown(0.6);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const totalWeight = options.columns.reduce((sum, column) => sum + (column.width ?? 16), 0);
    const widths = options.columns.map((column) => ((column.width ?? 16) / totalWeight) * pageWidth);
    const drawRow = (values, bold, background) => {
        const y = doc.y;
        const height = 18;
        if (background) {
            doc.rect(doc.page.margins.left, y - 2, pageWidth, height).fill(background);
        }
        let x = doc.page.margins.left;
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8);
        values.forEach((value, index) => {
            doc
                .fillColor(background === '#0f766e' ? '#ffffff' : '#0f172a')
                .text(String(value ?? ''), x + 3, y + 3, {
                width: widths[index] - 6,
                align: options.columns[index].numeric ? 'right' : 'left',
                ellipsis: true,
                lineBreak: false,
            });
            x += widths[index];
        });
        doc.y = y + height;
    };
    drawRow(options.columns.map((column) => column.header), true, '#0f766e');
    options.rows.forEach((row, index) => {
        if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
            doc.addPage();
            drawRow(options.columns.map((column) => column.header), true, '#0f766e');
        }
        drawRow(options.columns.map((column) => {
            const value = cellValue(row, column.key);
            return column.numeric ? Number(value || 0).toFixed(2) : value;
        }), false, index % 2 === 0 ? '#f8fafc' : undefined);
    });
    if (options.totals) {
        drawRow(options.columns.map((column, index) => index === 0
            ? 'TOTAL'
            : column.numeric
                ? Number(options.totals?.[column.key] ?? 0).toFixed(2)
                : ''), true, '#e2e8f0');
    }
    doc
        .moveDown(1)
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(`Generated ${(0, time_1.dayjs)().format('DD MMM YYYY HH:mm')}`, { align: 'right' });
    doc.end();
}
/** Dispatches to the right writer, or returns false for a JSON response. */
async function sendExport(res, format, options) {
    if (format === 'csv') {
        sendCsv(res, options);
        return true;
    }
    if (format === 'excel') {
        await sendExcel(res, options);
        return true;
    }
    if (format === 'pdf') {
        sendPdf(res, options);
        return true;
    }
    return false;
}
//# sourceMappingURL=export.js.map