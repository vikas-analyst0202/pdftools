/**
 * PDF Tools Logic using pdf-lib
 * Handles Merge, Split, and Compress operations entirely client-side.
 */

const PDFTools = {
    /**
     * Merge multiple PDF files into one.
     * @param {File[]} files - Array of PDF File objects
     * @returns {Promise<Blob>} - Resulting merged PDF as a Blob
     */
    async merge(files, options = {}) {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        const mergedPdf = await PDFDocument.create();
        const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
        const boldFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);

        const tocEntries = [];
        let totalPagesProcessed = 0;

        // Add 1 page for TOC later if requested, we'll keep track of where it starts
        // Simpler to add documents first and then add TOC at the beginning

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const sourcePageCount = pdf.getPageCount();
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

            // Record start page for TOC (considering TOC page will be index 0)
            const startPageIndex = options.toc ? totalPagesProcessed + 1 : totalPagesProcessed;
            tocEntries.push({ title: file.name, pageIndex: startPageIndex });

            copiedPages.forEach((page, i) => {
                const { width, height } = page.getSize();

                // Add Source Filename
                if (options.filename) {
                    page.drawText(`Source: ${file.name}`, {
                        x: 50,
                        y: 20,
                        size: 9,
                        font: font,
                        color: rgb(0.5, 0.5, 0.5),
                    });
                }

                // Add Original Page Numbers
                if (options.origPages) {
                    page.drawText(`original - ${i + 1}/${sourcePageCount}`, {
                        x: width / 2 - 40,
                        y: 20,
                        size: 9,
                        font: font,
                        color: rgb(0.5, 0.5, 0.5),
                    });
                }

                mergedPdf.addPage(page);
                totalPagesProcessed++;
            });
        }

        // Add Final Page Numbers (sequential)
        if (options.finalPages) {
            const pages = mergedPdf.getPages();
            pages.forEach((page, i) => {
                const { width, height } = page.getSize();
                page.drawText(`Page ${i + 1} of ${totalPagesProcessed}`, {
                    x: width - 100,
                    y: 20,
                    size: 9,
                    font: font,
                    color: rgb(0.5, 0.5, 0.5),
                });
            });
        }

        // Add TOC at the beginning
        if (options.toc) {
            const tocPage = mergedPdf.insertPage(0);
            const { width, height } = tocPage.getSize();

            tocPage.drawText('Table of Contents', {
                x: 50,
                y: height - 100,
                size: 24,
                font: boldFont,
                color: rgb(0, 0, 0),
            });

            tocEntries.forEach((entry, idx) => {
                const yPos = height - 150 - (idx * 25);

                // Draw text
                tocPage.drawText(`${entry.title} (Page ${entry.pageIndex + 1})`, {
                    x: 70,
                    y: yPos,
                    size: 14,
                    font: font,
                    color: rgb(0, 0, 1), // Blue for links
                });

                // Add Link (Internal Destination)
                // This adds a clickable rectangular area over the text
                const textWidth = font.widthOfTextAtSize(`${entry.title} (Page ${entry.pageIndex + 1})`, 14);
                const linkRect = {
                    x: 70,
                    y: yPos - 2,
                    width: textWidth,
                    height: 16,
                };

                // Create link annotation
                const linkAnnotation = mergedPdf.context.obj({
                    Type: 'Annot',
                    Subtype: 'Link',
                    Rect: [linkRect.x, linkRect.y, linkRect.x + linkRect.width, linkRect.y + linkRect.height],
                    Border: [0, 0, 0],
                    C: [0, 0, 1], // Blue border color (though Border is 0)
                    Dest: [mergedPdf.getPages()[entry.pageIndex].ref, 'XYZ', null, null, null],
                });

                const linkAnnRef = mergedPdf.context.register(linkAnnotation);
                const annots = tocPage.node.get(PDFLib.PDFName.of('Annots'));
                if (annots) {
                    annots.push(linkAnnRef);
                } else {
                    tocPage.node.set(PDFLib.PDFName.of('Annots'), mergedPdf.context.obj([linkAnnRef]));
                }
            });
        }

        const pdfBytes = await mergedPdf.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Split a PDF into individual pages or ranges.
     * @param {File} file - Source PDF File object
     * @param {string} range - Optional range string (e.g., "1-5, 1, 3" creates 3 PDFs)
     * @returns {Promise<Blob[]>} - Array of Blobs (one for each extracted part)
     */
    async split(file, range) {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer);
        const pageCount = srcPdf.getPageCount();

        // If no range specified, split into individual pages
        if (!range || range.trim() === '') {
            const blobs = [];
            for (let i = 0; i < pageCount; i++) {
                const newDoc = await PDFDocument.create();
                const [copiedPage] = await newDoc.copyPages(srcPdf, [i]);
                newDoc.addPage(copiedPage);
                const bytes = await newDoc.save();
                blobs.push(new Blob([bytes], { type: 'application/pdf' }));
            }
            return blobs;
        }

        // Parse range and create SEPARATE PDFs for each comma-separated part
        // e.g., "1-5, 1, 3" creates 3 PDFs
        const parts = range.split(',').map(p => p.trim()).filter(p => p);
        const blobs = [];

        for (const part of parts) {
            const indices = this._parseRangePart(part, pageCount);
            if (indices.length > 0) {
                const newDoc = await PDFDocument.create();
                const copiedPages = await newDoc.copyPages(srcPdf, indices);
                copiedPages.forEach(p => newDoc.addPage(p));
                const bytes = await newDoc.save();
                blobs.push(new Blob([bytes], { type: 'application/pdf' }));
            }
        }

        return blobs;
    },

    /**
     * "Compress" PDF by removing unused objects and optimizing page structure.
     * Note: Purely client-side compression is limited compared to server-side.
     * @param {File} file - Source PDF File object
     * @returns {Promise<Blob>} - Optimized PDF Blob
     */
    async compress(file, options = {}) {
        const { PDFDocument } = PDFLib;
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        // 1. Strip Metadata & Annotations
        if (options.strip) {
            pdfDoc.setTitle('');
            pdfDoc.setAuthor('');
            pdfDoc.setSubject('');
            pdfDoc.setKeywords([]);
            pdfDoc.setProducer('');
            pdfDoc.setCreator('');

            const pages = pdfDoc.getPages();
            pages.forEach(page => {
                if (page.node.has(PDFLib.PDFName.of('Annots'))) {
                    page.node.delete(PDFLib.PDFName.of('Annots'));
                }
            });
        }

        // 2. Flatten Form Fields
        if (options.flatten) {
            const form = pdfDoc.getForm();
            try {
                form.flatten();
            } catch (e) {
                console.warn('Form flattening skipped', e);
            }
        }

        // 3. Image Optimization & Grayscale
        // In a real-world scenario, we'd extract and re-compress images. 
        // For this version, we will focus on the highly effective useObjectStreams 
        // and structural cleanup which pdf-lib handles very well.

        const pdfBytes = await pdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            updateFieldAppearances: false
        });

        return new Blob([pdfBytes], { type: 'application/pdf' });
    },

    /**
     * Helper to parse range strings like "1-3, 5, 7-10"
     * Returns 0-indexed page numbers.
     */
    _parseRange(rangeStr, totalPages) {
        const pages = new Set();
        const parts = rangeStr.split(',').map(p => p.trim());

        parts.forEach(part => {
            if (part.includes('-')) {
                const [start, end] = part.split('-').map(Number);
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= totalPages) pages.add(i - 1);
                }
            } else {
                const p = Number(part);
                if (p >= 1 && p <= totalPages) pages.add(p - 1);
            }
        });

        return Array.from(pages).sort((a, b) => a - b);
    },

    /**
     * Helper to parse a SINGLE range part like "1-5" or "3"
     * Returns 0-indexed page numbers for this part only.
     */
    _parseRangePart(part, totalPages) {
        const pages = [];

        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            for (let i = start; i <= end; i++) {
                if (i >= 1 && i <= totalPages) pages.push(i - 1);
            }
        } else {
            const p = Number(part);
            if (p >= 1 && p <= totalPages) pages.push(p - 1);
        }

        return pages;
    }
};

window.PDFTools = PDFTools;
